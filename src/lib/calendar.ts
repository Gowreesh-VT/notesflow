import { compareItems } from "./items-logic";
import type { Item } from "./types";
import { addDays, daysBetween } from "./utils";
import { weekdayPosition } from "./locale";

/**
 * Date maths for the calendar view. Everything works on local date keys (YYYY-MM-DD) and "HH:MM" clocks through the
 * helpers in `utils.ts`, so daylight-saving changes never shift a day. Weeks start on Monday.
 */

export type CalendarLayout = "month" | "week" | "day" | "agenda";

export const CALENDAR_LAYOUTS: { value: CalendarLayout; label: string }[] = [
  { value: "month", label: "Month" },
  { value: "week", label: "Week" },
  { value: "day", label: "Day" },
  { value: "agenda", label: "Agenda" },
];

export const isCalendarLayout = (value: unknown): value is CalendarLayout =>
  CALENDAR_LAYOUTS.some((l) => l.value === value);

export const isDateKey = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && addDays(value, 0) === value;

/** Position in the week, 0 for the preferred first day of the week (Monday unless changed in settings). */
export const weekdayIndex = (day: string): number => weekdayPosition(day);

/** The first day of the week on or before `day`. */
export const startOfWeek = (day: string): string => addDays(day, -weekdayIndex(day));

/** The seven days of the week containing `day`, from the preferred first day. */
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
 * Whole weeks (from the preferred first day) covering the month of `day`: 4 to 6 rows of seven date keys, including the
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

/** A task sits in a day's time grid only on its due day and only when it has a time; otherwise it is all-day. */
export const isTimedOn = (item: Pick<Item, "due" | "dueTime">, day: string): boolean =>
  Boolean(item.dueTime) && item.due === day;

export const MINUTES_PER_DAY = 24 * 60;
/** Length of a timed task without an estimate. */
export const DEFAULT_BLOCK_MINUTES = 30;
/** Shortest block drawn, so very short estimates stay clickable. */
const MIN_BLOCK_MINUTES = 15;

export function clockToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToClock(minutes: number): string {
  const clamped = Math.min(Math.max(Math.round(minutes), 0), MINUTES_PER_DAY - 1);
  return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
}

/**
 * The time at a vertical offset in a day's time grid, rounded down to `step` minutes and kept inside the day
 * (the last slot starts at 24:00 minus one step).
 */
export function timeAtOffset(offset: number, hourHeight: number, step = 15): string {
  const minutes = (offset / hourHeight) * 60;
  const snapped = Math.floor(minutes / step) * step;
  return minutesToClock(Math.min(Math.max(snapped, 0), MINUTES_PER_DAY - step));
}

/** A timed task placed in a day column: minutes from midnight, and its column among overlapping tasks. */
export type TimedBlock = {
  item: Item;
  start: number;
  end: number;
  column: number;
  columns: number;
};

/**
 * Lays out a day's timed tasks: each block runs from its due time for its estimate (30 minutes without one), cut
 * at midnight. Overlapping blocks are put side by side; every block in a group of overlapping tasks gets the same
 * number of columns so they line up.
 */
export function layoutTimedTasks(tasks: Item[]): TimedBlock[] {
  const blocks = tasks
    .filter((t) => t.dueTime)
    .map((item) => {
      const start = clockToMinutes(item.dueTime!);
      const length = Math.max(item.estimate || DEFAULT_BLOCK_MINUTES, MIN_BLOCK_MINUTES);
      return { item, start, end: Math.min(start + length, MINUTES_PER_DAY), column: 0, columns: 1 };
    })
    .sort((a, b) => a.start - b.start || b.end - a.end || compareItems(a.item, b.item, "default"));

  let group: TimedBlock[] = [];
  let columnEnds: number[] = [];
  let groupEnd = -1;
  const closeGroup = () => {
    for (const block of group) block.columns = columnEnds.length;
    group = [];
    columnEnds = [];
  };
  for (const block of blocks) {
    if (block.start >= groupEnd) closeGroup();
    let column = columnEnds.findIndex((end) => end <= block.start);
    if (column === -1) column = columnEnds.length;
    columnEnds[column] = block.end;
    block.column = column;
    group.push(block);
    groupEnd = Math.max(groupEnd, block.end);
  }
  closeGroup();
  return blocks;
}

export type ReschedulePatch = { due: string; startDate?: string | null; dueTime?: string | null };

/**
 * Moving a task that was shown on `fromDay` to `toDay`: the due date (and a multi-day task's start date) move by the
 * same number of days, keeping the time. With `time`, the task also gets that due time (null makes it all-day). A task
 * without a date simply becomes due on `toDay`.
 */
export function reschedulePatch(
  item: Pick<Item, "due" | "startDate">,
  fromDay: string | null,
  toDay: string,
  time?: string | null,
): ReschedulePatch {
  const withTime = time !== undefined ? { dueTime: time } : {};
  if (!item.due) return { due: toDay, ...withTime };
  const delta = daysBetween(fromDay ?? item.due, toDay);
  return {
    due: addDays(item.due, delta),
    ...(item.startDate ? { startDate: addDays(item.startDate, delta) } : {}),
    ...withTime,
  };
}

/** Number of days the agenda looks ahead, today included. */
export const AGENDA_DAYS = 30;

export type AgendaGroup = { day: string | "overdue"; items: Item[] };

/**
 * The agenda: open tasks that are overdue first, then one group per day from today for `length` days, each task
 * listed once on its due date. Days without tasks are left out.
 */
export function agendaGroups(tasks: Item[], today: string, length = AGENDA_DAYS): AgendaGroup[] {
  const last = addDays(today, length - 1);
  const overdue = tasks
    .filter((t) => t.status === "open" && t.due !== null && t.due < today)
    .sort((a, b) => a.due!.localeCompare(b.due!) || compareDayEntries(a, b));
  const byDay = new Map<string, Item[]>();
  for (const task of tasks) {
    if (!task.due || task.due < today || task.due > last) continue;
    byDay.set(task.due, [...(byDay.get(task.due) ?? []), task]);
  }
  const days = [...byDay.keys()].sort().map((day) => ({
    day,
    items: byDay.get(day)!.sort(compareDayEntries),
  }));
  return overdue.length ? [{ day: "overdue", items: overdue }, ...days] : days;
}
