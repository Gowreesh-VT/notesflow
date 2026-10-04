import type { Item, Reminder } from "./types";
import { createId } from "./utils";

/** All-day tasks are reminded relative to this time on their due date (configurable later in settings). */
export const DEFAULT_REMINDER_TIME = "09:00";
export const MAX_REMINDERS = 5;
/** Longest lead time: one week, in minutes. */
export const MAX_REMINDER_LEAD = 7 * 24 * 60;

export const REMINDER_PRESETS = [0, 5, 15, 30, 60, 120, 1440];

/** 0 → "At due time", 15 → "15 minutes before", 1440 → "1 day before". */
export function reminderLabel(before: number): string {
  if (before === 0) return "At due time";
  if (before % 1440 === 0) return `${before / 1440} day${before === 1440 ? "" : "s"} before`;
  if (before % 60 === 0) return `${before / 60} hour${before === 60 ? "" : "s"} before`;
  return `${before} minute${before === 1 ? "" : "s"} before`;
}

/** Local timestamp of a date key plus an HH:MM time. */
export function atLocal(dateKey: string, time: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  return new Date(y, m - 1, d, h, min).getTime();
}

/** When the task is due: its time on the due date, or the default reminder time for all-day tasks. */
export function dueMoment(
  item: Pick<Item, "due" | "dueTime">,
  defaultTime = DEFAULT_REMINDER_TIME,
): number | null {
  return item.due ? atLocal(item.due, item.dueTime ?? defaultTime) : null;
}

/** Each reminder's firing time, earliest first. Empty when the task has no due date. */
export function reminderTimes(
  item: Pick<Item, "due" | "dueTime" | "reminders">,
  defaultTime = DEFAULT_REMINDER_TIME,
): { reminder: Reminder; at: number }[] {
  const due = dueMoment(item, defaultTime);
  if (due === null) return [];
  return (item.reminders ?? [])
    .map((reminder) => ({ reminder, at: due - reminder.before * 60_000 }))
    .sort((a, b) => a.at - b.at);
}

export const makeReminder = (before: number): Reminder => ({ id: createId(), before });

/** Valid lead times only, no duplicates, at most five, sorted from the earliest lead. */
export function parseReminders(raw: unknown): Reminder[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<number>();
  const reminders = raw.flatMap((value: unknown): Reminder[] => {
    if (!value || typeof value !== "object") return [];
    const r = value as Record<string, unknown>;
    const before = r.before;
    if (typeof r.id !== "string" || !r.id) return [];
    if (typeof before !== "number" || !Number.isInteger(before)) return [];
    if (before < 0 || before > MAX_REMINDER_LEAD || seen.has(before)) return [];
    seen.add(before);
    return [{ id: r.id, before }];
  });
  return reminders.sort((a, b) => b.before - a.before).slice(0, MAX_REMINDERS);
}
