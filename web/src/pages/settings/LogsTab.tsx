import type { ApiLogItem, Language } from "../../../../shared/api";
import { strings } from "../../i18n";

function levelColor(level: string) {
  const v = String(level).toLowerCase();
  if (v === "error") return "bg-red-500/20 text-red-200";
  if (v === "warn") return "bg-amber-500/20 text-amber-200";
  if (v === "debug") return "bg-slate-500/20 text-slate-200";
  return "bg-emerald-500/20 text-emerald-200";
}

function formatSqliteTimestamp(value: string) {
  const s = String(value);
  const iso = s.includes("T") ? s : s.replace(" ", "T") + "Z";
  return new Date(iso).toLocaleString();
}

export default function LogsTab(props: {
  language: Language;
  logs: ApiLogItem[];
  loading: boolean;
  limit: number;
  setLimit: (v: number) => void;
  onRefresh: () => void | Promise<void>;
}) {
  const t = strings[props.language];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="glass-panel rounded-xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">{props.language === "zh-CN" ? "操作日志" : "Logs"}</h2>
            <div className="text-xs text-white/50 mt-1">{props.language === "zh-CN" ? "显示最近的后端日志（按时间倒序）。" : "Shows latest backend logs (newest first)."}</div>
          </div>
          <button
            type="button"
            className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded text-white transition-colors disabled:opacity-50"
            onClick={() => props.onRefresh()}
            disabled={props.loading}
          >
            {t.refresh}
          </button>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <div className="text-xs text-white/50">{props.language === "zh-CN" ? "数量" : "Limit"}</div>
          <div className="relative">
            <select
              className="appearance-none rounded-lg border border-white/10 bg-slate-950 pl-3 pr-8 py-2 text-sm text-white outline-none focus:border-sky-500/50 transition-colors [&>option]:bg-slate-900"
              value={props.limit}
              onChange={(e) => props.setLimit(Number(e.target.value))}
            >
              {[20, 50, 100, 200].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-white/40">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
            </div>
          </div>
        </div>
      </div>

      <div className="glass-panel rounded-xl overflow-hidden">
        <div className="divide-y divide-white/5">
          {props.logs.map((l) => (
            <div key={l.id} className="p-4 hover:bg-white/5 transition-colors">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`shrink-0 rounded px-2 py-0.5 text-[10px] uppercase tracking-wide ${levelColor(l.level)}`}>
                    {String(l.level)}
                  </span>
                  <span className="text-xs text-white/40 shrink-0">{formatSqliteTimestamp(l.created_at)}</span>
                  <span className="text-xs text-white/60 truncate">{l.scope}</span>
                </div>
                <div className="text-xs text-white/30 shrink-0">#{l.id}</div>
              </div>
              <div className="mt-2 text-sm text-white">{l.message}</div>
              {l.meta ? <pre className="mt-2 text-xs text-white/50 whitespace-pre-wrap break-words">{l.meta}</pre> : null}
            </div>
          ))}
          {props.logs.length === 0 && (
            <div className="p-8 text-center text-white/30">{props.language === "zh-CN" ? "暂无日志" : "No logs"}</div>
          )}
        </div>
      </div>
    </div>
  );
}
