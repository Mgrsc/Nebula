import { LOGO_FETCH_TIMEOUT_MS, MAX_LOGO_CANDIDATES } from "../constants/config";
import { fetchWithTimeout } from "../helpers/fetch";
import { log } from "./logger";

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
    return u.hostname.toLowerCase();
  } catch {
    try {
      const u = new URL(`https://${value}`);
      return u.hostname.toLowerCase();
    } catch {
      const m = value.trim().match(/^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/);
      return m ? m[0].toLowerCase() : null;
    }
  }
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

function normalizeCandidateUrl(value: string) {
  try {
    const u = new URL(value);
    u.hash = "";
    return u.toString();
  } catch {
    return value;
  }
}

function iconRelPriority(rel: string) {
  if (rel.includes("apple-touch-icon")) return 0;
  if (rel.includes("shortcut icon")) return 1;
  if (rel === "icon") return 2;
  if (rel.includes("icon")) return 3;
  return 9;
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

  const out: Array<LogoCandidate & { priority: number }> = [];

  const linkTags = head.match(/<link\b[^>]*>/gi) ?? [];
  for (const tag of linkTags) {
    const rel = extractTagAttr(tag, "rel").toLowerCase();
    if (!rel.includes("icon")) continue;
    const href = extractTagAttr(tag, "href");
    if (!href) continue;
    const abs = absolutize(res.url, href);
    if (!abs) continue;
    if (!looksLikeImageUrl(abs)) continue;
    out.push({ url: normalizeCandidateUrl(abs), title: rel, source: "site", priority: iconRelPriority(rel) });
  }

  out.sort((a, b) => a.priority - b.priority);

  return uniqBy(out, (x) => x.url)
    .slice(0, 6)
    .map(({ url: iconUrl, title, source }) => ({ url: iconUrl, title, source }));
}

function providerCandidates(domain: string): LogoCandidate[] {
  const d = domain.trim().toLowerCase();
  if (!d) return [];
  return [
    {
      url: `https://${d}/favicon.ico`,
      title: d,
      source: "site:fallback"
    },
    {
      url: `https://${d}/apple-touch-icon.png`,
      title: d,
      source: "site:fallback"
    },
    {
      url: `https://${d}/apple-touch-icon-precomposed.png`,
      title: d,
      source: "site:fallback"
    },
    {
      url: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(d)}&sz=128`,
      title: d,
      source: "favicon:google"
    },
    {
      url: `https://icons.duckduckgo.com/ip3/${encodeURIComponent(d)}.ico`,
      title: d,
      source: "favicon:duckduckgo"
    }
  ];
}

export async function searchLogoCandidates(args: { q?: string | null; url?: string | null }) {
  const urlInput = (args.url ?? "").trim();
  const qInput = (args.q ?? "").trim();
  const domain = getDomainFromUrl(urlInput) ?? getDomainFromUrl(qInput);

  const candidates: LogoCandidate[] = [];
  let siteCount = 0;
  if (urlInput) {
    try {
      const site = await siteCandidates(urlInput);
      candidates.push(...site);
      siteCount = site.length;
    } catch (error: any) {
      log("warn", "logos.search", "site icon extraction failed", {
        url: urlInput,
        error: String(error?.message ?? error)
      });
    }
  }

  const provider = domain ? providerCandidates(domain) : [];
  candidates.push(...provider);

  const items = uniqBy(candidates, (c) => normalizeCandidateUrl(c.url)).slice(0, MAX_LOGO_CANDIDATES);

  log("debug", "logos.search", "logo candidates generated", {
    input_url: urlInput || null,
    input_q: qInput || null,
    domain: domain ?? null,
    site_candidates: siteCount,
    provider_candidates: provider.length,
    returned_candidates: items.length
  });

  return items;
}
