import { db } from "../db";
import type { SettingsRow } from "../types";

export function getSettings(): SettingsRow | null {
  return db.query<SettingsRow, []>(`SELECT * FROM settings WHERE id = 1;`).get() ?? null;
}

export function parseNumericId(value: string | number): number | null {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

export type ValidTable = "subscriptions" | "webhook_channels" | "settings" | "logs" | "exchange_rates";

export function recordExists(table: ValidTable, id: number): boolean {
  const result = db.query<{ id: number }, [number]>(
    `SELECT id FROM ${table} WHERE id = ?;`
  ).get(id);
  return !!result;
}
