import { LOGO_FETCH_TIMEOUT_MS, MAX_LOGO_CANDIDATES } from "../constants/config";
import { fetchWithTimeout } from "../helpers/fetch";

type WikiSearchItem = { pageid: number; title: string };

function uniqBy<T>(items: T[], key: (x: T) => string) {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of items) {
    const k = key(it);
    if (!k) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
}

function getDomainFromUrl(value: string) {
  try {
    const u = new URL(value);
    return u.hostname;
  } catch {
    try {
      const u = new URL(`https://${value}`);
      return u.hostname;
    } catch {
      const m = value.trim().match(/^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/);
      return m ? m[0] : null;
    }
  }
}

async function wikiSearch(lang: string, q: string): Promise<WikiSearchItem[]> {
  const api = `https://${lang}.wikipedia.org/w/api.php`;
  const url = new URL(api);
  url.searchParams.set("action", "query");
  url.searchParams.set("list", "search");
  url.searchParams.set("srsearch", q);
  url.searchParams.set("srlimit", "6");
  url.searchParams.set("format", "json");
  const res = await fetchWithTimeout(
    url.toString(),
    { headers: { "user-agent": "Nebula/0.1 (logo search)" } },
    LOGO_FETCH_TIMEOUT_MS
  );
  if (!res.ok) return [];
  const data = (await res.json()) as any;
  const items = Array.isArray(data?.query?.search) ? (data.query.search as unknown[]) : [];
  return items
    .map((it) => {
      const raw: any = it;
      const pageid = Number(raw?.pageid);
      if (!Number.isFinite(pageid) || pageid <= 0) return null;
      const title = typeof raw?.title === "string" ? raw.title : "";
      return { pageid, title } satisfies WikiSearchItem;
    })
    .filter((x): x is WikiSearchItem => Boolean(x));
}

async function wikiThumbnails(lang: string, pageids: number[]) {
  if (!pageids.length) return [];
  const api = `https://${lang}.wikipedia.org/w/api.php`;
  const url = new URL(api);
  url.searchParams.set("action", "query");
  url.searchParams.set("prop", "pageimages");
  url.searchParams.set("piprop", "thumbnail");
  url.searchParams.set("pithumbsize", "256");
  url.searchParams.set("pageids", pageids.join("|"));
  url.searchParams.set("format", "json");
  const res = await fetchWithTimeout(
    url.toString(),
    { headers: { "user-agent": "Nebula/0.1 (logo search)" } },
    LOGO_FETCH_TIMEOUT_MS
  );
  if (!res.ok) return [];
  const data = (await res.json()) as any;
  const pages = data?.query?.pages ?? {};
  const out: Array<{ url: string; title: string; source: string }> = [];
  for (const p of Object.values(pages)) {
    const page: any = p;
    const src = page?.thumbnail?.source;
    if (typeof src === "string" && src.length) {
      out.push({ url: src, title: page?.title ?? "", source: `wikipedia:${lang}` });
    }
  }
  return out;
}

export type LogoCandidate = { url: string; title?: string; source: string };

function absolutize(base: string, maybeRelative: string) {
  try {
    return new URL(maybeRelative, base).toString();
  } catch {
    return null;
  }
}

function extractHead(html: string) {
  const lower = html.toLowerCase();
  const headStart = lower.indexOf("<head");
  if (headStart === -1) return html.slice(0, 64_000);
  const headEnd = lower.indexOf("</head>");
  const end = headEnd === -1 ? Math.min(html.length, headStart + 64_000) : headEnd + 7;
  return html.slice(headStart, end);
}

function extractTagAttr(tag: string, attr: string) {
  const re = new RegExp(`${attr}\\s*=\\s*("([^"]+)"|'([^']+)'|([^\\s>]+))`, "i");
  const m = tag.match(re);
  return (m?.[2] ?? m?.[3] ?? m?.[4] ?? "").trim();
}

function looksLikeImageUrl(u: string) {
  return /\.(png|jpg|jpeg|webp|svg|ico)(\?|#|$)/i.test(u) || u.startsWith("data:image/");
}

async function siteCandidates(rawUrl: string) {
  if (!rawUrl.trim()) return [] as LogoCandidate[];
  const url = rawUrl.startsWith("http://") || rawUrl.startsWith("https://") ? rawUrl : `https://${rawUrl}`;

  let res: Response;
  try {
    res = await fetchWithTimeout(
      url,
      {
        headers: {
          "user-agent": "Nebula/0.1 (logo search)",
          accept: "text/html,application/xhtml+xml"
        },
        redirect: "follow"
      },
      LOGO_FETCH_TIMEOUT_MS
    );
  } catch {
    return [];
  }
  if (!res.ok) return [];

  let html = "";
  try {
    html = await res.text();
  } catch {
    return [];
  }
  const head = extractHead(html);

  const out: LogoCandidate[] = [];

  const linkTags = head.match(/<link\b[^>]*>/gi) ?? [];
  for (const tag of linkTags) {
    const rel = extractTagAttr(tag, "rel").toLowerCase();
    if (!rel.includes("icon")) continue;
    const href = extractTagAttr(tag, "href");
    if (!href) continue;
    const abs = absolutize(res.url, href);
    if (!abs) continue;
    out.push({ url: abs, title: rel, source: "site" });
  }

  const metaTags = head.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of metaTags) {
    const prop = (extractTagAttr(tag, "property") || extractTagAttr(tag, "name")).toLowerCase();
    if (prop !== "og:image" && prop !== "twitter:image") continue;
    const content = extractTagAttr(tag, "content");
    if (!content) continue;
    const abs = absolutize(res.url, content);
    if (!abs) continue;
    out.push({ url: abs, title: prop, source: "site" });
  }

  return uniqBy(out.filter((x) => looksLikeImageUrl(x.url)), (x) => x.url).slice(0, 6);
}

export async function searchLogoCandidates(args: { q?: string | null; url?: string | null }) {
  const candidates: LogoCandidate[] = [];

  const domain = args.url ? getDomainFromUrl(args.url) : null;
  if (domain) {
    candidates.push({
      url: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`,
      title: domain,
      source: "favicon"
    });
    candidates.push({
      url: `https://favicon.vemetric.com/${encodeURIComponent(domain)}`,
      title: domain,
      source: "favicon.vemetric.com"
    });
    candidates.push({
      url: `https://icons.favicone.com/i/${encodeURIComponent(domain)}/favicon.ico`,
      title: domain,
      source: "icons.favicone.com"
    });
    candidates.push({
      url: `https://icons.duckduckgo.com/ip3/${encodeURIComponent(domain)}.ico`,
      title: domain,
      source: "icons.duckduckgo.com"
    });
    candidates.push({
      url: `https://icon.horse/icon/${domain}`,
      title: domain,
      source: "icon.horse"
    });
    candidates.push({
      url: `https://logo.clearbit.com/${domain}?size=256`,
      title: domain,
      source: "clearbit"
    });
  }

  const q = (args.q ?? "").trim();
  if (q) {
    try {
      const zh = await wikiSearch("zh", q);
      const zhIds = uniqBy(zh, (x) => String(x.pageid)).map((x) => Number(x.pageid));
      candidates.push(...(await wikiThumbnails("zh", zhIds)));
    } catch {}
    try {
      const en = await wikiSearch("en", q);
      const enIds = uniqBy(en, (x) => String(x.pageid)).map((x) => Number(x.pageid));
      candidates.push(...(await wikiThumbnails("en", enIds)));
    } catch {}
  }

  if (args.url) {
    try {
      candidates.push(...(await siteCandidates(args.url)));
    } catch {}
  }

  return uniqBy(candidates, (c) => c.url).slice(0, MAX_LOGO_CANDIDATES);
}
