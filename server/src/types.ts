export type SettingsRow = {
  timezone: string;
  language: string;
  base_currency: string;
  exchange_enabled: number;
  exchange_api_key: string | null;
  last_rate_update: string | null;
  auth_enabled: number;
  password_hash: string | null;
  public_dashboard: number;
  default_notify_channel_ids: string | null;

  backup_webdav_url?: string | null;
  backup_webdav_username?: string | null;
  backup_webdav_password?: string | null;
  backup_auto_enabled?: number;
  backup_interval_hours?: number;
  backup_retention_count?: number;
};

export type SubscriptionRow = {
  id: number;
  name: string;
  icon: string | null;
  logo_url: string | null;
  url: string | null;
  price: number;
  currency: string;
  payment_cycle: string;
  custom_days: number | null;
  start_date: string;
  next_due_date: string;
  payment_method: string | null;
  status: string;
  notify_enabled: number;
  notify_days: string;
  notify_time: string;
  notify_channel_ids: string | null;
  created_at: string;
};

export type WebhookChannelRow = {
  id: number;
  name: string;
  url: string;
  template: string | null;
  enabled: number;
  created_at: string;
};
