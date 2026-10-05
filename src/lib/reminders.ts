import type { Item, Reminder } from "./types";
import { zonedParts } from "./timezone";
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
/** Turns a date key and HH:MM into a timestamp; the device's local time by default. */
export type ToTime = (dateKey: string, time: string) => number;

export function dueMoment(
  item: Pick<Item, "due" | "dueTime">,
  defaultTime = DEFAULT_REMINDER_TIME,
  toTime: ToTime = atLocal,
): number | null {
  return item.due ? toTime(item.due, item.dueTime ?? defaultTime) : null;
}

/** Each reminder's firing time, earliest first. Empty when the task has no due date. */
export function reminderTimes(
  item: Pick<Item, "due" | "dueTime" | "reminders">,
  defaultTime = DEFAULT_REMINDER_TIME,
  toTime: ToTime = atLocal,
): { reminder: Reminder; at: number }[] {
  const due = dueMoment(item, defaultTime, toTime);
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

export type SnoozeOption = { label: string; until: (now: number, defaultTime?: string) => number };

/** 10 minutes, 1 hour, or tomorrow at the default reminder time. */
export const SNOOZE_OPTIONS: SnoozeOption[] = [
  { label: "10 minutes", until: (now) => now + 10 * 60_000 },
  { label: "1 hour", until: (now) => now + 60 * 60_000 },
  {
    label: "Tomorrow morning",
    until: (now, defaultTime = DEFAULT_REMINDER_TIME) => {
      const d = new Date(now);
      const [h, m] = defaultTime.split(":").map(Number);
      return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, h, m).getTime();
    },
  },
];

export type QuietHours = { start: string; end: string };

/** Whether `now` falls inside quiet hours; windows may cross midnight (22:00–07:00). */
export function isQuietTime(now: number, quiet: QuietHours | null, timeZone?: string): boolean {
  if (!quiet || quiet.start === quiet.end) return false;
  const local = timeZone ? zonedParts(now, timeZone) : null;
  const d = new Date(now);
  const minutes = local ? local.hour * 60 + local.minute : d.getHours() * 60 + d.getMinutes();
  const toMinutes = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const start = toMinutes(quiet.start);
  const end = toMinutes(quiet.end);
  return start < end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
}

export const isClock = (value: unknown): value is string =>
  typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
