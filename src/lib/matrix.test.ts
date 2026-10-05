import { describe, expect, it } from "vitest";
import {
  isUrgent,
  matrixTasks,
  neighbourQuadrant,
  patchForQuadrant,
  quadrantOf,
  URGENT_WITHIN_DAYS,
} from "./matrix";
import { INBOX_ID, type Item } from "./types";

const today = "2026-05-10";

const make = (id: string, patch: Partial<Item> = {}): Item => ({
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
  due: null,
  subtasks: [],
  sectionId: null,
  ...patch,
});

describe("isUrgent", () => {
  it("counts overdue tasks and tasks due within the threshold, today included", () => {
    expect(URGENT_WITHIN_DAYS).toBe(2);
    expect(isUrgent("2026-05-01", today)).toBe(true);
    expect(isUrgent(today, today)).toBe(true);
    expect(isUrgent("2026-05-11", today)).toBe(true);
    expect(isUrgent("2026-05-12", today)).toBe(false);
    expect(isUrgent(null, today)).toBe(false);
  });
});

describe("quadrantOf", () => {
  it("places tasks by priority and due date", () => {
    expect(quadrantOf({ priority: "high", due: today }, today)).toBe("do");
    expect(quadrantOf({ priority: "medium", due: "2026-05-09" }, today)).toBe("do");
    expect(quadrantOf({ priority: "high", due: null }, today)).toBe("schedule");
    expect(quadrantOf({ priority: "medium", due: "2026-06-01" }, today)).toBe("schedule");
    expect(quadrantOf({ priority: "low", due: "2026-05-11" }, today)).toBe("delegate");
    expect(quadrantOf({ priority: "none", due: today }, today)).toBe("delegate");
    expect(quadrantOf({ priority: "low", due: null }, today)).toBe("later");
    expect(quadrantOf({ priority: "none", due: "2026-05-20" }, today)).toBe("later");
  });
});

describe("matrixTasks", () => {
  it("keeps only open, live tasks from active lists, sorted by due date", () => {
    const items = [
      make("late", { priority: "high", due: "2026-05-12" }),
      make("soon", { priority: "high", due: "2026-05-11" }),
      make("note", { kind: "note", priority: "high", due: today }),
      make("done", { status: "done", priority: "high", due: today }),
      make("trashed", { deletedAt: 5, priority: "high", due: today }),
      make("template", { template: true, priority: "high", due: today }),
      make("archived", { listId: "old", priority: "high", due: today }),
      make("someday"),
    ];
    const result = matrixTasks(items, new Set(["old"]), today);
    expect(result.do.map((i) => i.id)).toEqual(["soon"]);
    expect(result.schedule.map((i) => i.id)).toEqual(["late"]);
    expect(result.delegate).toEqual([]);
    expect(result.later.map((i) => i.id)).toEqual(["someday"]);
  });
});

describe("patchForQuadrant", () => {
  it("changes nothing when the task already fits", () => {
    expect(patchForQuadrant({ priority: "medium", due: today }, "do", today)).toEqual({});
    expect(patchForQuadrant({ priority: "none", due: null }, "later", today)).toEqual({});
  });

  it("raises or lowers the priority across the important line", () => {
    expect(patchForQuadrant({ priority: "low", due: null }, "schedule", today)).toEqual({
      priority: "high",
    });
    expect(patchForQuadrant({ priority: "medium", due: null }, "later", today)).toEqual({
      priority: "low",
    });
  });

  it("makes a task due today when it becomes urgent", () => {
    expect(patchForQuadrant({ priority: "none", due: null }, "delegate", today)).toEqual({
      due: today,
    });
    expect(patchForQuadrant({ priority: "low", due: "2026-06-01" }, "do", today)).toEqual({
      priority: "high",
      due: today,
    });
  });

  it("pushes an urgent task to the first day that is no longer urgent", () => {
    expect(patchForQuadrant({ priority: "high", due: "2026-05-01" }, "schedule", today)).toEqual({
      due: "2026-05-12",
    });
    expect(quadrantOf({ priority: "high", due: "2026-05-12" }, today)).toBe("schedule");
  });

  it("keeps the length of a multi-day task", () => {
    expect(
      patchForQuadrant(
        { priority: "high", due: today, startDate: "2026-05-07" },
        "schedule",
        today,
      ),
    ).toEqual({ due: "2026-05-12", startDate: "2026-05-09" });
  });

  it("always lands the task in the target quadrant", () => {
    const quadrants = ["do", "schedule", "delegate", "later"] as const;
    const samples = [
      { priority: "none" as const, due: null },
      { priority: "high" as const, due: "2026-04-01" },
      { priority: "medium" as const, due: "2026-07-01" },
      { priority: "low" as const, due: today },
    ];
    for (const sample of samples) {
      for (const target of quadrants) {
        const next = { ...sample, ...patchForQuadrant(sample, target, today) };
        expect(quadrantOf(next, today)).toBe(target);
      }
    }
  });
});

describe("neighbourQuadrant", () => {
  it("moves within the 2×2 grid", () => {
    expect(neighbourQuadrant("do", "right")).toBe("schedule");
    expect(neighbourQuadrant("do", "down")).toBe("delegate");
    expect(neighbourQuadrant("later", "up")).toBe("schedule");
    expect(neighbourQuadrant("later", "left")).toBe("delegate");
    expect(neighbourQuadrant("do", "left")).toBeNull();
    expect(neighbourQuadrant("delegate", "down")).toBeNull();
  });
});
