import { describe, expect, it } from "vitest";
import { completionStreak, completionsPerDay, todayTally } from "./progress";
import { INBOX_ID, type Item } from "./types";

const at = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d, 12).getTime();
};
const done = (id: string, date: string, patch: Partial<Item> = {}): Item => ({
  id,
  kind: "task",
  title: id,
  body: "",
  listId: INBOX_ID,
  createdAt: 1,
  updatedAt: 1,
  deletedAt: null,
  pinned: false,
  status: "done",
  completedAt: at(date),
  priority: "none",
  due: null,
  subtasks: [],
  sectionId: null,
  ...patch,
});

describe("progress", () => {
  const today = "2026-10-07";

  it("counts completions per day", () => {
    const per = completionsPerDay(
      [done("a", today), done("b", today), done("c", "2026-10-05")],
      today,
      3,
    );
    expect(per).toEqual([
      { date: "2026-10-05", count: 1 },
      { date: "2026-10-06", count: 0 },
      { date: "2026-10-07", count: 2 },
    ]);
  });

  it("counts streaks of days with something finished", () => {
    const items = ["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-05", "2026-10-06"].map(
      (d, i) => done(`t${i}`, d),
    );
    expect(completionStreak(items, today)).toEqual({ current: 2, best: 3 });
    expect(completionStreak([...items, done("x", today)], today).current).toBe(3);
    expect(completionStreak([done("y", "2026-10-01")], today).current).toBe(0);
  });

  it("tallies today, ignoring won't do, trash and templates", () => {
    const items = [
      done("a", today),
      done("skip", today, { status: "wontdo" }),
      done("trash", today, { deletedAt: 1 }),
      done("open", today, { status: "open", completedAt: null, due: today }),
      done("late", today, { status: "open", completedAt: null, due: "2026-10-01" }),
      done("later", today, { status: "open", completedAt: null, due: "2026-10-09" }),
    ];
    expect(todayTally(items, today)).toEqual({ finished: 1, remaining: 2 });
  });
});
