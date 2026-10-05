/**
 * Date and time display preferences: first day of the week, date order and 12/24-hour clock. They are account
 * preferences; AppShell copies the current ones here (`setLocalePrefs`) before rendering, so plain formatting
 * functions can use them without every caller passing them along.
 */

/** 0 = Sunday, 1 = Monday, 6 = Saturday (as in Date.getDay). */
export type WeekStart = 0 | 1 | 6;
/** "auto" follows the browser's language; the others fix the order ("5 Oct" or "Oct 5"). */
export type DateOrder = "auto" | "dmy" | "mdy";
export type ClockFormat = "auto" | "12h" | "24h";

export type LocalePrefs = { weekStart: WeekStart; dateOrder: DateOrder; clock: ClockFormat };

export const WEEK_STARTS: WeekStart[] = [1, 0, 6];
export const DATE_ORDERS: DateOrder[] = ["auto", "dmy", "mdy"];
export const CLOCK_FORMATS: ClockFormat[] = ["auto", "12h", "24h"];

export const DEFAULT_LOCALE_PREFS: LocalePrefs = { weekStart: 1, dateOrder: "auto", clock: "auto" };

let current: LocalePrefs = DEFAULT_LOCALE_PREFS;

export function setLocalePrefs(prefs: LocalePrefs): void {
  current = prefs;
}

export const localePrefs = (): LocalePrefs => current;

const LOCALES: Record<DateOrder, string | undefined> = {
  auto: undefined,
  dmy: "en-GB",
  mdy: "en-US",
};

/** Adds the 12/24-hour choice to formatting options that show an hour. */
function withClock(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormatOptions {
  if (current.clock === "auto" || !options.hour) return options;
  return current.clock === "12h"
    ? { ...options, hour12: true }
    : { ...options, hour12: false, hourCycle: "h23" };
}

/** Like toLocaleDateString, honouring the date order preference. */
export const formatDate = (date: Date, options: Intl.DateTimeFormatOptions): string =>
  date.toLocaleDateString(LOCALES[current.dateOrder], options);

/** Like toLocaleTimeString, honouring the clock preference. */
export const formatTime = (date: Date, options: Intl.DateTimeFormatOptions): string =>
  date.toLocaleTimeString(LOCALES[current.dateOrder], withClock(options));

/** Like toLocaleString (date and time), honouring both preferences. */
export const formatDateTime = (date: Date, options: Intl.DateTimeFormatOptions): string =>
  date.toLocaleString(LOCALES[current.dateOrder], withClock(options));

/** Position of `day` in its week, 0 for the preferred first day of the week. */
export function weekdayPosition(day: string, weekStart: WeekStart = current.weekStart): number {
  const [y, m, d] = day.split("-").map(Number);
  return (new Date(y, m - 1, d).getDay() - weekStart + 7) % 7;
}
