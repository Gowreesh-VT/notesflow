/** Split view: a second list pinned beside the current view, with tasks dragged between the two. */

import { filterItems, isArchived, isOpenTask } from "./items-logic";
import { INBOX_ID, type Item, type TaskList, type View } from "./types";

/**
 * Extra drag type set by rows of the pinned list, so the main pane knows a drag came from beside it (the dragged id
 * itself is only readable on drop).
 */
export const SPLIT_DRAG_TYPE = "application/x-notesflow-split";

/** The list a view shows and new items go into (a list or the Inbox), or null for other views. */
export function viewListId(view: View): string | null {
  if (view.kind === "list") return view.id;
  if (view.kind === "smart" && view.id === "inbox") return INBOX_ID;
  return null;
}

/** Can `listId` be pinned beside other views? The Inbox and existing, unarchived lists can. */
export function canPin(lists: TaskList[], listId: string): boolean {
  if (listId === INBOX_ID) return true;
  const list = lists.find((l) => l.id === listId);
  return Boolean(list && !isArchived(list));
}

/**
 * The pinned list to show beside `view`: none when nothing is pinned, the list is gone or archived, or the view
 * already shows that list.
 */
export function pinnedList(
  lists: TaskList[],
  splitListId: string | null,
  view: View,
): { id: string; name: string } | null {
  if (!splitListId || !canPin(lists, splitListId) || viewListId(view) === splitListId) return null;
  if (splitListId === INBOX_ID) return { id: INBOX_ID, name: "Inbox" };
  const list = lists.find((l) => l.id === splitListId)!;
  return { id: list.id, name: list.name };
}

/** Open tasks of a pinned list, in smart order. */
export function pinnedTasks(items: Item[], listId: string, today: string): Item[] {
  return filterItems(items, { kind: "list", id: listId }, "", today).filter(isOpenTask);
}

/**
 * The change for dropping `item` on the pane that shows `listId`: move it there (the store clears its section), or
 * null when it already is there or cannot be moved.
 */
export function dropOnListPatch(
  item: Pick<Item, "listId" | "deletedAt" | "template"> | undefined,
  listId: string,
): { listId: string } | null {
  if (!item || item.deletedAt !== null || item.template || item.listId === listId) return null;
  return { listId };
}
