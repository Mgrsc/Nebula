import { useEffect, useMemo, useState } from "react";
import Modal from "./Modal";
import DatePicker from "./DatePicker";
import ComboBox from "./ComboBox";
import { coerceLanguage, strings } from "../i18n";
import { supportedCurrencies } from "../data/currencies";
import { normalizeCurrency, isValidCurrency } from "../utils/helpers";
import { useAuthHeaders } from "../contexts/AuthContext";
import { apiFetch } from "../utils/api";
import type {
  ApiSettingsResponse,
  ApiSubscription,
  ApiSubscriptionUpsertRequest,
  ApiWebhooksListResponse,
  ApiWebhookChannel
} from "../../../shared/api";

type LogoCandidate = { url: string; title?: string; source: string };
type LogosResponse = { items: LogoCandidate[] };
type SubscriptionRow = ApiSubscription;
type WebhookChannel = ApiWebhookChannel;

function parseISODate(value: string): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return { year, month, day };
}

function formatISODate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addDaysISO(dateISO: string, days: number): string | null {
  const p = parseISODate(dateISO);
  if (!p) return null;
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function addMonthsISO(dateISO: string, months: number): string | null {
  const p = parseISODate(dateISO);
  if (!p) return null;
  const targetMonth = p.month - 1 + months;
  const year = p.year + Math.floor(targetMonth / 12);
  const monthIndex = ((targetMonth % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const day = Math.min(p.day, lastDay);
  return formatISODate(year, monthIndex + 1, day);
}

function addYearsISO(dateISO: string, years: number): string | null {
  return addMonthsISO(dateISO, years * 12);
}

function computeNextDueDateForCycle(
  startDate: string,
  paymentCycle: string,
  customDays: string
): string | null {
  if (!parseISODate(startDate)) return null;
  if (paymentCycle === "monthly") return addMonthsISO(startDate, 1);
  if (paymentCycle === "yearly") return addYearsISO(startDate, 1);
  if (paymentCycle === "custom_days") {
    const days = Number(customDays);
    if (!Number.isFinite(days) || days <= 0) return null;
    return addDaysISO(startDate, Math.trunc(days));
  }
  return null;
}

function diffDaysISO(startDate: string, endDate: string): number | null {
  const s = parseISODate(startDate);
  const e = parseISODate(endDate);
  if (!s || !e) return null;
  const start = Date.UTC(s.year, s.month - 1, s.day);
  const end = Date.UTC(e.year, e.month - 1, e.day);
  return Math.round((end - start) / 86_400_000);
}

function todayLocalISO(): string {
  const now = new Date();
  return formatISODate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

const commonPaymentMethods = [
  "Visa",
  "Mastercard",
  "American Express",
  "PayPal",
  "Alipay",
  "WeChat Pay",
  "Apple Pay",
  "Google Pay",
  "Bank Transfer",
  "Debit Card",
  "Credit Card",
  "Cryptocurrency"
];

export default function SubscriptionModal(props: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  initial?: SubscriptionRow | null;
}) {
  const [settings, setSettings] = useState<ApiSettingsResponse | null>(null);
  const authHeaders = useAuthHeaders();
  const lang = coerceLanguage(settings?.language);
  const t = strings[lang];

  const isEdit = Boolean(props.initial?.id);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [url, setUrl] = useState("");
  const [logoUrl, setLogoUrl] = useState<string>("");
  const [logoOptions, setLogoOptions] = useState<LogoCandidate[]>([]);
  const [price, setPrice] = useState("10");
  const [currency, setCurrency] = useState<string>("USD");
  const [currencyInput, setCurrencyInput] = useState<string>("");
  const [paymentCycle, setPaymentCycle] = useState("");
  const [customDays, setCustomDays] = useState("30");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");

  const [notifyEnabled, setNotifyEnabled] = useState(false);
  const [notifyDays, setNotifyDays] = useState("7,3,1,0");
  const [notifyTime, setNotifyTime] = useState("09:00");
  const [webhooks, setWebhooks] = useState<WebhookChannel[]>([]);
  const [selectedWebhookIds, setSelectedWebhookIds] = useState<number[]>([]);

  const [loadingLogos, setLoadingLogos] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastModified, setLastModified] = useState<"start" | "end" | "cycle" | null>(null);

  const daysInfo = useMemo(() => {
    if (!startDate || !endDate) return null;
    const totalDays = diffDaysISO(startDate, endDate);
    const daysLeft = diffDaysISO(todayLocalISO(), endDate);
    if (totalDays === null || daysLeft === null) return null;
    return { totalDays, daysLeft };
  }, [startDate, endDate]);

  const effectiveCurrency = useMemo(() => normalizeCurrency(currency), [currency]);

  useEffect(() => {
    if (!props.open) return;
    setError(null);
    setLogoOptions([]);
    apiFetch<ApiSettingsResponse>("/api/settings", { headers: authHeaders })
      .then((s) => setSettings(s))
      .catch(() => {});

    apiFetch<ApiWebhooksListResponse>("/api/webhooks", { headers: authHeaders })
      .then((d) => setWebhooks(d.items.filter((x) => x.enabled)))
      .catch(() => setWebhooks([]));
  }, [props.open]);

  useEffect(() => {
    if (!props.open) return;
    if (!props.initial) {
      setName("");
      setIcon("");
      setUrl("");
      setLogoUrl("");
      setPrice("10");
      setCurrency((settings?.baseCurrency || "USD"));
      setCurrencyInput("");
      setPaymentCycle("");
      setCustomDays("30");
      setStartDate("");
      setEndDate("");
      setPaymentMethod("");
      setNotifyEnabled(false);
      setNotifyDays("7,3,1,0");
      setNotifyTime("09:00");
      setSelectedWebhookIds([]);
      return;
    }

    const s = props.initial;
    setName(s.name ?? "");
    setIcon(s.icon ?? "");
    setUrl(s.url ?? "");
    setLogoUrl(s.logo_url ?? "");
    setPrice(String(s.price ?? 0));
    const cur = normalizeCurrency(s.currency ?? (settings?.baseCurrency || "USD"));
    setCurrency(cur);
    setCurrencyInput("");
    setPaymentCycle(s.payment_cycle ?? "");
    setCustomDays(String(s.custom_days ?? 30));
    setStartDate(s.start_date ?? "");
    setEndDate(s.next_due_date ?? "");
    setPaymentMethod(s.payment_method ?? "");
    setNotifyEnabled(Boolean(s.notify_enabled));
    setNotifyDays(s.notify_days ?? "7,3,1,0");
    setNotifyTime(s.notify_time ?? "09:00");
    setSelectedWebhookIds(Array.isArray(s.notify_channel_ids) ? s.notify_channel_ids : []);
  }, [props.open, props.initial, settings?.baseCurrency]);

  useEffect(() => {
    if (!props.open || lastModified !== "end") return;
    if (!endDate || !paymentCycle) return;

    try {
      if (!parseISODate(endDate)) return;
      if (paymentCycle === "monthly") {
        const nextStart = addMonthsISO(endDate, -1);
        if (!nextStart) return;
        setStartDate(nextStart);
        return;
      }
      if (paymentCycle === "yearly") {
        const nextStart = addYearsISO(endDate, -1);
        if (!nextStart) return;
        setStartDate(nextStart);
        return;
      }
      if (paymentCycle === "custom_days") {
        const days = Number(customDays);
        if (!Number.isFinite(days) || days <= 0) return;
        const nextStart = addDaysISO(endDate, -Math.trunc(days));
        if (!nextStart) return;
        setStartDate(nextStart);
      }
    } catch (e) {
    }
  }, [endDate, paymentCycle, customDays, lastModified, props.open]);

  useEffect(() => {
    if (!props.open || lastModified !== "start") return;
    if (!startDate || !paymentCycle) return;

    try {
      const nextDue = computeNextDueDateForCycle(startDate, paymentCycle, customDays);
      if (!nextDue) return;
      setEndDate(nextDue);
    } catch (e) {
    }
  }, [startDate, paymentCycle, customDays, lastModified, props.open]);

  useEffect(() => {
    if (!props.open || lastModified !== "cycle") return;
    if (!startDate || !paymentCycle) return;

    const nextDue = computeNextDueDateForCycle(startDate, paymentCycle, customDays);
    if (!nextDue) return;
    setEndDate(nextDue);
  }, [startDate, paymentCycle, customDays, lastModified, props.open]);

  useEffect(() => {
    if (!props.open) return;
    if (lastModified === "cycle") return;
    if (!startDate || !endDate) return;
    if (paymentCycle) return;

    try {
      const daysDiff = diffDaysISO(startDate, endDate);
      if (daysDiff === null) return;

      if (addMonthsISO(startDate, 1) === endDate) {
        setPaymentCycle("monthly");
      } else if (addYearsISO(startDate, 1) === endDate) {
        setPaymentCycle("yearly");
      } else if (daysDiff > 0) {
        setPaymentCycle("custom_days");
        setCustomDays(String(daysDiff));
      }
    } catch (e) {
    }
  }, [startDate, endDate, paymentCycle, lastModified, props.open]);

  async function searchLogos() {
    setLoadingLogos(true);
    setError(null);
    try {
      const u = new URL("/api/logos/search", window.location.origin);
      if (name.trim()) u.searchParams.set("q", name.trim());
      if (url.trim()) u.searchParams.set("url", url.trim());
      const data = await apiFetch<LogosResponse>(u.toString());
      setLogoOptions(data.items);
      if (!logoUrl && data.items[0]?.url) setLogoUrl(data.items[0].url);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoadingLogos(false);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      if (!name.trim()) throw new Error("Name is required");
      if (!isValidCurrency(effectiveCurrency)) throw new Error("Invalid currency code");

      const payload: ApiSubscriptionUpsertRequest = {
        icon: icon.trim() || undefined,
        name: name.trim(),
        url: url.trim() || undefined,
        logoUrl: logoUrl.trim() || undefined,
        price: Number(price),
        currency: effectiveCurrency,
        paymentCycle,
        customDays: paymentCycle === "custom_days" ? Number(customDays) : undefined,
        startDate,
        nextDueDate: endDate.trim() || undefined,
        paymentMethod: paymentMethod.trim() || undefined,
        notifyEnabled,
        notifyDays: notifyDays.trim() || undefined,
        notifyTime: notifyTime.trim() || undefined,
        notifyChannelIds: selectedWebhookIds
      };

      await apiFetch<{ ok: true }>(isEdit ? `/api/subs/${props.initial!.id}` : "/api/subs", {
        method: isEdit ? "PUT" : "POST",
        headers: { ...authHeaders, "content-type": "application/json" },
        body: JSON.stringify(payload)
      });

      props.onSaved();
      props.onClose();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  }

  async function del() {
    if (!isEdit) return;
    const ok = confirm(lang === "en" ? "Delete this subscription?" : "确定删除这个订阅吗？");
    if (!ok) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch<{ ok: true }>(`/api/subs/${props.initial!.id}`, { method: "DELETE", headers: authHeaders });
      props.onSaved();
      props.onClose();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  }

  const title = isEdit
    ? lang === "en"
      ? "Edit subscription"
      : "编辑订阅"
    : lang === "en"
      ? "Add subscription"
      : "添加订阅";

  return (
    <Modal open={props.open} onClose={props.onClose} title={title}>
      {error ? (
        <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-100">{error}</div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="text-xs text-white/60">{lang === "en" ? "Name" : "订阅名称"}</label>
          <input
            className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="AWS EC2"
          />
          <div className="mt-3">
            <label className="text-xs text-white/60">{lang === "en" ? "Icon (optional)" : "图标（可选）"}</label>
            <input
              className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder={lang === "en" ? "e.g. ☁️" : "例如 ☁️"}
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-white/60">{lang === "en" ? "URL" : "订阅 URL"}</label>
          <input
            className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
          />
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-white">{lang === "en" ? "Logo" : "订阅 Logo"}</div>
            <div className="mt-1 text-xs text-white/60">
              {lang === "en"
                ? "Search by name (Wikipedia) and show candidates. You can also paste a logo URL."
                : "按名称联网搜索（Wikipedia/站点 icon）并提供候选图片；也可以直接粘贴图片链接。"}
            </div>
          </div>
          <button
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10 disabled:opacity-50"
            onClick={searchLogos}
            disabled={loadingLogos}
          >
            {loadingLogos ? (lang === "en" ? "Searching..." : "搜索中...") : lang === "en" ? "Search logos" : "搜索 Logo"}
          </button>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-slate-950 p-3">
            <div className="h-10 w-10 overflow-hidden rounded-lg bg-white/5">
              {logoUrl ? (
                <img src={logoUrl} alt="logo" className="h-10 w-10 object-contain" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center text-white/40">{icon.trim() || "📦"}</div>
              )}
            </div>
            <input
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/30"
              placeholder={lang === "en" ? "Logo image URL" : "Logo 图片 URL"}
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
            />
          </div>
          <div className="text-xs text-white/50">
            {lang === "en" ? "Tip: provide URL to improve results." : "提示：填写订阅 URL 会得到更可靠的 favicon/logo。"}
          </div>
        </div>

        {logoOptions.length ? (
          <div className="mt-4 grid grid-cols-3 gap-2 md:grid-cols-6">
            {logoOptions.map((c) => (
              <button
                key={c.url}
                className={[
                  "group rounded-lg border p-2",
                  c.url === logoUrl ? "border-sky-400 bg-sky-500/10" : "border-white/10 bg-white/0 hover:bg-white/5"
                ].join(" ")}
                onClick={() => setLogoUrl(c.url)}
                title={`${c.title ?? ""} (${c.source})`}
              >
                <img src={c.url} alt={c.title ?? "logo"} className="h-10 w-full object-contain" />
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-3 text-xs text-white/50">
            {lang === "en"
              ? "No candidates yet. Tip: paste the subscription URL and click “Search logos”."
              : "暂无候选图片。建议填写订阅 URL，然后点击“搜索 Logo”。"}
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="text-xs text-white/60">{lang === "en" ? "Price" : "价格"}</label>
          <input
            type="number"
            step="0.01"
            className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="text-xs text-white/60">{lang === "en" ? "Currency" : "货币单位"}</label>
            <a
              className="text-xs text-sky-300 hover:text-sky-200"
              href="https://www.exchangerate-api.com/docs/supported-currencies"
              target="_blank"
              rel="noreferrer"
            >
              {t.currencyDocs}
            </a>
          </div>
          <ComboBox
            className="mt-2"
            value={currencyInput || currency || "USD"}
            onChange={(val) => {
              setCurrencyInput(val);
              if (val.trim()) {
                setCurrency(normalizeCurrency(val));
              }
            }}
            placeholder={currency || "USD"}
            options={supportedCurrencies.map(c => ({
              value: c.code,
              label: `${c.code} — ${c.name} (${c.country})`
            }))}
          />
        </div>

        <div>
          <label className="text-xs text-white/60">{lang === "en" ? "Payment cycle" : "支付频率"}</label>
          <div className="relative mt-2">
            <select
              className="w-full appearance-none rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-sky-500/50 transition-colors"
              value={paymentCycle}
              onChange={(e) => {
                setPaymentCycle(e.target.value);
                setLastModified("cycle");
              }}
            >
              <option value="">{lang === "en" ? "Select cycle..." : "选择支付频率..."}</option>
              <option value="monthly">{lang === "en" ? "Monthly" : "每月"}</option>
              <option value="yearly">{lang === "en" ? "Yearly" : "每年"}</option>
              <option value="custom_days">{lang === "en" ? "Custom (days)" : "自定义（天）"}</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-white/40">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m6 9 6 6 6-6"/>
              </svg>
            </div>
          </div>
          {paymentCycle === "custom_days" ? (
            <input
              type="number"
              className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
              value={customDays}
              onChange={(e) => setCustomDays(e.target.value)}
              placeholder="30"
            />
          ) : null}
        </div>

        <div>
          <label className="text-xs text-white/60">{lang === "en" ? "Start date" : "开始时间"}</label>
          <DatePicker
            lang={lang}
            value={parseISODate(startDate) ? startDate : ""}
            onChange={(iso) => {
              setStartDate(iso);
              setLastModified("start");
            }}
            className="mt-2"
          />
        </div>

        <div>
          <label className="text-xs text-white/60">{lang === "en" ? "End date / Next due" : "结束时间 / 下次到期"}</label>
          <DatePicker
            lang={lang}
            value={parseISODate(endDate) ? endDate : ""}
            onChange={(iso) => {
              setEndDate(iso);
              setLastModified("end");
            }}
            className="mt-2"
          />
          {daysInfo && (
            <div className="mt-2 text-xs text-white/60">
              {lang === "en"
                ? `Total: ${daysInfo.totalDays} days | Remaining: ${daysInfo.daysLeft} days`
                : `总计：${daysInfo.totalDays} 天 | 剩余：${daysInfo.daysLeft} 天`}
            </div>
          )}
        </div>

        <div>
          <label className="text-xs text-white/60">{lang === "en" ? "Payment method" : "支付方式"}</label>
          <ComboBox
            className="mt-2"
            value={paymentMethod}
            onChange={setPaymentMethod}
            placeholder={lang === "en" ? "Select or enter custom" : "选择或输入自定义"}
            options={commonPaymentMethods.map(method => ({
              value: method,
              label: method
            }))}
          />
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-white">{lang === "en" ? "Notifications" : "通知"}</div>
            <div className="mt-1 text-xs text-white/60">
              {lang === "en"
                ? "Configure channels in Settings; choose which ones apply to this subscription."
                : "在设置里先配置 Webhook 渠道，然后在这里选择用于该订阅的渠道。"}
            </div>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={notifyEnabled}
              onChange={(e) => setNotifyEnabled(e.target.checked)}
              className="h-4 w-4 accent-sky-400"
            />
            <span className="text-sm text-white">{notifyEnabled ? "ON" : "OFF"}</span>
          </label>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="text-xs text-white/60">{lang === "en" ? "Notify days (comma)" : "通知时间（天，逗号分隔）"}</label>
            <input
              className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
              value={notifyDays}
              onChange={(e) => setNotifyDays(e.target.value)}
              placeholder="7,3,1,0"
              disabled={!notifyEnabled}
            />
          </div>
          <div>
            <label className="text-xs text-white/60">{lang === "en" ? "Notify time" : "通知时刻"}</label>
            <input
              type="time"
              className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
              value={notifyTime}
              onChange={(e) => setNotifyTime(e.target.value)}
              disabled={!notifyEnabled}
            />
          </div>
        </div>

        <div className="mt-3">
          <div className="text-xs text-white/60">{lang === "en" ? "Channels" : "通知渠道"}</div>
          {webhooks.length ? (
            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
              {webhooks.map((w) => {
                const checked = selectedWebhookIds.includes(w.id);
                return (
                  <label key={w.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedWebhookIds((prev) => [...prev, w.id]);
                        else setSelectedWebhookIds((prev) => prev.filter((id) => id !== w.id));
                      }}
                      disabled={!notifyEnabled}
                      className="h-4 w-4 accent-sky-400"
                    />
                    <div className="min-w-0">
                      <div className="truncate text-white">{w.name}</div>
                      <div className="truncate text-xs text-white/50">{w.url}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          ) : (
            <div className="mt-2 text-xs text-white/50">
              {lang === "en" ? "No webhook channels yet. Add them in Settings." : "还没有 Webhook 渠道，请先去 Settings 添加。"}
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 flex items-center justify-end gap-2">
        {isEdit ? (
          <button
            className="mr-auto rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100 hover:bg-red-500/20 disabled:opacity-50"
            onClick={del}
            disabled={saving}
          >
            {lang === "en" ? "Delete" : "删除"}
          </button>
        ) : null}
        <button
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10"
          onClick={props.onClose}
        >
          {lang === "en" ? "Cancel" : "取消"}
        </button>
        <button
          className="rounded-lg bg-sky-500 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-sky-400 disabled:opacity-50"
          onClick={save}
          disabled={saving}
        >
          {saving ? t.saving : isEdit ? (lang === "en" ? "Save" : "保存") : lang === "en" ? "Add" : "添加"}
        </button>
      </div>
    </Modal>
  );
}
