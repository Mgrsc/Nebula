import { Elysia, t } from "elysia";
import { db } from "../db";
import { errorResponse, serverError } from "../helpers/response";
import { asHttpError } from "../helpers/errors";
import { requireAuth } from "../helpers/auth";
import { getSettings } from "../helpers/database";
import { normalizeCurrency, isValidCurrency, isValidLanguage, parseNotifyChannelIds } from "../validators";
import { updateRates } from "../services/rates";
import { log } from "../services/logger";
import { getAuthStatus } from "../services/auth";

function parseStoredChannelIds(value: string | null | undefined): number[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return parseNotifyChannelIds(parsed) ?? [];
  } catch {
    return [];
  }
}

export const settingsRoutes = new Elysia({ prefix: "/api" })
  .get("/settings", ({ headers }) => {
    const status = getAuthStatus();
    const s = getSettings();
    if (!s) return serverError("missing settings");
    const publicDashboard = s.public_dashboard === 0 ? false : true;
    if (status.enabled && status.configured && !publicDashboard) {
      const authCheck = requireAuth()({ headers } as any);
      if (authCheck) return authCheck;
    }
    return {
      timezone: s.timezone,
      language: s.language,
      baseCurrency: s.base_currency,
      publicDashboard,
      defaultWebhookChannelIds: parseStoredChannelIds(s.default_notify_channel_ids),
      exchange: {
        enabled: Boolean(s.exchange_enabled),
        apiKeySet: Boolean(s.exchange_api_key),
        lastUpdate: s.last_rate_update
      }
    };
  })
  .patch(
    "/settings",
    ({ body, headers }) => {
      const authCheck = requireAuth()({ headers } as any);
      if (authCheck) return authCheck;

      const current = getSettings();
      if (!current) return serverError("missing settings");

      const nextTimezone = body.timezone ?? current.timezone;
      const nextLanguage = body.language ?? current.language;
      const nextBaseCurrencyRaw = body.baseCurrency ?? current.base_currency;
      const nextBaseCurrency = normalizeCurrency(nextBaseCurrencyRaw);
      const nextPublicDashboard =
        body.publicDashboard !== undefined ? (body.publicDashboard ? 1 : 0) : (current.public_dashboard ?? 1);
      const nextDefaultNotifyChannelIds =
        body.defaultWebhookChannelIds !== undefined
          ? parseNotifyChannelIds(body.defaultWebhookChannelIds)
          : parseStoredChannelIds(current.default_notify_channel_ids);

      const nextApiKey = body.exchange?.apiKey !== undefined ? body.exchange.apiKey : current.exchange_api_key;
      const nextEnabled =
        body.exchange?.enabled !== undefined ? (body.exchange.enabled ? 1 : 0) : current.exchange_enabled;

      if (!isValidLanguage(nextLanguage)) {
        return errorResponse("invalid language (use zh-CN or en)");
      }
      if (!isValidCurrency(nextBaseCurrency)) {
        return errorResponse("invalid baseCurrency (use 3-letter code like USD)");
      }
      if (nextDefaultNotifyChannelIds === null) {
        return errorResponse("invalid defaultWebhookChannelIds");
      }
      if (nextEnabled && (!nextApiKey || nextApiKey.trim().length === 0)) {
        return errorResponse("exchange enabled but api key missing");
      }

      db.query(
        `UPDATE settings
         SET timezone = ?, language = ?, base_currency = ?, public_dashboard = ?, default_notify_channel_ids = ?, exchange_api_key = ?, exchange_enabled = ?
         WHERE id = 1;`
      ).run(
        nextTimezone,
        nextLanguage,
        nextBaseCurrency,
        nextPublicDashboard,
        nextDefaultNotifyChannelIds.length ? JSON.stringify(nextDefaultNotifyChannelIds) : null,
        nextApiKey,
        nextEnabled
      );

      log("info", "settings.update", "settings updated", {
        timezone: nextTimezone,
        language: nextLanguage,
        public_dashboard: Boolean(nextPublicDashboard),
        default_webhook_channel_count: nextDefaultNotifyChannelIds.length
      });

      return { ok: true };
    },
    {
      body: t.Object({
        timezone: t.Optional(t.String()),
        language: t.Optional(t.String()),
        baseCurrency: t.Optional(t.String()),
        publicDashboard: t.Optional(t.Boolean()),
        defaultWebhookChannelIds: t.Optional(t.Array(t.Number())),
        exchange: t.Optional(
          t.Object({
            enabled: t.Optional(t.Boolean()),
            apiKey: t.Optional(t.String())
          })
        )
      })
    }
  )
  .post("/settings/webhooks/apply-default", ({ headers }) => {
    const authCheck = requireAuth()({ headers } as any);
    if (authCheck) return authCheck;

    const current = getSettings();
    if (!current) return serverError("missing settings");

    const defaultWebhookChannelIds = parseStoredChannelIds(current.default_notify_channel_ids);
    const nextValue = defaultWebhookChannelIds.length ? JSON.stringify(defaultWebhookChannelIds) : null;
    const info = db.query(`UPDATE subscriptions SET notify_channel_ids = ?;`).run(nextValue) as any;

    log("info", "settings.webhooks.apply_default", "applied default webhook channels to all subscriptions", {
      updated_subscriptions: Number(info?.changes ?? 0),
      default_webhook_channel_ids: defaultWebhookChannelIds
    });

    return {
      ok: true,
      updated: Number(info?.changes ?? 0),
      defaultWebhookChannelIds
    };
  })
  .post("/settings/rates/refresh", async ({ headers }) => {
    const authCheck = requireAuth()({ headers } as any);
    if (authCheck) return authCheck;

    try {
      const result = await updateRates({ force: true });
      return { ok: true, ...result };
    } catch (e) {
      const err = asHttpError(e, 500);
      log("warn", "rates.refresh", "failed", { status: err.status, err: err.message });
      return errorResponse(err.message, err.status);
    }
  });
