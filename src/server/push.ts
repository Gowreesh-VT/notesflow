import { and, eq, gte, inArray, lt } from "drizzle-orm";
import { dueAlarms, FIRED_TTL_MS, repeatAlarms, type Alarm } from "@/lib/alarms";
import { parseItem } from "@/lib/backup";
import { isClock, isQuietTime } from "@/lib/reminders";
import { atZone, isTimeZone } from "@/lib/timezone";
import type { Item } from "@/lib/types";
import type { Db } from "./db";
import { pushDeliveries, pushSubscriptions, syncRecords } from "./schema";

export type PushSubscriptionInput = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  timeZone: string;
  defaultReminderTime: string;
  quietHours: { start: string; end: string } | null;
};

/** What the service worker receives; it shows this as the notification. */
export type PushPayload = {
  title: string;
  body: string;
  tag: string;
  itemId: string;
  requireInteraction: boolean;
};

export type SendResult = "sent" | "gone" | "failed";
export type Sender = (
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: PushPayload,
) => Promise<SendResult>;

const MAX_ENDPOINT = 2048;

/** Checks a subscription from the browser; returns null when anything looks wrong. */
export function parseSubscriptionInput(raw: unknown): PushSubscriptionInput | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const keys = r.keys as Record<string, unknown> | undefined;
  const quiet = r.quietHours as Record<string, unknown> | null | undefined;
  if (typeof r.endpoint !== "string" || r.endpoint.length > MAX_ENDPOINT) return null;
  let url: URL;
  try {
    url = new URL(r.endpoint);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (!keys || typeof keys.p256dh !== "string" || typeof keys.auth !== "string") return null;
  if (keys.p256dh.length > 200 || keys.auth.length > 100) return null;
  if (!isTimeZone(r.timeZone) || !isClock(r.defaultReminderTime)) return null;
  const quietHours =
    quiet && isClock(quiet.start) && isClock(quiet.end)
      ? { start: quiet.start as string, end: quiet.end as string }
      : null;
  return {
    endpoint: r.endpoint,
    keys: { p256dh: keys.p256dh, auth: keys.auth },
    timeZone: r.timeZone,
    defaultReminderTime: r.defaultReminderTime,
    quietHours,
  };
}

/** Saves (or moves to this user, or updates the settings of) a device's subscription. */
export async function saveSubscription(
  db: Db,
  userId: string,
  input: PushSubscriptionInput,
  now = Date.now(),
): Promise<void> {
  const values = {
    endpoint: input.endpoint,
    userId,
    p256dh: input.keys.p256dh,
    auth: input.keys.auth,
    timeZone: input.timeZone,
    defaultReminderTime: input.defaultReminderTime,
    quietStart: input.quietHours?.start ?? null,
    quietEnd: input.quietHours?.end ?? null,
    createdAt: now,
    updatedAt: now,
  };
  // A device that changed hands must not keep the previous account's delivery history.
  const [existing] = await db
    .select({ userId: pushSubscriptions.userId })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, input.endpoint));
  if (existing && existing.userId !== userId) {
    await db.delete(pushDeliveries).where(eq(pushDeliveries.endpoint, input.endpoint));
  }
  await db
    .insert(pushSubscriptions)
    .values(values)
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: {
        userId,
        p256dh: values.p256dh,
        auth: values.auth,
        timeZone: values.timeZone,
        defaultReminderTime: values.defaultReminderTime,
        quietStart: values.quietStart,
        quietEnd: values.quietEnd,
        updatedAt: now,
      },
    });
}

/** Removes a device's subscription; only its owner can. */
export async function deleteSubscription(db: Db, userId: string, endpoint: string): Promise<void> {
  await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, userId)));
}

const bodyFor = (alarm: Alarm) => `Reminder · ${alarm.label}`;

/**
 * Sends every reminder that is due now to every subscribed device, once per device. Meant to run about once a
 * minute from a scheduler. Devices in quiet hours are skipped and catch up when quiet hours end; devices the
 * push service reports as gone are removed.
 */
export async function sendDueReminders(
  db: Db,
  send: Sender,
  now = Date.now(),
): Promise<{ devices: number; sent: number; removed: number }> {
  const subscriptions = await db.select().from(pushSubscriptions);
  if (!subscriptions.length) return { devices: 0, sent: 0, removed: 0 };

  // Forget old deliveries; they are only needed to avoid repeats within the reminder window.
  await db.delete(pushDeliveries).where(lt(pushDeliveries.sentAt, now - FIRED_TTL_MS));

  const userIds = [...new Set(subscriptions.map((s) => s.userId))];
  const rows = await db
    .select({ userId: syncRecords.userId, data: syncRecords.data })
    .from(syncRecords)
    .where(
      and(
        inArray(syncRecords.userId, userIds),
        eq(syncRecords.collection, "item"),
        eq(syncRecords.deleted, false),
      ),
    );
  const itemsByUser = new Map<string, Item[]>();
  for (const row of rows) {
    const item = parseItem(row.data, now);
    if (!item || item.kind !== "task" || !(item.reminders?.length || item.snoozedUntil)) continue;
    const list = itemsByUser.get(row.userId) ?? [];
    list.push(item);
    itemsByUser.set(row.userId, list);
  }

  const deliveries = await db
    .select()
    .from(pushDeliveries)
    .where(gte(pushDeliveries.sentAt, now - FIRED_TTL_MS));
  const firedByEndpoint = new Map<string, Record<string, number>>();
  const lastShownByEndpoint = new Map<string, Record<string, number>>();
  for (const d of deliveries) {
    const fired = firedByEndpoint.get(d.endpoint) ?? {};
    fired[d.key] = d.sentAt;
    firedByEndpoint.set(d.endpoint, fired);
    const last = lastShownByEndpoint.get(d.endpoint) ?? {};
    last[d.itemId] = Math.max(last[d.itemId] ?? 0, d.sentAt);
    lastShownByEndpoint.set(d.endpoint, last);
  }

  let sent = 0;
  let removed = 0;
  for (const sub of subscriptions) {
    const items = itemsByUser.get(sub.userId);
    if (!items?.length) continue;
    const quiet =
      sub.quietStart && sub.quietEnd ? { start: sub.quietStart, end: sub.quietEnd } : null;
    if (isQuietTime(now, quiet, sub.timeZone)) continue;

    const toTime = atZone(sub.timeZone);
    const alarms = [
      ...dueAlarms(
        items,
        now,
        firedByEndpoint.get(sub.endpoint) ?? {},
        sub.defaultReminderTime,
        toTime,
      ),
      ...repeatAlarms(
        items,
        now,
        lastShownByEndpoint.get(sub.endpoint) ?? {},
        sub.defaultReminderTime,
        toTime,
      ),
    ];

    for (const alarm of alarms) {
      // Claim the delivery first, so overlapping runs never send the same reminder twice.
      const claimed = await db
        .insert(pushDeliveries)
        .values({ endpoint: sub.endpoint, key: alarm.key, itemId: alarm.itemId, sentAt: now })
        .onConflictDoNothing()
        .returning({ key: pushDeliveries.key });
      if (!claimed.length) continue;

      const item = items.find((i) => i.id === alarm.itemId);
      const result = await send(sub, {
        title: alarm.title,
        body: bodyFor(alarm),
        // Same tags as the in-app notifications, so a device that shows both only shows one.
        tag: alarm.repeat ? `repeat:${alarm.itemId}` : alarm.key,
        itemId: alarm.itemId,
        requireInteraction: Boolean(item?.constantReminder),
      });
      if (result === "sent") sent++;
      // A temporary failure releases the claim, so the next run tries again (until the reminder is stale).
      if (result === "failed") {
        await db
          .delete(pushDeliveries)
          .where(and(eq(pushDeliveries.endpoint, sub.endpoint), eq(pushDeliveries.key, alarm.key)));
      }
      if (result === "gone") {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, sub.endpoint));
        removed++;
        break;
      }
    }
  }
  return { devices: subscriptions.length, sent, removed };
}
