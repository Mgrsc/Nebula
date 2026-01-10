import { useMemo } from "react";
import { coerceLanguage, type Language } from "../i18n";
import { formatMoney } from "../utils/helpers";

type SubLite = { id: number; name: string; next_due_date: string; logo_url?: string | null; url?: string | null; price?: number; currency?: string };

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function isoOf(year: number, month: number, day: number) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
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
      list.push({ date: d, iso, items });
    }
    return list;
  }, [dueMap]);

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
          
          <div className="flex items-center bg-white/5 rounded-lg border border-white/10 px-1 mx-1">
            <select 
              value={props.year} 
              onChange={(e) => props.onChangeMonth(Number(e.target.value), props.month)}
              className="bg-transparent text-sm text-white outline-none cursor-pointer py-1 text-center font-medium [&>option]:bg-slate-900"
            >
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <span className="text-white/20 text-xs mx-1">/</span>
            <select 
              value={props.month} 
              onChange={(e) => props.onChangeMonth(props.year, Number(e.target.value))}
              className="bg-transparent text-sm text-white outline-none cursor-pointer py-1 text-center font-medium [&>option]:bg-slate-900"
            >
              {months.map(m => (
                  <option key={m} value={m}>
                      {lang === 'en' ? new Date(2000, m-1, 1).toLocaleString('en', {month:'short'}) : `${m}月`}
                  </option>
              ))}
            </select>
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
        {upcomingMobile.map(({ date, iso, items }) => (
          <div key={iso} className="flex items-start gap-3 border-b border-white/5 pb-2 last:border-0">
            <div className="flex flex-col items-center min-w-[50px] rounded bg-white/5 p-2">
               <div className="text-xs text-white/50">{date.toLocaleDateString(lang, { weekday: 'short' })}</div>
               <div className="text-lg font-bold text-white">{date.getDate()}</div>
            </div>
            <div className="flex-1 space-y-2 pt-1">
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
            
            return (
              <button
                key={idx}
                className={[
                  "relative h-10 w-full flex flex-col items-center justify-center rounded-lg transition-all",
                  c.iso ? "hover:bg-white/5" : "invisible",
                  selected ? "bg-white/10" : ""
                ].join(" ")}
                onClick={() => c.iso && props.onSelectISO(c.iso)}
                disabled={!c.iso}
              >
                <div className={`text-sm ${c.iso ? "text-white" : "text-white/20"} ${selected ? "font-bold" : ""}`}>
                    {c.day ?? ""}
                </div>
                {count > 0 ? (
                  <div className="mt-1 h-1.5 w-1.5 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.8)]"></div>
                ) : <div className="mt-1 h-1.5 w-1.5"></div>}
              </button>
            );
          })}
        </div>

        <div className="mt-4 border-t border-white/10 pt-3">
          <div className="text-xs text-white/40 mb-2">
            {lang === "en" ? "Selected: " : "选中: "}{props.selectedISO ?? "-"}
          </div>
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
