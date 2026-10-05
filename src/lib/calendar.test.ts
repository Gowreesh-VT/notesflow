import { describe, expect, it } from "vitest";
import {
  addMonths,
  calendarTasks,
  isDateKey,
  monthMatrix,
  startOfWeek,
  taskSpan,
  tasksByDay,
  weekDays,
  weekdayIndex,
} from "./calendar";
import { INBOX_ID, type Item } from "./types";

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

const ids = (items: { id: string }[]) => items.map((i) => i.id);

describe("weeks", () => {
  it("numbers weekdays from Monday", () => {
    expect(weekdayIndex("2026-10-05")).toBe(0); // Monday
    expect(weekdayIndex("2026-10-11")).toBe(6); // Sunday
  });

  it("starts weeks on Monday, across month and year boundaries", () => {
    expect(startOfWeek("2026-10-05")).toBe("2026-10-05");
    expect(startOfWeek("2026-10-11")).toBe("2026-10-05");
    expect(startOfWeek("2026-01-01")).toBe("2025-12-29");
  });

  it("lists the seven days of a week", () => {
    expect(weekDays("2026-03-01")).toEqual([
      "2026-02-23",
      "2026-02-24",
      "2026-02-25",
      "2026-02-26",
      "2026-02-27",
      "2026-02-28",
      "2026-03-01",
    ]);
  });

  it("keeps whole days across daylight-saving changes", () => {
    // Europe and the US change the clocks in late March / early November.
    expect(weekDays("2026-03-29")).toContain("2026-03-29");
    expect(weekDays("2026-03-29")[6]).toBe("2026-03-29");
    expect(weekDays("2026-11-01")).toHaveLength(7);
    expect(new Set(weekDays("2026-11-01")).size).toBe(7);
  });
});

describe("months", () => {
  it("adds months, clamping to shorter months and leap years", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-15");
    expect(addMonths("2026-01-15", -1)).toBe("2025-12-15");
    expect(addMonths("2026-03-31", -13)).toBe("2025-02-28");
  });

  it("builds whole Monday-to-Sunday weeks covering the month", () => {
    const weeks = monthMatrix("2026-10-05");
    expect(weeks[0][0]).toBe("2026-09-28");
    expect(weeks.at(-1)!.at(-1)).toBe("2026-11-01");
    expect(weeks).toHaveLength(5);
    for (const week of weeks) expect(week).toHaveLength(7);
  });

  it("uses four rows for a February that fits exactly and six when needed", () => {
    // February 2027 starts on a Monday and has 28 days.
    expect(monthMatrix("2027-02-10")).toHaveLength(4);
    // August 2026 starts on a Saturday and has 31 days.
    expect(monthMatrix("2026-08-01")).toHaveLength(6);
  });

  it("covers leap days", () => {
    const days = monthMatrix("2028-02-01").flat();
    expect(days).toContain("2028-02-29");
    expect(days).toContain("2028-03-01");
    expect(monthMatrix("2026-02-01").flat()).not.toContain("2026-02-29");
  });

  it("recognises real date keys only", () => {
    expect(isDateKey("2028-02-29")).toBe(true);
    expect(isDateKey("2026-02-29")).toBe(false);
    expect(isDateKey("2026-1-1")).toBe(false);
    expect(isDateKey(null)).toBe(false);
  });
});

describe("tasks on days", () => {
  it("shows live, dated tasks outside templates and archived lists", () => {
    const items = [
      make("open", { due: "2026-10-05" }),
      make("undated"),
      make("note", { kind: "note", due: "2026-10-05" }),
      make("trashed", { due: "2026-10-05", deletedAt: 5 }),
      make("template", { due: "2026-10-05", template: true }),
      make("archived", { due: "2026-10-05", listId: "old" }),
      make("done", { due: "2026-10-05", status: "done" }),
      make("skipped", { due: "2026-10-05", status: "wontdo" }),
    ];
    const archived = new Set(["old"]);
    expect(ids(calendarTasks(items, { archived }))).toEqual(["open"]);
    expect(ids(calendarTasks(items, { archived, showDone: true }))).toEqual(["open", "done"]);
  });

  it("spans multi-day tasks from their start to their due date", () => {
    expect(taskSpan({ due: "2026-10-08", startDate: "2026-10-05" })).toEqual({
      start: "2026-10-05",
      end: "2026-10-08",
    });
    expect(taskSpan({ due: "2026-10-08", startDate: null })).toEqual({
      start: "2026-10-08",
      end: "2026-10-08",
    });
    expect(taskSpan({ due: null })).toBeNull();
  });

  it("puts a multi-day task on every day it spans, clipped to the days shown", () => {
    const task = make("trip", { startDate: "2026-09-29", due: "2026-10-02" });
    const days = weekDays("2026-10-01"); // Sep 28 – Oct 4
    const byDay = tasksByDay([task], days);
    expect(byDay.get("2026-09-28")).toEqual([]);
    expect(byDay.get("2026-09-29")).toEqual([{ item: task, first: true, last: false }]);
    expect(byDay.get("2026-10-01")).toEqual([{ item: task, first: false, last: false }]);
    expect(byDay.get("2026-10-02")).toEqual([{ item: task, first: false, last: true }]);
    expect(byDay.get("2026-10-03")).toEqual([]);

    const later = tasksByDay([task], weekDays("2026-10-08"));
    expect([...later.values()].every((entries) => entries.length === 0)).toBe(true);
  });

  it("spans a multi-day task across a month boundary in the month grid", () => {
    const task = make("trip", { startDate: "2026-10-30", due: "2026-11-02" });
    const byDay = tasksByDay([task], monthMatrix("2026-10-01").flat());
    expect(byDay.get("2026-10-30")).toHaveLength(1);
    expect(byDay.get("2026-11-01")).toHaveLength(1);
    // The October grid ends on Sunday, November 1.
    expect(byDay.has("2026-11-02")).toBe(false);
  });

  it("orders a day: multi-day first, then all-day, then by time", () => {
    const tasks = [
      make("late", { due: "2026-10-05", dueTime: "17:00" }),
      make("early", { due: "2026-10-05", dueTime: "09:00" }),
      make("allday", { due: "2026-10-05" }),
      make("high", { due: "2026-10-05", priority: "high" }),
      make("span", { startDate: "2026-10-04", due: "2026-10-05", dueTime: "08:00" }),
    ];
    const entries = tasksByDay(tasks, ["2026-10-05"]).get("2026-10-05")!;
    expect(entries.map((e) => e.item.id)).toEqual(["span", "high", "allday", "early", "late"]);
  });
});
