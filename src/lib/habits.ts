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

/** Monday of the week containing `date`. */
function weekStart(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return addDays(date, -((new Date(y, m - 1, d).getDay() + 6) % 7));
}

/** Check-ins in the current period (today, or this Monday–Sunday week) and the target for it. */
export function periodProgress(
  habit: Pick<Habit, "checkins" | "goal">,
  today: string,
): { done: number; target: number; met: boolean } {
  const target = habit.goal.per === "day" ? 1 : habit.goal.times;
  const from = habit.goal.per === "day" ? today : weekStart(today);
  const done = habit.checkins.filter((d) => d >= from && d <= today).length;
  return { done, target, met: done >= target };
}

/**
 * Current and best streaks. Daily habits count consecutive days; weekly goals count consecutive weeks that met the
 * goal. The current streak does not break just because today (or this week) is not done yet.
 */
export function habitStreaks(
  habit: Pick<Habit, "checkins" | "goal">,
  today: string,
): { current: number; best: number; unit: "day" | "week" } {
  const days = new Set(habit.checkins);
  if (habit.goal.per === "day") {
    let current = 0;
    let cursor = days.has(today) ? today : addDays(today, -1);
    while (days.has(cursor)) {
      current++;
      cursor = addDays(cursor, -1);
    }
    let best = 0;
    let run = 0;
    let previous: string | null = null;
    for (const day of [...days].sort()) {
      run = previous && addDays(previous, 1) === day ? run + 1 : 1;
      best = Math.max(best, run);
      previous = day;
    }
    return { current, best: Math.max(best, current), unit: "day" };
  }

  const perWeek = new Map<string, number>();
  for (const day of days) {
    const week = weekStart(day);
    perWeek.set(week, (perWeek.get(week) ?? 0) + 1);
  }
  const met = (week: string) => (perWeek.get(week) ?? 0) >= habit.goal.times;
  const thisWeek = weekStart(today);
  let current = 0;
  let cursor = met(thisWeek) ? thisWeek : addDays(thisWeek, -7);
  while (met(cursor)) {
    current++;
    cursor = addDays(cursor, -7);
  }
  let best = 0;
  let run = 0;
  let previous: string | null = null;
  for (const week of [...perWeek.keys()].filter(met).sort()) {
    run = previous && addDays(previous, 7) === week ? run + 1 : 1;
    best = Math.max(best, run);
    previous = week;
  }
  return { current, best: Math.max(best, current), unit: "week" };
}

/** Days of a month as weeks (Monday first), with null padding: the heat-map grid. */
export function monthGrid(year: number, month: number): (string | null)[][] {
  const first = `${year}-${String(month).padStart(2, "0")}-01`;
  const daysInMonth = new Date(year, month, 0).getDate();
  const lead = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const cells: (string | null)[] = [
    ...Array<null>(lead).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => addDays(first, i)),
  ];
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}
