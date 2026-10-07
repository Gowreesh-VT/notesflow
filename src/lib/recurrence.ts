import { formatDate } from "./locale";
import type { Repeat, RepeatUnit } from "./types";
import { addDays } from "./utils";

export const REPEAT_UNITS: RepeatUnit[] = ["day", "week", "month", "year"];
export const MAX_REPEAT_EVERY = 365;
const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const parts = (key: string) => key.split("-").map(Number) as [number, number, number];
const weekday = (key: string) => {
  const [y, m, d] = parts(key);
  return new Date(y, m - 1, d).getDay();
};
const daysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate();
const toKey = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** Adds months, keeping the day of the month where possible (Jan 31 + 1 month = Feb 28/29). */
function addMonths(key: string, months: number): string {
  const [y, m, d] = parts(key);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return toKey(ny, nm, Math.min(d, daysInMonth(ny, nm)));
}

/** Monday-based start of the week containing `key`. */
const weekStart = (key: string) => addDays(key, -((weekday(key) + 6) % 7));

/** The next occurrence strictly after `from`. */
export function nextOccurrence(from: string, rule: Repeat): string {
  const every = Math.max(1, rule.every);
  switch (rule.unit) {
    case "day":
      return addDays(from, every);
    case "week": {
      const days = [...new Set(rule.weekdays ?? [])].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
      if (!days.length) return addDays(from, 7 * every);
      // Later in the same week, if one of the chosen weekdays is still ahead.
      for (let i = 1; i <= 6; i++) {
        const candidate = addDays(from, i);
        if (weekStart(candidate) !== weekStart(from)) break;
        if (days.includes(weekday(candidate))) return candidate;
      }
      // Otherwise the first chosen weekday of the week `every` weeks later.
      const start = addDays(weekStart(from), 7 * every);
      for (let i = 0; i < 7; i++) {
        const candidate = addDays(start, i);
        if (days.includes(weekday(candidate))) return candidate;
      }
      return addDays(from, 7 * every);
    }
    case "month":
      return addMonths(from, every);
    case "year":
      return addMonths(from, 12 * every);
  }
}

/**
 * The due date after finishing an occurrence. "After completion" counts from the day it was finished; otherwise the
 * schedule continues from the due date, skipping occurrences that are already in the past. Null when the next date
 * would fall after the rule's end date: the series is over.
 */
export function nextDueDate(due: string | null, rule: Repeat, today: string): string | null {
  let next: string;
  if (rule.afterCompletion || !due) next = nextOccurrence(today, rule);
  else {
    next = nextOccurrence(due, rule);
    for (let i = 0; next <= today && i < 1000; i++) next = nextOccurrence(next, rule);
  }
  return rule.until && next > rule.until ? null : next;
}

/** A real calendar day as YYYY-MM-DD (the same check as `isDateKey` in calendar.ts, which imports more). */
const isDateKey = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && addDays(value, 0) === value;

/** "Oct 31, 2026" for a rule's end date, in the user's date order. */
export function formatUntil(until: string): string {
  const [y, m, d] = parts(until);
  return formatDate(new Date(y, m - 1, d), { month: "short", day: "numeric", year: "numeric" });
}

const UNIT_WORDS: Record<RepeatUnit, [string, string]> = {
  day: ["Daily", "days"],
  week: ["Weekly", "weeks"],
  month: ["Monthly", "months"],
  year: ["Yearly", "years"],
};

/** "Daily", "Every 2 weeks on Mon, Wed", "Monthly, after completion", "Daily, until Oct 31, 2026". */
export function describeRepeat(rule: Repeat): string {
  const [single, plural] = UNIT_WORDS[rule.unit];
  let text = rule.every === 1 ? single : `Every ${rule.every} ${plural}`;
  if (rule.unit === "week" && rule.weekdays?.length) {
    const days = [...rule.weekdays].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
    const isWorkweek = days.join() === "1,2,3,4,5";
    text =
      rule.every === 1 && isWorkweek
        ? "Every weekday"
        : `${text} on ${days.map((d) => WEEKDAY_NAMES[d]).join(", ")}`;
  }
  if (rule.afterCompletion) text = `${text}, after completion`;
  return rule.until ? `${text}, until ${formatUntil(rule.until)}` : text;
}

export function parseRepeat(raw: unknown): Repeat | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!REPEAT_UNITS.includes(r.unit as RepeatUnit)) return null;
  const every = typeof r.every === "number" && Number.isInteger(r.every) ? r.every : 1;
  if (every < 1 || every > MAX_REPEAT_EVERY) return null;
  const rule: Repeat = { unit: r.unit as RepeatUnit, every };
  if (rule.unit === "week" && Array.isArray(r.weekdays)) {
    const days = [...new Set(r.weekdays.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))];
    if (days.length) rule.weekdays = days as number[];
  }
  if (r.afterCompletion === true) rule.afterCompletion = true;
  if (isDateKey(r.until)) rule.until = r.until;
  return rule;
}
