import { describe, expect, it } from "vitest";
import { timeOptions } from "./time-options";

describe("timeOptions", () => {
  it("lists every quarter hour of the day", () => {
    const times = timeOptions();
    expect(times).toHaveLength(96);
    expect(times[0]).toBe("00:00");
    expect(times[1]).toBe("00:15");
    expect(times[37]).toBe("09:15");
    expect(times.at(-1)).toBe("23:45");
  });

  it("keeps a time that is off the grid, in order and once", () => {
    const times = timeOptions("17:07");
    expect(times).toHaveLength(97);
    expect(times.indexOf("17:07")).toBe(times.indexOf("17:00") + 1);
    expect(timeOptions("17:15")).toHaveLength(96);
  });

  it("ignores values that are not a time", () => {
    expect(timeOptions("")).toHaveLength(96);
    expect(timeOptions(null)).toHaveLength(96);
    expect(timeOptions("25:00")).toHaveLength(96);
    expect(timeOptions("9:00")).toHaveLength(96);
  });
});
