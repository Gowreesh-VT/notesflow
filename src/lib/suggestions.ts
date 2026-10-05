import { formatDuration } from "./duration";
import { blockLength } from "./plan";
import type { Item, Priority } from "./types";

/** Work is assumed to end at 21:00 unless told otherwise (minutes after midnight). */
export const DEFAULT_DAY_END = 21 * 60;

export type Suggestion = {
  id: "overdue" | "overloaded" | "too-long";
  message: string;
  /** What the button does. */
  action: { label: string; ids: string[]; to: "today" | "tomorrow" };
};

const RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2, none: 3 };
const isOpenTodayTask = (i: Item, today: string) =>
  i.kind === "task" &&
  i.status === "open" &&
  i.deletedAt === null &&
  !i.template &&
  Boolean(i.due) &&
  i.due! <= today;

/**
 * Gentle scheduling suggestions for today, from simple local rules:
 * - overdue tasks that could be moved to today;
 * - more estimated work than time left before the end of the day (move the least important to tomorrow);
 * - a single task that needs more time than is left today.
 */
export function scheduleSuggestions(
  items: Item[],
  today: string,
  nowMinutes: number,
  dayEnd = DEFAULT_DAY_END,
): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const open = items.filter((i) => isOpenTodayTask(i, today));
  const overdue = open.filter((i) => i.due! < today);
  const left = Math.max(0, dayEnd - nowMinutes);

  if (overdue.length > 0) {
    suggestions.push({
      id: "overdue",
      message: `${overdue.length} overdue task${overdue.length === 1 ? "" : "s"} still waiting. Move ${overdue.length === 1 ? "it" : "them"} to today so ${overdue.length === 1 ? "it doesn’t" : "they don’t"} keep slipping?`,
      action: { label: "Move to today", ids: overdue.map((i) => i.id), to: "today" },
    });
  }

  const estimated = open.filter((i) => i.estimate);
  const needed = estimated.reduce((sum, i) => sum + blockLength(i), 0);
  if (estimated.length > 1 && needed > left) {
    // Drop the least important (then longest) until the rest fits.
    const byLeastImportant = [...estimated].sort(
      (a, b) => RANK[b.priority] - RANK[a.priority] || blockLength(b) - blockLength(a),
    );
    const move: string[] = [];
    let remaining = needed;
    for (const item of byLeastImportant) {
      if (remaining <= left) break;
      move.push(item.id);
      remaining -= blockLength(item);
    }
    suggestions.push({
      id: "overloaded",
      message: `Today has about ${formatDuration(needed)} of estimated work and ${left ? formatDuration(left) : "no time"} left. Move ${move.length} less important task${move.length === 1 ? "" : "s"} to tomorrow?`,
      action: { label: "Move to tomorrow", ids: move, to: "tomorrow" },
    });
  } else {
    const tooLong = estimated.find((i) => blockLength(i) > left);
    if (tooLong) {
      suggestions.push({
        id: "too-long",
        message: `“${tooLong.title}” needs ${formatDuration(blockLength(tooLong))}, but only ${left ? formatDuration(left) : "no time"} is left today.`,
        action: { label: "Move to tomorrow", ids: [tooLong.id], to: "tomorrow" },
      });
    }
  }
  return suggestions;
}
