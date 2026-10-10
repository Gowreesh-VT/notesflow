import type { Item } from "./types";

/** What it takes to take back one action: the earlier version of changed items, and items the action created. */
export interface UndoSnapshot {
  restore: Item[];
  remove: string[];
}

/** Compares the items before and after an action. Unchanged items keep their object identity in the store. */
export function diffItems(before: Item[], after: Item[]): UndoSnapshot {
  const earlier = new Map(before.map((item) => [item.id, item]));
  const restore: Item[] = [];
  const remove: string[] = [];
  for (const item of after) {
    const old = earlier.get(item.id);
    if (!old) remove.push(item.id);
    else if (old !== item) restore.push(old);
  }
  return { restore, remove };
}

export const isEmptySnapshot = (snapshot: UndoSnapshot): boolean =>
  snapshot.restore.length === 0 && snapshot.remove.length === 0;

/** Puts earlier versions back (stamped as new edits so they win a sync) and drops items the action created. */
export function applyUndo(items: Item[], snapshot: UndoSnapshot, now: number): Item[] {
  const restore = new Map(snapshot.restore.map((item) => [item.id, item]));
  const remove = new Set(snapshot.remove);
  return items
    .filter((item) => !remove.has(item.id))
    .map((item) => {
      const old = restore.get(item.id);
      return old ? { ...old, updatedAt: Math.max(now, item.updatedAt + 1) } : item;
    });
}
