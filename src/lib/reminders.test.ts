import { describe, expect, it } from "vitest";
import { atLocal, dueMoment, parseReminders, reminderLabel, reminderTimes } from "./reminders";

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
