import { db } from "../db";
import { EXCHANGE_RATE_CACHE_HOURS, RATE_FETCH_TIMEOUT_MS } from "../constants/config";
import type { SettingsRow } from "../types";
import { HttpError, asErrorMessage } from "../helpers/errors";
import { fetchWithTimeout } from "../helpers/fetch";

function isRecent(last: string | null, now = Date.now()) {
  if (!last) return false;
  const t = Date.parse(last);
  if (Number.isNaN(t)) return false;
  return now - t < EXCHANGE_RATE_CACHE_HOURS * 60 * 60 * 1000;
}

export async function updateRates(options?: { force?: boolean }) {
  const settings = db.query<SettingsRow, []>(
    `SELECT base_currency, exchange_api_key, exchange_enabled, last_rate_update FROM settings WHERE id = 1;`
  ).get();
  if (!settings) throw new HttpError(500, "missing settings row");
  if (!settings.exchange_enabled) throw new HttpError(400, "exchange is disabled");
  if (!settings.exchange_api_key) throw new HttpError(400, "missing exchange_api_key");

  if (!options?.force && isRecent(settings.last_rate_update)) return { updated: false };

  const url = `https://v6.exchangerate-api.com/v6/${encodeURIComponent(
    settings.exchange_api_key
  )}/latest/${encodeURIComponent(settings.base_currency)}`;

  let res: Response;
  try {
    res = await fetchWithTimeout(url, undefined, RATE_FETCH_TIMEOUT_MS);
  } catch (e) {
    throw new HttpError(502, `rate api request failed: ${asErrorMessage(e)}`);
  }

  if (!res.ok) throw new HttpError(502, `rate api http ${res.status}`);

  let data: any;
  try {
    data = (await res.json()) as any;
  } catch (e) {
    throw new HttpError(502, `rate api json parse failed: ${asErrorMessage(e)}`);
  }
  if (data?.result !== "success" || typeof data?.conversion_rates !== "object") {
    throw new HttpError(502, "rate api result not success");
  }

  const conversionRates = data.conversion_rates as Record<string, number>;
  const nowISO = new Date().toISOString();

  const tx = db.transaction(() => {
    const upsert = db.query(
      `INSERT INTO exchange_rates (currency_code, rate, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(currency_code) DO UPDATE SET rate = excluded.rate, updated_at = excluded.updated_at;`
    );
    for (const [currencyCode, rate] of Object.entries(conversionRates)) {
      if (typeof rate !== "number" || !Number.isFinite(rate)) continue;
      upsert.run(currencyCode, rate, nowISO);
    }
    db.query(`UPDATE settings SET last_rate_update = ? WHERE id = 1;`).run(nowISO);
  });
  tx();

  return { updated: true, at: nowISO };
}

export function convertToBaseCurrency(args: {
  price: number;
  currency: string;
  baseCurrency: string;
}) {
  const { price, currency, baseCurrency } = args;
  if (currency === baseCurrency) {
    return { price, currency: baseCurrency };
  }
  const row = db
    .query<{ rate: number }, [string]>(`SELECT rate FROM exchange_rates WHERE currency_code = ?;`)
    .get(currency);
  if (!row?.rate || !Number.isFinite(row.rate) || row.rate <= 0) return null;

  const converted = price / row.rate;
  return { price: Math.round(converted * 100) / 100, currency: baseCurrency };
}
