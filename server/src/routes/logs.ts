import { Elysia, t } from "elysia";
import { db } from "../db";
import { MAX_LOG_LIMIT, DEFAULT_LOG_LIMIT } from "../constants/config";
import { getAuthStatus } from "../services/auth";
import { requireAuth } from "../helpers/auth";

export const logsRoutes = new Elysia({ prefix: "/api" }).get(
  "/logs",
  ({ query, headers }) => {
    const status = getAuthStatus();
    if (status.enabled && status.configured) {
      const authCheck = requireAuth()({ headers } as any);
      if (authCheck) return authCheck;
    }

    const limit = Math.max(1, Math.min(MAX_LOG_LIMIT, Number(query.limit ?? DEFAULT_LOG_LIMIT) || DEFAULT_LOG_LIMIT));
    const rows = db
      .query(`SELECT id, level, scope, message, meta, created_at FROM logs ORDER BY id DESC LIMIT ?;`)
      .all(limit) as any[];
    return { items: rows };
  },
  { query: t.Object({ limit: t.Optional(t.String()) }) }
);

