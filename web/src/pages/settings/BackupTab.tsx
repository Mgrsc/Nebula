import type { ApiBackupHistoryItem, Language } from "../../../../shared/api";
import { strings } from "../../i18n";

function formatSqliteTimestamp(value: string) {
  const s = String(value);
  const iso = s.includes("T") ? s : s.replace(" ", "T") + "Z";
  return new Date(iso).toLocaleString();
}

export default function BackupTab(props: {
  language: Language;
  backupWebdavUrl: string;
  setBackupWebdavUrl: (v: string) => void;
  backupWebdavUsername: string;
  setBackupWebdavUsername: (v: string) => void;
  backupWebdavPassword: string;
  setBackupWebdavPassword: (v: string) => void;
  backupAutoEnabled: boolean;
  setBackupAutoEnabled: (v: boolean) => void;
  backupInterval: number;
  setBackupInterval: (v: number) => void;
  backupRetentionCount: number;
  setBackupRetentionCount: (v: number) => void;
  backupFiles: string[];
  backupHistory: ApiBackupHistoryItem[];
  backupLoading: boolean;
  onSaveBackupConfig: () => void | Promise<void>;
  onBackupNow: () => void | Promise<void>;
  onListBackupFiles: () => void | Promise<void>;
  onRestoreBackup: (filename: string) => void | Promise<void>;
}) {
  const { language } = props;
  const t = strings[language];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="glass-panel rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-2">{t.backupTitle}</h2>
        <p className="text-sm text-white/60 mb-4">{t.backupDesc}</p>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-white/50 mb-2 block">{t.webdavUrl}</label>
            <input
              className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-sky-500/50"
              placeholder="https://dav.jianguoyun.com/dav/"
              value={props.backupWebdavUrl}
              onChange={(e) => props.setBackupWebdavUrl(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-white/50 mb-2 block">{t.webdavUsername}</label>
              <input
                className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-sky-500/50"
                placeholder={language === "zh-CN" ? "用户名或邮箱" : "Username or Email"}
                value={props.backupWebdavUsername}
                onChange={(e) => props.setBackupWebdavUsername(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-white/50 mb-2 block">{t.webdavPassword}</label>
              <input
                type="password"
                className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-sky-500/50"
                placeholder={language === "zh-CN" ? "密码或应用专用密码" : "Password"}
                value={props.backupWebdavPassword}
                onChange={(e) => props.setBackupWebdavPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between bg-white/5 rounded-lg p-3">
            <div>
              <div className="text-sm text-white font-medium">{t.autoBackup}</div>
              <div className="text-xs text-white/50 mt-1">
                {language === "zh-CN" ? "定期自动备份到 WebDAV" : "Automatic backup to WebDAV"}
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={props.backupAutoEnabled}
                onChange={(e) => props.setBackupAutoEnabled(e.target.checked)}
              />
              <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-500"></div>
            </label>
          </div>

          {props.backupAutoEnabled && (
            <div>
              <label className="text-xs text-white/50 mb-2 block">{t.backupInterval}</label>
              <select
                className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-sky-500/50"
                value={props.backupInterval}
                onChange={(e) => props.setBackupInterval(Number(e.target.value))}
              >
                <option value={6}>{language === "zh-CN" ? "每 6 小时" : "Every 6 hours"}</option>
                <option value={12}>{language === "zh-CN" ? "每 12 小时" : "Every 12 hours"}</option>
                <option value={24}>{language === "zh-CN" ? "每 24 小时" : "Every 24 hours"}</option>
                <option value={48}>{language === "zh-CN" ? "每 48 小时" : "Every 48 hours"}</option>
                <option value={168}>{language === "zh-CN" ? "每周" : "Weekly"}</option>
              </select>
            </div>
          )}

          <div>
            <label className="text-xs text-white/50 mb-2 block">{t.backupRetention}</label>
            <div className="text-xs text-white/40 mb-2">{t.backupRetentionHint}</div>
            <input
              type="number"
              min={1}
              max={100}
              className="w-full max-w-[220px] rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-sky-500/50"
              value={props.backupRetentionCount}
              onChange={(e) =>
                props.setBackupRetentionCount(Math.max(1, Math.min(100, Number(e.target.value) || 1)))
              }
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              className="rounded-lg bg-sky-500 px-6 py-2.5 text-sm font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-50 transition-colors shadow-lg shadow-sky-500/20"
              onClick={props.onSaveBackupConfig}
              disabled={props.backupLoading || !props.backupWebdavUrl.trim()}
            >
              {props.backupLoading ? t.saving : t.save}
            </button>
            <button
              className="rounded-lg border border-sky-500/50 bg-sky-500/10 px-6 py-2.5 text-sm font-semibold text-sky-300 hover:bg-sky-500/20 disabled:opacity-50 transition-colors"
              onClick={props.onBackupNow}
              disabled={props.backupLoading || !props.backupWebdavUrl.trim()}
            >
              {props.backupLoading ? (language === "zh-CN" ? "备份中..." : "Backing up...") : t.backupNow}
            </button>
          </div>
        </div>
      </div>

      <div className="glass-panel rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-md font-semibold text-white">{t.backupHistory}</h3>
          <button
            className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded text-white transition-colors disabled:opacity-50"
            onClick={props.onListBackupFiles}
            disabled={props.backupLoading || !props.backupWebdavUrl.trim()}
          >
            {language === "zh-CN" ? "列出备份" : "List Backups"}
          </button>
        </div>

        {props.backupFiles.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs text-white/50 mb-2">{language === "zh-CN" ? "可用备份文件" : "Available Backup Files"}</div>
            {props.backupFiles.map((file, idx) => (
              <div key={idx} className="flex items-center justify-between bg-white/5 rounded px-3 py-2">
                <div className="text-sm text-white font-mono truncate flex-1">{file}</div>
                <button
                  className="ml-3 text-xs bg-amber-500/20 hover:bg-amber-500/30 px-3 py-1 rounded text-amber-200 transition-colors disabled:opacity-50"
                  onClick={() => props.onRestoreBackup(file)}
                  disabled={props.backupLoading}
                >
                  {language === "zh-CN" ? "恢复" : "Restore"}
                </button>
              </div>
            ))}
          </div>
        )}

        {props.backupHistory.length > 0 && (
          <div className="mt-4 space-y-2">
            <div className="text-xs text-white/50 mb-2">{language === "zh-CN" ? "最近备份记录" : "Recent Backups"}</div>
            {props.backupHistory.map((record, idx) => (
              <div key={idx} className="flex items-center justify-between bg-white/5 rounded px-3 py-2 text-xs">
                <div className="text-white/70">{formatSqliteTimestamp(record.created_at)}</div>
                <div
                  className={`px-2 py-0.5 rounded ${record.status === "success" ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"}`}
                >
                  {record.status}
                </div>
              </div>
            ))}
          </div>
        )}

        {props.backupHistory.length === 0 && props.backupFiles.length === 0 && (
          <div className="text-center py-8 text-white/30 border border-dashed border-white/10 rounded-xl">
            {language === "zh-CN" ? "暂无备份记录" : "No backup history"}
          </div>
        )}
      </div>
    </div>
  );
}
