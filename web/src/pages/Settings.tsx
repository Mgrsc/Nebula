import { useEffect, useMemo, useRef, useState } from "react";
import { coerceLanguage, strings } from "../i18n";
import { supportedCurrencies } from "../data/currencies";
import { webhookTemplatePresets } from "../data/webhookTemplates";
import { normalizeCurrency, isValidCurrency } from "../utils/helpers";
import { useAuth, useAuthHeaders } from "../contexts/AuthContext";
import { apiFetch } from "../utils/api";
import WebhooksTab from "./settings/WebhooksTab";
import BackupTab from "./settings/BackupTab";
import GeneralTab from "./settings/GeneralTab";
import CurrencyTab from "./settings/CurrencyTab";
import AuthTab from "./settings/AuthTab";
import LogsTab from "./settings/LogsTab";
import type {
  ApiAuthStatusResponse,
  ApiBackupConfigResponse,
  ApiBackupHistoryResponse,
  ApiBackupListResponse,
  ApiLogItem,
  ApiLogsResponse,
  ApiRatesRefreshResponse,
  ApiSettingsPatchRequest,
  ApiSettingsResponse,
  ApiWebhookChannel,
  ApiWebhooksListResponse,
  Language
} from "../../../shared/api";

type BackupNowResponse = { ok: true; message?: string };
type RestoreResponse = { ok: true; message?: string };

const commonTimezones = [
  { value: "Asia/Shanghai", label: "中国 (Asia/Shanghai)" },
  { value: "Asia/Tokyo", label: "日本 (Asia/Tokyo)" },
  { value: "Asia/Singapore", label: "新加坡 (Asia/Singapore)" },
  { value: "UTC", label: "UTC" },
  { value: "Europe/London", label: "英国 (Europe/London)" },
  { value: "America/New_York", label: "美国东部 (America/New_York)" },
  { value: "America/Los_Angeles", label: "美国西部 (America/Los_Angeles)" }
];

const webhookTemplateChips = [
  "{{name}}",
  "{{price}}",
  "{{currency}}",
  "{{display_price}}",
  "{{display_currency}}",
  "{{days_left}}",
  "{{due_date}}",
  "{{now}}"
];

export default function Settings() {
  const [activeTab, setActiveTab] = useState<"general" | "auth" | "currency" | "webhooks" | "backup" | "logs">("general");
  const [loaded, setLoaded] = useState<ApiSettingsResponse | null>(null);
  const authHeaders = useAuthHeaders();
  const { setupPassword, checkAuth } = useAuth();

  const [timezone, setTimezone] = useState("Asia/Shanghai");
  const [language, setLanguage] = useState<Language>("zh-CN");
  const [baseCurrency, setBaseCurrency] = useState("CNY");
  const [exchangeEnabled, setExchangeEnabled] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [publicDashboard, setPublicDashboard] = useState(true);
  const [publicDashboardSaving, setPublicDashboardSaving] = useState(false);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currencyError, setCurrencyError] = useState<string | null>(null);
  const t = strings[language];

  const [webhooks, setWebhooks] = useState<ApiWebhookChannel[]>([]);
  const [whName, setWhName] = useState("");
  const [whUrl, setWhUrl] = useState("");
  const [whEnabled, setWhEnabled] = useState(false);
  const [whTemplate, setWhTemplate] = useState("");
  const [addWhOpen, setAddWhOpen] = useState(false);
  const addWhTextareaRef = useRef<HTMLTextAreaElement>(null);

  const [backupWebdavUrl, setBackupWebdavUrl] = useState("");
  const [backupWebdavUsername, setBackupWebdavUsername] = useState("");
  const [backupWebdavPassword, setBackupWebdavPassword] = useState("");
  const [backupAutoEnabled, setBackupAutoEnabled] = useState(false);
  const [backupInterval, setBackupInterval] = useState(24);
  const [backupRetentionCount, setBackupRetentionCount] = useState(1);
  const [backupFiles, setBackupFiles] = useState<string[]>([]);
  const [backupHistory, setBackupHistory] = useState<ApiBackupHistoryResponse["items"]>([]);
  const [backupLoading, setBackupLoading] = useState(false);

  const [authStatus, setAuthStatus] = useState<ApiAuthStatusResponse | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [setupPwd1, setSetupPwd1] = useState("");
  const [setupPwd2, setSetupPwd2] = useState("");
  const [togglePwd, setTogglePwd] = useState("");
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd1, setNewPwd1] = useState("");
  const [newPwd2, setNewPwd2] = useState("");

  const [logs, setLogs] = useState<ApiLogItem[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsLimit, setLogsLimit] = useState(50);

  useEffect(() => {
    let alive = true;
    apiFetch<ApiSettingsResponse>("/api/settings", { headers: authHeaders })
      .then((s) => {
        if (!alive) return;
        setLoaded(s);
        setTimezone(s.timezone);
        const lang = coerceLanguage(s.language);
        setLanguage(lang);
        document.documentElement.lang = lang;

        const bc = normalizeCurrency(s.baseCurrency);
        setBaseCurrency(bc);
        setExchangeEnabled(s.exchange.enabled);
        setApiKey("");
        setPublicDashboard(s.publicDashboard !== false);
      })
      .catch((e) => {
        if (!alive) return;
        setError(String(e?.message ?? e));
      });
    return () => {
      alive = false;
    };
  }, []);

  async function loadWebhooks() {
    const data = await apiFetch<ApiWebhooksListResponse>("/api/webhooks", { headers: authHeaders });
    setWebhooks(data.items);
  }

  async function loadLogs(limit: number) {
    setLogsLoading(true);
    try {
      const u = new URL("/api/logs", window.location.origin);
      u.searchParams.set("limit", String(limit));
      const data = await apiFetch<ApiLogsResponse>(u.toString(), { headers: authHeaders });
      setLogs(data.items);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLogsLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === "webhooks") {
      loadWebhooks().catch(() => {});
      const lark = webhookTemplatePresets.find(p => p.id === 'lark-interactive');
      if (lark) {
        setWhName("Lark / Feishu Card");
        setWhTemplate(lark.template);
      }
    }
    if (activeTab === "auth") {
      loadAuthStatus().catch(() => {});
    }
    if (activeTab === "backup") {
      loadBackupConfig().catch(() => {});
      loadBackupHistory().catch(() => {});
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "logs") return;
    loadLogs(logsLimit).catch(() => {});
  }, [activeTab, logsLimit]);

  const effectiveBaseCurrency = useMemo(() => normalizeCurrency(baseCurrency), [baseCurrency]);

  async function refreshRates() {
    setMessage(null);
    setError(null);
    const data = await apiFetch<ApiRatesRefreshResponse>("/api/settings/rates/refresh", { method: "POST", headers: authHeaders });
    setMessage(data.updated ? `${t.ratesUpdated}${data.at ? new Date(data.at).toLocaleString() : ""}` : t.ratesNoNeed);
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    setError(null);
    setCurrencyError(null);
    try {
      if (!isValidCurrency(effectiveBaseCurrency)) {
        setCurrencyError(`${t.currencyCodeHint} [例如 USD / CNY]`);
        return;
      }
      const body: ApiSettingsPatchRequest = {
        timezone,
        language,
        baseCurrency: effectiveBaseCurrency,
        exchange: {
          enabled: exchangeEnabled
        }
      };
      if (apiKey.trim().length > 0) body.exchange = { ...body.exchange, apiKey: apiKey.trim() };

      await apiFetch<{ ok: true }>("/api/settings", {
        method: "PATCH",
        headers: { ...authHeaders, "content-type": "application/json" },
        body: JSON.stringify(body)
      });

      setMessage(t.saved);
      if (exchangeEnabled) {
        await refreshRates();
      }
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  }

  async function addWebhook() {
    setMessage(null);
    setError(null);
    try {
      await apiFetch<{ ok: true }>("/api/webhooks", {
        method: "POST",
        headers: { ...authHeaders, "content-type": "application/json" },
        body: JSON.stringify({ name: whName, url: whUrl, enabled: whEnabled, template: whTemplate })
      });
      setWhName("");
      setWhUrl("");
      setWhEnabled(false);
      setWhTemplate("");
      setAddWhOpen(false);
      await loadWebhooks();
      setMessage(t.saved);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
  }

  async function loadBackupConfig() {
    try {
      const data = await apiFetch<ApiBackupConfigResponse>("/api/backup/config", { headers: authHeaders });
      setBackupWebdavUrl(data.webdavUrl || "");
      setBackupWebdavUsername(data.webdavUsername || "");
      setBackupAutoEnabled(data.autoBackup || false);
      setBackupInterval(data.backupInterval || 24);
      setBackupRetentionCount(Math.max(1, Number(data.retentionCount) || 1));
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
  }

  async function saveBackupConfig() {
    setBackupLoading(true);
    setMessage(null);
    setError(null);
    try {
      await apiFetch<{ ok: true }>("/api/backup/config", {
        method: "PATCH",
        headers: { ...authHeaders, "content-type": "application/json" },
        body: JSON.stringify({
          webdavUrl: backupWebdavUrl,
          webdavUsername: backupWebdavUsername,
          webdavPassword: backupWebdavPassword || undefined,
          autoBackup: backupAutoEnabled,
          backupInterval: backupInterval,
          retentionCount: backupRetentionCount
        })
      });
      setMessage(t.saved);
      setBackupWebdavPassword("");
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setBackupLoading(false);
    }
  }

  async function backupNow() {
    setBackupLoading(true);
    setMessage(null);
    setError(null);
    try {
      const data = await apiFetch<BackupNowResponse>("/api/backup/now", {
        method: "POST",
        headers: authHeaders
      });
      setMessage(data.message || t.saved);
      await loadBackupHistory();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setBackupLoading(false);
    }
  }

  async function loadBackupHistory() {
    try {
      const data = await apiFetch<ApiBackupHistoryResponse>("/api/backup/history", { headers: authHeaders });
      setBackupHistory(data.items || []);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
  }

  async function listBackupFiles() {
    setBackupLoading(true);
    try {
      const data = await apiFetch<ApiBackupListResponse>("/api/backup/list", { headers: authHeaders });
      setBackupFiles(data.items || []);
      setMessage(language === "zh-CN" ? `找到 ${data.items.length} 个备份文件` : `Found ${data.items.length} backup files`);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setBackupLoading(false);
    }
  }

  async function restoreBackup(filename: string) {
    if (!confirm(language === "zh-CN" ? `确定要从备份 "${filename}" 恢复吗？这将覆盖所有当前数据！` : `Restore from "${filename}"? This will overwrite all current data!`)) {
      return;
    }

    setBackupLoading(true);
    setMessage(null);
    setError(null);
    try {
      const data = await apiFetch<RestoreResponse>("/api/backup/restore", {
        method: "POST",
        headers: { ...authHeaders, "content-type": "application/json" },
        body: JSON.stringify({ filename })
      });
      setMessage(data.message || (language === "zh-CN" ? "恢复成功！请刷新页面。" : "Restore successful! Please refresh."));
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setBackupLoading(false);
    }
  }

  async function loadAuthStatus() {
    setAuthLoading(true);
    try {
      const data = await apiFetch<ApiAuthStatusResponse>("/api/auth/status");
      setAuthStatus({
        enabled: Boolean(data.enabled),
        configured: Boolean(data.configured),
        publicDashboard: data.publicDashboard !== false
      });
      setPublicDashboard(data.publicDashboard !== false);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setAuthLoading(false);
    }
  }

  async function savePublicDashboardSetting(next: boolean) {
    setPublicDashboardSaving(true);
    setMessage(null);
    setError(null);
    try {
      await apiFetch<{ ok: true }>("/api/settings", {
        method: "PATCH",
        headers: { ...authHeaders, "content-type": "application/json" },
        body: JSON.stringify({ publicDashboard: next })
      });
      await checkAuth();
      setMessage(t.saved);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setPublicDashboardSaving(false);
    }
  }

  async function doSetupPassword() {
    setMessage(null);
    setError(null);
    if (!setupPwd1 || setupPwd1.length < 6) {
      setError(language === "zh-CN" ? "密码至少 6 位" : "Password must be at least 6 characters");
      return;
    }
    if (setupPwd1 !== setupPwd2) {
      setError(language === "zh-CN" ? "两次输入的密码不一致" : "Passwords do not match");
      return;
    }

    const result = await setupPassword(setupPwd1);
    if (!result.ok) {
      setError(result.message || (language === "zh-CN" ? "设置失败" : "Setup failed"));
      return;
    }

    setSetupPwd1("");
    setSetupPwd2("");
    setMessage(language === "zh-CN" ? "密码已设置，请重新登录。" : "Password set. Please login again.");
    await loadAuthStatus();
  }

  async function doToggleAuth(nextEnabled: boolean) {
    setMessage(null);
    setError(null);
    try {
      await apiFetch<{ ok: true; enabled: boolean }>("/api/auth/toggle", {
        method: "POST",
        headers: { ...authHeaders, "content-type": "application/json" },
        body: JSON.stringify({ enabled: nextEnabled, password: togglePwd || undefined })
      });
      setTogglePwd("");
      await loadAuthStatus();
      await checkAuth();
      setMessage(nextEnabled ? (language === "zh-CN" ? "已启用身份验证" : "Authentication enabled") : (language === "zh-CN" ? "已禁用身份验证" : "Authentication disabled"));
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
  }

  async function doChangePassword() {
    setMessage(null);
    setError(null);
    if (!currentPwd) {
      setError(language === "zh-CN" ? "请输入当前密码" : "Enter current password");
      return;
    }
    if (!newPwd1 || newPwd1.length < 6) {
      setError(language === "zh-CN" ? "新密码至少 6 位" : "New password must be at least 6 characters");
      return;
    }
    if (newPwd1 !== newPwd2) {
      setError(language === "zh-CN" ? "两次输入的新密码不一致" : "New passwords do not match");
      return;
    }

    try {
      await apiFetch<{ ok: true; message?: string }>("/api/auth/change-password", {
        method: "POST",
        headers: { ...authHeaders, "content-type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPwd, newPassword: newPwd1 })
      });
      setCurrentPwd("");
      setNewPwd1("");
      setNewPwd2("");
      await loadAuthStatus();
      await checkAuth();
      setMessage(language === "zh-CN" ? "密码已修改，请重新登录。" : "Password changed. Please login again.");
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
  }

  return (
    <div className="flex flex-col md:flex-row gap-6 items-start">
      <div className="w-full md:w-64 flex-shrink-0 glass-panel rounded-xl p-2 flex md:flex-col gap-1 overflow-x-auto md:overflow-visible">
         <button
           onClick={() => setActiveTab('general')}
           className={`px-4 py-3 rounded-lg text-left text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === 'general' ? 'bg-sky-500/20 text-sky-300' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
         >
           <span className="text-base">🌐</span>
           {t.settingsTitle}
         </button>
         <button
           onClick={() => setActiveTab('auth')}
           className={`px-4 py-3 rounded-lg text-left text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === 'auth' ? 'bg-sky-500/20 text-sky-300' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
         >
           <span className="text-base">🔐</span>
           {t.authTitle}
         </button>
         <button
           onClick={() => setActiveTab('currency')}
           className={`px-4 py-3 rounded-lg text-left text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === 'currency' ? 'bg-sky-500/20 text-sky-300' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
         >
           <span className="text-base">💱</span>
           {t.baseCurrencyTitle} & {t.exchangeTitle}
         </button>
         <button
           onClick={() => setActiveTab('webhooks')}
           className={`px-4 py-3 rounded-lg text-left text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === 'webhooks' ? 'bg-sky-500/20 text-sky-300' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
         >
           <span className="text-base">🔌</span>
           {t.webhooksTitle}
         </button>
         <button
           onClick={() => setActiveTab('backup')}
           className={`px-4 py-3 rounded-lg text-left text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === 'backup' ? 'bg-sky-500/20 text-sky-300' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
         >
           <span className="text-base">💾</span>
           {t.backupTitle}
         </button>
         <button
           onClick={() => setActiveTab('logs')}
           className={`px-4 py-3 rounded-lg text-left text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === 'logs' ? 'bg-sky-500/20 text-sky-300' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
         >
           <span className="text-base">🧾</span>
           {t.logsTitle}
         </button>
      </div>

      <div className="flex-1 min-w-0 space-y-6 max-w-[700px]">
        {message ? <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">{message}</div> : null}
        {error ? <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-100">{error}</div> : null}

        {activeTab === "general" && (
          <GeneralTab
            language={language}
            timezone={timezone}
            timezones={commonTimezones}
            saving={saving}
            onChangeLanguage={(next) => {
              setLanguage(next);
              document.documentElement.lang = next;
            }}
            onChangeTimezone={(tz) => setTimezone(tz)}
            onSave={save}
          />
        )}

        {activeTab === "currency" && (
          <CurrencyTab
            language={language}
            baseCurrency={baseCurrency}
            currencyError={currencyError}
            supportedCurrencies={supportedCurrencies}
            exchangeEnabled={exchangeEnabled}
            apiKey={apiKey}
            apiKeySet={Boolean(loaded?.exchange.apiKeySet)}
            lastUpdate={loaded?.exchange.lastUpdate ?? null}
            showApiKey={showApiKey}
            saving={saving}
            onBaseCurrencyFocus={() => setBaseCurrency("")}
            onBaseCurrencyChange={(v) => setBaseCurrency(normalizeCurrency(v))}
            onBaseCurrencyBlur={() => {
              if (!baseCurrency && loaded) {
                setBaseCurrency(normalizeCurrency(loaded.baseCurrency));
              }
            }}
            onClearCurrencyError={() => setCurrencyError(null)}
            onToggleExchange={(enabled) => setExchangeEnabled(enabled)}
            onApiKeyChange={(v) => setApiKey(v)}
            onToggleShowApiKey={() => setShowApiKey((x) => !x)}
            onRefreshRates={refreshRates}
            onSave={save}
          />
        )}

        {activeTab === "auth" && (
          <AuthTab
            language={language}
            authStatus={authStatus}
            authLoading={authLoading}
            setupPwd1={setupPwd1}
            setupPwd2={setupPwd2}
            togglePwd={togglePwd}
            currentPwd={currentPwd}
            newPwd1={newPwd1}
            newPwd2={newPwd2}
            publicDashboard={publicDashboard}
            publicDashboardSaving={publicDashboardSaving}
            onRefreshStatus={loadAuthStatus}
            onSetupPassword={doSetupPassword}
            onToggleAuth={doToggleAuth}
            onSavePublicDashboard={savePublicDashboardSetting}
            onChangePassword={doChangePassword}
            setSetupPwd1={setSetupPwd1}
            setSetupPwd2={setSetupPwd2}
            setTogglePwd={setTogglePwd}
            setCurrentPwd={setCurrentPwd}
            setNewPwd1={setNewPwd1}
            setNewPwd2={setNewPwd2}
            setPublicDashboard={setPublicDashboard}
          />
        )}

        {activeTab === 'webhooks' && (
          <WebhooksTab
            language={language}
            webhooks={webhooks}
            addWhOpen={addWhOpen}
            setAddWhOpen={setAddWhOpen}
            whName={whName}
            setWhName={setWhName}
            whUrl={whUrl}
            setWhUrl={setWhUrl}
            whEnabled={whEnabled}
            setWhEnabled={setWhEnabled}
            whTemplate={whTemplate}
            setWhTemplate={setWhTemplate}
            addWhTextareaRef={addWhTextareaRef}
            chips={webhookTemplateChips}
            presets={webhookTemplatePresets}
            onAddWebhook={addWebhook}
            onReload={loadWebhooks}
          />
        )}

        {activeTab === "logs" && (
          <LogsTab
            language={language}
            logs={logs}
            loading={logsLoading}
            limit={logsLimit}
            setLimit={setLogsLimit}
            onRefresh={() => loadLogs(logsLimit)}
          />
        )}

        {activeTab === 'backup' && (
          <BackupTab
            language={language}
            backupWebdavUrl={backupWebdavUrl}
            setBackupWebdavUrl={setBackupWebdavUrl}
            backupWebdavUsername={backupWebdavUsername}
            setBackupWebdavUsername={setBackupWebdavUsername}
            backupWebdavPassword={backupWebdavPassword}
            setBackupWebdavPassword={setBackupWebdavPassword}
            backupAutoEnabled={backupAutoEnabled}
            setBackupAutoEnabled={setBackupAutoEnabled}
            backupInterval={backupInterval}
            setBackupInterval={setBackupInterval}
            backupRetentionCount={backupRetentionCount}
            setBackupRetentionCount={setBackupRetentionCount}
            backupFiles={backupFiles}
            backupHistory={backupHistory}
            backupLoading={backupLoading}
            onSaveBackupConfig={saveBackupConfig}
            onBackupNow={backupNow}
            onListBackupFiles={listBackupFiles}
            onRestoreBackup={restoreBackup}
          />
        )}
      </div>
    </div>
  );
}
