import type { ApiWebhookChannel, Language } from "../../../../shared/api";
import { strings } from "../../i18n";
import WebhookItem from "../../components/WebhookItem";
import { insertTextAtCursor } from "../../utils/helpers";
import type { RefObject } from "react";

export default function WebhooksTab(props: {
  language: Language;
  webhooks: ApiWebhookChannel[];
  defaultWebhookChannelIds: number[];
  savingDefaultWebhook: boolean;
  applyingDefaultWebhook: boolean;
  addWhOpen: boolean;
  setAddWhOpen: (v: boolean) => void;
  whName: string;
  setWhName: (v: string) => void;
  whUrl: string;
  setWhUrl: (v: string) => void;
  whEnabled: boolean;
  setWhEnabled: (v: boolean) => void;
  whTemplate: string;
  setWhTemplate: (v: string) => void;
  addWhTextareaRef: RefObject<HTMLTextAreaElement>;
  chips: string[];
  presets: { id: string; name: string; template: string }[];
  onToggleDefaultWebhook: (id: number, checked: boolean) => void;
  onSaveDefaultWebhook: () => void | Promise<void>;
  onApplyDefaultToAll: () => void | Promise<void>;
  onAddWebhook: () => void | Promise<void>;
  onReload: () => void | Promise<void>;
}) {
  const { language, chips, presets } = props;
  const t = strings[language];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">{t.webhooksTitle}</h2>
          <div className="text-xs text-white/50">{t.webhooksDesc}</div>
        </div>
        <button
          className="rounded-lg bg-sky-500 px-3 py-1.5 text-sm font-medium text-slate-950 hover:bg-sky-400"
          onClick={() => props.setAddWhOpen(!props.addWhOpen)}
        >
          {props.addWhOpen ? t.cancel : t.addChannel}
        </button>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-white">{t.defaultWebhookTitle}</div>
            <div className="mt-1 text-xs text-white/60">{t.defaultWebhookDesc}</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10 disabled:opacity-50"
              onClick={props.onApplyDefaultToAll}
              disabled={props.applyingDefaultWebhook}
            >
              {props.applyingDefaultWebhook ? t.saving : t.applyToAllSubscriptions}
            </button>
            <button
              className="rounded-lg bg-sky-500 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-sky-400 disabled:opacity-50"
              onClick={props.onSaveDefaultWebhook}
              disabled={props.savingDefaultWebhook}
            >
              {props.savingDefaultWebhook ? t.saving : t.save}
            </button>
          </div>
        </div>
        {props.webhooks.length ? (
          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
            {props.webhooks.map((wh) => {
              const checked = props.defaultWebhookChannelIds.includes(wh.id);
              return (
                <label key={wh.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => props.onToggleDefaultWebhook(wh.id, e.target.checked)}
                    className="h-4 w-4 accent-sky-400"
                  />
                  <div className="min-w-0">
                    <div className="truncate text-white">{wh.name}</div>
                    <div className="truncate text-xs text-white/50">{wh.url}</div>
                  </div>
                </label>
              );
            })}
          </div>
        ) : (
          <div className="mt-2 text-xs text-white/50">{t.noWebhooksConfigured}</div>
        )}
      </div>

      {props.addWhOpen && (
        <div className="glass-panel rounded-xl p-6 border-sky-500/30">
          <h3 className="text-sm font-medium text-white mb-4">{t.newWebhook}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <input
              className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
              placeholder={t.channelName}
              value={props.whName}
              onChange={(e) => props.setWhName(e.target.value)}
            />
            <input
              className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
              placeholder={t.channelUrl}
              value={props.whUrl}
              onChange={(e) => props.setWhUrl(e.target.value)}
            />
          </div>

          <div className="mb-4">
            <label className="text-xs text-white/50 mb-1 block">{t.webhookTemplate}</label>

            <div className="flex flex-wrap gap-2 mb-2">
              <span className="text-xs text-white/40 py-1">{language === 'zh-CN' ? '快速选择:' : 'Quick Select:'}</span>
              {presets.map((p) => (
                <button
                  key={p.id}
                  className="px-2 py-0.5 rounded bg-sky-500/20 hover:bg-sky-500/30 text-xs border border-sky-500/30 text-sky-300 hover:text-sky-200 transition-colors"
                  onClick={() => {
                    props.setWhTemplate(p.template);
                    if (!props.whName) props.setWhName(p.name);
                  }}
                >
                  {p.name}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 mb-2">
              <span className="text-xs text-white/40 py-1">{language === 'zh-CN' ? '插入变量:' : 'Insert Variable:'}</span>
              {chips.map((chip) => (
                <button
                  key={chip}
                  className="px-2 py-0.5 rounded-full bg-white/10 text-xs text-sky-300 hover:bg-white/20 border border-white/5"
                  onClick={() => insertTextAtCursor(props.addWhTextareaRef, chip, props.whTemplate, props.setWhTemplate)}
                >
                  {chip}
                </button>
              ))}
            </div>

            <textarea
              ref={props.addWhTextareaRef}
              className="w-full bg-slate-950 border border-white/10 rounded px-2 py-2 text-sm text-white font-mono h-24"
              value={props.whTemplate}
              onChange={(e) => props.setWhTemplate(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
              <input
                type="checkbox"
                checked={props.whEnabled}
                onChange={(e) => props.setWhEnabled(e.target.checked)}
                className="accent-sky-500"
              />
              {t.enabled}
            </label>
            <button
              className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-sky-400 disabled:opacity-50"
              onClick={props.onAddWebhook}
              disabled={!props.whName.trim() || !props.whUrl.trim()}
            >
              {t.addChannel}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {props.webhooks.map((wh) => (
          <WebhookItem key={wh.id} webhook={wh} onReload={props.onReload} lang={language} chips={chips} />
        ))}
        {props.webhooks.length === 0 && (
          <div className="text-center py-8 text-white/30 border border-dashed border-white/10 rounded-xl">
            {t.noWebhooksConfigured}
          </div>
        )}
      </div>
    </div>
  );
}
