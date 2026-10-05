import type { Item } from "./types";
import { addDays, toDateKey } from "./utils";
import { weekdayPosition } from "./locale";

export type FocusStats = {
  todayMinutes: number;
  weekMinutes: number;
  /** Completed focus stretches this week. */
  weekSessions: number;
  /** Last `days` days, oldest first. */
  days: { date: string; minutes: number }[];
  /** This week, by list id (Inbox included), largest first. */
  byList: { listId: string; minutes: number }[];
};

/** First day (as set in preferences; Monday by default) of the week containing `dateKey`. */
export const weekStartOf = (dateKey: string): string => addDays(dateKey, -weekdayPosition(dateKey));

/**
 * Focus time from Pomodoro entries on tasks (trashed and template tasks included only if not deleted). A stretch
 * counts on the local day it started.
 */
export function focusStats(items: Item[], today: string, days = 7): FocusStats {
  const weekStart = weekStartOf(today);
  const first = addDays(today, -(days - 1));
  const perDay = new Map<string, number>();
  const perList = new Map<string, number>();
  let weekMinutes = 0;
  let weekSessions = 0;

  for (const item of items) {
    if (item.template) continue;
    for (const entry of item.timeEntries ?? []) {
      if (!entry.focus || entry.end === null) continue;
      const minutes = (entry.end - entry.start) / 60_000;
      const date = toDateKey(new Date(entry.start));
      if (date >= first && date <= today) perDay.set(date, (perDay.get(date) ?? 0) + minutes);
      if (date >= weekStart && date <= today) {
        weekMinutes += minutes;
        weekSessions++;
        perList.set(item.listId, (perList.get(item.listId) ?? 0) + minutes);
      }
    }
  }

  return {
    todayMinutes: Math.round(perDay.get(today) ?? 0),
    weekMinutes: Math.round(weekMinutes),
    weekSessions,
    days: Array.from({ length: days }, (_, i) => {
      const date = addDays(first, i);
      return { date, minutes: Math.round(perDay.get(date) ?? 0) };
    }),
    byList: [...perList.entries()]
      .map(([listId, minutes]) => ({ listId, minutes: Math.round(minutes) }))
      .filter((l) => l.minutes > 0)
      .sort((a, b) => b.minutes - a.minutes),
  };
}
