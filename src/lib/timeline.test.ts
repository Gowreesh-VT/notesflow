import { describe, expect, it } from "vitest";
import {
  barGeometry,
  daysFromPixels,
  describeBar,
  dragDates,
  groupTimeline,
  isMultiDay,
  isWeekend,
  monthSpans,
  rangeDays,
  timelineRange,
  timelineStart,
  timelineTasks,
  type TimelineTask,
} from "./timeline";
import { INBOX_ID, type Item, type TaskList } from "./types";

// A Sunday.
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

const task = (id: string, due: string, startDate?: string, patch: Partial<Item> = {}) =>
  make(id, { due, startDate, ...patch }) as TimelineTask;

const list = (id: string, name: string, order?: number): TaskList => ({
  id,
  name,
  sections: [],
  folderId: null,
  order,
  createdAt: 1,
  updatedAt: 1,
});

describe("timelineStart", () => {
  it("uses the start date of a multi-day task and the due date otherwise", () => {
    expect(timelineStart({ due: "2026-05-12", startDate: "2026-05-09" })).toBe("2026-05-09");
    expect(timelineStart({ due: "2026-05-12" })).toBe("2026-05-12");
    expect(timelineStart({ due: "2026-05-12", startDate: "2026-05-12" })).toBe("2026-05-12");
    expect(isMultiDay({ due: "2026-05-12", startDate: "2026-05-12" })).toBe(false);
    expect(isMultiDay({ due: "2026-05-12", startDate: "2026-05-11" })).toBe(true);
  });
});

describe("timelineTasks", () => {
  it("keeps open, dated tasks from active lists, ordered by start", () => {
    const items = [
      make("later", { due: "2026-05-20" }),
      make("range", { due: "2026-05-22", startDate: "2026-05-01" }),
      make("undated"),
      make("note", { kind: "note", due: "2026-05-11" }),
      make("done", { status: "done", due: "2026-05-11" }),
      make("trashed", { deletedAt: 1, due: "2026-05-11" }),
      make("template", { template: true, due: "2026-05-11" }),
      make("archived", { listId: "old", due: "2026-05-11" }),
    ];
    expect(timelineTasks(items, new Set(["old"])).map((t) => t.id)).toEqual(["range", "later"]);
  });
});

describe("groupTimeline", () => {
  it("groups by list with the Inbox first, then lists in sidebar order", () => {
    const tasks = [
      task("a", "2026-05-11", undefined, { listId: "work" }),
      task("b", "2026-05-12"),
      task("c", "2026-05-13", undefined, { listId: "home" }),
      task("d", "2026-05-14", undefined, { listId: "gone" }),
    ];
    const lists = [list("work", "Work", 2), list("home", "Home", 1), list("empty", "Empty", 0)];
    const groups = groupTimeline(tasks, lists);
    expect(groups.map((g) => g.name)).toEqual(["Inbox", "Home", "Work"]);
    expect(groups[0].items.map((t) => t.id)).toEqual(["b", "d"]);
  });
});

describe("timelineRange", () => {
  it("covers about three weeks around today in week zoom, aligned to Monday–Sunday", () => {
    const range = timelineRange([], today, "week");
    expect(range.from).toBe("2026-04-27");
    expect(range.to).toBe("2026-06-07");
    expect(range.days % 7).toBe(0);
  });

  it("covers whole months in month zoom", () => {
    const range = timelineRange([], today, "month");
    expect(range.from).toBe("2026-04-01");
    expect(range.to).toBe("2026-08-31");
  });

  it("grows to fit tasks, within limits", () => {
    const range = timelineRange(
      [task("a", "2026-07-01", "2026-03-30"), task("far", "2031-01-01")],
      today,
      "month",
    );
    expect(range.from).toBe("2026-03-01");
    expect(range.to).toBe("2028-05-31");
  });

  it("lists its days and month spans", () => {
    const range = { from: "2026-12-30", to: "2027-01-02", days: 4 };
    expect(rangeDays(range)).toEqual(["2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02"]);
    expect(monthSpans(range).map(({ key, start, days }) => ({ key, start, days }))).toEqual([
      { key: "2026-12", start: "2026-12-30", days: 2 },
      { key: "2027-01", start: "2027-01-01", days: 2 },
    ]);
  });
});

describe("barGeometry", () => {
  const range = { from: "2026-05-04", to: "2026-05-17", days: 14 };

  it("spans from the start of the first day to the end of the due day", () => {
    expect(barGeometry("2026-05-05", "2026-05-07", range, 10)).toEqual({
      x: 10,
      width: 30,
      clippedStart: false,
      clippedEnd: false,
    });
    expect(barGeometry("2026-05-04", "2026-05-04", range, 48)?.width).toBe(48);
  });

  it("clips bars at the edges and skips bars outside the range", () => {
    expect(barGeometry("2026-05-01", "2026-05-20", range, 10)).toEqual({
      x: 0,
      width: 140,
      clippedStart: true,
      clippedEnd: true,
    });
    expect(barGeometry("2026-05-18", "2026-05-19", range, 10)).toBeNull();
    expect(barGeometry("2026-04-01", "2026-05-03", range, 10)).toBeNull();
  });
});

describe("daysFromPixels", () => {
  it("rounds to the nearest day", () => {
    expect(daysFromPixels(23, 48)).toBe(0);
    expect(daysFromPixels(25, 48)).toBe(1);
    expect(daysFromPixels(-100, 48)).toBe(-2);
    expect(Object.is(daysFromPixels(-1, 48), 0)).toBe(true);
  });
});

describe("dragDates", () => {
  const range = { due: "2026-05-08", startDate: "2026-05-05" };

  it("moves the start and due dates together", () => {
    expect(dragDates(range, "move", 3)).toEqual({ due: "2026-05-11", startDate: "2026-05-08" });
    expect(dragDates({ due: "2026-05-08" }, "move", -2)).toEqual({
      due: "2026-05-06",
      startDate: null,
    });
  });

  it("changes the due date without passing the start", () => {
    expect(dragDates(range, "end", 2)).toEqual({ due: "2026-05-10", startDate: "2026-05-05" });
    expect(dragDates(range, "end", -10)).toEqual({ due: "2026-05-05", startDate: null });
  });

  it("changes the start date without passing the due date", () => {
    expect(dragDates(range, "start", -1)).toEqual({ due: "2026-05-08", startDate: "2026-05-04" });
    expect(dragDates(range, "start", 9)).toEqual({ due: "2026-05-08", startDate: null });
  });

  it("turns a single-day task into a multi-day one by dragging an edge", () => {
    const single = { due: "2026-05-08", startDate: null };
    expect(dragDates(single, "end", 2)).toEqual({ due: "2026-05-10", startDate: "2026-05-08" });
    expect(dragDates(single, "start", -2)).toEqual({ due: "2026-05-08", startDate: "2026-05-06" });
    expect(dragDates(single, "end", -2)).toEqual({ due: "2026-05-08", startDate: null });
  });
});

describe("describeBar", () => {
  it("names the task and its dates", () => {
    expect(describeBar(task("Plan offsite", "2026-05-11", today), today)).toBe(
      "Plan offsite, Today to Tomorrow",
    );
    expect(describeBar(task("Pay rent", today), today)).toBe("Pay rent, due Today");
  });
});

describe("isWeekend", () => {
  it("knows Saturdays and Sundays", () => {
    expect(isWeekend("2026-05-09")).toBe(true);
    expect(isWeekend(today)).toBe(true);
    expect(isWeekend("2026-05-11")).toBe(false);
  });
});
