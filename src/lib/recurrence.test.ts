import { describe, expect, it } from "vitest";
import {
  describeRepeat,
  formatUntil,
  nextDueDate,
  nextOccurrence,
  parseRepeat,
} from "./recurrence";

describe("nextOccurrence", () => {
  it("steps by days, weeks, months and years", () => {
    expect(nextOccurrence("2026-05-10", { unit: "day", every: 1 })).toBe("2026-05-11");
    expect(nextOccurrence("2026-05-10", { unit: "day", every: 3 })).toBe("2026-05-13");
    expect(nextOccurrence("2026-05-10", { unit: "week", every: 2 })).toBe("2026-05-24");
    expect(nextOccurrence("2026-01-31", { unit: "month", every: 1 })).toBe("2026-02-28");
    expect(nextOccurrence("2028-02-29", { unit: "year", every: 1 })).toBe("2029-02-28");
    expect(nextOccurrence("2026-11-15", { unit: "month", every: 3 })).toBe("2027-02-15");
  });

  it("follows chosen weekdays", () => {
    // 2026-05-11 is a Monday.
    const mwf = { unit: "week" as const, every: 1, weekdays: [1, 3, 5] };
    expect(nextOccurrence("2026-05-11", mwf)).toBe("2026-05-13");
    expect(nextOccurrence("2026-05-15", mwf)).toBe("2026-05-18");
    const everyOtherMonday = { unit: "week" as const, every: 2, weekdays: [1] };
    expect(nextOccurrence("2026-05-11", everyOtherMonday)).toBe("2026-05-25");
    const weekdays = { unit: "week" as const, every: 1, weekdays: [1, 2, 3, 4, 5] };
    expect(nextOccurrence("2026-05-15", weekdays)).toBe("2026-05-18");
  });
});

describe("nextDueDate", () => {
  const daily = { unit: "day" as const, every: 1 };
  it("continues the schedule, skipping missed occurrences", () => {
    expect(nextDueDate("2026-05-10", daily, "2026-05-10")).toBe("2026-05-11");
    expect(nextDueDate("2026-05-01", daily, "2026-05-10")).toBe("2026-05-11");
    expect(nextDueDate("2026-05-12", daily, "2026-05-10")).toBe("2026-05-13");
  });

  it("counts from completion when asked, or when there is no due date", () => {
    const weekly = { unit: "week" as const, every: 1, afterCompletion: true };
    expect(nextDueDate("2026-05-01", weekly, "2026-05-10")).toBe("2026-05-17");
    expect(nextDueDate(null, daily, "2026-05-10")).toBe("2026-05-11");
  });
});

describe("end dates", () => {
  const daily = { unit: "day" as const, every: 1, until: "2026-05-12" };
  it("stops the series after the end date", () => {
    expect(nextDueDate("2026-05-10", daily, "2026-05-10")).toBe("2026-05-11");
    expect(nextDueDate("2026-05-11", daily, "2026-05-11")).toBe("2026-05-12");
    expect(nextDueDate("2026-05-12", daily, "2026-05-12")).toBeNull();
    // Missed occurrences are skipped, so a late finish can end the series early.
    expect(nextDueDate("2026-05-10", daily, "2026-05-14")).toBeNull();
    const weekly = { unit: "week" as const, every: 1, weekdays: [1, 3], until: "2026-05-13" };
    expect(nextDueDate("2026-05-11", weekly, "2026-05-11")).toBe("2026-05-13");
    expect(nextDueDate("2026-05-13", weekly, "2026-05-13")).toBeNull();
    const after = { unit: "day" as const, every: 3, afterCompletion: true, until: "2026-05-12" };
    expect(nextDueDate(null, after, "2026-05-10")).toBeNull();
  });

  it("are described, kept and validated", () => {
    expect(describeRepeat(daily)).toBe(`Daily, until ${formatUntil("2026-05-12")}`);
    expect(formatUntil("2026-05-12")).toContain("2026");
    expect(parseRepeat(daily)).toEqual(daily);
    expect(parseRepeat({ unit: "day", every: 1, until: "2026-02-30" })).toEqual({
      unit: "day",
      every: 1,
    });
    expect(parseRepeat({ unit: "day", every: 1, until: 20260512 })).toEqual({
      unit: "day",
      every: 1,
    });
  });
});

describe("describeRepeat and parseRepeat", () => {
  it("describes rules", () => {
    expect(describeRepeat({ unit: "day", every: 1 })).toBe("Daily");
    expect(describeRepeat({ unit: "week", every: 2, weekdays: [3, 1] })).toBe(
      "Every 2 weeks on Mon, Wed",
    );
    expect(describeRepeat({ unit: "week", every: 1, weekdays: [1, 2, 3, 4, 5] })).toBe(
      "Every weekday",
    );
    expect(describeRepeat({ unit: "month", every: 1, afterCompletion: true })).toBe(
      "Monthly, after completion",
    );
  });

  it("sanitises stored rules", () => {
    expect(
      parseRepeat({ unit: "week", every: 2, weekdays: [1, 1, 9], afterCompletion: true }),
    ).toEqual({
      unit: "week",
      every: 2,
      weekdays: [1],
      afterCompletion: true,
    });
    expect(parseRepeat({ unit: "fortnight" })).toBeNull();
    expect(parseRepeat({ unit: "day", every: 0 })).toBeNull();
    expect(parseRepeat({ unit: "day" })).toEqual({ unit: "day", every: 1 });
  });
});
