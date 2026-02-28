import { db } from "./db";

export function ensureSchema() {
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai',
      language TEXT NOT NULL DEFAULT 'zh-CN',
      base_currency TEXT NOT NULL DEFAULT 'CNY',

      exchange_enabled INTEGER NOT NULL DEFAULT 0,
      exchange_api_key TEXT,
      last_rate_update DATETIME,

      auth_enabled INTEGER NOT NULL DEFAULT 0,
      password_hash TEXT,
      public_dashboard INTEGER NOT NULL DEFAULT 1,
      default_notify_channel_ids TEXT,

      backup_webdav_url TEXT,
      backup_webdav_username TEXT,
      backup_webdav_password TEXT,
      backup_auto_enabled INTEGER NOT NULL DEFAULT 0,
      backup_interval_hours INTEGER NOT NULL DEFAULT 24,
      backup_retention_count INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT UNIQUE NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS backups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      status TEXT NOT NULL,
      message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      icon TEXT,
      logo_url TEXT,
      url TEXT,

      price REAL NOT NULL,
      currency TEXT NOT NULL,

      payment_cycle TEXT NOT NULL DEFAULT 'monthly',
      custom_days INTEGER,

      start_date TEXT NOT NULL,
      next_due_date TEXT NOT NULL,

      payment_method TEXT,
      status TEXT NOT NULL DEFAULT 'active',

      notify_enabled INTEGER NOT NULL DEFAULT 0,
      notify_days TEXT NOT NULL DEFAULT '7,3,1,0',
      notify_time TEXT NOT NULL DEFAULT '09:00',
      notify_channel_ids TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS exchange_rates (
      currency_code TEXT PRIMARY KEY,
      rate REAL NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS webhook_channels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      template TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level TEXT NOT NULL,
      scope TEXT NOT NULL,
      message TEXT NOT NULL,
      meta TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.run(`
    INSERT OR IGNORE INTO settings (id) VALUES (1);
  `);

  try {
    db.run(`ALTER TABLE settings ADD COLUMN default_notify_channel_ids TEXT;`);
  } catch {
  }
}
