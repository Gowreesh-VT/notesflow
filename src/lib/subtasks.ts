import type { Subtask } from "./types";
import { createId } from "./utils";

/** Subtasks nest up to this many levels below the task (a top-level subtask is level 1). */
export const MAX_SUBTASK_DEPTH = 5;

export type FoundSubtask = { node: Subtask; depth: number; parentId: string | null };

/** Finds a subtask anywhere in the tree, with its level (1 = directly under the task) and parent id. */
export function findSubtask(
  list: Subtask[],
  id: string,
  depth = 1,
  parentId: string | null = null,
): FoundSubtask | null {
  for (const node of list) {
    if (node.id === id) return { node, depth, parentId };
    const found = node.children ? findSubtask(node.children, id, depth + 1, node.id) : null;
    if (found) return found;
  }
  return null;
}

/** Number of levels a subtask occupies, counting itself (a leaf is 1). */
export function subtreeHeight(node: Subtask): number {
  return 1 + Math.max(0, ...(node.children ?? []).map(subtreeHeight));
}

/** Every subtask in the tree, parents before their children. */
export function flattenSubtasks(list: Subtask[]): Subtask[] {
  return list.flatMap((node) => [node, ...flattenSubtasks(node.children ?? [])]);
}

/** Done and total across all levels. */
export function countSubtasks(list: Subtask[]): { done: number; total: number } {
  const all = flattenSubtasks(list);
  return { done: all.filter((s) => s.done).length, total: all.length };
}

const withChildren = (node: Subtask, children: Subtask[]): Subtask => {
  const copy = { ...node };
  delete copy.children;
  return children.length ? { ...copy, children } : copy;
};

/** Marks a subtask and everything below it done or not done. */
export function setDoneDeep(node: Subtask, done: boolean): Subtask {
  return withChildren(
    { ...node, done },
    (node.children ?? []).map((c) => setDoneDeep(c, done)),
  );
}

/** A subtask with children is done exactly when all of its children are done. */
export function rollUp(list: Subtask[]): Subtask[] {
  return list.map((node) => {
    if (!node.children?.length) return node;
    const children = rollUp(node.children);
    return { ...node, children, done: children.every((c) => c.done) };
  });
}

/**
 * Replaces the subtask with `id` by the result of `fn` (null removes it), wherever it is in the tree.
 * Returns the same array when the id is not found.
 */
export function updateSubtask(
  list: Subtask[],
  id: string,
  fn: (node: Subtask) => Subtask | null,
): Subtask[] {
  let changed = false;
  const next = list.flatMap((node) => {
    if (node.id === id) {
      changed = true;
      const result = fn(node);
      return result ? [result] : [];
    }
    if (!node.children) return [node];
    const children = updateSubtask(node.children, id, fn);
    if (children === node.children) return [node];
    changed = true;
    return [withChildren(node, children)];
  });
  return changed ? next : list;
}

/** Deep copy with fresh ids, optionally resetting done. */
export function cloneSubtasks(list: Subtask[], resetDone = false): Subtask[] {
  return list.map((node) =>
    withChildren(
      { ...node, id: createId(), done: resetDone ? false : node.done },
      cloneSubtasks(node.children ?? [], resetDone),
    ),
  );
}

/** Cuts a tree down to `levels` levels; deeper subtasks are dropped. */
export function limitDepth(list: Subtask[], levels = MAX_SUBTASK_DEPTH): Subtask[] {
  if (levels <= 0) return [];
  return list.map((node) => withChildren(node, limitDepth(node.children ?? [], levels - 1)));
}
