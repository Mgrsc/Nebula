import { db } from "../db";
import { log } from "./logger";

export type BackupConfig = {
  webdavUrl: string;
  webdavUsername: string;
  webdavPassword: string;
  autoBackup: boolean;
  backupInterval: number;
  retentionCount: number;
};

type BackupFile = {
  version: string;
  timestamp: string;
  data: Record<string, any[]>;
};

const WEBDAV_BACKUP_DIR = "nebula-backups";
const SINGLE_BACKUP_FILENAME = "nebula-backup.json";

function parseSqliteUtcTimestampMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const s = String(value).trim();
  if (!s) return null;
  const iso = s.includes("T") ? s : s.replace(" ", "T") + "Z";
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

function normalizeDirUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

function joinUrl(baseUrl: string, ...segments: string[]): string {
  const base = normalizeDirUrl(baseUrl);
  const encoded = segments.map((s) => encodeURIComponent(s));
  return `${base}/${encoded.join("/")}`;
}

function basicAuthHeader(username: string, password: string): string {
  const auth = btoa(`${username}:${password}`);
  return `Basic ${auth}`;
}

async function ensureWebDAVDirectory(config: BackupConfig): Promise<string> {
  const rootUrl = normalizeDirUrl(config.webdavUrl);
  const dirUrl = joinUrl(rootUrl, WEBDAV_BACKUP_DIR);
  const authHeader = basicAuthHeader(config.webdavUsername, config.webdavPassword);

  const response = await fetch(dirUrl, {
    method: "MKCOL",
    headers: { Authorization: authHeader }
  });

  if (response.ok) return dirUrl;

  if (response.status === 405) return dirUrl;

  throw new Error(`WebDAV directory creation failed: ${response.status} ${response.statusText}`);
}

async function listBackupsInUrl(
  baseUrl: string,
  username: string,
  password: string
): Promise<string[]> {
  const url = normalizeDirUrl(baseUrl);
  const authHeader = basicAuthHeader(username, password);

  const response = await fetch(url, {
    method: "PROPFIND",
    headers: {
      Authorization: authHeader,
      Depth: "1"
    }
  });

  if (!response.ok) {
    throw new Error(`WebDAV list failed: ${response.status}`);
  }

  const text = await response.text();
  const matches = text.match(/nebula-backup(?:-[\w-]+)?\.json/g) || [];
  return Array.from(new Set(matches)).sort().reverse();
}

async function deleteWebDAVFile(url: string, username: string, password: string): Promise<void> {
  const authHeader = basicAuthHeader(username, password);
  const response = await fetch(url, { method: "DELETE", headers: { Authorization: authHeader } });
  if (!response.ok && response.status !== 404) {
    throw new Error(`WebDAV delete failed: ${response.status} ${response.statusText}`);
  }
}

export async function backupToWebDAV(config: BackupConfig): Promise<void> {
  const retentionCount = Number.isFinite(config.retentionCount)
    ? Math.max(1, Math.min(100, Math.floor(config.retentionCount)))
    : 1;

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = retentionCount <= 1 ? SINGLE_BACKUP_FILENAME : `nebula-backup-${timestamp}.json`;

  const tables = ['settings', 'subscriptions', 'webhook_channels', 'exchange_rates'];
  const backup: BackupFile = { version: "1.0", timestamp, data: {} };

  for (const table of tables) {
    try {
      const rows = db.query(`SELECT * FROM ${table};`).all();
      backup.data[table] = rows;
    } catch (e: any) {
      log("warn", "backup", `failed to backup table ${table}`, { error: String(e?.message ?? e) });
    }
  }

  const backupData = JSON.stringify(backup, null, 2);

  const dirUrl = await ensureWebDAVDirectory(config);
  const fileUrl = joinUrl(dirUrl, filename);
  const authHeader = basicAuthHeader(config.webdavUsername, config.webdavPassword);

  try {
    const response = await fetch(fileUrl, {
      method: 'PUT',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      body: backupData
    });

    if (!response.ok) {
      throw new Error(`WebDAV upload failed: ${response.status} ${response.statusText}`);
    }

    db.query(
      `INSERT INTO backups (type, status, message) VALUES (?, ?, ?);`
    ).run('webdav', 'success', `Backed up to ${WEBDAV_BACKUP_DIR}/${filename}`);

    log("info", "backup", "backup successful", { filename, size: backupData.length });

    try {
      const allFiles = await listBackupsInUrl(dirUrl, config.webdavUsername, config.webdavPassword);
      const timestamped = allFiles.filter((f) => f.startsWith("nebula-backup-") && f.endsWith(".json"));

      if (retentionCount <= 1) {
        await Promise.all(
          timestamped.map((f) => deleteWebDAVFile(joinUrl(dirUrl, f), config.webdavUsername, config.webdavPassword))
        );
      } else {
        await deleteWebDAVFile(
          joinUrl(dirUrl, SINGLE_BACKUP_FILENAME),
          config.webdavUsername,
          config.webdavPassword
        ).catch(() => {});
        const toDelete = timestamped.slice(retentionCount);
        await Promise.all(
          toDelete.map((f) => deleteWebDAVFile(joinUrl(dirUrl, f), config.webdavUsername, config.webdavPassword))
        );
      }
    } catch (e: any) {
      log("warn", "backup", "retention cleanup failed", { error: String(e?.message ?? e) });
    }

  } catch (e: any) {
    const errorMsg = String(e?.message ?? e);

    db.query(
      `INSERT INTO backups (type, status, message) VALUES (?, ?, ?);`
    ).run('webdav', 'failed', errorMsg);

    log("error", "backup", "backup failed", { error: errorMsg });
    throw e;
  }
}

export async function restoreFromWebDAV(
  config: BackupConfig,
  filename: string
): Promise<void> {
  const authHeader = basicAuthHeader(config.webdavUsername, config.webdavPassword);
  const dirUrl = await ensureWebDAVDirectory(config);
  const primaryUrl = joinUrl(dirUrl, filename);

  try {
    const response = await fetch(primaryUrl, { method: "GET", headers: { Authorization: authHeader } });
    if (!response.ok) {
      throw new Error(`WebDAV download failed: ${response.status} ${response.statusText}`);
    }

    const backupData = (await response.json()) as Partial<BackupFile>;

    if (!backupData.data) {
      throw new Error('Invalid backup format');
    }

    const tableOrder = ['settings', 'webhook_channels', 'subscriptions', 'exchange_rates'];

    for (const table of tableOrder) {
      const rows = backupData.data[table] as any[] | undefined;
      if (!rows || !Array.isArray(rows)) continue;

      try {
        db.run('BEGIN TRANSACTION;');

        db.query(`DELETE FROM ${table};`).run();

        if (rows.length > 0) {
          const firstRow = rows[0];
          const columns = Object.keys(firstRow);
          const placeholders = columns.map(() => '?').join(', ');
          const insertSQL = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders});`;

          const stmt = db.query(insertSQL);
          for (const row of rows) {
            const values = columns.map(col => row[col]);
            stmt.run(...values);
          }
        }

        db.run('COMMIT;');
        log("info", "restore", `restored table ${table}`, { rows: rows.length });

      } catch (e: any) {
        db.run('ROLLBACK;');
        log("error", "restore", `failed to restore table ${table}`, { error: String(e?.message ?? e) });
        throw e;
      }
    }

    db.query(
      `INSERT INTO backups (type, status, message) VALUES (?, ?, ?);`
    ).run('webdav_restore', 'success', `Restored from ${filename}`);

    log("info", "restore", "restore successful", { filename });

  } catch (e: any) {
    const errorMsg = String(e?.message ?? e);

    db.query(
      `INSERT INTO backups (type, status, message) VALUES (?, ?, ?);`
    ).run('webdav_restore', 'failed', errorMsg);

    log("error", "restore", "restore failed", { error: errorMsg });
    throw e;
  }
}

export async function listWebDAVBackups(config: BackupConfig): Promise<string[]> {
  try {
    const dirUrl = await ensureWebDAVDirectory(config);
    return await listBackupsInUrl(dirUrl, config.webdavUsername, config.webdavPassword);
  } catch (e: any) {
    log("error", "backup", "list backups failed", { error: String(e?.message ?? e) });
    return [];
  }
}

export function getBackupHistory(limit: number = 20): any[] {
  return db
    .query(`SELECT * FROM backups ORDER BY id DESC LIMIT ?;`)
    .all(limit) as any[];
}

let autoBackupRunning = false;

function getLastSuccessfulBackupMs(): number | null {
  const row = db
    .query<{ created_at: string }, []>(
      `SELECT created_at FROM backups WHERE type = 'webdav' AND status = 'success' ORDER BY id DESC LIMIT 1;`
    )
    .get();
  return parseSqliteUtcTimestampMs(row?.created_at ?? null);
}

function readAutoBackupSettings() {
  const row = db
    .query<
      {
        backup_auto_enabled: number;
        backup_interval_hours: number;
        backup_retention_count: number;
        backup_webdav_url: string | null;
        backup_webdav_username: string | null;
        backup_webdav_password: string | null;
      },
      []
    >(
      `SELECT backup_auto_enabled, backup_interval_hours, backup_retention_count,
              backup_webdav_url, backup_webdav_username, backup_webdav_password
       FROM settings WHERE id = 1;`
    )
    .get();
  if (!row) return null;
  return {
    enabled: Boolean(row.backup_auto_enabled),
    intervalHours: Number(row.backup_interval_hours) || 24,
    retentionCount: Number(row.backup_retention_count) || 1,
    webdavUrl: row.backup_webdav_url || "",
    webdavUsername: row.backup_webdav_username || "",
    webdavPassword: row.backup_webdav_password || ""
  };
}

export async function maybeRunAutoBackup(): Promise<void> {
  const s = readAutoBackupSettings();
  if (!s || !s.enabled) return;

  const intervalHours = Math.max(1, Math.min(24 * 30, Math.floor(s.intervalHours)));
  const lastMs = getLastSuccessfulBackupMs();
  const now = Date.now();
  if (lastMs && now - lastMs < intervalHours * 60 * 60 * 1000) return;

  if (!s.webdavUrl.trim()) {
    log("warn", "backup.auto", "enabled but webdav url missing");
    return;
  }
  if (!s.webdavPassword.trim()) {
    log("warn", "backup.auto", "enabled but webdav password missing");
    return;
  }

  if (autoBackupRunning) return;
  autoBackupRunning = true;

  try {
    await backupToWebDAV({
      webdavUrl: s.webdavUrl,
      webdavUsername: s.webdavUsername,
      webdavPassword: s.webdavPassword,
      autoBackup: true,
      backupInterval: intervalHours,
      retentionCount: s.retentionCount
    });
  } catch (e: any) {
    log("error", "backup.auto", "backup failed", { error: String(e?.message ?? e) });
  } finally {
    autoBackupRunning = false;
  }
}