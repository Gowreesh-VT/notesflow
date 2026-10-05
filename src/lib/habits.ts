import type { Habit, HabitGoal } from "./types";
import { addDays } from "./utils";

export const MAX_HABIT_NAME = 80;
export const MAX_CHECKINS = 3660;
export const DEFAULT_GOAL: HabitGoal = { per: "day", times: 1 };

const isDateKey = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

export function cleanHabitName(name: string): string | null {
  const clean = name.trim().replace(/\s+/g, " ").slice(0, MAX_HABIT_NAME);
  return clean || null;
}

export function parseGoal(raw: unknown): HabitGoal {
  if (!raw || typeof raw !== "object") return DEFAULT_GOAL;
  const r = raw as Record<string, unknown>;
  const per = r.per === "week" ? "week" : "day";
  const max = per === "week" ? 7 : 1;
  const times =
    typeof r.times === "number" && Number.isInteger(r.times)
      ? Math.min(max, Math.max(1, r.times))
      : 1;
  return { per, times };
}

/** Sorted, unique, valid check-in dates (the newest kept if there are too many). */
export function cleanCheckins(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter(isDateKey))].sort().slice(-MAX_CHECKINS);
}

/** Adds or removes a check-in for `date`. */
export function toggleCheckin(checkins: string[], date: string): string[] {
  return checkins.includes(date)
    ? checkins.filter((d) => d !== date)
    : cleanCheckins([...checkins, date]);
}

export const isDoneOn = (habit: Pick<Habit, "checkins">, date: string): boolean =>
  habit.checkins.includes(date);

/** The last `count` days ending today, oldest first. */
export const lastDays = (today: string, count: number): string[] =>
  Array.from({ length: count }, (_, i) => addDays(today, i - (count - 1)));
