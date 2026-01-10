import { db } from "../db";

export type LogLevel = "debug" | "info" | "warn" | "error";

export function log(level: LogLevel, scope: string, message: string, meta?: unknown) {
  const line = `[${level.toUpperCase()}] ${scope}: ${message}`;
  if (level === "error") console.error(line, meta ?? "");
  else if (level === "warn") console.warn(line, meta ?? "");
  else console.log(line, meta ?? "");

  let metaText: string | null = null;
  if (meta !== undefined) {
    try {
      metaText = JSON.stringify(meta);
    } catch {
      metaText = String(meta);
    }
  }
  try {
    db.query(`INSERT INTO logs (level, scope, message, meta) VALUES (?, ?, ?, ?);`).run(
      level,
      scope,
      message,
      metaText
    );
  } catch {
  }
}

