import { Elysia, t } from "elysia";
import { backupToWebDAV, restoreFromWebDAV, listWebDAVBackups, getBackupHistory } from "../services/backup";
import { db } from "../db";
import { errorResponse, serverError } from "../helpers/response";
import { log } from "../services/logger";
import { requireAuth } from "../helpers/auth";

export const backupRoutes = new Elysia({ prefix: "/api/backup" })
  .get("/config", ({ headers }) => {
    const authCheck = requireAuth()({ headers } as any);
    if (authCheck) return authCheck;

    const settings = db
      .query<{
        backup_webdav_url: string | null;
        backup_webdav_username: string | null;
        backup_webdav_password: string | null;
        backup_auto_enabled: number;
        backup_interval_hours: number;
        backup_retention_count: number;
      }, []>(
        `SELECT backup_webdav_url, backup_webdav_username, backup_webdav_password, backup_auto_enabled, backup_interval_hours, backup_retention_count
         FROM settings WHERE id = 1;`
      )
      .get();

    if (!settings) return serverError("settings not found");

    return {
      webdavUrl: settings.backup_webdav_url || "",
      webdavUsername: settings.backup_webdav_username || "",
      webdavPasswordSet: Boolean(settings.backup_webdav_password),
      autoBackup: Boolean(settings.backup_auto_enabled),
      backupInterval: settings.backup_interval_hours,
      retentionCount: settings.backup_retention_count || 1
    };
  })
  .patch(
    "/config",
    async ({ body, headers }) => {
      const authCheck = requireAuth()({ headers } as any);
      if (authCheck) return authCheck;

      const current = db
        .query<{ backup_webdav_password: string | null }, []>(`SELECT backup_webdav_password FROM settings WHERE id = 1;`)
        .get();
      if (!current) return serverError("settings not found");

      const retentionCount =
        typeof body.retentionCount === "number" && Number.isFinite(body.retentionCount)
          ? Math.max(1, Math.min(100, Math.floor(body.retentionCount)))
          : 1;

      const nextPassword =
        body.webdavPassword !== undefined
          ? body.webdavPassword.trim().length
            ? body.webdavPassword
            : null
          : current.backup_webdav_password;

      db.query(
        `UPDATE settings SET
          backup_webdav_url = ?,
          backup_webdav_username = ?,
          backup_webdav_password = ?,
          backup_auto_enabled = ?,
          backup_interval_hours = ?,
          backup_retention_count = ?
        WHERE id = 1;`
      ).run(
        body.webdavUrl || null,
        body.webdavUsername || null,
        nextPassword,
        body.autoBackup ? 1 : 0,
        body.backupInterval || 24,
        retentionCount
      );

      log("info", "backup.config", "backup config updated");

      return { ok: true };
    },
    {
      body: t.Object({
        webdavUrl: t.Optional(t.String()),
        webdavUsername: t.Optional(t.String()),
        webdavPassword: t.Optional(t.String()),
        autoBackup: t.Optional(t.Boolean()),
        backupInterval: t.Optional(t.Number()),
        retentionCount: t.Optional(t.Number())
      })
    }
  )
  .post("/now", async ({ headers }) => {
    const authCheck = requireAuth()({ headers } as any);
    if (authCheck) return authCheck;

    const settings = db
      .query<{
        backup_webdav_url: string;
        backup_webdav_username: string;
        backup_webdav_password: string;
        backup_retention_count: number;
      }, []>(
        `SELECT backup_webdav_url, backup_webdav_username, backup_webdav_password, backup_retention_count
         FROM settings WHERE id = 1;`
      )
      .get();

    if (!settings || !settings.backup_webdav_url) {
      return errorResponse("WebDAV not configured", 400);
    }

    try {
      await backupToWebDAV({
        webdavUrl: settings.backup_webdav_url,
        webdavUsername: settings.backup_webdav_username || "",
        webdavPassword: settings.backup_webdav_password || "",
        autoBackup: false,
        backupInterval: 24,
        retentionCount: settings.backup_retention_count || 1
      });

      return { ok: true, message: "Backup completed successfully" };
    } catch (e: any) {
      return errorResponse(String(e?.message ?? e), 500);
    }
  })
  .get("/history", ({ headers }) => {
    const authCheck = requireAuth()({ headers } as any);
    if (authCheck) return authCheck;

    const history = getBackupHistory(10);
    return { items: history };
  })
  .get("/list", async ({ headers }) => {
    const authCheck = requireAuth()({ headers } as any);
    if (authCheck) return authCheck;

    const settings = db
      .query<{
        backup_webdav_url: string;
        backup_webdav_username: string;
        backup_webdav_password: string;
        backup_retention_count: number;
      }, []>(
        `SELECT backup_webdav_url, backup_webdav_username, backup_webdav_password, backup_retention_count
         FROM settings WHERE id = 1;`
      )
      .get();

    if (!settings || !settings.backup_webdav_url) {
      return { items: [] };
    }

    try {
      const files = await listWebDAVBackups({
        webdavUrl: settings.backup_webdav_url,
        webdavUsername: settings.backup_webdav_username || "",
        webdavPassword: settings.backup_webdav_password || "",
        autoBackup: false,
        backupInterval: 24,
        retentionCount: settings.backup_retention_count || 1
      });

      return { items: files };
    } catch (e: any) {
      log("error", "backup.list", "failed to list backups", { error: String(e?.message ?? e) });
      return { items: [] };
    }
  })
  .post(
    "/restore",
    async ({ body, headers }) => {
      const authCheck = requireAuth()({ headers } as any);
      if (authCheck) return authCheck;

    const settings = db
      .query<{
        backup_webdav_url: string;
        backup_webdav_username: string;
        backup_webdav_password: string;
        backup_retention_count: number;
      }, []>(
          `SELECT backup_webdav_url, backup_webdav_username, backup_webdav_password, backup_retention_count
           FROM settings WHERE id = 1;`
        )
        .get();

      if (!settings || !settings.backup_webdav_url) {
        return errorResponse("WebDAV not configured", 400);
      }

      try {
        await restoreFromWebDAV(
          {
            webdavUrl: settings.backup_webdav_url,
            webdavUsername: settings.backup_webdav_username || "",
            webdavPassword: settings.backup_webdav_password || "",
            autoBackup: false,
            backupInterval: 24,
            retentionCount: settings.backup_retention_count || 1
          },
          body.filename
        );

        return { ok: true, message: "Restore completed successfully" };
      } catch (e: any) {
        return errorResponse(String(e?.message ?? e), 500);
      }
    },
    {
      body: t.Object({
        filename: t.String()
      })
    }
  );
