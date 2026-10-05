import { describe, expect, it } from "vitest";
import {
  blockLength,
  clockToMinutes,
  layoutBlocks,
  minutesToClock,
  minutesToOffset,
  nextFreeStart,
  offsetToMinutes,
  planTotals,
  planWindow,
  resizeLength,
  scheduledOn,
  shiftStart,
  slotStarts,
  snapMinutes,
  toPlanOn,
  autoSchedule,
  plannerOrder,
} from "./plan";
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

const at = (id: string, dueTime: string, estimate?: number) =>
  make(id, { due: today, dueTime, ...(estimate ? { estimate } : {}) });

const window = { start: 6 * 60, end: 23 * 60 };

describe("plan time conversions", () => {
  it("converts clock times to minutes and back", () => {
    expect(clockToMinutes("09:30")).toBe(570);
    expect(clockToMinutes("00:00")).toBe(0);
    expect(clockToMinutes("23:59")).toBe(1439);
    expect(clockToMinutes("24:00")).toBeNull();
    expect(clockToMinutes("9:30")).toBeNull();
    expect(clockToMinutes(null)).toBeNull();
    expect(minutesToClock(570)).toBe("09:30");
    expect(minutesToClock(0)).toBe("00:00");
    expect(minutesToClock(-20)).toBe("00:00");
    expect(minutesToClock(24 * 60)).toBe("23:59");
  });

  it("snaps to quarter hours", () => {
    expect(snapMinutes(577)).toBe(570);
    expect(snapMinutes(578)).toBe(585);
    expect(snapMinutes(61, 30)).toBe(60);
  });

  it("lists half-hour slots in the window", () => {
    const slots = slotStarts({ start: 360, end: 480 });
    expect(slots).toEqual([360, 390, 420, 450]);
    expect(slotStarts(window)).toHaveLength(34);
  });

  it("maps grid offsets to snapped times inside the window", () => {
    // 2px per minute: 210px is 105 minutes after 6:00 → 7:45.
    expect(offsetToMinutes(210, 2, window)).toBe(465);
    expect(offsetToMinutes(215, 2, window)).toBe(465);
    expect(offsetToMinutes(-40, 2, window)).toBe(360);
    expect(offsetToMinutes(99_999, 2, window)).toBe(23 * 60 - 15);
    expect(minutesToOffset(465, 2, window)).toBe(210);
  });

  it("sizes, resizes and moves blocks", () => {
    expect(blockLength({ estimate: 45 })).toBe(45);
    expect(blockLength({})).toBe(30);
    expect(blockLength({ estimate: null })).toBe(30);
    // Dragging the bottom edge 50px at 2px/min adds 25 minutes, snapped to 30.
    expect(resizeLength(30, 50, 2, 600)).toBe(60);
    expect(resizeLength(30, -500, 2, 600)).toBe(15);
    expect(resizeLength(30, 5000, 2, 23 * 60)).toBe(60);
    expect(shiftStart(600, 15)).toBe(615);
    expect(shiftStart(5, -15)).toBe(0);
    expect(shiftStart(1430, 15)).toBe(1425);
  });
});

describe("which tasks are planned or still to plan", () => {
  const items: Item[] = [
    make("due-today", { due: today, priority: "high" }),
    at("timed", "09:00"),
    at("timed-late", "08:00"),
    make("overdue", { due: "2026-05-01" }),
    make("overdue-timed", { due: "2026-05-02", dueTime: "10:00" }),
    make("tomorrow", { due: "2026-05-11" }),
    make("running", { due: "2026-05-12", startDate: "2026-05-09" }),
    make("undated"),
    make("done", { due: today, status: "done" }),
    make("done-timed", { due: today, dueTime: "12:00", status: "done" }),
    make("skipped-timed", { due: today, dueTime: "13:00", status: "wontdo" }),
    make("note", { kind: "note", due: today }),
    make("trashed", { due: today, deletedAt: 5 }),
    make("template", { due: today, template: true }),
    make("archived", { due: today, listId: "old" }),
  ];
  const archived = new Set(["old"]);

  it("collects tasks to plan for today, with overdue ones", () => {
    const ids = toPlanOn(items, today, today, { archived }).map((i) => i.id);
    expect(ids).toEqual(["overdue", "overdue-timed", "due-today", "running"]);
  });

  it("can include undated tasks", () => {
    const ids = toPlanOn(items, today, today, { archived, includeUndated: true }).map((i) => i.id);
    expect(ids).toContain("undated");
  });

  it("keeps overdue tasks for future days but not past ones", () => {
    expect(toPlanOn(items, "2026-05-11", today).map((i) => i.id)).toEqual([
      "overdue",
      "overdue-timed",
      "tomorrow",
      "running",
    ]);
    expect(toPlanOn(items, "2026-05-01", today).map((i) => i.id)).toEqual(["overdue"]);
  });

  it("lists the day's timed tasks in time order, without skipped ones", () => {
    expect(scheduledOn(items, today, archived).map((i) => i.id)).toEqual([
      "timed-late",
      "timed",
      "done-timed",
    ]);
    expect(scheduledOn(items, "2026-05-02").map((i) => i.id)).toEqual(["overdue-timed"]);
  });
});

describe("block layout", () => {
  it("keeps separate blocks in one column", () => {
    const blocks = layoutBlocks([at("a", "09:00"), at("b", "09:30"), at("c", "11:00", 60)]);
    expect(blocks.map((b) => [b.item.id, b.start, b.end, b.column, b.columns])).toEqual([
      ["a", 540, 570, 0, 1],
      ["b", 570, 600, 0, 1],
      ["c", 660, 720, 0, 1],
    ]);
  });

  it("places overlapping blocks side by side", () => {
    const blocks = layoutBlocks([
      at("long", "09:00", 120),
      at("mid", "09:30", 30),
      at("later", "10:00", 30),
      at("third", "09:45", 60),
      at("alone", "12:00"),
    ]);
    const byId = Object.fromEntries(blocks.map((b) => [b.item.id, [b.column, b.columns]]));
    expect(byId).toEqual({
      long: [0, 3],
      mid: [1, 3],
      third: [2, 3],
      later: [1, 3],
      alone: [0, 1],
    });
  });

  it("ignores tasks without a valid time and ends blocks at midnight", () => {
    const blocks = layoutBlocks([make("x", { due: today }), at("late", "23:30", 90)]);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].end).toBe(24 * 60);
  });

  it("widens the window to whole hours around early and late blocks", () => {
    expect(planWindow([])).toEqual(window);
    expect(planWindow([{ start: 5 * 60 + 30, end: 6 * 60 }])).toEqual({ start: 300, end: 1380 });
    expect(planWindow([{ start: 23 * 60, end: 23 * 60 + 10 }])).toEqual({ start: 360, end: 1440 });
  });
});

describe("plan totals", () => {
  const blocks = [
    { start: 9 * 60, end: 10 * 60 },
    { start: 9 * 60 + 30, end: 10 * 60 + 30 },
    { start: 14 * 60, end: 15 * 60 },
  ];

  it("counts planned and free time for a future day", () => {
    // 3h planned; 17h window minus 2h30m covered.
    expect(planTotals(blocks, window, null)).toEqual({
      planned: 180,
      available: 17 * 60,
      free: 17 * 60 - 150,
      over: 0,
    });
  });

  it("only counts time still ahead today", () => {
    const totals = planTotals(blocks, window, 10 * 60);
    expect(totals.planned).toBe(180);
    expect(totals.available).toBe(13 * 60);
    expect(totals.free).toBe(13 * 60 - 90);
    expect(totals.over).toBe(0);
  });

  it("reports when the plan no longer fits", () => {
    const late = [
      { start: 22 * 60, end: 23 * 60 },
      { start: 22 * 60, end: 23 * 60 },
    ];
    expect(planTotals(late, window, 22 * 60 + 30)).toEqual({
      planned: 120,
      available: 30,
      free: 0,
      over: 30,
    });
    expect(planTotals(blocks, window, 24 * 60)).toMatchObject({ available: 0, free: 0, over: 0 });
  });

  it("finds the next gap for a task", () => {
    expect(nextFreeStart(blocks, 9 * 60, 30, window)).toBe(10 * 60 + 30);
    expect(nextFreeStart(blocks, 8 * 60 + 40, 15, window)).toBe(8 * 60 + 45);
    expect(nextFreeStart(blocks, 8 * 60 + 40, 30, window)).toBe(10 * 60 + 30);
    expect(nextFreeStart(blocks, 3 * 60, 30, window)).toBe(6 * 60);
    expect(nextFreeStart(blocks, 22 * 60 + 50, 30, window)).toBeNull();
  });
});

describe("guided day planning", () => {
  const t = (id: string, patch: Partial<Item> = {}) =>
    ({
      id,
      kind: "task",
      title: id,
      body: "",
      listId: "inbox",
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
    }) as Item;

  it("orders overdue first, then by priority, then shorter tasks", () => {
    const ordered = plannerOrder(
      [
        t("long-high", { priority: "high", estimate: 90 }),
        t("short-high", { priority: "high", estimate: 15 }),
        t("late", { due: "2026-10-01" }),
        t("low", { priority: "low" }),
      ],
      "2026-10-05",
    );
    expect(ordered.map((i) => i.id)).toEqual(["late", "short-high", "long-high", "low"]);
  });

  it("schedules tasks back to back from a rounded-up start, with breaks, and reports overflow", () => {
    const { blocks, overflow } = autoSchedule(
      [t("a", { estimate: 60 }), t("b"), t("c", { estimate: 120 }), t("d", { estimate: 15 })],
      9 * 60 + 7,
      12 * 60,
      5,
    );
    expect(blocks).toEqual([
      { id: "a", start: 555, end: 615 },
      { id: "b", start: 620, end: 650 },
      { id: "d", start: 655, end: 670 },
    ]);
    expect(overflow).toEqual(["c"]);
  });
});
