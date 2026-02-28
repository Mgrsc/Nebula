export type Language = "zh-CN" | "en";

export type ApiErrorBody = { ok: false; error: string };

export type ApiAuthStatusResponse = {
  enabled: boolean;
  configured: boolean;
  publicDashboard: boolean;
};

export type ApiAuthLoginRequest = { password: string };
export type ApiAuthLoginResponse = { ok: true; token: string; expiresIn: number };

export type ApiAuthSetupRequest = { password: string };
export type ApiAuthChangePasswordRequest = { currentPassword: string; newPassword: string };
export type ApiAuthToggleRequest = { enabled: boolean; password?: string };

export type ApiSettingsResponse = {
  timezone: string;
  language: Language;
  baseCurrency: string;
  publicDashboard: boolean;
  exchange: { enabled: boolean; apiKeySet: boolean; lastUpdate: string | null };
};

export type ApiSettingsPatchRequest = {
  timezone?: string;
  language?: Language;
  baseCurrency?: string;
  publicDashboard?: boolean;
  exchange?: { enabled?: boolean; apiKey?: string };
};

export type ApiRatesRefreshResponse = { ok: true; updated: boolean; at?: string };

export type ApiConverted = { price: number; currency: string } | null;

export type ApiSubsSettings = {
  timezone: string;
  language: Language;
  baseCurrency: string;
  exchangeEnabled: boolean;
  exchangeRates?: Record<string, number> | null;
};

export type ApiSubscription = {
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
  notify_enabled: boolean;
  notify_days: string;
  notify_time: string;
  notify_channel_ids: number[];
  created_at: string;
  days_left: number;
  converted: ApiConverted;
};

export type ApiSubsListResponse = { settings: ApiSubsSettings; items: ApiSubscription[] };

export type ApiSubscriptionUpsertRequest = {
  icon?: string;
  name: string;
  url?: string;
  logoUrl?: string;
  price: number;
  currency: string;
  paymentCycle: string;
  customDays?: number;
  startDate: string;
  nextDueDate?: string;
  paymentMethod?: string;
  notifyEnabled?: boolean;
  notifyDays?: string;
  notifyTime?: string;
  notifyChannelIds?: number[];
};

export type ApiSubscriptionRenewResponse = {
  ok: true;
  startDate: string;
  nextDueDate: string;
};

export type ApiWebhookChannel = {
  id: number;
  name: string;
  url: string;
  template: string | null;
  enabled: boolean;
  created_at: string;
};

export type ApiWebhooksListResponse = { items: ApiWebhookChannel[] };
export type ApiWebhookUpsertRequest = { name: string; url: string; enabled?: boolean; template?: string };

export type ApiWebhookTestRequest = { subscriptionId?: number };
export type ApiWebhookTestResponse = { ok: boolean; status: number; response: string; elapsed_ms: number };

export type ApiBackupConfigResponse = {
  webdavUrl: string;
  webdavUsername: string;
  webdavPasswordSet: boolean;
  autoBackup: boolean;
  backupInterval: number;
  retentionCount: number;
};

export type ApiBackupConfigPatchRequest = {
  webdavUrl?: string;
  webdavUsername?: string;
  webdavPassword?: string;
  autoBackup?: boolean;
  backupInterval?: number;
  retentionCount?: number;
};

export type ApiBackupHistoryItem = {
  id: number;
  type: string;
  status: string;
  message: string | null;
  created_at: string;
};

export type ApiBackupHistoryResponse = { items: ApiBackupHistoryItem[] };

export type ApiBackupListResponse = { items: string[] };
export type ApiBackupRestoreRequest = { filename: string };

export type ApiLogItem = {
  id: number;
  level: string;
  scope: string;
  message: string;
  meta: string | null;
  created_at: string;
};

export type ApiLogsResponse = { items: ApiLogItem[] };
