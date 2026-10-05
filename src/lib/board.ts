/** Board (Kanban) layout of a list: its sections become columns of cards. */

import { compareItems } from "./items-logic";
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
