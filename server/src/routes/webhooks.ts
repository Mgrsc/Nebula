import { Elysia, t } from "elysia";
import { db } from "../db";
import { requireAuth } from "../helpers/auth";
import { errorResponse, notFound, serverError } from "../helpers/response";
import { log } from "../services/logger";
import { getAuthStatus } from "../services/auth";
import { WEBHOOK_TIMEOUT_MS } from "../constants/config";
import { buildContextFromSubscription, buildTestContext, getWebhookChannel, makeDefaultPayload, renderTemplate } from "../services/webhooks";
import { getSettings, parseNumericId, recordExists } from "../helpers/database";
import { validateWebhookInput } from "../validators";
import { fetchWithTimeout } from "../helpers/fetch";

export const webhooksRoutes = new Elysia({ prefix: "/api" })
  .get("/webhooks", ({ headers }) => {
    const status = getAuthStatus();
    if (status.enabled && status.configured) {
      const authCheck = requireAuth()({ headers } as any);
      if (authCheck) return authCheck;
    }

    const rows = db
      .query(`SELECT id, name, url, template, enabled, created_at FROM webhook_channels ORDER BY id DESC;`)
      .all() as any[];
    return { items: rows.map((r) => ({ ...r, enabled: Boolean(r.enabled) })) };
  })
  .post(
    "/webhooks",
    ({ body, headers }) => {
      const authCheck = requireAuth()({ headers } as any);
      if (authCheck) return authCheck;

      const validation = validateWebhookInput(body);
      if (!validation.ok) {
        return errorResponse(validation.error, validation.status);
      }

      const data = validation.data;
      const info = db
        .query(`INSERT INTO webhook_channels (name, url, template, enabled) VALUES (?, ?, ?, ?);`)
        .run(data.name, data.url, data.template, data.enabled) as any;

      log("info", "webhook.create", "webhook created", { id: Number(info?.lastInsertRowid), name: data.name });

      return { ok: true, id: Number(info?.lastInsertRowid) };
    },
    {
      body: t.Object({
        name: t.String(),
        url: t.String(),
        enabled: t.Optional(t.Boolean()),
        template: t.Optional(t.String())
      })
    }
  )
  .put(
    "/webhooks/:id",
    ({ params, body, headers }) => {
      const authCheck = requireAuth()({ headers } as any);
      if (authCheck) return authCheck;

      const id = parseNumericId(params.id);
      if (!id) return errorResponse("invalid id");
      if (!recordExists("webhook_channels", id)) return notFound();

      const validation = validateWebhookInput(body);
      if (!validation.ok) {
        return errorResponse(validation.error, validation.status);
      }

      const data = validation.data;
      db.query(`UPDATE webhook_channels SET name = ?, url = ?, template = ?, enabled = ? WHERE id = ?;`).run(
        data.name,
        data.url,
        data.template,
        data.enabled,
        id
      );

      log("info", "webhook.update", "webhook updated", { id, name: data.name });

      return { ok: true };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        name: t.String(),
        url: t.String(),
        enabled: t.Boolean(),
        template: t.Optional(t.String())
      })
    }
  )
  .post(
    "/webhooks/:id/test",
    async ({ params, body, headers }) => {
      const authCheck = requireAuth()({ headers } as any);
      if (authCheck) return authCheck;

      const id = parseNumericId(params.id);
      if (!id) return errorResponse("invalid id");
      const ch = getWebhookChannel(id);
      if (!ch) return notFound();

      const startedAt = Date.now();
      log("info", "webhook.test", "start", { id: ch.id, name: ch.name, url: ch.url, enabled: ch.enabled });

      const s = getSettings();
      if (!s) return serverError("missing settings");

      const subId = body?.subscriptionId !== undefined ? Number(body.subscriptionId) : null;
      let ctx =
        subId && Number.isFinite(subId) ? buildContextFromSubscription({ subId, settings: s }) : null;
      if (!ctx) ctx = buildTestContext({ timezone: s.timezone, baseCurrency: s.base_currency });

      let payload: any = makeDefaultPayload(ctx);
      if (ch.template && ch.template.trim().length) {
        try {
          const rendered = renderTemplate(ch.template, ctx);
          payload = JSON.parse(rendered);
        } catch (e: any) {
          const elapsedMs = Date.now() - startedAt;
          log("error", "webhook.test", "template render/parse failed", { id: ch.id, err: String(e?.message ?? e) });
          return { ok: false, status: 0, response: `template error: ${String(e?.message ?? e)}`, elapsed_ms: elapsedMs };
        }
      }

      try {
        const res = await fetchWithTimeout(
          ch.url,
          {
            method: "POST",
            headers: { "content-type": "application/json", "user-agent": "Nebula/0.1 (webhook test)" },
            body: JSON.stringify(payload)
          },
          WEBHOOK_TIMEOUT_MS
        );
        const text = await res.text().catch(() => "");
        const elapsedMs = Date.now() - startedAt;
        log(res.ok ? "info" : "warn", "webhook.test", "done", {
          id: ch.id,
          status: res.status,
          elapsed_ms: elapsedMs,
          response_preview: text.slice(0, 400)
        });
        return { ok: res.ok, status: res.status, response: text.slice(0, 2000), elapsed_ms: elapsedMs };
      } catch (e: any) {
        const elapsedMs = Date.now() - startedAt;
        const msg = String(e?.message ?? e);
        const isTimeout = msg.toLowerCase().includes("timeout");
        log("error", "webhook.test", isTimeout ? "timeout" : "request failed", {
          id: ch.id,
          elapsed_ms: elapsedMs,
          err: msg
        });
        return { ok: false, status: 0, response: isTimeout ? "timeout" : msg, elapsed_ms: elapsedMs };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Optional(
        t.Object({
          subscriptionId: t.Optional(t.Number())
        })
      )
    }
  )
  .delete(
    "/webhooks/:id",
    ({ params, headers }) => {
      const authCheck = requireAuth()({ headers } as any);
      if (authCheck) return authCheck;

      const id = parseNumericId(params.id);
      if (!id) return errorResponse("invalid id");

      db.query(`DELETE FROM webhook_channels WHERE id = ?;`).run(id);

      log("info", "webhook.delete", "webhook deleted", { id });

      return { ok: true };
    },
    { params: t.Object({ id: t.String() }) }
  );
