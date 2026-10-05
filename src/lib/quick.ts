import type { Energy, Item, Priority } from "./types";

const RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2, none: 3 };

/**
 * Open tasks that fit in `minutes`: those estimated at or under it, plus unestimated "quick win" tasks when there
 * are at least 15 minutes. Optionally only one energy level. Most urgent first (overdue or due today), then by
 * priority, then the ones that use the time best (longest that still fits).
 */
export function quickPicks(
  items: Item[],
  minutes: number,
  today: string,
  options: { energy?: Energy | null; archived?: ReadonlySet<string> } = {},
): Item[] {
  const archived = options.archived ?? new Set<string>();
  const fits = (item: Item) =>
    item.estimate ? item.estimate <= minutes : item.energy === "quick" && minutes >= 15;
  const urgent = (item: Item) => Boolean(item.due && item.due <= today);
  return items
    .filter(
      (i) =>
        i.kind === "task" &&
        i.status === "open" &&
        i.deletedAt === null &&
        !i.template &&
        !archived.has(i.listId) &&
        (!options.energy || i.energy === options.energy) &&
        fits(i),
    )
    .sort(
      (a, b) =>
        Number(urgent(b)) - Number(urgent(a)) ||
        RANK[a.priority] - RANK[b.priority] ||
        (b.estimate ?? 15) - (a.estimate ?? 15),
    );
}
