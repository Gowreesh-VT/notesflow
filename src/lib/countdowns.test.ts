import { describe, expect, it } from "vitest";
import { countdownLabel, visibleCountdowns } from "./countdowns";

const c = (id: string, date: string) => ({ id, name: id, date, createdAt: 1, updatedAt: 1 });

describe("countdowns", () => {
  const today = "2026-10-05";
  it("shows upcoming dates soonest first, then recently passed ones", () => {
    const list = [
      c("far", "2026-12-25"),
      c("old", "2026-09-01"),
      c("soon", "2026-10-08"),
      c("past", "2026-10-02"),
    ];
    expect(visibleCountdowns(list, today).map((x) => x.id)).toEqual(["soon", "far", "past"]);
  });

  it("labels the distance", () => {
    expect(countdownLabel(today, today)).toBe("Today");
    expect(countdownLabel("2026-10-06", today)).toBe("Tomorrow");
    expect(countdownLabel("2026-10-17", today)).toBe("12 days");
    expect(countdownLabel("2026-10-04", today)).toBe("Yesterday");
    expect(countdownLabel("2026-10-01", today)).toBe("4 days ago");
  });
});
