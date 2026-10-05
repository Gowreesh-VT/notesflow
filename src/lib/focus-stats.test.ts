import { describe, expect, it } from "vitest";
import { focusStats, weekStartOf } from "./focus-stats";
import { INBOX_ID, type Item } from "./types";

const at = (date: string, hour: number) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d, hour).getTime();
};
const entry = (date: string, hour: number, minutes: number, focus = true) => ({
  id: `${date}-${hour}`,
  start: at(date, hour),
  end: at(date, hour) + minutes * 60_000,
  ...(focus ? { focus: true } : {}),
});
const task = (id: string, listId: string, timeEntries: Item["timeEntries"]): Item => ({
  id,
  kind: "task",
  title: id,
  body: "",
  listId,
  createdAt: 1,
  updatedAt: 1,
  deletedAt: null,
  pinned: false,
  status: "open",
  completedAt: null,
  priority: "none",
  due: null,
  subtasks: [],
  sectionId: null,
  timeEntries,
});

describe("focus statistics", () => {
  // 2026-10-07 is a Wednesday; its week starts on Monday 2026-10-05.
  const today = "2026-10-07";

  it("finds the Monday of a week", () => {
    expect(weekStartOf(today)).toBe("2026-10-05");
    expect(weekStartOf("2026-10-05")).toBe("2026-10-05");
    expect(weekStartOf("2026-10-11")).toBe("2026-10-05");
  });

  it("sums focus time per day, this week and per list, ignoring plain timer entries", () => {
    const stats = focusStats(
      [
        task("a", "work", [entry(today, 9, 25), entry(today, 10, 25), entry("2026-10-05", 9, 50)]),
        task("b", INBOX_ID, [entry("2026-10-04", 9, 30), entry(today, 14, 40, false)]),
      ],
      today,
    );
    expect(stats.todayMinutes).toBe(50);
    expect(stats.weekMinutes).toBe(100);
    expect(stats.weekSessions).toBe(3);
    expect(stats.days.map((d) => d.minutes)).toEqual([0, 0, 0, 30, 50, 0, 50]);
    expect(stats.byList).toEqual([{ listId: "work", minutes: 100 }]);
  });
});
