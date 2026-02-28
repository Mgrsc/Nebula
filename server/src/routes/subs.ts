import { Elysia, t } from "elysia";
import { db } from "../db";
import { requireAuth } from "../helpers/auth";
import { errorResponse, notFound, serverError } from "../helpers/response";
import { log } from "../services/logger";
import { getAuthStatus } from "../services/auth";
import { getSettings, parseNumericId, recordExists } from "../helpers/database";
import { validateSubscriptionInput } from "../validators";
import { todayISOInTimeZone, diffDays } from "../services/time";
import { convertToBaseCurrency } from "../services/rates";
import { computeNextDueDate, type PaymentCycle } from "../services/dates";

export const subsRoutes = new Elysia({ prefix: "/api" })
  .post(
    "/subs",
    ({ body, headers }) => {
      const authCheck = requireAuth()({ headers } as any);
      if (authCheck) return authCheck;

      const validation = validateSubscriptionInput(body);
      if (!validation.ok) {
        return errorResponse(validation.error, validation.status);
      }

      const data = validation.data;
      const info = db
        .query(
          `INSERT INTO subscriptions
            (name, icon, logo_url, url, price, currency, payment_cycle, custom_days, start_date, next_due_date,
             payment_method, notify_enabled, notify_days, notify_time, notify_channel_ids)
           VALUES
            (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`
        )
        .run(
          data.name,
          data.icon,
          data.logoUrl,
          data.url,
          data.price,
          data.currency,
          data.paymentCycle,
          data.customDays,
          data.startDate,
          data.nextDueDate,
          data.paymentMethod,
          data.notifyEnabled,
          data.notifyDays,
          data.notifyTime,
          data.notifyChannelIds
        ) as any;

      log("info", "subscription.create", "subscription created", { id: Number(info?.lastInsertRowid), name: data.name });

      return { ok: true, id: Number(info?.lastInsertRowid) };
    },
    {
      body: t.Object({
        icon: t.Optional(t.String()),
        name: t.String(),
        url: t.Optional(t.String()),
        logoUrl: t.Optional(t.String()),
        price: t.Number(),
        currency: t.String(),
        paymentCycle: t.String(),
        customDays: t.Optional(t.Number()),
        startDate: t.String(),
        nextDueDate: t.Optional(t.String()),
        paymentMethod: t.Optional(t.String()),
        notifyEnabled: t.Optional(t.Boolean()),
        notifyDays: t.Optional(t.String()),
        notifyTime: t.Optional(t.String()),
        notifyChannelIds: t.Optional(t.Array(t.Number()))
      })
    }
  )
  .put(
    "/subs/:id",
    ({ params, body, headers }) => {
      const authCheck = requireAuth()({ headers } as any);
      if (authCheck) return authCheck;

      const id = parseNumericId(params.id);
      if (!id) return errorResponse("invalid id");
      if (!recordExists("subscriptions", id)) return notFound();

      const validation = validateSubscriptionInput(body);
      if (!validation.ok) {
        return errorResponse(validation.error, validation.status);
      }

      const data = validation.data;
      db.query(
        `UPDATE subscriptions SET
          name = ?,
          icon = ?,
          logo_url = ?,
          url = ?,
          price = ?,
          currency = ?,
          payment_cycle = ?,
          custom_days = ?,
          start_date = ?,
          next_due_date = ?,
          payment_method = ?,
          notify_enabled = ?,
          notify_days = ?,
          notify_time = ?,
          notify_channel_ids = ?
         WHERE id = ?;`
      ).run(
        data.name,
        data.icon,
        data.logoUrl,
        data.url,
        data.price,
        data.currency,
        data.paymentCycle,
        data.customDays,
        data.startDate,
        data.nextDueDate,
        data.paymentMethod,
        data.notifyEnabled,
        data.notifyDays,
        data.notifyTime,
        data.notifyChannelIds,
        id
      );

      log("info", "subscription.update", "subscription updated", { id, name: data.name });

      return { ok: true };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        icon: t.Optional(t.String()),
        name: t.String(),
        url: t.Optional(t.String()),
        logoUrl: t.Optional(t.String()),
        price: t.Number(),
        currency: t.String(),
        paymentCycle: t.String(),
        customDays: t.Optional(t.Number()),
        startDate: t.String(),
        nextDueDate: t.Optional(t.String()),
        paymentMethod: t.Optional(t.String()),
        notifyEnabled: t.Optional(t.Boolean()),
        notifyDays: t.Optional(t.String()),
        notifyTime: t.Optional(t.String()),
        notifyChannelIds: t.Optional(t.Array(t.Number()))
      })
    }
  )
  .post(
    "/subs/:id/renew",
    ({ params, headers }) => {
      const authCheck = requireAuth()({ headers } as any);
      if (authCheck) return authCheck;

      const id = parseNumericId(params.id);
      if (!id) return errorResponse("invalid id");

      const sub = db
        .query<
          {
            name: string;
            payment_cycle: string;
            custom_days: number | null;
            start_date: string;
            next_due_date: string;
          },
          [number]
        >(
          `SELECT name, payment_cycle, custom_days, start_date, next_due_date
           FROM subscriptions
           WHERE id = ?;`
        )
        .get(id);
      if (!sub) return notFound();

      const paymentCycle =
        sub.payment_cycle === "monthly" || sub.payment_cycle === "yearly" || sub.payment_cycle === "custom_days"
          ? (sub.payment_cycle as PaymentCycle)
          : null;
      if (!paymentCycle) {
        log("error", "subscription.renew", "invalid payment cycle", {
          id,
          name: sub.name,
          payment_cycle: sub.payment_cycle
        });
        return errorResponse("invalid paymentCycle", 400);
      }

      const startDate = sub.next_due_date;
      const nextDueDate = computeNextDueDate({
        startDate,
        paymentCycle,
        customDays: sub.custom_days
      });
      if (!nextDueDate) {
        log("error", "subscription.renew", "failed to compute next due date", {
          id,
          name: sub.name,
          payment_cycle: paymentCycle,
          custom_days: sub.custom_days ?? null,
          start_date: startDate
        });
        return errorResponse("invalid nextDueDate", 400);
      }

      log("debug", "subscription.renew", "renewal computed", {
        id,
        name: sub.name,
        payment_cycle: paymentCycle,
        custom_days: sub.custom_days ?? null,
        previous_start_date: sub.start_date,
        previous_next_due_date: sub.next_due_date,
        next_start_date: startDate,
        next_due_date: nextDueDate
      });

      db.query(
        `UPDATE subscriptions SET
          start_date = ?,
          next_due_date = ?
         WHERE id = ?;`
      ).run(startDate, nextDueDate, id);

      log("info", "subscription.renew", "subscription renewed", {
        id,
        name: sub.name,
        start_date: startDate,
        next_due_date: nextDueDate,
        payment_cycle: paymentCycle,
        custom_days: sub.custom_days ?? null
      });

      return { ok: true, startDate, nextDueDate };
    },
    {
      params: t.Object({ id: t.String() })
    }
  )
  .delete(
    "/subs/:id",
    ({ params, headers }) => {
      const authCheck = requireAuth()({ headers } as any);
      if (authCheck) return authCheck;

      const id = parseNumericId(params.id);
      if (!id) return errorResponse("invalid id");

      const sub = db.query<{ name: string }, [number]>(`SELECT name FROM subscriptions WHERE id = ?;`).get(id);
      if (!sub) return notFound();

      db.query(`DELETE FROM subscriptions WHERE id = ?;`).run(id);

      log("info", "subscription.delete", "subscription deleted", { id, name: sub?.name });

      return { ok: true };
    },
    { params: t.Object({ id: t.String() }) }
  )
  .get("/subs", ({ headers }) => {
    const status = getAuthStatus();
    const s = getSettings();
    if (!s) return serverError("missing settings");
    const publicDashboard = s.public_dashboard === 0 ? false : true;
    if (status.enabled && status.configured && !publicDashboard) {
      const authCheck = requireAuth()({ headers } as any);
      if (authCheck) return authCheck;
    }

    const today = todayISOInTimeZone(s.timezone);
    const rows = db.query(`SELECT * FROM subscriptions ORDER BY next_due_date ASC;`).all() as any[];

    let exchangeRates: Record<string, number> | null = null;
    if (s.exchange_enabled === 1) {
      exchangeRates = {};
      const rateRows = db.query<{ currency_code: string; rate: number }, [string]>(
        `SELECT currency_code, rate FROM exchange_rates WHERE currency_code != ? ORDER BY currency_code ASC;`
      ).all(s.base_currency);

      for (const r of rateRows) {
        if (r.rate && r.rate > 0) {
          exchangeRates[r.currency_code] = Math.round((1 / r.rate) * 10000) / 10000;
        }
      }
    }

    return {
      settings: {
        timezone: s.timezone,
        language: s.language,
        baseCurrency: s.base_currency,
        exchangeEnabled: Boolean(s.exchange_enabled),
        exchangeRates
      },
      items: rows.map((r) => {
        const converted =
          s.exchange_enabled === 1
            ? convertToBaseCurrency({
                price: r.price,
                currency: r.currency,
                baseCurrency: s.base_currency
              })
            : null;
        let notifyChannelIds: number[] = [];
        if (typeof r.notify_channel_ids === "string" && r.notify_channel_ids.length) {
          try {
            const parsed = JSON.parse(r.notify_channel_ids);
            if (Array.isArray(parsed)) notifyChannelIds = parsed.map((x) => Number(x)).filter(Number.isFinite);
          } catch {}
        }
        const paymentCycle =
          r.payment_cycle === "monthly" || r.payment_cycle === "yearly" || r.payment_cycle === "custom_days"
            ? r.payment_cycle
            : "monthly";
        return {
          id: r.id,
          name: r.name,
          icon: r.icon ?? null,
          logo_url: r.logo_url ?? null,
          url: r.url ?? null,
          price: r.price,
          currency: r.currency,
          payment_cycle: paymentCycle,
          custom_days: r.custom_days ?? null,
          start_date: r.start_date,
          next_due_date: r.next_due_date,
          payment_method: r.payment_method ?? null,
          status: r.status,
          notify_enabled: Boolean(r.notify_enabled),
          notify_days: r.notify_days,
          notify_time: r.notify_time,
          notify_channel_ids: notifyChannelIds,
          created_at: r.created_at,
          days_left: diffDays(today, r.next_due_date),
          converted
        };
      })
    };
  });
