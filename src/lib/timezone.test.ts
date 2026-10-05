// @vitest-environment node
import { describe, expect, it } from "vitest";
import { dueAlarms } from "./alarms";
import { isQuietTime, reminderTimes } from "./reminders";
import { atZone, isTimeZone, zonedParts, zonedTime } from "./timezone";

describe("zonedTime", () => {
  it("converts wall-clock times in fixed-offset zones", () => {
    expect(zonedTime("2026-10-05", "09:00", "Asia/Kolkata")).toBe(Date.UTC(2026, 9, 5, 3, 30));
    expect(zonedTime("2026-10-05", "09:00", "UTC")).toBe(Date.UTC(2026, 9, 5, 9, 0));
  });

  it("handles daylight saving time", () => {
    // New York: UTC-4 in summer, UTC-5 in winter.
    expect(zonedTime("2026-07-01", "09:00", "America/New_York")).toBe(Date.UTC(2026, 6, 1, 13, 0));
    expect(zonedTime("2026-12-01", "09:00", "America/New_York")).toBe(Date.UTC(2026, 11, 1, 14, 0));
    // The day clocks go back (Nov 1 2026): 09:00 is already standard time.
    expect(zonedTime("2026-11-01", "09:00", "America/New_York")).toBe(Date.UTC(2026, 10, 1, 14, 0));
    // The day clocks go forward (Mar 8 2026): 09:00 is daylight time.
    expect(zonedTime("2026-03-08", "09:00", "America/New_York")).toBe(Date.UTC(2026, 2, 8, 13, 0));
  });

  it("reads wall-clock parts and validates zones", () => {
    expect(zonedParts(Date.UTC(2026, 9, 5, 20, 0), "Asia/Kolkata")).toMatchObject({
      day: 6,
      hour: 1,
      minute: 30,
    });
    expect(isTimeZone("Europe/London")).toBe(true);
    expect(isTimeZone("Mars/Base")).toBe(false);
    expect(isTimeZone(5)).toBe(false);
  });
});

describe("reminders in a time zone", () => {
  const task = {
    id: "t",
    kind: "task" as const,
    title: "Call",
    body: "",
    listId: "inbox",
    createdAt: 1,
    updatedAt: 1,
    deletedAt: null,
    pinned: false,
    status: "open" as const,
    completedAt: null,
    priority: "none" as const,
    due: "2026-10-05",
    dueTime: "10:00",
    subtasks: [],
    sectionId: null,
    reminders: [{ id: "r", before: 30 }],
  };

  it("fires at the right instant for the device's zone", () => {
    const toTime = atZone("Asia/Kolkata");
    const [{ at }] = reminderTimes(task, "09:00", toTime);
    expect(at).toBe(Date.UTC(2026, 9, 5, 4, 0));
    expect(dueAlarms([task], at - 1, {}, "09:00", toTime)).toEqual([]);
    expect(dueAlarms([task], at + 1, {}, "09:00", toTime)).toHaveLength(1);
  });

  it("checks quiet hours on the device's clock", () => {
    const quiet = { start: "22:00", end: "07:00" };
    // 17:00 UTC is 22:30 in India.
    expect(isQuietTime(Date.UTC(2026, 9, 5, 17, 0), quiet, "Asia/Kolkata")).toBe(true);
    expect(isQuietTime(Date.UTC(2026, 9, 5, 17, 0), quiet, "UTC")).toBe(false);
  });
});
