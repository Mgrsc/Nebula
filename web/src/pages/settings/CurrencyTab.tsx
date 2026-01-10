import type { Language } from "../../../../shared/api";
import type { Currency } from "../../../../shared/currencies";
import { strings } from "../../i18n";

export default function CurrencyTab(props: {
  language: Language;
  baseCurrency: string;
  currencyError: string | null;
  supportedCurrencies: Currency[];
  exchangeEnabled: boolean;
  apiKey: string;
  apiKeySet: boolean;
  lastUpdate: string | null;
  showApiKey: boolean;
  saving: boolean;
  onBaseCurrencyChange: (v: string) => void;
  onBaseCurrencyFocus: () => void;
  onBaseCurrencyBlur: () => void;
  onClearCurrencyError: () => void;
  onToggleExchange: (enabled: boolean) => void;
  onApiKeyChange: (v: string) => void;
  onToggleShowApiKey: () => void;
  onRefreshRates: () => void | Promise<void>;
  onSave: () => void | Promise<void>;
}) {
  const t = strings[props.language];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="glass-panel rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-1">{t.baseCurrencyTitle}</h2>
        <div className="text-xs text-white/50 mb-4">{t.baseCurrencyDesc}</div>

        <div className="relative max-w-[300px]">
          <input
            className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-sky-500/50 placeholder:text-white/30"
            list="nebula-currency-codes-settings"
            placeholder="CNY"
            value={props.baseCurrency}
            onFocus={() => props.onBaseCurrencyFocus()}
            onChange={(e) => {
              props.onBaseCurrencyChange(e.target.value);
              props.onClearCurrencyError();
            }}
            onBlur={() => props.onBaseCurrencyBlur()}
          />
          <datalist id="nebula-currency-codes-settings">
            {props.supportedCurrencies.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.name} ({c.country})
              </option>
            ))}
          </datalist>
        </div>
        {props.currencyError ? <div className="mt-2 text-xs text-red-200">{props.currencyError}</div> : null}
      </div>

      <div className="glass-panel rounded-xl p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-white">{t.exchangeTitle}</h2>
            <div className="text-xs text-white/50 mt-1">{t.exchangeDesc}</div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={props.exchangeEnabled}
              onChange={(e) => props.onToggleExchange(e.target.checked)}
            />
            <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-500"></div>
          </label>
        </div>

        {props.exchangeEnabled && (
          <div className="space-y-4 pt-4 border-t border-white/10">
            <div className="max-w-[400px]">
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs text-white/60">{t.exchangeKeyTitle}</label>
                <a
                  className="text-xs text-sky-400 hover:text-sky-300"
                  href="https://www.exchangerate-api.com/"
                  target="_blank"
                  rel="noreferrer"
                >
                  {t.exchangeKeyLink}
                </a>
              </div>
              <div className="relative">
                <input
                  type={props.showApiKey ? "text" : "password"}
                  className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-sky-500/50 pr-10"
                  placeholder={props.apiKeySet && !props.apiKey ? t.exchangeKeySaved : t.exchangeKeyPlaceholder}
                  value={props.apiKey}
                  onChange={(e) => props.onApiKeyChange(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                  onClick={() => props.onToggleShowApiKey()}
                >
                  {props.showApiKey ? (props.language === "zh-CN" ? "隐藏" : "Hide") : props.language === "zh-CN" ? "显示" : "Show"}
                </button>
              </div>
              <div className="text-xs text-white/40 mt-2">{t.exchangeKeyNote}</div>
            </div>

            <div className="flex items-center justify-between bg-white/5 rounded-lg p-3 max-w-[400px]">
              <div className="text-xs text-white/60">
                {t.lastUpdate}: {props.lastUpdate ? new Date(props.lastUpdate).toLocaleString() : props.language === "zh-CN" ? "从未" : "Never"}
              </div>
              <button
                type="button"
                onClick={() => props.onRefreshRates()}
                className="text-xs bg-white/10 hover:bg-white/20 px-2 py-1 rounded text-white transition-colors"
              >
                {t.syncNow}
              </button>
            </div>
          </div>
        )}
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
