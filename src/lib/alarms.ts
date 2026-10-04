import { reminderLabel, reminderTimes, DEFAULT_REMINDER_TIME } from "./reminders";
import type { Item } from "./types";

/** Reminders older than this when the app opens are skipped instead of firing late. */
export const STALE_AFTER_MS = 12 * 60 * 60_000;
/** Constant reminders repeat this often until the task is done or snoozed. */
export const REPEAT_EVERY_MS = 5 * 60_000;
/** A constant reminder stops repeating a day after it first rang. */
export const REPEAT_FOR_MS = 24 * 60 * 60_000;
/** Fired-reminder records are forgotten after a week. */
export const FIRED_TTL_MS = 7 * 24 * 60 * 60_000;

export type Alarm = {
  /** Unique per reminder and firing time, so moving the due date re-arms it. */
  key: string;
  itemId: string;
  title: string;
  label: string;
  at: number;
  /** A repeat of a constant reminder. */
  repeat?: boolean;
};

const isActiveTask = (item: Item) =>
  item.kind === "task" && item.status === "open" && item.deletedAt === null && !item.template;

/** Reminders that are due now and have not fired on this device yet, oldest first. */
export function dueAlarms(
  items: Item[],
  now: number,
  fired: Record<string, number>,
  defaultTime = DEFAULT_REMINDER_TIME,
): Alarm[] {
  const alarms: Alarm[] = [];
  for (const item of items) {
    if (!isActiveTask(item)) continue;
    // While snoozed nothing rings; when the snooze ends it rings once more.
    if (item.snoozedUntil) {
      if (item.snoozedUntil > now) continue;
      const key = `${item.id}:snooze:${item.snoozedUntil}`;
      if (!fired[key] && now - item.snoozedUntil <= STALE_AFTER_MS) {
        alarms.push({
          key,
          itemId: item.id,
          title: item.title,
          label: "Snoozed",
          at: item.snoozedUntil,
        });
      }
    }
    for (const { reminder, at } of reminderTimes(item, defaultTime)) {
      if (item.snoozedUntil && at <= item.snoozedUntil) continue;
      const key = `${item.id}:${reminder.id}:${at}`;
      if (at > now || now - at > STALE_AFTER_MS || fired[key]) continue;
      alarms.push({
        key,
        itemId: item.id,
        title: item.title,
        label: reminderLabel(reminder.before),
        at,
      });
    }
  }
  return alarms.sort((a, b) => a.at - b.at);
}

/** Drops fired records older than the TTL; returns the same object when nothing expired. */
export function pruneFired(fired: Record<string, number>, now: number): Record<string, number> {
  const kept = Object.entries(fired).filter(([, at]) => now - at < FIRED_TTL_MS);
  return kept.length === Object.keys(fired).length ? fired : Object.fromEntries(kept);
}

/**
 * Repeats of constant reminders: a task whose reminder rang within the last day, is still open, and was last
 * shown at least REPEAT_EVERY_MS ago rings again.
 */
export function repeatAlarms(
  items: Item[],
  now: number,
  lastShown: Record<string, number>,
  defaultTime = DEFAULT_REMINDER_TIME,
): Alarm[] {
  const alarms: Alarm[] = [];
  for (const item of items) {
    if (!item.constantReminder || !isActiveTask(item)) continue;
    if (item.snoozedUntil && item.snoozedUntil > now) continue;
    const last = lastShown[item.id];
    if (last === undefined || now - last < REPEAT_EVERY_MS) continue;
    const rings = [
      ...reminderTimes(item, defaultTime).map((r) => r.at),
      ...(item.snoozedUntil ? [item.snoozedUntil] : []),
    ];
    const rang = rings.filter((at) => at <= now && now - at < REPEAT_FOR_MS);
    if (!rang.length) continue;
    alarms.push({
      key: `${item.id}:repeat:${now}`,
      itemId: item.id,
      title: item.title,
      label: "Still to do",
      at: now,
      repeat: true,
    });
  }
  return alarms;
}
