import { supportedCurrencyCodes } from "./constants/currencies";
import { DEFAULT_NOTIFY_DAYS, DEFAULT_NOTIFY_TIME } from "./constants/config";
import { computeNextDueDate, isValidISODate, type PaymentCycle } from "./services/dates";
import { buildTestContext, validateTemplateOrThrow } from "./services/webhooks";
import { getSettings } from "./helpers/database";
import type { ApiSubscriptionUpsertRequest, ApiWebhookUpsertRequest } from "../../shared/api";

export function normalizeCurrency(code: string): string {
  return code.trim().toUpperCase();
}

export function isValidCurrency(code: string): boolean {
  return supportedCurrencyCodes.has(code);
}

export function isValidLanguage(lang: string): boolean {
  return lang === "zh-CN" || lang === "en";
}

export function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function isValidTimeHHMM(value: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(value)) return false;
  const [h, m] = value.split(":").map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

export function parseNotifyChannelIds(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  const ids: number[] = [];
  for (const v of value) {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return null;
    ids.push(Math.trunc(n));
  }
  return ids;
}

export type SubscriptionInput = ApiSubscriptionUpsertRequest;
export type WebhookInput = ApiWebhookUpsertRequest;

export type ValidationResult =
  | { ok: true; data: any }
  | { ok: false; error: string; status: number };

export function validateSubscriptionInput(input: SubscriptionInput): ValidationResult {
  const icon = input.icon?.trim() ?? null;
  if (icon && icon.length > 16) return { ok: false, error: "icon too long", status: 400 };

  const name = input.name.trim();
  if (!name) return { ok: false, error: "name required", status: 400 };

  const url = input.url?.trim() ?? null;
  if (url && !isValidHttpUrl(url)) return { ok: false, error: "invalid url", status: 400 };

  const logoUrl = input.logoUrl?.trim() ?? null;
  if (logoUrl && !isValidHttpUrl(logoUrl)) return { ok: false, error: "invalid logoUrl", status: 400 };

  const price = Number(input.price);
  if (!Number.isFinite(price) || price < 0) return { ok: false, error: "invalid price", status: 400 };

  const currency = normalizeCurrency(input.currency);
  if (!isValidCurrency(currency)) return { ok: false, error: "invalid currency", status: 400 };

  const paymentCycle = input.paymentCycle as PaymentCycle;
  if (!["monthly", "yearly", "custom_days"].includes(paymentCycle))
    return { ok: false, error: "invalid paymentCycle", status: 400 };

  const customDays = input.customDays !== undefined ? Number(input.customDays) : null;
  if (paymentCycle === "custom_days") {
    if (!customDays || !Number.isFinite(customDays) || customDays <= 0)
      return { ok: false, error: "customDays required", status: 400 };
  }

  const startDate = input.startDate;
  if (!isValidISODate(startDate)) return { ok: false, error: "invalid startDate", status: 400 };

  const nextDueDate = input.nextDueDate ?? null;
  const computedNextDue = computeNextDueDate({
    startDate,
    paymentCycle,
    customDays,
    explicitNextDueDate: nextDueDate
  });
  if (!computedNextDue) return { ok: false, error: "invalid nextDueDate", status: 400 };

  const paymentMethod = input.paymentMethod?.trim() ?? null;

  const notifyEnabled = input.notifyEnabled ? 1 : 0;
  const notifyDays = (input.notifyDays?.trim() ?? DEFAULT_NOTIFY_DAYS) || DEFAULT_NOTIFY_DAYS;
  const notifyTime = (input.notifyTime?.trim() ?? DEFAULT_NOTIFY_TIME) || DEFAULT_NOTIFY_TIME;
  if (!isValidTimeHHMM(notifyTime)) return { ok: false, error: "invalid notifyTime", status: 400 };

  const channelIds = input.notifyChannelIds ? parseNotifyChannelIds(input.notifyChannelIds) : [];
  if (channelIds === null) return { ok: false, error: "invalid notifyChannelIds", status: 400 };
  const notifyChannelIds = channelIds.length ? JSON.stringify(channelIds) : null;

  return {
    ok: true,
    data: {
      icon,
      name,
      logoUrl,
      url,
      price,
      currency,
      paymentCycle,
      customDays,
      startDate,
      nextDueDate: computedNextDue,
      paymentMethod,
      notifyEnabled,
      notifyDays,
      notifyTime,
      notifyChannelIds
    }
  };
}

export function validateWebhookInput(input: WebhookInput): ValidationResult {
  const name = input.name.trim();
  const url = input.url.trim();
  const enabled = input.enabled ? 1 : 0;
  const template = input.template?.trim() || null;

  if (!name) return { ok: false, error: "name required", status: 400 };
  if (!isValidHttpUrl(url)) return { ok: false, error: "invalid url", status: 400 };

  if (template) {
    const settings = getSettings();
    if (!settings) return { ok: false, error: "missing settings", status: 500 };

    try {
      validateTemplateOrThrow(
        template,
        buildTestContext({ timezone: settings.timezone, baseCurrency: settings.base_currency })
      );
    } catch (e: any) {
      return { ok: false, error: String(e?.message ?? e), status: 400 };
    }
  }

  return {
    ok: true,
    data: { name, url, enabled, template }
  };
}
