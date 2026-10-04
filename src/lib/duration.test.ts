import { describe, expect, it } from "vitest";
import { asMinutes, formatDuration, parseDuration } from "./duration";

describe("durations", () => {
  it("parses common shorthand", () => {
    expect(parseDuration("25m")).toBe(25);
    expect(parseDuration("25")).toBe(25);
    expect(parseDuration("1h")).toBe(60);
    expect(parseDuration("1h30")).toBe(90);
    expect(parseDuration("1h 30m")).toBe(90);
    expect(parseDuration("1.5h")).toBe(90);
    expect(parseDuration(" 90 min ")).toBe(90);
  });

  it("rejects junk, zero and very long durations", () => {
    for (const bad of ["", "abc", "0", "0m", "-5", "1d", "200h"])
      expect(parseDuration(bad)).toBeNull();
  });

  it("formats minutes", () => {
    expect(formatDuration(45)).toBe("45m");
    expect(formatDuration(60)).toBe("1h");
    expect(formatDuration(95)).toBe("1h 35m");
  });

  it("validates stored minutes", () => {
    expect(asMinutes(30)).toBe(30);
    expect(asMinutes(0)).toBeNull();
    expect(asMinutes(1.5)).toBeNull();
    expect(asMinutes("30")).toBeNull();
  });
});
