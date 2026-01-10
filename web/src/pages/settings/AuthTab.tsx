import type { Language, ApiAuthStatusResponse } from "../../../../shared/api";
import { strings } from "../../i18n";

export default function AuthTab(props: {
  language: Language;
  authStatus: ApiAuthStatusResponse | null;
  authLoading: boolean;
  setupPwd1: string;
  setupPwd2: string;
  togglePwd: string;
  currentPwd: string;
  newPwd1: string;
  newPwd2: string;
  publicDashboard: boolean;
  publicDashboardSaving: boolean;
  onRefreshStatus: () => void | Promise<void>;
  onSetupPassword: () => void | Promise<void>;
  onToggleAuth: (enabled: boolean) => void | Promise<void>;
  onSavePublicDashboard: (v: boolean) => void | Promise<void>;
  onChangePassword: () => void | Promise<void>;
  setSetupPwd1: (v: string) => void;
  setSetupPwd2: (v: string) => void;
  setTogglePwd: (v: string) => void;
  setCurrentPwd: (v: string) => void;
  setNewPwd1: (v: string) => void;
  setNewPwd2: (v: string) => void;
  setPublicDashboard: (v: boolean) => void;
}) {
  const t = strings[props.language];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="glass-panel rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-1">{t.authTitle}</h2>
        <div className="text-xs text-white/50 mb-4">{t.authDesc}</div>

        <div className="flex items-center justify-between bg-white/5 rounded-lg p-3">
          <div className="text-xs text-white/70">
            {t.authStatus}:{" "}
            {props.authLoading || !props.authStatus
              ? props.language === "zh-CN"
                ? "加载中..."
                : "Loading..."
              : `${props.authStatus.configured ? t.authConfigured : t.authNotConfigured} · ${props.authStatus.enabled ? t.authEnabled : t.authDisabled}`}
          </div>
          <button
            type="button"
            className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded text-white transition-colors disabled:opacity-50"
            onClick={() => props.onRefreshStatus()}
            disabled={props.authLoading}
          >
            {t.refresh}
          </button>
        </div>
      </div>

      {props.authStatus && !props.authStatus.configured && (
        <div className="glass-panel rounded-xl p-6">
          <h3 className="text-md font-semibold text-white mb-4">{t.authSetupTitle}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-[520px]">
            <div>
              <label className="text-xs text-white/50 mb-2 block">{t.authPassword}</label>
              <input
                type="password"
                className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-sky-500/50"
                value={props.setupPwd1}
                onChange={(e) => props.setSetupPwd1(e.target.value)}
                placeholder={props.language === "zh-CN" ? "至少 6 位" : "At least 6 characters"}
              />
            </div>
            <div>
              <label className="text-xs text-white/50 mb-2 block">{t.authPasswordConfirm}</label>
              <input
                type="password"
                className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-sky-500/50"
                value={props.setupPwd2}
                onChange={(e) => props.setSetupPwd2(e.target.value)}
              />
            </div>
          </div>
          <div className="pt-4">
            <button
              type="button"
              className="rounded-lg bg-sky-500 px-6 py-2.5 text-sm font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-50 transition-colors shadow-lg shadow-sky-500/20"
              onClick={() => props.onSetupPassword()}
              disabled={props.authLoading}
            >
              {t.authSetPassword}
            </button>
          </div>
        </div>
      )}

      {props.authStatus && props.authStatus.configured && (
        <>
          <div className="glass-panel rounded-xl p-6">
            <div className="flex items-start justify-between gap-4 mb-2">
              <div>
                <h3 className="text-md font-semibold text-white">{t.authToggleTitle}</h3>
                <div className="text-xs text-white/50 mt-1">{t.authToggleHint}</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={Boolean(props.authStatus.enabled)}
                  onChange={(e) => props.onToggleAuth(e.target.checked)}
                />
                <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-500"></div>
              </label>
            </div>

            <div className="pt-4 border-t border-white/10 max-w-[420px]">
              <label className="text-xs text-white/50 mb-2 block">{t.authTogglePasswordHint}</label>
              <input
                type="password"
                className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-sky-500/50"
                value={props.togglePwd}
                onChange={(e) => props.setTogglePwd(e.target.value)}
                placeholder={props.language === "zh-CN" ? "可选：无登录态时需要" : "Optional: required if not logged in"}
              />
            </div>
          </div>

          <div className="glass-panel rounded-xl p-6">
            <h3 className="text-md font-semibold text-white mb-1">
              {props.language === "zh-CN" ? "仪表盘访问" : "Dashboard access"}
            </h3>
            <div className="text-xs text-white/50 mb-4">
              {props.language === "zh-CN"
                ? "开启后：未登录也可查看仪表盘（只读）；新增/编辑/删除/设置/管理 Webhook 仍需登录。"
                : "When enabled: you can view the dashboard without login (read-only). All modifications still require login."}
            </div>

            <div className="flex items-center justify-between bg-white/5 rounded-lg p-3">
              <div className="text-sm text-white">{props.language === "zh-CN" ? "允许匿名查看仪表盘" : "Allow anonymous dashboard view"}</div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={props.publicDashboard}
                  onChange={(e) => props.setPublicDashboard(e.target.checked)}
                />
                <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-500"></div>
              </label>
            </div>

            <div className="pt-4">
              <button
                type="button"
                className="rounded-lg bg-sky-500 px-6 py-2.5 text-sm font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-50 transition-colors shadow-lg shadow-sky-500/20"
                onClick={() => props.onSavePublicDashboard(props.publicDashboard)}
                disabled={props.publicDashboardSaving || props.authLoading}
              >
                {props.publicDashboardSaving
                  ? props.language === "zh-CN"
                    ? "保存中..."
                    : "Saving..."
                  : t.save}
              </button>
            </div>
          </div>

          <div className="glass-panel rounded-xl p-6">
            <h3 className="text-md font-semibold text-white mb-4">{t.authChangeTitle}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-[520px]">
              <div className="md:col-span-2">
                <label className="text-xs text-white/50 mb-2 block">{t.authCurrentPassword}</label>
                <input
                  type="password"
                  className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-sky-500/50"
                  value={props.currentPwd}
                  onChange={(e) => props.setCurrentPwd(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-white/50 mb-2 block">{t.authNewPassword}</label>
                <input
                  type="password"
                  className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-sky-500/50"
                  value={props.newPwd1}
                  onChange={(e) => props.setNewPwd1(e.target.value)}
                  placeholder={props.language === "zh-CN" ? "至少 6 位" : "At least 6 characters"}
                />
              </div>
              <div>
                <label className="text-xs text-white/50 mb-2 block">{t.authPasswordConfirm}</label>
                <input
                  type="password"
                  className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-sky-500/50"
                  value={props.newPwd2}
                  onChange={(e) => props.setNewPwd2(e.target.value)}
                />
              </div>
            </div>
            <div className="pt-4">
              <button
                type="button"
                className="rounded-lg bg-sky-500 px-6 py-2.5 text-sm font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-50 transition-colors shadow-lg shadow-sky-500/20"
                onClick={() => props.onChangePassword()}
                disabled={props.authLoading}
              >
                {t.authChangePassword}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

