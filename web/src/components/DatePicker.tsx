import { useState, useRef, useEffect, useMemo } from "react";
import { coerceLanguage, type Language } from "../i18n";

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function isoOf(year: number, month: number, day: number) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function parseISODate(value: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

export default function DatePicker(props: {
  lang: Language;
  value: string;
  onChange: (iso: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const lang = coerceLanguage(props.lang);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const initDate = parseISODate(props.value) || { year: new Date().getFullYear(), month: new Date().getMonth() + 1 };
  const [year, setYear] = useState(initDate.year);
  const [month, setMonth] = useState(initDate.month);

  useEffect(() => {
    if (open) {
      const d = parseISODate(props.value) || { year: new Date().getFullYear(), month: new Date().getMonth() + 1 };
      setYear(d.year);
      setMonth(d.month);
    }
  }, [open, props.value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const firstDayOfWeek = lang === "en" ? 0 : 1;

  const grid = useMemo(() => {
    const dim = daysInMonth(year, month);
    const first = new Date(year, month - 1, 1);
    const nativeDow = first.getDay();
    const offset = (nativeDow - firstDayOfWeek + 7) % 7;

    const cells: Array<{ iso: string | null; day: number | null }> = [];
    for (let i = 0; i < offset; i++) cells.push({ iso: null, day: null });
    for (let day = 1; day <= dim; day++) {
      cells.push({ iso: isoOf(year, month, day), day });
    }
    while (cells.length % 7 !== 0) cells.push({ iso: null, day: null });
    return cells;
  }, [year, month, firstDayOfWeek]);

  const weekDays = useMemo(() => {
    const labelsEn = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
    const labelsZh = ["日", "一", "二", "三", "四", "五", "六"];
    const labels = lang === "en" ? labelsEn : labelsZh;
    return Array.from({ length: 7 }, (_, i) => labels[(firstDayOfWeek + i) % 7]);
  }, [lang, firstDayOfWeek]);

  const prev = (e: React.MouseEvent) => {
    e.stopPropagation();
    const y = month === 1 ? year - 1 : year;
    const m = month === 1 ? 12 : month - 1;
    setYear(y);
    setMonth(m);
  };

  const next = (e: React.MouseEvent) => {
    e.stopPropagation();
    const y = month === 12 ? year + 1 : year;
    const m = month === 12 ? 1 : month + 1;
    setYear(y);
    setMonth(m);
  };

  const selectDate = (iso: string) => {
    props.onChange(iso);
    setOpen(false);
  };

  const years = useMemo(() => {
    const current = new Date().getFullYear();
    const list = [];
    for (let i = current - 10; i <= current + 10; i++) list.push(i);
    return list;
  }, []);

  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div className={`relative ${props.className || ""}`} ref={containerRef}>
      <input
        type="text"
        readOnly
        className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none cursor-pointer placeholder:text-white/30"
        value={props.value}
        onClick={() => setOpen(!open)}
        placeholder={props.placeholder || (lang === "en" ? "Select date" : "选择日期")}
      />
      
      {open && (
        <div className="absolute z-50 mt-2 p-3 w-64 rounded-xl border border-white/10 bg-slate-900 shadow-xl shadow-black/50 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              className="rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
              onClick={prev}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>

            <div className="flex items-center gap-1 font-medium text-sm text-white">
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="appearance-none bg-transparent outline-none cursor-pointer hover:text-sky-400 [&>option]:bg-slate-900 [&>option]:text-white text-center"
              >
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <span className="text-white/30">/</span>
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="appearance-none bg-transparent outline-none cursor-pointer hover:text-sky-400 [&>option]:bg-slate-900 [&>option]:text-white text-center"
              >
                {months.map(m => (
                  <option key={m} value={m}>
                    {lang === 'en' ? new Date(2000, m-1, 1).toLocaleString('en', {month:'short'}) : `${m}月`}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
              onClick={next}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1">
            {weekDays.map(d => (
              <div key={d} className="text-center text-[10px] font-medium text-white/40 py-1">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {grid.map((c, idx) => {
              const isSelected = c.iso === props.value;
              const isToday = c.iso === new Date().toISOString().slice(0, 10);
              return (
                <button
                  key={idx}
                  type="button"
                  disabled={!c.iso}
                  onClick={() => c.iso && selectDate(c.iso)}
                  className={`
                    flex h-8 items-center justify-center rounded-md text-xs transition-colors
                    ${!c.iso ? 'invisible' : ''}
                    ${isSelected 
                      ? 'bg-sky-500 font-bold text-white shadow-[0_0_10px_rgba(14,165,233,0.4)]' 
                      : c.iso 
                        ? 'text-white/80 hover:bg-white/10 hover:text-white' 
                        : ''}
                    ${isToday && !isSelected ? 'border border-sky-500/50 text-sky-400' : ''}
                  `}
                >
                  {c.day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
