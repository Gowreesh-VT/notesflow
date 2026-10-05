import { describe, expect, it } from "vitest";
import {
  cleanFocusSettings,
  DEFAULT_FOCUS_SETTINGS,
  nextPhase,
  phaseMinutes,
  remainingMs,
} from "./focus";

describe("focus timer rules", () => {
  it("alternates work and breaks with a long break every N sessions", () => {
    const s = DEFAULT_FOCUS_SETTINGS;
    expect(nextPhase("work", 1, s)).toBe("short");
    expect(nextPhase("work", 4, s)).toBe("long");
    expect(nextPhase("short", 1, s)).toBe("work");
    expect(nextPhase("long", 4, s)).toBe("work");
  });

  it("cleans settings to safe ranges", () => {
    expect(
      cleanFocusSettings({ work: 2, short: 500, long: Number.NaN, longEvery: 3.4 }),
    ).toMatchObject({
      work: 5,
      short: 60,
      long: 15,
      longEvery: 3,
    });
    expect(cleanFocusSettings(undefined)).toEqual(DEFAULT_FOCUS_SETTINGS);
    expect(phaseMinutes("long", DEFAULT_FOCUS_SETTINGS)).toBe(15);
  });

  it("counts down while running and freezes while paused", () => {
    expect(remainingMs({ endsAt: 10_000, pausedRemaining: null }, 4_000)).toBe(6_000);
    expect(remainingMs({ endsAt: 10_000, pausedRemaining: null }, 12_000)).toBe(0);
    expect(remainingMs({ endsAt: null, pausedRemaining: 7_000 }, 99_000)).toBe(7_000);
  });
});
