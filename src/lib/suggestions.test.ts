import { describe, expect, it } from "vitest";
import { scheduleSuggestions } from "./suggestions";
import { INBOX_ID, type Item } from "./types";

const task = (id: string, patch: Partial<Item> = {}): Item => ({
  id,
  kind: "task",
  title: id,
  body: "",
  listId: INBOX_ID,
  createdAt: 1,
  updatedAt: 1,
  deletedAt: null,
  pinned: false,
  status: "open",
  completedAt: null,
  priority: "none",
  due: "2026-10-05",
  subtasks: [],
  sectionId: null,
  ...patch,
});
const today = "2026-10-05";
const at = (h: number) => h * 60;

describe("scheduling suggestions", () => {
  it("suggests moving overdue tasks to today", () => {
    const [s] = scheduleSuggestions(
      [task("late", { due: "2026-10-01" }), task("now")],
      today,
      at(9),
    );
    expect(s).toMatchObject({ id: "overdue", action: { ids: ["late"], to: "today" } });
  });

  it("moves the least important work to tomorrow when the day is overloaded", () => {
    const items = [
      task("big-high", { estimate: 120, priority: "high" }),
      task("mid-low", { estimate: 60, priority: "low" }),
      task("small-none", { estimate: 30 }),
      task("unestimated"),
    ];
    // 18:00 leaves 3 hours before 21:00; 3.5 hours are estimated.
    const [s] = scheduleSuggestions(items, today, at(18));
    expect(s.id).toBe("overloaded");
    expect(s.action.ids).toEqual(["small-none"]);
  });

  it("flags a single task longer than the time left", () => {
    const [s] = scheduleSuggestions([task("essay", { estimate: 180 })], today, at(19));
    expect(s).toMatchObject({ id: "too-long", action: { ids: ["essay"], to: "tomorrow" } });
  });

  it("stays quiet on a manageable day", () => {
    expect(
      scheduleSuggestions(
        [task("a", { estimate: 30 }), task("b", { due: "2026-10-09" })],
        today,
        at(9),
      ),
    ).toEqual([]);
  });
});
