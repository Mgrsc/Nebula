import { db } from "../db";
import { log } from "./logger";

const SESSION_EXPIRY_HOURS = 24 * 7;

function pepperedPassword(password: string): string {
  const pepper = process.env.AUTH_SALT ?? "";
  return pepper ? `${password}\u0000${pepper}` : password;
}

export async function hashPassword(password: string): Promise<string> {
  return await Bun.password.hash(pepperedPassword(password));
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await Bun.password.verify(pepperedPassword(password), hash);
  } catch {
    return false;
  }
}

export function generateToken(): string {
  return crypto.randomUUID() + "-" + Date.now().toString(36);
}

export function createSession(token: string): void {
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_HOURS * 60 * 60 * 1000).toISOString();
  db.query(`INSERT INTO sessions (token, expires_at) VALUES (?, ?);`).run(token, expiresAt);
  log("info", "auth", "session created", { expires_at: expiresAt });
}

export function validateSession(token: string): boolean {
  const session = db
    .query<{ expires_at: string }, [string]>(`SELECT expires_at FROM sessions WHERE token = ?;`)
    .get(token);

  if (!session) return false;

  const expiresAt = new Date(session.expires_at).getTime();
  const now = Date.now();

  if (now > expiresAt) {
    db.query(`DELETE FROM sessions WHERE token = ?;`).run(token);
    log("info", "auth", "session expired", { token: token.slice(0, 8) });
    return false;
  }

  return true;
}

export function deleteSession(token: string): void {
  db.query(`DELETE FROM sessions WHERE token = ?;`).run(token);
  log("info", "auth", "session deleted", { token: token.slice(0, 8) });
}

export function cleanExpiredSessions(): void {
  const now = new Date().toISOString();
  const result = db.query(`DELETE FROM sessions WHERE expires_at < ?;`).run(now) as any;
  if (result.changes > 0) {
    log("info", "auth", "cleaned expired sessions", { count: result.changes });
  }
}

export function getAuthStatus(): { enabled: boolean; configured: boolean; publicDashboard: boolean } {
  const settings = db
    .query<{ auth_enabled: number; password_hash: string | null; public_dashboard: number | null }, []>(
      `SELECT auth_enabled, password_hash, public_dashboard FROM settings WHERE id = 1;`
    )
    .get();

  if (!settings) return { enabled: false, configured: false, publicDashboard: true };

  return {
    enabled: Boolean(settings.auth_enabled),
    configured: Boolean(settings.password_hash),
    publicDashboard: settings.public_dashboard === 0 ? false : true
  };
}

export async function setPassword(password: string, enabled: boolean = true): Promise<void> {
  const hash = await hashPassword(password);
  db.query(`UPDATE settings SET password_hash = ?, auth_enabled = ? WHERE id = 1;`).run(
    hash,
    enabled ? 1 : 0
  );
  log("info", "auth", "password updated", { enabled });
}

export function disableAuth(): void {
  db.query(`UPDATE settings SET auth_enabled = 0 WHERE id = 1;`).run();
  db.query(`DELETE FROM sessions;`).run();
  log("info", "auth", "authentication disabled");
}
