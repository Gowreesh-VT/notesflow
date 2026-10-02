import { describe, expect, it } from "vitest";
import { countTasks, dueBucket, filterTasks, parseQuickAdd, subtaskProgress } from "./tasks-logic";
import type { Task } from "./types";
import { addDays } from "./utils";

const today = "2026-05-10";

const make = (id: string, patch: Partial<Task> = {}): Task => ({
  id,
  title: id,
  details: "",
  done: false,
  priority: "none",
  due: null,
  createdAt: 1,
  completedAt: null,
  subtasks: [],
  ...patch,
});

const tasks = [
  make("late", { due: "2026-05-01" }),
  make("now", { due: today, priority: "high" }),
  make("soon", { due: "2026-05-20" }),
  make("someday"),
  make("done", { done: true, completedAt: 50 }),
];

describe("tasks logic", () => {
  it("buckets due dates", () => {
    expect(dueBucket({ due: null }, today)).toBe("none");
    expect(dueBucket({ due: "2026-05-09" }, today)).toBe("overdue");
    expect(dueBucket({ due: today }, today)).toBe("today");
    expect(dueBucket({ due: "2026-05-11" }, today)).toBe("upcoming");
  });

  it("filters by view and orders by due date then priority", () => {
    const ids = (f: Parameters<typeof filterTasks>[1]) =>
      filterTasks(tasks, f, "", today).map((t) => t.id);
    expect(ids("inbox")).toEqual(["late", "now", "soon", "someday"]);
    expect(ids("today")).toEqual(["late", "now"]);
    expect(ids("upcoming")).toEqual(["soon"]);
    expect(ids("completed")).toEqual(["done"]);
  });

  it("searches titles, details and subtasks", () => {
    const withSub = [make("x", { subtasks: [{ id: "s", title: "buy milk", done: false }] })];
    expect(filterTasks(withSub, "inbox", "MILK", today)).toHaveLength(1);
    expect(filterTasks(withSub, "inbox", "eggs", today)).toHaveLength(0);
  });

  it("counts tasks per view", () => {
    expect(countTasks(tasks, today)).toEqual({ inbox: 4, today: 2, upcoming: 1, completed: 1 });
  });

  it("computes subtask progress", () => {
    const sub = (done: boolean) => ({ id: String(done), title: "t", done });
    expect(subtaskProgress({ subtasks: [sub(true), sub(false), sub(true)] })).toEqual({
      done: 2,
      total: 3,
    });
  });
});

describe("parseQuickAdd", () => {
  it("extracts priority and due keywords", () => {
    expect(parseQuickAdd("Pay rent tomorrow !high", today, addDays)).toEqual({
      title: "Pay rent",
      priority: "high",
      due: "2026-05-11",
    });
    expect(parseQuickAdd("call mom 2026-06-01 !m", today, addDays)).toEqual({
      title: "call mom",
      priority: "medium",
      due: "2026-06-01",
    });
  });

  it("keeps the input as the title when only keywords are given", () => {
    expect(parseQuickAdd("today", today, addDays).title).toBe("today");
  });
});
