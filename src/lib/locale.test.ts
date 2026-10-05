import { afterEach, describe, expect, it } from "vitest";
import { monthMatrix, weekDays } from "./calendar";
import { weekStartOf } from "./focus-stats";
import { monthGrid } from "./habits";
import { DEFAULT_LOCALE_PREFS, setLocalePrefs, weekdayPosition } from "./locale";
import { cleanPreferenceValues } from "./preferences";
import { formatClock, formatDueLabel } from "./utils";

afterEach(() => setLocalePrefs(DEFAULT_LOCALE_PREFS));

// 2026-10-05 is a Monday.
describe("week start", () => {
  it("starts weeks on Monday by default", () => {
    expect(weekdayPosition("2026-10-05")).toBe(0);
    expect(weekDays("2026-10-07")[0]).toBe("2026-10-05");
    expect(weekStartOf("2026-10-11")).toBe("2026-10-05");
  });

  it("can start weeks on Sunday or Saturday", () => {
    setLocalePrefs({ ...DEFAULT_LOCALE_PREFS, weekStart: 0 });
    expect(weekDays("2026-10-07")).toEqual([
      "2026-10-04",
      "2026-10-05",
      "2026-10-06",
      "2026-10-07",
      "2026-10-08",
      "2026-10-09",
      "2026-10-10",
    ]);
    expect(weekStartOf("2026-10-10")).toBe("2026-10-04");
    // October 2026 starts on a Thursday: four blank days before it when weeks start on Sunday.
    expect(monthGrid(2026, 10)[0].filter((d) => d === null)).toHaveLength(4);
    expect(monthMatrix("2026-10-15")[0][0]).toBe("2026-09-27");

    setLocalePrefs({ ...DEFAULT_LOCALE_PREFS, weekStart: 6 });
    expect(weekDays("2026-10-07")[0]).toBe("2026-10-03");
  });
});

describe("date and time formats", () => {
  it("orders day and month as chosen", () => {
    setLocalePrefs({ ...DEFAULT_LOCALE_PREFS, dateOrder: "dmy" });
    expect(formatDueLabel("2026-10-20", "2026-10-05")).toBe("20 Oct");
    setLocalePrefs({ ...DEFAULT_LOCALE_PREFS, dateOrder: "mdy" });
    expect(formatDueLabel("2026-10-20", "2026-10-05")).toBe("Oct 20");
  });

  it("shows 12- or 24-hour times as chosen", () => {
    setLocalePrefs({ ...DEFAULT_LOCALE_PREFS, dateOrder: "mdy", clock: "24h" });
    expect(formatClock("13:05")).toBe("13:05");
    setLocalePrefs({ ...DEFAULT_LOCALE_PREFS, dateOrder: "dmy", clock: "12h" });
    expect(formatClock("13:05").toLowerCase().replace(/\s/g, " ")).toMatch(/^1:05 pm$/);
  });

  it("only accepts known values in preferences", () => {
    expect(cleanPreferenceValues({ weekStart: 3, dateOrder: "ymd", clock: "24h" })).toMatchObject({
      weekStart: 1,
      dateOrder: "auto",
      clock: "24h",
    });
  });
});
