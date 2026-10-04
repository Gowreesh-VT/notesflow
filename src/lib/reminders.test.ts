import { describe, expect, it } from "vitest";
import {
  atLocal,
  dueMoment,
  isClock,
  isQuietTime,
  parseReminders,
  reminderLabel,
  reminderTimes,
} from "./reminders";

describe("reminders", () => {
  it("labels lead times", () => {
    expect(reminderLabel(0)).toBe("At due time");
    expect(reminderLabel(15)).toBe("15 minutes before");
    expect(reminderLabel(60)).toBe("1 hour before");
    expect(reminderLabel(120)).toBe("2 hours before");
    expect(reminderLabel(1440)).toBe("1 day before");
  });

  it("computes due moments and firing times", () => {
    expect(dueMoment({ due: "2026-05-10", dueTime: "14:30" })).toBe(atLocal("2026-05-10", "14:30"));
    expect(dueMoment({ due: "2026-05-10" })).toBe(atLocal("2026-05-10", "09:00"));
    expect(dueMoment({ due: null })).toBeNull();
    const times = reminderTimes({
      due: "2026-05-10",
      dueTime: "14:30",
      reminders: [
        { id: "a", before: 0 },
        { id: "b", before: 1440 },
      ],
    });
    expect(times.map((t) => t.reminder.id)).toEqual(["b", "a"]);
    expect(times[1].at - times[0].at).toBe(1440 * 60_000);
    expect(reminderTimes({ due: null, reminders: [{ id: "a", before: 0 }] })).toEqual([]);
  });

  it("sanitises stored reminders", () => {
    const parsed = parseReminders([
      { id: "a", before: 15 },
      { id: "b", before: 15 },
      { id: "c", before: -1 },
      { id: "d", before: 99999 },
      { id: "e", before: 1.5 },
      { id: "f", before: 0 },
      { before: 5 },
    ]);
    expect(parsed).toEqual([
      { id: "a", before: 15 },
      { id: "f", before: 0 },
    ]);
  });
});

describe("quiet hours", () => {
  const at = (h: number, m = 0) => new Date(2026, 4, 10, h, m).getTime();
  it("handles daytime and overnight windows", () => {
    const overnight = { start: "22:00", end: "07:00" };
    expect(isQuietTime(at(23), overnight)).toBe(true);
    expect(isQuietTime(at(6, 59), overnight)).toBe(true);
    expect(isQuietTime(at(7), overnight)).toBe(false);
    expect(isQuietTime(at(12), overnight)).toBe(false);
    const lunch = { start: "12:00", end: "13:00" };
    expect(isQuietTime(at(12, 30), lunch)).toBe(true);
    expect(isQuietTime(at(13), lunch)).toBe(false);
    expect(isQuietTime(at(12), null)).toBe(false);
    expect(isQuietTime(at(12), { start: "09:00", end: "09:00" })).toBe(false);
  });

  it("validates clock strings and uses the default time for all-day reminders", () => {
    expect(isClock("07:30")).toBe(true);
    expect(isClock("7:30")).toBe(false);
    expect(dueMoment({ due: "2026-05-10" }, "07:30")).toBe(atLocal("2026-05-10", "07:30"));
  });
});
