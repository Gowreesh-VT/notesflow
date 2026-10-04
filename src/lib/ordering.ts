/**
 * Manual (drag-and-drop) ordering. Records carry an optional fractional `order`: moving a record writes only its
 * own new position, the midpoint between its new neighbours. Only when a neighbour has no position yet, or the
 * gap between two positions has run out of precision, is the whole group renumbered.
 */

export const ORDER_STEP = 1024;

export type Ordered = { id: string; order?: number | null };

const hasOrder = (x: Ordered | undefined): x is Ordered & { order: number } =>
  typeof x?.order === "number" && Number.isFinite(x.order);

/**
 * A position between `before` and `after` (either may be missing at the start or end of a group). Returns null
 * when no number fits strictly between them, so the caller must renumber.
 */
export function orderBetween(before?: number, after?: number): number | null {
  if (before === undefined && after === undefined) return ORDER_STEP;
  if (before === undefined) return after! - ORDER_STEP;
  if (after === undefined) return before + ORDER_STEP;
  const mid = (before + after) / 2;
  return before < mid && mid < after ? mid : null;
}

/**
 * Plans moving `moved` so it lands before the record now at `index` of `sequence` (`sequence.length` = at the end).
 * `sequence` is the target group as displayed; it contains `moved` when the move stays inside one group. Returns the
 * positions to write by id: usually just the moved record, or the whole group when it has to be renumbered. An
 * empty result means nothing changes.
 */
export function planMove(
  sequence: Ordered[],
  moved: Ordered,
  index: number,
): Record<string, number> {
  const from = sequence.findIndex((x) => x.id === moved.id);
  const rest = sequence.filter((x) => x.id !== moved.id);
  const at = Math.max(0, Math.min(rest.length, from >= 0 && from < index ? index - 1 : index));
  if (from >= 0 && at === from) return {};

  const prev = rest[at - 1];
  const next = rest[at];
  if ((!prev || hasOrder(prev)) && (!next || hasOrder(next))) {
    const order = orderBetween(prev?.order ?? undefined, next?.order ?? undefined);
    if (order !== null) return { [moved.id]: order };
  }

  const result = [...rest.slice(0, at), moved, ...rest.slice(at)];
  const changes: Record<string, number> = {};
  result.forEach((x, i) => {
    const order = (i + 1) * ORDER_STEP;
    if (x.order !== order || x.id === moved.id) changes[x.id] = order;
  });
  return changes;
}

/** Plans moving `id` one place up (-1) or down (1) inside `sequence`; empty at either end. */
export function planStep(sequence: Ordered[], id: string, delta: -1 | 1): Record<string, number> {
  const from = sequence.findIndex((x) => x.id === id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= sequence.length) return {};
  return planMove(sequence, sequence[from], delta < 0 ? to : to + 1);
}

/**
 * Compares by manual position. Records without a position come first (`unordered: "first"`, newest first by
 * `createdAt`) or last (`"last"`, keeping their incoming order when the sort is stable).
 */
export function compareOrder(
  a: Ordered & { createdAt: number },
  b: Ordered & { createdAt: number },
  unordered: "first" | "last",
): number {
  const oa = hasOrder(a);
  const ob = hasOrder(b);
  if (oa && ob) return a.order! - b.order!;
  if (oa !== ob) return (oa ? 1 : -1) * (unordered === "first" ? 1 : -1);
  return unordered === "first" ? b.createdAt - a.createdAt : 0;
}

/** Records by manual position, followed by those without one in their incoming order (used for lists). */
export function sortByOrder<T extends Ordered & { createdAt: number }>(records: T[]): T[] {
  return [...records].sort((a, b) => compareOrder(a, b, "last"));
}

/** A valid manual position from untrusted data (sync, backups), or null. */
export const asOrder = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;
