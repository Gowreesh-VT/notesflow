import { describe, expect, it } from "vitest";
import { cleanCheckins, cleanHabitName, lastDays, parseGoal, toggleCheckin } from "./habits";

describe("habits", () => {
  it("cleans names, goals and check-ins", () => {
    expect(cleanHabitName("  Read   daily ")).toBe("Read daily");
    expect(cleanHabitName("   ")).toBeNull();
    expect(parseGoal({ per: "week", times: 9 })).toEqual({ per: "week", times: 7 });
    expect(parseGoal({ per: "day", times: 3 })).toEqual({ per: "day", times: 1 });
    expect(parseGoal("junk")).toEqual({ per: "day", times: 1 });
    expect(cleanCheckins(["2026-10-05", "bad", "2026-10-01", "2026-10-05"])).toEqual([
      "2026-10-01",
      "2026-10-05",
    ]);
  });

  it("toggles check-ins and lists recent days", () => {
    expect(toggleCheckin(["2026-10-01"], "2026-10-03")).toEqual(["2026-10-01", "2026-10-03"]);
    expect(toggleCheckin(["2026-10-01", "2026-10-03"], "2026-10-01")).toEqual(["2026-10-03"]);
    expect(lastDays("2026-10-02", 3)).toEqual(["2026-09-30", "2026-10-01", "2026-10-02"]);
  });
});
