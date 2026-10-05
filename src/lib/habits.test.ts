import { describe, expect, it } from "vitest";
import {
  cleanCheckins,
  cleanHabitName,
  habitStreaks,
  lastDays,
  monthGrid,
  parseGoal,
  periodProgress,
  toggleCheckin,
} from "./habits";

describe("habits", () => {
  it("cleans names, goals and check-ins", () => {
    expect(cleanHabitName("  Read   daily ")).toBe("Read daily");
    expect(cleanHabitName("   ")).toBeNull();
    expect(parseGoal({ per: "week", times: 9 })).toEqual({ per: "week", times: 7 });
    expect(parseGoal({ per: "day", times: 3 })).toEqual({ per: "day", times: 1 });
    expect(parseGoal("junk")).toEqual({ per: "day", times: 1 });
    expect(cleanCheckins(["2026-10-05", "bad", "2026-10-01", "2026-10-05"])).toEqual([
      "2026-10-01",
      "2026-10-05",
    ]);
  });

  it("toggles check-ins and lists recent days", () => {
    expect(toggleCheckin(["2026-10-01"], "2026-10-03")).toEqual(["2026-10-01", "2026-10-03"]);
    expect(toggleCheckin(["2026-10-01", "2026-10-03"], "2026-10-01")).toEqual(["2026-10-03"]);
    expect(lastDays("2026-10-02", 3)).toEqual(["2026-09-30", "2026-10-01", "2026-10-02"]);
  });
});

describe("habit goals and streaks", () => {
  // 2026-10-07 is a Wednesday.
  const today = "2026-10-07";
  const daily = (checkins: string[]) => ({ checkins, goal: { per: "day" as const, times: 1 } });
  const weekly = (checkins: string[], times = 3) => ({
    checkins,
    goal: { per: "week" as const, times },
  });

  it("counts progress in the current day or week", () => {
    expect(periodProgress(daily([today]), today)).toEqual({ done: 1, target: 1, met: true });
    expect(periodProgress(weekly(["2026-10-05", "2026-10-06", "2026-10-04"]), today)).toEqual({
      done: 2,
      target: 3,
      met: false,
    });
  });

  it("counts daily streaks without breaking on an unfinished today", () => {
    const s = habitStreaks(
      daily(["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-05", "2026-10-06"]),
      today,
    );
    expect(s).toEqual({ current: 2, best: 3, unit: "day" });
    expect(habitStreaks(daily(["2026-10-05"]), today).current).toBe(0);
  });

  it("counts weekly streaks of weeks that met the goal", () => {
    const checkins = [
      // Week of Sep 21: 3 times.
      "2026-09-21",
      "2026-09-22",
      "2026-09-23",
      // Week of Sep 28: 3 times.
      "2026-09-28",
      "2026-09-30",
      "2026-10-02",
      // This week: only once so far.
      "2026-10-05",
    ];
    expect(habitStreaks(weekly(checkins), today)).toEqual({ current: 2, best: 2, unit: "week" });
  });

  it("builds a Monday-first month grid", () => {
    const grid = monthGrid(2026, 10);
    expect(grid[0]).toEqual([
      null,
      null,
      null,
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
    ]);
    expect(grid.flat().filter(Boolean)).toHaveLength(31);
    expect(grid.every((w) => w.length === 7)).toBe(true);
  });
});
