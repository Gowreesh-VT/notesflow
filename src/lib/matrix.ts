import { compareItems, isOpenTask } from "./items-logic";
import type { Item, Priority } from "./types";
import { addDays, daysBetween } from "./utils";

/**
 * Eisenhower matrix. A task is
 * - **important** when its priority is high or medium, and
 * - **urgent** when it is overdue or due within the next `URGENT_WITHIN_DAYS` days, today included (with 2: today
 *   or tomorrow). Tasks without a due date are never urgent.
 */
export const URGENT_WITHIN_DAYS = 2;

export type Quadrant = "do" | "schedule" | "delegate" | "later";

export type QuadrantInfo = {
  id: Quadrant;
  name: string;
  /** Short description of what belongs here. */
  hint: string;
  /** What dropping a task here changes (shown as a tooltip on the drop zone). */
  dropHint: string;
  important: boolean;
  urgent: boolean;
};

/** In reading order: urgent on the left, important on top. */
export const QUADRANTS: QuadrantInfo[] = [
  {
    id: "do",
    name: "Do first",
    hint: "Urgent & important",
    dropHint: "Dropping a task here makes it high priority and due today, if it isn’t already.",
    important: true,
    urgent: true,
  },
  {
    id: "schedule",
    name: "Schedule",
    hint: "Important, not urgent",
    dropHint: `Dropping a task here makes it high priority and moves its due date to ${URGENT_WITHIN_DAYS} days from now, if needed.`,
    important: true,
    urgent: false,
  },
  {
    id: "delegate",
    name: "Delegate",
    hint: "Urgent, not important",
    dropHint: "Dropping a task here sets low priority and makes it due today, if needed.",
    important: false,
    urgent: true,
  },
  {
    id: "later",
    name: "Later",
    hint: "Neither urgent nor important",
    dropHint: `Dropping a task here sets low priority and moves its due date to ${URGENT_WITHIN_DAYS} days from now, if needed.`,
    important: false,
    urgent: false,
  },
];

export const quadrantInfo = (id: Quadrant): QuadrantInfo => QUADRANTS.find((q) => q.id === id)!;

export const isImportant = (priority: Priority): boolean =>
  priority === "high" || priority === "medium";

export const isUrgent = (due: string | null, today: string): boolean =>
  due !== null && daysBetween(today, due) < URGENT_WITHIN_DAYS;

export function quadrantOf(item: Pick<Item, "priority" | "due">, today: string): Quadrant {
  const important = isImportant(item.priority);
  const urgent = isUrgent(item.due, today);
  return QUADRANTS.find((q) => q.important === important && q.urgent === urgent)!.id;
}

/**
 * Open tasks sorted into the four quadrants (by due date, then priority). Notes, finished tasks, templates, trashed
 * items and items in archived lists are left out.
 */
export function matrixTasks(
  items: Item[],
  archived: ReadonlySet<string>,
  today: string,
): Record<Quadrant, Item[]> {
  const result: Record<Quadrant, Item[]> = { do: [], schedule: [], delegate: [], later: [] };
  for (const item of items) {
    if (!isOpenTask(item) || item.deletedAt !== null || item.template) continue;
    if (archived.has(item.listId)) continue;
    result[quadrantOf(item, today)].push(item);
  }
  for (const list of Object.values(result)) list.sort((a, b) => compareItems(a, b, "due"));
  return result;
}

export type MatrixPatch = Partial<Pick<Item, "priority" | "due" | "startDate">>;

/**
 * The smallest edit that moves a task into `target`:
 * - into an important quadrant: low or no priority becomes high (medium and high stay);
 * - into an unimportant quadrant: medium or high priority becomes low (low and none stay);
 * - into an urgent quadrant: a task that is not urgent becomes due today;
 * - into a non-urgent quadrant: an urgent (or overdue) task moves to the first day that is no longer urgent
 *   (`URGENT_WITHIN_DAYS` days from today), so it keeps a date instead of losing it.
 * A multi-day task keeps its length: its start date moves by as many days as its due date.
 * Returns an empty patch when the task already belongs in `target`.
 */
export function patchForQuadrant(
  item: Pick<Item, "priority" | "due" | "startDate">,
  target: Quadrant,
  today: string,
): MatrixPatch {
  const { important, urgent } = quadrantInfo(target);
  const patch: MatrixPatch = {};
  if (important && !isImportant(item.priority)) patch.priority = "high";
  if (!important && isImportant(item.priority)) patch.priority = "low";

  let due: string | null = null;
  if (urgent && !isUrgent(item.due, today)) due = today;
  if (!urgent && isUrgent(item.due, today)) due = addDays(today, URGENT_WITHIN_DAYS);
  if (due !== null) {
    patch.due = due;
    if (item.startDate && item.due) {
      patch.startDate = addDays(item.startDate, daysBetween(item.due, due));
    }
  }
  return patch;
}

export type MatrixDirection = "left" | "right" | "up" | "down";

/** The quadrant next to `from` in the 2×2 grid (urgent column on the left, important row on top), or null. */
export function neighbourQuadrant(from: Quadrant, direction: MatrixDirection): Quadrant | null {
  const { important, urgent } = quadrantInfo(from);
  const next = {
    left: urgent ? null : { important, urgent: true },
    right: urgent ? { important, urgent: false } : null,
    up: important ? null : { important: true, urgent },
    down: important ? { important: false, urgent } : null,
  }[direction];
  if (!next) return null;
  return QUADRANTS.find((q) => q.important === next.important && q.urgent === next.urgent)!.id;
}
