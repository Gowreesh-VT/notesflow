import type { Countdown } from "./types";
import { daysBetween } from "./utils";

/** Countdowns to show: upcoming ones (soonest first), then those passed within the last week. */
export function visibleCountdowns(countdowns: Countdown[], today: string): Countdown[] {
  const upcoming = countdowns
    .filter((c) => c.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  const recent = countdowns
    .filter((c) => c.date < today && daysBetween(c.date, today) <= 7)
    .sort((a, b) => b.date.localeCompare(a.date));
  return [...upcoming, ...recent];
}

/** "Today", "Tomorrow", "12 days", "Yesterday", "3 days ago". */
export function countdownLabel(date: string, today: string): string {
  const days = daysBetween(today, date);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  return days > 0 ? `${days} days` : `${-days} days ago`;
}
