import type { Item } from "./types";

/**
 * The daily note for a date: a live one first, then one in the trash; the oldest wins if two devices both
 * created one.
 */
export function findDailyNote(items: Item[], date: string): Item | undefined {
  const notes = items
    .filter((i) => i.kind === "note" && i.dailyNote === date && !i.template)
    .sort(
      (a, b) =>
        Number(a.deletedAt !== null) - Number(b.deletedAt !== null) || a.createdAt - b.createdAt,
    );
  return notes[0];
}

/** A friendly title for a daily note, such as "Sunday, October 4, 2026". */
export function dailyNoteTitle(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
