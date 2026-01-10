import { useRef, useState } from "react";
import { strings } from "../i18n";
import { useAuthHeaders } from "../contexts/AuthContext";
import { apiFetch } from "../utils/api";
import { insertTextAtCursor } from "../utils/helpers";
import type { ApiWebhookChannel, ApiWebhookTestResponse, Language } from "../../../shared/api";

export default function WebhookItem({
  webhook,
  onReload,
  lang,
  chips
}: {
  webhook: ApiWebhookChannel;
  onReload: () => void | Promise<void>;
  lang: Language;
  chips: string[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [wh, setWh] = useState(webhook);
  const [msg, setMsg] = useState<string | null>(null);
  const authHeaders = useAuthHeaders();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const t = strings[lang];

  async function save() {
    setLoading(true);
    setMsg(null);
    try {
      await apiFetch<{ ok: true }>(`/api/webhooks/${wh.id}`, {
        method: "PUT",
        headers: { ...authHeaders, "content-type": "application/json" },
        body: JSON.stringify({ name: wh.name, url: wh.url, enabled: wh.enabled, template: wh.template ?? "" })
      });
      setMsg(t.saved);
      onReload();
    } catch (e: any) {
      setMsg("Error: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  async function test() {
    setLoading(true);
    setMsg(null);
    try {
      const data = await apiFetch<ApiWebhookTestResponse>(`/api/webhooks/${wh.id}/test`, {
        method: "POST",
        headers: authHeaders
      });
      if (data.ok) {
        setMsg(`${t.webhookTestOk} (${data.elapsed_ms}ms)`);
      } else {
        setMsg(`${t.webhookTestFail}: ${data.status} (${data.elapsed_ms}ms)`);
      }
    } catch (e: any) {
      setMsg("Error: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  async function del() {
    if (!confirm(t.deleteWebhookConfirm)) return;
    await apiFetch<any>(`/api/webhooks/${wh.id}`, { method: "DELETE", headers: authHeaders });
    onReload();
  }

  return (
    <div className="glass-panel rounded-xl overflow-hidden transition-all">
      <div
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/5"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-2 h-2 rounded-full ${wh.enabled ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-gray-500"}`}
          ></div>
          <div>
            <div className="font-medium text-white text-sm">{wh.name}</div>
            <div className="text-xs text-white/40 truncate max-w-[200px]">{wh.url}</div>
          </div>
        </div>
        <div className="text-white/40 text-xs">{expanded ? "▲" : "▼"}</div>
      </div>

      {expanded && (
        <div className="p-4 border-t border-white/5 bg-black/20 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-white/50 mb-1 block">{t.channelName}</label>
              <input
                className="w-full bg-slate-950 border border-white/10 rounded px-2 py-1 text-sm text-white"
                value={wh.name}
                onChange={(e) => setWh({ ...wh, name: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1 block">{t.channelUrl}</label>
              <input
                className="w-full bg-slate-950 border border-white/10 rounded px-2 py-1 text-sm text-white"
                value={wh.url}
                onChange={(e) => setWh({ ...wh, url: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-white/50 mb-1 block">{t.webhookTemplate}</label>
            <div className="text-xs text-white/40 mb-2">{t.webhookTemplateDesc}</div>
            <div className="flex flex-wrap gap-2 mb-2">
              {chips.map((chip) => (
                <button
                  key={chip}
                  className="px-2 py-0.5 rounded-full bg-white/10 text-xs text-sky-300 hover:bg-white/20 border border-white/5"
                  onClick={() =>
                    insertTextAtCursor(textareaRef, chip, wh.template || "", (v) => setWh({ ...wh, template: v }))
                  }
                >
                  {chip}
                </button>
              ))}
            </div>
            <textarea
              ref={textareaRef}
              className="w-full bg-slate-950 border border-white/10 rounded px-2 py-2 text-sm text-white font-mono h-24"
              value={wh.template || ""}
              onChange={(e) => setWh({ ...wh, template: e.target.value })}
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
                <input
                  type="checkbox"
                  checked={wh.enabled}
                  onChange={(e) => setWh({ ...wh, enabled: e.target.checked })}
                  className="accent-sky-500"
                />
                {t.enabled}
              </label>
              {msg && <span className="text-xs text-emerald-400 ml-2">{msg}</span>}
            </div>

            <div className="flex items-center gap-2">
              <button
                className="px-3 py-1.5 rounded text-xs text-white bg-white/10 hover:bg-white/20 disabled:opacity-50"
                onClick={test}
                disabled={loading}
              >
                {t.webhookTest}
              </button>
              <button
                className="px-3 py-1.5 rounded text-xs text-white bg-white/10 hover:bg-white/20 disabled:opacity-50"
                onClick={save}
                disabled={loading}
              >
                {t.save}
              </button>
              <button
                className="px-3 py-1.5 rounded text-xs text-red-200 bg-red-500/10 hover:bg-red-500/20 disabled:opacity-50"
                onClick={del}
                disabled={loading}
              >
                {t.delete}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
