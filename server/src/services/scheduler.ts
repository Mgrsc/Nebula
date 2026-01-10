import { db } from "../db";
import { getSettings } from "../helpers/database";
import { todayISOInTimeZone, diffDays } from "./time";
import { buildContextFromSubscription, getWebhookChannel, makeDefaultPayload, renderTemplate } from "./webhooks";
import { log } from "./logger";
import { fetchWithTimeout } from "../helpers/fetch";
import { WEBHOOK_TIMEOUT_MS } from "../constants/config";
import { maybeRunAutoBackup } from "./backup";

type SubscriptionRow = {
  id: number;
  name: string;
  notify_enabled: number;
  notify_days: string;
  notify_time: string;
  notify_channel_ids: string | null;
  next_due_date: string;
};

const sentNotifications = new Map<string, string>();

function getNotificationKey(subId: number, daysBefore: number): string {
  return `${subId}-${daysBefore}`;
}

export function shouldSendNotification(
  sub: SubscriptionRow,
  today: string
): Array<number> | null {
  if (!sub.notify_enabled) return null;

  const daysLeft = diffDays(today, sub.next_due_date);

  const notifyDaysList = sub.notify_days
    .split(',')
    .map(d => parseInt(d.trim()))
    .filter(d => !isNaN(d));

  const toNotify: number[] = [];

  for (const daysBefore of notifyDaysList) {
    if (daysLeft === daysBefore) {
      const key = getNotificationKey(sub.id, daysBefore);
      const lastSent = sentNotifications.get(key);

      if (!lastSent || lastSent !== today) {
        toNotify.push(daysBefore);
      }
    }
  }

  return toNotify.length > 0 ? toNotify : null;
}

export async function sendSubscriptionNotifications(
  subId: number,
  daysBefore: number
): Promise<void> {
  const settings = getSettings();
  if (!settings) {
    log("error", "scheduler", "settings not found");
    return;
  }

  const sub = db
    .query<SubscriptionRow, [number]>(`SELECT * FROM subscriptions WHERE id = ?;`)
    .get(subId);

  if (!sub || !sub.notify_enabled) return;

  let channelIds: number[] = [];
  if (sub.notify_channel_ids) {
    try {
      const parsed = JSON.parse(sub.notify_channel_ids);
      if (Array.isArray(parsed)) {
        channelIds = parsed.map(x => Number(x)).filter(Number.isFinite);
      }
    } catch {}
  }

  if (channelIds.length === 0) {
    log("warn", "scheduler", "no channels configured", { sub_id: subId });
    return;
  }

  const ctx = buildContextFromSubscription({
    subId,
    settings: {
      timezone: settings.timezone,
      base_currency: settings.base_currency,
      exchange_enabled: settings.exchange_enabled
    }
  });

  if (!ctx) {
    log("error", "scheduler", "failed to build context", { sub_id: subId });
    return;
  }

  for (const channelId of channelIds) {
    const channel = getWebhookChannel(channelId);
    if (!channel || !channel.enabled) continue;

    try {
      let payload: any = makeDefaultPayload(ctx);

      if (channel.template && channel.template.trim()) {
        try {
          const rendered = renderTemplate(channel.template, ctx);
          payload = JSON.parse(rendered);
        } catch (e: any) {
          log("error", "scheduler.webhook", "template error", {
            channel_id: channelId,
            error: String(e?.message ?? e)
          });
          continue;
        }
      }

      const response = await fetchWithTimeout(
        channel.url,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "user-agent": "Nebula/0.2 (scheduled notification)"
          },
          body: JSON.stringify(payload)
        },
        WEBHOOK_TIMEOUT_MS
      );

      const status = response.ok ? "success" : "failed";
      log(response.ok ? "info" : "warn", "scheduler.webhook", `notification ${status}`, {
        sub_id: subId,
        sub_name: sub.name,
        channel_id: channelId,
        channel_name: channel.name,
        days_before: daysBefore,
        status: response.status
      });

    } catch (e: any) {
      log("error", "scheduler.webhook", "request failed", {
        sub_id: subId,
        channel_id: channelId,
        error: String(e?.message ?? e)
      });
    }
  }

  const today = todayISOInTimeZone(settings.timezone);
  const key = getNotificationKey(subId, daysBefore);
  sentNotifications.set(key, today);
}

export function checkAndSendNotifications(): void {
  const settings = getSettings();
  if (!settings) {
    log("error", "scheduler", "settings not found");
    return;
  }

  const today = todayISOInTimeZone(settings.timezone);
  const currentTime = new Date().toLocaleTimeString('zh-CN', {
    timeZone: settings.timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  log("debug", "scheduler", "checking notifications", { today, currentTime });

  const subs = db
    .query<SubscriptionRow, []>(
      `SELECT id, name, notify_enabled, notify_days, notify_time, notify_channel_ids, next_due_date
       FROM subscriptions
       WHERE notify_enabled = 1;`
    )
    .all();

  for (const sub of subs) {
    const notifyTime = sub.notify_time || "09:00";
    const [targetHour, targetMinute] = notifyTime.split(':').map(Number);
    const [currentHour, currentMinute] = currentTime.split(':').map(Number);

    if (currentHour !== targetHour || Math.abs(currentMinute - targetMinute) > 5) {
      continue;
    }

    const toNotify = shouldSendNotification(sub, today);
    if (toNotify) {
      for (const daysBefore of toNotify) {
        sendSubscriptionNotifications(sub.id, daysBefore).catch((e) => {
          log("error", "scheduler", "notification error", {
            sub_id: sub.id,
            error: String(e?.message ?? e)
          });
        });
      }
    }
  }
}

export function startScheduler(): void {
  const INTERVAL_MS = 5 * 60 * 1000;

  checkAndSendNotifications();
  maybeRunAutoBackup().catch(() => {});

  setInterval(() => {
    checkAndSendNotifications();
    maybeRunAutoBackup().catch(() => {});
  }, INTERVAL_MS);

  log("info", "scheduler", "started", { interval_minutes: 5 });
}
