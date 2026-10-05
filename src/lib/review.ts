import type { Item } from "./types";
import { addDays, toDateKey } from "./utils";

export type ReviewRange = { from: string; to: string };

/** The 7 days ending today, or the 7 days before that. */
export function reviewRange(today: string, weeksBack = 0): ReviewRange {
  const to = addDays(today, -7 * weeksBack);
  return { from: addDays(to, -6), to };
}

export type WeeklyReview = {
  /** Tasks finished in the range (done), newest first. */
  finished: Item[];
  /** Open tasks that were due in the range (up to yesterday) and slipped. */
  slipped: Item[];
  /** Tasks marked won't do in the range. */
  skipped: Item[];
  /** Finished count per day, oldest first. */
  perDay: { date: string; count: number }[];
};

const dayOf = (ms: number) => toDateKey(new Date(ms));
const counted = (item: Item) => item.kind === "task" && item.deletedAt === null && !item.template;

export function weeklyReview(items: Item[], today: string, range: ReviewRange): WeeklyReview {
  const inRange = (date: string) => date >= range.from && date <= range.to;
  const finished = items
    .filter(
      (i) =>
        counted(i) &&
        i.status === "done" &&
        i.completedAt !== null &&
        inRange(dayOf(i.completedAt)),
    )
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
  const skipped = items.filter(
    (i) =>
      counted(i) &&
      i.status === "wontdo" &&
      i.completedAt !== null &&
      inRange(dayOf(i.completedAt)),
  );
  const lastSlipDay = range.to < today ? range.to : addDays(today, -1);
  const slipped = items
    .filter(
      (i) =>
        counted(i) && i.status === "open" && i.due && i.due >= range.from && i.due <= lastSlipDay,
    )
    .sort((a, b) => (a.due ?? "").localeCompare(b.due ?? ""));
  const perDay = Array.from({ length: 7 }, (_, k) => {
    const date = addDays(range.from, k);
    return { date, count: finished.filter((i) => dayOf(i.completedAt!) === date).length };
  });
  return { finished, slipped, skipped, perDay };
}

/** The next Monday after `today` (a week ahead if today is Monday). */
export function nextMonday(today: string): string {
  const [y, m, d] = today.split("-").map(Number);
  const weekday = new Date(y, m - 1, d).getDay();
  return addDays(today, (8 - weekday) % 7 || 7);
}
