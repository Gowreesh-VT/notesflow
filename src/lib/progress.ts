import type { Item } from "./types";
import { addDays, toDateKey } from "./utils";

const dayOf = (ms: number) => toDateKey(new Date(ms));
const isFinishedTask = (i: Item) =>
  i.kind === "task" &&
  i.status === "done" &&
  i.completedAt !== null &&
  i.deletedAt === null &&
  !i.template;

/** Tasks finished per day for the `days` days ending today, oldest first. */
export function completionsPerDay(
  items: Item[],
  today: string,
  days = 30,
): { date: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (isFinishedTask(item)) {
      const day = dayOf(item.completedAt!);
      counts.set(day, (counts.get(day) ?? 0) + 1);
    }
  }
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(today, i - (days - 1));
    return { date, count: counts.get(date) ?? 0 };
  });
}

/**
 * Days in a row with at least one finished task. The current streak still counts while today has nothing yet,
 * as long as yesterday did.
 */
export function completionStreak(items: Item[], today: string): { current: number; best: number } {
  const days = new Set(items.filter(isFinishedTask).map((i) => dayOf(i.completedAt!)));
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
  return { current, best: Math.max(best, current) };
}

/** Today's tally: finished today, and open tasks still due today or overdue. */
export function todayTally(items: Item[], today: string): { finished: number; remaining: number } {
  let finished = 0;
  let remaining = 0;
  for (const item of items) {
    if (item.kind !== "task" || item.deletedAt !== null || item.template) continue;
    if (isFinishedTask(item) && dayOf(item.completedAt!) === today) finished++;
    if (item.status === "open" && item.due && item.due <= today) remaining++;
  }
  return { finished, remaining };
}
