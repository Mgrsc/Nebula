import type { Language } from "../../../../shared/api";
import { strings } from "../../i18n";

export default function GeneralTab(props: {
  language: Language;
  timezone: string;
  timezones: Array<{ value: string; label: string }>;
  saving: boolean;
  onChangeLanguage: (lang: Language) => void;
  onChangeTimezone: (tz: string) => void;
  onSave: () => void | Promise<void>;
}) {
  const t = strings[props.language];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="glass-panel rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">{t.languageTitle}</h2>
        <div className="grid grid-cols-1 gap-4">
          <div className="max-w-[400px]">
            <label className="text-xs text-white/50 block mb-2">{t.interfaceLanguageLabel}</label>
            <select
              className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-sky-500/50"
              value={props.language}
              onChange={(e) => props.onChangeLanguage(e.target.value === "en" ? "en" : "zh-CN")}
            >
              <option value="zh-CN">中文 (zh-CN)</option>
              <option value="en">English (en)</option>
            </select>
          </div>
        </div>
      </div>

      <div className="glass-panel rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">{t.timezoneTitle}</h2>
        <div className="text-xs text-white/50 mb-4">{t.timezoneDesc}</div>
        <div className="max-w-[400px]">
          <select
            className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-sky-500/50"
            value={props.timezone}
            onChange={(e) => props.onChangeTimezone(e.target.value)}
          >
            {props.timezones.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex justify-start pt-2">
        <button
          className="rounded-lg bg-sky-500 px-8 py-2.5 text-sm font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-50 transition-colors shadow-lg shadow-sky-500/20"
          onClick={() => props.onSave()}
          disabled={props.saving}
        >
          {props.saving ? t.saving : t.save}
        </button>
      </div>
    </div>
  );
}
