import { describe, expect, it } from "vitest";
import { formatElapsed, parseTimeEntries, runningEntry, trackedMinutes } from "./time-tracking";

describe("time tracking helpers", () => {
  it("sums finished and running entries", () => {
    const entries = [
      { id: "a", start: 0, end: 30 * 60_000 },
      { id: "b", start: 40 * 60_000, end: null },
    ];
    expect(trackedMinutes(entries, 55 * 60_000)).toBe(45);
    expect(runningEntry({ timeEntries: entries })?.id).toBe("b");
    expect(trackedMinutes(undefined, 0)).toBe(0);
  });

  it("formats elapsed time", () => {
    expect(formatElapsed(65_000)).toBe("1:05");
    expect(formatElapsed(3_725_000)).toBe("1:02:05");
  });

  it("sanitises entries and keeps only one running", () => {
    const parsed = parseTimeEntries([
      { id: "a", start: 10, end: 5 },
      { id: "b", start: 10, end: null },
      { id: "c", start: 20 },
      { id: "", start: 1, end: 2 },
      { id: "d", start: 1, end: 2, manual: true },
      "junk",
    ]);
    expect(parsed).toEqual([
      { id: "a", start: 10, end: null },
      { id: "d", start: 1, end: 2, manual: true },
    ]);
  });
});
