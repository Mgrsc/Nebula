import { Elysia, t } from "elysia";
import {
  getAuthStatus,
  verifyPassword,
  generateToken,
  createSession,
  deleteSession,
  setPassword,
  disableAuth,
  validateSession
} from "../services/auth";
import { db } from "../db";
import { errorResponse } from "../helpers/response";
import { log } from "../services/logger";
import { requireAuth } from "../helpers/auth";

export const authRoutes = new Elysia({ prefix: "/api/auth" })
  .get("/status", () => {
    const status = getAuthStatus();
    return {
      enabled: status.enabled,
      configured: status.configured,
      publicDashboard: status.publicDashboard
    };
  })
  .get("/me", ({ headers }) => {
    const authCheck = requireAuth()({ headers } as any);
    if (authCheck) return authCheck;
    return { ok: true };
  })
  .post(
    "/setup",
    async ({ body }) => {
      const status = getAuthStatus();
      if (status.configured) {
        return errorResponse("Password already configured. Use /change-password instead.", 400);
      }

      if (!body.password || body.password.length < 6) {
        return errorResponse("Password must be at least 6 characters", 400);
      }

      await setPassword(body.password, true);
      log("info", "auth.setup", "password configured");

      return { ok: true, message: "Password configured successfully" };
    },
    {
      body: t.Object({
        password: t.String()
      })
    }
  )
  .post(
    "/login",
    async ({ body }) => {
      const status = getAuthStatus();

      if (!status.enabled) {
        return errorResponse("Authentication is disabled", 400);
      }

      if (!status.configured) {
        return errorResponse("No password configured", 400);
      }

      const settings = db
        .query<{ password_hash: string }, []>(`SELECT password_hash FROM settings WHERE id = 1;`)
        .get();

      if (!settings?.password_hash) {
        return errorResponse("No password configured", 500);
      }

      const isValid = await verifyPassword(body.password, settings.password_hash);
      if (!isValid) {
        log("warn", "auth.login", "invalid password attempt");
        return errorResponse("Invalid password", 401);
      }

      const token = generateToken();
      createSession(token);

      log("info", "auth.login", "login successful");

      return {
        ok: true,
        token,
        expiresIn: 7 * 24 * 60 * 60
      };
    },
    {
      body: t.Object({
        password: t.String()
      })
    }
  )
  .post(
    "/logout",
    ({ headers }) => {
      const authHeader = headers.authorization || headers.Authorization;
      if (authHeader) {
        const token = authHeader.replace(/^Bearer\s+/i, "");
        deleteSession(token);
      }
      return { ok: true };
    }
  )
  .post(
    "/change-password",
    async ({ body }) => {
      const status = getAuthStatus();

      if (!status.configured) {
        return errorResponse("No password configured", 400);
      }

      const settings = db
        .query<{ password_hash: string }, []>(`SELECT password_hash FROM settings WHERE id = 1;`)
        .get();

      if (!settings?.password_hash) {
        return errorResponse("No password configured", 500);
      }

      const isValid = await verifyPassword(body.currentPassword, settings.password_hash);
      if (!isValid) {
        log("warn", "auth.change", "invalid current password");
        return errorResponse("Invalid current password", 401);
      }

      if (!body.newPassword || body.newPassword.length < 6) {
        return errorResponse("New password must be at least 6 characters", 400);
      }

      await setPassword(body.newPassword, status.enabled);

      db.query(`DELETE FROM sessions;`).run();

      log("info", "auth.change", "password changed, all sessions cleared");

      return { ok: true, message: "Password changed successfully. Please login again." };
    },
    {
      body: t.Object({
        currentPassword: t.String(),
        newPassword: t.String()
      })
    }
  )
  .post(
    "/toggle",
    async ({ body, headers }) => {
      const status = getAuthStatus();

      if (!status.configured && body.enabled) {
        return errorResponse("Cannot enable auth without password. Use /setup first.", 400);
      }

      if (status.configured) {
        const authHeader = headers.authorization || headers.Authorization;
        const token = authHeader ? authHeader.replace(/^Bearer\s+/i, "") : null;

        const tokenValid = Boolean(token && status.enabled && validateSession(token));
        if (!tokenValid) {
          if (!body.password || body.password.trim().length === 0) {
            return errorResponse("Password required", 401);
          }

          const settings = db
            .query<{ password_hash: string }, []>(`SELECT password_hash FROM settings WHERE id = 1;`)
            .get();

          if (!settings?.password_hash) {
            return errorResponse("No password configured", 500);
          }

          const ok = await verifyPassword(body.password, settings.password_hash);
          if (!ok) return errorResponse("Invalid password", 401);
        }
      }

      if (body.enabled) {
        db.query(`UPDATE settings SET auth_enabled = 1 WHERE id = 1;`).run();
        log("info", "auth.toggle", "authentication enabled");
      } else {
        disableAuth();
      }

      return { ok: true, enabled: body.enabled };
    },
    {
      body: t.Object({
        enabled: t.Boolean(),
        password: t.Optional(t.String())
      })
    }
  );
