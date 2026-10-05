/** Board (Kanban) layout of a list: its sections become columns of cards. */

import { compareItems } from "./items-logic";
import { planMove, planStep } from "./ordering";
import type { Item, ListSection } from "./types";

/** Column id of the unsectioned part of a list. */
export const NO_SECTION = "";

export type BoardColumn = {
  /** The section id, or NO_SECTION for items without a (known) section. */
  id: string;
  section: ListSection | null;
  /** Open tasks and notes, in manual order. */
  items: Item[];
  /** Completed and won't-do tasks, most recently finished first. */
  finished: Item[];
};

const isFinished = (item: Item) => item.kind === "task" && item.status !== "open";

/**
 * Splits a list's items into board columns: "No section" first (only when it holds something, or when the list has
 * no sections so there is somewhere to put new tasks), then one column per section in order, empty ones included.
 * Items whose section no longer exists land in "No section". Cards are in manual order.
 */
export function boardColumns(items: Item[], sections: ListSection[]): BoardColumn[] {
  const known = new Set(sections.map((s) => s.id));
  const sorted = [...items].sort((a, b) => compareItems(a, b, "manual"));
  const column = (id: string, section: ListSection | null): BoardColumn => {
    const inColumn = sorted.filter((i) =>
      section ? i.sectionId === id : !i.sectionId || !known.has(i.sectionId),
    );
    return {
      id,
      section,
      items: inColumn.filter((i) => !isFinished(i)),
      finished: inColumn.filter(isFinished),
    };
  };
  const unsectioned = column(NO_SECTION, null);
  const showUnsectioned =
    sections.length === 0 || unsectioned.items.length > 0 || unsectioned.finished.length > 0;
  return [
    ...(showUnsectioned ? [unsectioned] : []),
    ...sections.map((section) => column(section.id, section)),
  ];
}

/** What dropping a card means: the manual positions to write and the section it ends up in. */
export type CardMove = { orders: Record<string, number>; sectionId: string | null };

/** The column a card is shown in, or undefined when it is not on this board (dragged in from another list). */
export const columnOf = (columns: BoardColumn[], itemId: string): BoardColumn | undefined =>
  columns.find(
    (c) => c.items.some((i) => i.id === itemId) || c.finished.some((i) => i.id === itemId),
  );

/**
 * Plans dropping `item` before the card at `index` of column `columnId` (index = card count: at the end). Returns
 * null when nothing would change or the column does not exist.
 */
export function planCardDrop(
  columns: BoardColumn[],
  item: Item,
  columnId: string,
  index: number,
): CardMove | null {
  const target = columns.find((c) => c.id === columnId);
  if (!target) return null;
  const orders = planMove(target.items, item, index);
  const sameColumn = columnOf(columns, item.id)?.id === columnId;
  if (sameColumn && Object.keys(orders).length === 0) return null;
  return { orders, sectionId: target.section?.id ?? null };
}

export type CardDirection = "up" | "down" | "left" | "right";

/**
 * Plans a keyboard move of an open card: up or down within its column, or left or right into the neighbouring
 * column at the same height (or its end). Returns null at the edges.
 */
export function planCardStep(
  columns: BoardColumn[],
  itemId: string,
  direction: CardDirection,
): (CardMove & { columnId: string; index: number }) | null {
  const from = columns.findIndex((c) => c.items.some((i) => i.id === itemId));
  if (from < 0) return null;
  const column = columns[from];
  const index = column.items.findIndex((i) => i.id === itemId);
  if (direction === "up" || direction === "down") {
    const delta = direction === "up" ? -1 : 1;
    const orders = planStep(column.items, itemId, delta);
    if (Object.keys(orders).length === 0) return null;
    return {
      orders,
      sectionId: column.section?.id ?? null,
      columnId: column.id,
      index: index + delta,
    };
  }
  const target = columns[from + (direction === "left" ? -1 : 1)];
  if (!target) return null;
  const at = Math.min(index, target.items.length);
  return {
    orders: planMove(target.items, column.items[index], at),
    sectionId: target.section?.id ?? null,
    columnId: target.id,
    index: at,
  };
}

/**
 * Moves the section `id` so it lands before the section now at `index` (index = length: at the end). Returns the
 * same array when the order does not change or the section is unknown.
 */
export function moveSectionTo(sections: ListSection[], id: string, index: number): ListSection[] {
  const from = sections.findIndex((s) => s.id === id);
  if (from < 0) return sections;
  const rest = sections.filter((s) => s.id !== id);
  const at = Math.max(0, Math.min(rest.length, from < index ? index - 1 : index));
  if (at === from) return sections;
  return [...rest.slice(0, at), sections[from], ...rest.slice(at)];
}
