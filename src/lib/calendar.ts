import { compareItems } from "./items-logic";
import type { Item } from "./types";
import { addDays } from "./utils";

/**
 * Date maths for the calendar view. Everything works on local date keys (YYYY-MM-DD) and "HH:MM" clocks through the
 * helpers in `utils.ts`, so daylight-saving changes never shift a day. Weeks start on Monday.
 */

export const isDateKey = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && addDays(value, 0) === value;

/** Day of the week with Monday = 0 … Sunday = 6. */
export function weekdayIndex(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return (new Date(y, m - 1, d).getDay() + 6) % 7;
}

/** The Monday on or before `day`. */
export const startOfWeek = (day: string): string => addDays(day, -weekdayIndex(day));

/** The seven days (Monday to Sunday) of the week containing `day`. */
export const weekDays = (day: string): string[] =>
  Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(day), i));

/** "YYYY-MM" of a date key. */
export const monthOf = (day: string): string => day.slice(0, 7);

export const startOfMonth = (day: string): string => `${monthOf(day)}-01`;

const daysInMonth = (year: number, month: number): number => new Date(year, month, 0).getDate(); // month is 1-based here: day 0 of the next month

/** The same day `months` months later, clamped to the end of shorter months (Jan 31 + 1 → Feb 28/29). */
export function addMonths(day: string, months: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const total = y * 12 + (m - 1) + months;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  const date = Math.min(d, daysInMonth(year, month));
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(date).padStart(2, "0")}`;
}

/**
 * Whole weeks (Monday to Sunday) covering the month of `day`: 4 to 6 rows of seven date keys, including the
 * leading and trailing days of the neighbouring months.
 */
export function monthMatrix(day: string): string[][] {
  const first = startOfMonth(day);
  const last = addDays(addMonths(first, 1), -1);
  const weeks: string[][] = [];
  for (let start = startOfWeek(first); start <= last; start = addDays(start, 7)) {
    weeks.push(weekDays(start));
  }
  return weeks;
}

/** First and last day a task occupies: its start date (when before the due date) to its due date. */
export function taskSpan(
  item: Pick<Item, "due" | "startDate">,
): { start: string; end: string } | null {
  if (!item.due) return null;
  const start = item.startDate && item.startDate < item.due ? item.startDate : item.due;
  return { start, end: item.due };
}

/**
 * Tasks the calendar shows: live tasks with a due date, outside templates and archived lists. Finished tasks are
 * included only when asked for (and only those marked done, not "won't do").
 */
export function calendarTasks(
  items: Item[],
  options: { archived?: ReadonlySet<string>; showDone?: boolean } = {},
): Item[] {
  return items.filter(
    (i) =>
      i.kind === "task" &&
      i.due !== null &&
      i.deletedAt === null &&
      !i.template &&
      !options.archived?.has(i.listId) &&
      (i.status === "open" || (options.showDone === true && i.status === "done")),
  );
}

/** A task on one calendar day; `first`/`last` say whether the day starts or ends a multi-day span. */
export type DayEntry = { item: Item; first: boolean; last: boolean };

const isMultiDay = (item: Item) => Boolean(item.startDate && item.due && item.startDate < item.due);

/** Within a day: multi-day spans first, then all-day tasks, then timed tasks by time; ties by the usual order. */
export function compareDayEntries(a: Item, b: Item): number {
  const multi = Number(isMultiDay(b)) - Number(isMultiDay(a));
  if (multi !== 0) return multi;
  const timed = Number(Boolean(a.dueTime)) - Number(Boolean(b.dueTime));
  if (timed !== 0) return timed;
  return (a.dueTime ?? "").localeCompare(b.dueTime ?? "") || compareItems(a, b, "default");
}

/** The tasks shown on each of `days` (sorted keys, consecutive or not), with multi-day tasks on every day they span. */
export function tasksByDay(tasks: Item[], days: string[]): Map<string, DayEntry[]> {
  const result = new Map<string, DayEntry[]>(days.map((d) => [d, []]));
  if (days.length === 0) return result;
  const from = days[0];
  const to = days[days.length - 1];
  for (const item of tasks) {
    const span = taskSpan(item);
    if (!span || span.end < from || span.start > to) continue;
    const start = span.start < from ? from : span.start;
    const end = span.end > to ? to : span.end;
    for (let day = start; day <= end; day = addDays(day, 1)) {
      result.get(day)?.push({ item, first: day === span.start, last: day === span.end });
    }
  }
  for (const entries of result.values()) entries.sort((a, b) => compareDayEntries(a.item, b.item));
  return result;
}
