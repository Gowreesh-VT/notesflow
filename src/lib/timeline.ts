import { isOpenTask } from "./items-logic";
import { sortByOrder } from "./ordering";
import { INBOX_ID, type Item, type TaskList } from "./types";
import { addDays, daysBetween, displayTitle, formatDueLabel } from "./utils";
import { formatDate } from "./locale";

/** Week zoom shows about three weeks at a time, month zoom about three months. */
export type TimelineZoom = "week" | "month";

export const DAY_WIDTH: Record<TimelineZoom, number> = { week: 48, month: 12 };

/** How far around today the timeline reaches at least, and the padding kept around the tasks, in days. */
const SPAN: Record<TimelineZoom, { before: number; after: number; pad: number }> = {
  week: { before: 7, after: 28, pad: 3 },
  month: { before: 31, after: 92, pad: 7 },
};

/** Tasks far away are clipped at the edges so the timeline stays a reasonable size. */
const MAX_PAST_DAYS = 365;
const MAX_FUTURE_DAYS = 730;

type Dated = Pick<Item, "due" | "startDate">;

/** First day of a task on the timeline: its start date, or its due date when it is a single-day task. */
export function timelineStart(item: Dated & { due: string }): string {
  return item.startDate && item.startDate < item.due ? item.startDate : item.due;
}

/** A task that spans more than one day. */
export const isMultiDay = (item: Dated & { due: string }): boolean =>
  timelineStart(item) !== item.due;

export type TimelineTask = Item & { due: string };

/** Open tasks with a due date, from active lists, ordered by start then due date. */
export function timelineTasks(items: Item[], archived: ReadonlySet<string>): TimelineTask[] {
  return items
    .filter(
      (item): item is TimelineTask =>
        isOpenTask(item) &&
        item.deletedAt === null &&
        !item.template &&
        item.due !== null &&
        !archived.has(item.listId),
    )
    .sort(
      (a, b) =>
        timelineStart(a).localeCompare(timelineStart(b)) ||
        a.due.localeCompare(b.due) ||
        a.createdAt - b.createdAt,
    );
}

export type TimelineGroup = { id: string; name: string; items: TimelineTask[] };

/** Tasks grouped by list: the Inbox first, then lists in their sidebar order. Empty lists are left out. */
export function groupTimeline(tasks: TimelineTask[], lists: TaskList[]): TimelineGroup[] {
  const order = [
    { id: INBOX_ID, name: "Inbox" },
    ...sortByOrder(lists.filter((l) => l.id !== INBOX_ID)),
  ];
  const known = new Set(order.map((l) => l.id));
  return order
    .map((list) => ({
      id: list.id,
      name: list.name,
      // Tasks in a list that no longer exists are shown with the Inbox rather than lost.
      items: tasks.filter((t) =>
        list.id === INBOX_ID ? t.listId === INBOX_ID || !known.has(t.listId) : t.listId === list.id,
      ),
    }))
    .filter((g) => g.items.length > 0);
}

export type TimelineRange = { from: string; to: string; days: number };

const weekday = (dateKey: string): number => {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
};

const minKey = (a: string, b: string) => (a < b ? a : b);
const maxKey = (a: string, b: string) => (a > b ? a : b);

/**
 * The days the timeline shows: a stretch around today that grows to fit every task (within limits), aligned to
 * whole weeks (Monday to Sunday) for the week zoom and to whole months for the month zoom.
 */
export function timelineRange(
  tasks: TimelineTask[],
  today: string,
  zoom: TimelineZoom,
): TimelineRange {
  const span = SPAN[zoom];
  let from = addDays(today, -span.before);
  let to = addDays(today, span.after);
  for (const task of tasks) {
    from = minKey(from, addDays(timelineStart(task), -span.pad));
    to = maxKey(to, addDays(task.due, span.pad));
  }
  from = maxKey(from, addDays(today, -MAX_PAST_DAYS));
  to = minKey(to, addDays(today, MAX_FUTURE_DAYS));
  if (zoom === "week") {
    from = addDays(from, -((weekday(from) + 6) % 7));
    to = addDays(to, (7 - weekday(to)) % 7);
  } else {
    from = `${from.slice(0, 8)}01`;
    const [y, m] = to.split("-").map(Number);
    // Day 0 of the next month is the last day of this one.
    const last = new Date(y, m, 0).getDate();
    to = `${to.slice(0, 8)}${String(last).padStart(2, "0")}`;
  }
  return { from, to, days: daysBetween(from, to) + 1 };
}

/** Every day of the range, in order. */
export function rangeDays(range: TimelineRange): string[] {
  return Array.from({ length: range.days }, (_, i) => addDays(range.from, i));
}

export const isWeekend = (dateKey: string): boolean => {
  const day = weekday(dateKey);
  return day === 0 || day === 6;
};

/** Pixel offset of the start of a day from the left edge of the range. */
export const dayOffset = (range: TimelineRange, dateKey: string, dayWidth: number): number =>
  daysBetween(range.from, dateKey) * dayWidth;

export type BarGeometry = {
  x: number;
  width: number;
  /** The task starts before the range or ends after it, so the bar is cut off at that edge. */
  clippedStart: boolean;
  clippedEnd: boolean;
};

/** Where a task's bar sits: from the start of its first day to the end of its due day. Null when out of range. */
export function barGeometry(
  start: string,
  due: string,
  range: TimelineRange,
  dayWidth: number,
): BarGeometry | null {
  if (due < range.from || start > range.to) return null;
  const first = maxKey(start, range.from);
  const last = minKey(due, range.to);
  return {
    x: dayOffset(range, first, dayWidth),
    width: (daysBetween(first, last) + 1) * dayWidth,
    clippedStart: start < range.from,
    clippedEnd: due > range.to,
  };
}

/** Whole days a pointer has travelled, rounded to the nearest day. */
export const daysFromPixels = (dx: number, dayWidth: number): number =>
  Math.round(dx / dayWidth) || 0;

/** "move" shifts the whole task; "start" and "end" drag its first or last day. */
export type DragMode = "move" | "start" | "end";

export type TimelineDates = { due: string; startDate: string | null };

/**
 * New dates after dragging a task by `days`. The start never passes the due date (and vice versa); a task whose
 * start meets its due date becomes a single-day task (no start date), and dragging an edge of a single-day task
 * turns it into a multi-day one.
 */
export function dragDates(
  item: Dated & { due: string },
  mode: DragMode,
  days: number,
): TimelineDates {
  const start = timelineStart(item);
  const dates = (first: string, last: string): TimelineDates => ({
    due: last,
    startDate: first < last ? first : null,
  });
  if (mode === "move") return dates(addDays(start, days), addDays(item.due, days));
  if (mode === "end") return dates(start, maxKey(addDays(item.due, days), start));
  return dates(minKey(addDays(start, days), item.due), item.due);
}

/** Accessible name of a bar, such as "Plan offsite, Oct 3 to Oct 8" or "Pay rent, due Today". */
export function describeBar(
  item: Pick<Item, "title" | "body"> & Dated & { due: string },
  today: string,
) {
  const start = timelineStart(item);
  const title = displayTitle(item);
  return start === item.due
    ? `${title}, due ${formatDueLabel(item.due, today)}`
    : `${title}, ${formatDueLabel(start, today)} to ${formatDueLabel(item.due, today)}`;
}

export type MonthSpan = { key: string; label: string; start: string; days: number };

/** The months (or parts of months) the range covers, for the header. */
export function monthSpans(range: TimelineRange): MonthSpan[] {
  const spans: MonthSpan[] = [];
  let start = range.from;
  while (start <= range.to) {
    const [y, m] = start.split("-").map(Number);
    const next = `${new Date(y, m, 1).getFullYear()}-${String((m % 12) + 1).padStart(2, "0")}-01`;
    const end = minKey(addDays(next, -1), range.to);
    spans.push({
      key: start.slice(0, 7),
      label: formatDate(new Date(y, m - 1, 1), {
        month: "long",
        year: "numeric",
      }),
      start,
      days: daysBetween(start, end) + 1,
    });
    start = next;
  }
  return spans;
}
