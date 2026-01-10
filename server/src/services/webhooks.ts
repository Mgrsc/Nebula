import { db } from "../db";
import { convertToBaseCurrency } from "./rates";
import { diffDays, todayISOInTimeZone } from "./time";
import type { SettingsRow } from "../types";

export type WebhookContext = {
  name: string;
  price: string;
  currency: string;
  display_price: string;
  display_currency: string;
  days_left: string;
  due_date: string;
  now: string;
};

function escapeJsonString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

export function renderTemplate(template: string, ctx: WebhookContext) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key) => {
    const k = String(key) as keyof WebhookContext;
    const value = ctx[k] ?? "";
    return escapeJsonString(value);
  });
}

export function buildTestContext(args: { timezone: string; baseCurrency: string }) {
  const now = new Date().toISOString();
  const today = todayISOInTimeZone(args.timezone);
  const due = today;
  return {
    name: "Nebula Test",
    price: "10.00",
    currency: "USD",
    display_price: "10.00",
    display_currency: args.baseCurrency,
    days_left: String(diffDays(today, due)),
    due_date: due,
    now
  } satisfies WebhookContext;
}

export function makeDefaultPayload(ctx: WebhookContext) {
  return {
    type: "nebula.webhook.test",
    message: `Nebula webhook test for ${ctx.name}`,
    now: ctx.now,
    subscription: {
      name: ctx.name,
      price: ctx.price,
      currency: ctx.currency,
      display_price: ctx.display_price,
      display_currency: ctx.display_currency,
      days_left: ctx.days_left,
      due_date: ctx.due_date
    }
  };
}

export function validateTemplateOrThrow(template: string, ctx: WebhookContext) {
  const rendered = renderTemplate(template, ctx);
  try {
    JSON.parse(rendered);
  } catch (e: any) {
    throw new Error(`template is not valid JSON after rendering: ${String(e?.message ?? e)}`);
  }
}

export function getWebhookChannel(id: number) {
  return db
    .query<{ id: number; name: string; url: string; enabled: number; template: string | null }, [number]>(
      `SELECT id, name, url, enabled, template FROM webhook_channels WHERE id = ?;`
    )
    .get(id);
}

export type WebhookSettings = Pick<SettingsRow, "timezone" | "base_currency" | "exchange_enabled">;

export function buildContextFromSubscription(args: {
  subId: number;
  settings: WebhookSettings;
}) {
  const sub = db.query<any, [number]>(`SELECT * FROM subscriptions WHERE id = ?;`).get(args.subId);
  if (!sub) return null;

  const today = todayISOInTimeZone(args.settings.timezone);
  const converted =
    args.settings.exchange_enabled === 1
      ? convertToBaseCurrency({
          price: sub.price,
          currency: sub.currency,
          baseCurrency: args.settings.base_currency
        })
      : null;

  const display =
    converted && converted.currency
      ? { price: converted.price.toFixed(2), currency: converted.currency }
      : { price: Number(sub.price).toFixed(2), currency: String(sub.currency) };

  const ctx: WebhookContext = {
    name: String(sub.name ?? ""),
    price: Number(sub.price).toFixed(2),
    currency: String(sub.currency),
    display_price: display.price,
    display_currency: display.currency,
    days_left: String(diffDays(today, String(sub.next_due_date))),
    due_date: String(sub.next_due_date),
    now: new Date().toISOString()
  };
  return ctx;
}
