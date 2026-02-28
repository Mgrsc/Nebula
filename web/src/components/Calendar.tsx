import { useMemo, useState, useRef, useEffect } from "react";
import { coerceLanguage, type Language } from "../i18n";
import { formatMoney } from "../utils/helpers";

type SubLite = { id: number; name: string; next_due_date: string; logo_url?: string | null; url?: string | null; price?: number; currency?: string };
type CalendarLabel = { label: string; kind: "holiday" | "solar_term" };
type LocalizedLabel = { zh: string; en: string };

function Selector(props: {
  value: number;
  options: { value: number; label: string }[];
  onChange: (val: number) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const selectedLabel = props.options.find(o => o.value === props.value)?.label;

  return (
    <div className={`relative ${props.className || ""}`} ref={containerRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 bg-transparent text-sm text-white outline-none cursor-pointer hover:bg-white/10 rounded px-2 py-0.5 font-medium transition-colors"
      >
        {selectedLabel}
        <svg
          className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-50 max-h-60 overflow-y-auto rounded-xl border border-white/10 bg-slate-900/95 backdrop-blur-xl shadow-2xl p-1 custom-scrollbar min-w-[80px] animate-fade-in">
          {props.options.map((opt) => (
            <button
              key={opt.value}
              className={`w-full text-center px-3 py-1.5 text-sm rounded-lg transition-colors ${
                props.value === opt.value ? "bg-sky-500/20 text-sky-400 font-medium" : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
              onClick={() => {
                props.onChange(opt.value);
                setOpen(false);
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const HOLIDAY_LABELS: Record<string, LocalizedLabel> = {
  "01-01": { zh: "元旦", en: "New Year" },
  "04-04": { zh: "清明", en: "Qingming" },
  "05-01": { zh: "劳动节", en: "Labor Day" },
  "10-01": { zh: "国庆", en: "National Day" },
  "10-02": { zh: "国庆", en: "National Day" },
  "10-03": { zh: "国庆", en: "National Day" }
};

const SOLAR_TERM_LABELS: Record<string, LocalizedLabel> = {
  "01-05": { zh: "小寒", en: "Minor Cold" },
  "01-20": { zh: "大寒", en: "Major Cold" },
  "02-03": { zh: "立春", en: "Start of Spring" },
  "02-18": { zh: "雨水", en: "Rain Water" },
  "03-05": { zh: "惊蛰", en: "Awakening" },
  "03-20": { zh: "春分", en: "Spring Equinox" },
  "04-04": { zh: "清明", en: "Pure Brightness" },
  "04-20": { zh: "谷雨", en: "Grain Rain" },
  "05-05": { zh: "立夏", en: "Start of Summer" },
  "05-21": { zh: "小满", en: "Grain Full" },
  "06-05": { zh: "芒种", en: "Grain in Ear" },
  "06-21": { zh: "夏至", en: "Summer Solstice" },
  "07-07": { zh: "小暑", en: "Minor Heat" },
  "07-22": { zh: "大暑", en: "Major Heat" },
  "08-07": { zh: "立秋", en: "Start of Autumn" },
  "08-23": { zh: "处暑", en: "Limit of Heat" },
  "09-07": { zh: "白露", en: "White Dew" },
  "09-23": { zh: "秋分", en: "Autumn Equinox" },
  "10-08": { zh: "寒露", en: "Cold Dew" },
  "10-23": { zh: "霜降", en: "Frost Descent" },
  "11-07": { zh: "立冬", en: "Start of Winter" },
  "11-22": { zh: "小雪", en: "Minor Snow" },
  "12-07": { zh: "大雪", en: "Major Snow" },
  "12-21": { zh: "冬至", en: "Winter Solstice" }
};

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function isoOf(year: number, month: number, day: number) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function labelsOfISO(iso: string, lang: Language): CalendarLabel[] {
  const key = iso.slice(5, 10);
  const locale = lang === "en" ? "en" : "zh";
  const labels: CalendarLabel[] = [];
  const holiday = HOLIDAY_LABELS[key];
  if (holiday) labels.push({ label: holiday[locale], kind: "holiday" });
  const solarTerm = SOLAR_TERM_LABELS[key];
  if (solarTerm) {
    const text = solarTerm[locale];
    if (!labels.some((item) => item.label === text)) labels.push({ label: text, kind: "solar_term" });
  }
  return labels;
}

export default function Calendar(props: {
  lang: Language;
  year: number;
  month: number;
  items: SubLite[];
  selectedISO: string | null;
  onSelectISO: (iso: string) => void;
  onChangeMonth: (year: number, month: number) => void;
}) {
  const lang = coerceLanguage(props.lang);

  const dueMap = useMemo(() => {
    const map = new Map<string, SubLite[]>();
    for (const it of props.items) {
      const key = it.next_due_date;
      const list = map.get(key) ?? [];
      list.push(it);
      map.set(key, list);
    }
    return map;
  }, [props.items]);

  const firstDayOfWeek = useMemo(() => {
    return lang === "en" ? 0 : 1;
  }, [lang]);

  const grid = useMemo(() => {
    const dim = daysInMonth(props.year, props.month);
    const first = new Date(props.year, props.month - 1, 1);
    const nativeDow = first.getDay();
    const offset = (nativeDow - firstDayOfWeek + 7) % 7;

    const cells: Array<{ iso: string | null; day: number | null }> = [];
    for (let i = 0; i < offset; i++) cells.push({ iso: null, day: null });
    for (let day = 1; day <= dim; day++) {
      cells.push({ iso: isoOf(props.year, props.month, day), day });
    }
    while (cells.length % 7 !== 0) cells.push({ iso: null, day: null });
    return cells;
  }, [props.year, props.month, firstDayOfWeek]);

  const weekDays = useMemo(() => {
    const labelsEn = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const labelsZh = ["日", "一", "二", "三", "四", "五", "六"];
    const labels = lang === "en" ? labelsEn : labelsZh;
    return Array.from({ length: 7 }, (_, i) => labels[(firstDayOfWeek + i) % 7]);
  }, [lang, firstDayOfWeek]);

  const selectedItems = useMemo(() => {
    if (!props.selectedISO) return [];
    return dueMap.get(props.selectedISO) ?? [];
  }, [props.selectedISO, dueMap]);

  const monthLabelMap = useMemo(() => {
    const map = new Map<string, CalendarLabel[]>();
    const dim = daysInMonth(props.year, props.month);
    for (let day = 1; day <= dim; day++) {
      const iso = isoOf(props.year, props.month, day);
      const labels = labelsOfISO(iso, lang);
      if (labels.length) map.set(iso, labels);
    }
    return map;
  }, [props.year, props.month, lang]);

  const selectedLabels = useMemo(() => {
    if (!props.selectedISO) return [];
    return labelsOfISO(props.selectedISO, lang);
  }, [props.selectedISO, lang]);

  const prev = () => {
    const y = props.month === 1 ? props.year - 1 : props.year;
    const m = props.month === 1 ? 12 : props.month - 1;
    props.onChangeMonth(y, m);
  };

  const next = () => {
    const y = props.month === 12 ? props.year + 1 : props.year;
    const m = props.month === 12 ? 1 : props.month + 1;
    props.onChangeMonth(y, m);
  };

  const years = useMemo(() => {
    const current = new Date().getFullYear();
    const list = [];
    for (let i = current - 5; i <= current + 5; i++) list.push(i);
    return list;
  }, []);

  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  const upcomingMobile = useMemo(() => {
    const today = new Date();
    const list = [];
    for (let i = 0; i < 4; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      const items = dueMap.get(iso) ?? [];
      const labels = labelsOfISO(iso, lang);
      list.push({ date: d, iso, items, labels });
    }
    return list;
  }, [dueMap, lang]);

  return (
    <div className="glass-panel rounded-xl p-4">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="text-sm font-medium text-white">{lang === "en" ? "Calendar" : "日历"}</div>
        <div className="hidden md:flex items-center gap-1">
          <button
            className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-sm text-white/80 hover:bg-white/10"
            onClick={prev}
            aria-label="Prev month"
          >
            ←
          </button>

          <div className="flex items-center gap-1 bg-white/5 rounded-lg border border-white/10 p-0.5">
            <Selector
              value={props.year}
              options={years.map(y => ({ value: y, label: String(y) }))}
              onChange={(y) => props.onChangeMonth(y, props.month)}
            />
            <div className="w-px h-3 bg-white/10"></div>
            <Selector
              value={props.month}
              options={months.map(m => ({
                value: m,
                label: lang === 'en' ? new Date(2000, m - 1, 1).toLocaleString('en', { month: 'short' }) : `${m}月`
              }))}
              onChange={(m) => props.onChangeMonth(props.year, m)}
            />
          </div>

          <button
            className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-sm text-white/80 hover:bg-white/10"
            onClick={next}
            aria-label="Next month"
          >
            →
          </button>
        </div>
      </div>

      <div className="md:hidden space-y-3">
        {upcomingMobile.map(({ date, iso, items, labels }) => (
          <div key={iso} className="flex items-start gap-3 border-b border-white/5 pb-2 last:border-0">
            <div className="flex flex-col items-center min-w-[50px] rounded bg-white/5 p-2">
               <div className="text-xs text-white/50">{date.toLocaleDateString(lang, { weekday: 'short' })}</div>
               <div className="text-lg font-bold text-white">{date.getDate()}</div>
            </div>
            <div className="flex-1 space-y-2 pt-1">
              {labels.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {labels.map((label) => (
                    <span
                      key={label.label}
                      className={[
                        "rounded px-1.5 py-0.5 text-[10px]",
                        label.kind === "holiday" ? "bg-rose-500/10 text-rose-300/90" : "bg-white/5 text-white/40"
                      ].join(" ")}
                    >
                      {label.label}
                    </span>
                  ))}
                </div>
              ) : null}
              {items.length > 0 ? items.map(s => (
                <div key={s.id} className="flex items-center gap-2 text-sm text-white">
                   <div className="h-2 w-2 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.6)]"></div>
                   <span>{s.name}</span>
                </div>
              )) : (
                 <div className="text-xs text-white/30 italic">{lang === 'en' ? 'No due' : '无预定'}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="hidden md:block">
        <div className="grid grid-cols-7 gap-1 text-xs text-white/50 mb-2 text-center">
          {weekDays.map((d) => (
            <div key={d} className="py-1">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {grid.map((c, idx) => {
            const count = c.iso ? (dueMap.get(c.iso)?.length ?? 0) : 0;
            const selected = c.iso && props.selectedISO === c.iso;
            const labels = c.iso ? (monthLabelMap.get(c.iso) ?? []) : [];
            const topLabel = labels[0] ?? null;

            return (
              <button
                key={idx}
                className={[
                  "relative h-12 w-full flex flex-col items-center justify-center pt-1 pb-2 rounded-lg transition-all",
                  c.iso ? "hover:bg-white/5" : "invisible",
                  selected ? "bg-white/10" : ""
                ].join(" ")}
                onClick={() => c.iso && props.onSelectISO(c.iso)}
                disabled={!c.iso}
              >
                <div className={`text-sm leading-none ${c.iso ? "text-white" : "text-white/20"} ${selected ? "font-bold" : ""}`}>
                  {c.day ?? ""}
                </div>
                <div className="h-3 flex items-center justify-center mt-1">
                  {topLabel ? (
                    <span className={`text-[10px] font-medium leading-none ${topLabel.kind === "holiday" ? "text-rose-400/80" : "text-white/40"}`}>
                      {topLabel.label}
                    </span>
                  ) : null}
                </div>
                {count > 0 ? (
                  <div className="absolute bottom-1 h-1.5 w-1.5 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.8)]"></div>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="mt-4 border-t border-white/10 pt-3">
          <div className="text-xs text-white/40 mb-2">
            {lang === "en" ? "Selected: " : "选中: "}{props.selectedISO ?? "-"}
          </div>
          {selectedLabels.length > 0 ? (
            <div className="mb-2 flex flex-wrap gap-1">
              {selectedLabels.map((label) => (
                <span
                  key={label.label}
                  className={[
                    "rounded px-1.5 py-0.5 text-[10px]",
                    label.kind === "holiday" ? "bg-rose-500/10 text-rose-300/90" : "bg-white/5 text-white/40"
                  ].join(" ")}
                >
                  {label.label}
                </span>
              ))}
            </div>
          ) : null}
          {selectedItems.length ? (
            <div className="space-y-2">
              {selectedItems.map((s) => (
                <a
                  key={s.id}
                  href={s.url ?? "#"}
                  target={s.url ? "_blank" : undefined}
                  rel={s.url ? "noreferrer" : undefined}
                  className="flex items-center justify-between rounded-lg bg-white/5 p-2 transition-colors hover:bg-white/10"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-6 w-6 overflow-hidden rounded bg-white shrink-0 p-0.5">
                      {s.logo_url ? (
                        <img src={s.logo_url} alt={s.name} className="h-5 w-5 object-contain" />
                      ) : (
                        <div className="flex h-5 w-5 items-center justify-center text-slate-400 text-[10px]">📦</div>
                      )}
                    </div>
                    <div className="truncate text-sm text-white">{s.name}</div>
                  </div>
                  {s.price !== undefined && s.currency && (
                    <div className="text-xs font-medium text-white/70 tabular-nums">
                      {formatMoney(s.price, s.currency, { maximumFractionDigits: 0 })}
                    </div>
                  )}
                </a>
              ))}
            </div>
          ) : (
             <div className="flex flex-col items-center justify-center py-8 text-white/30 space-y-2">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                   <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                   <polyline points="17 8 12 3 7 8" />
                   <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <div className="text-xs italic">{lang === 'en' ? 'No subscriptions.' : '无订阅'}</div>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
