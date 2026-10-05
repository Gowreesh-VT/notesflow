import { beforeEach, describe, expect, it } from "vitest";
import { useUi } from "./ui";

beforeEach(() => {
  useUi.setState({ calendarDate: null, calendarShowDone: false });
});

const stored = () => JSON.parse(window.localStorage.getItem("notesflow:ui") ?? "{}").state;

describe("calendar settings", () => {
  it("moves the calendar to a valid day only", () => {
    useUi.getState().setCalendarDate("2026-10-05");
    useUi.getState().setCalendarDate("2026-02-30");
    useUi.getState().setCalendarDate("soon");
    expect(useUi.getState().calendarDate).toBe("2026-10-05");
    useUi.getState().setCalendarDate(null);
    expect(useUi.getState().calendarDate).toBeNull();
  });

  it("remembers whether completed tasks show, but always reopens on today", () => {
    useUi.getState().setCalendarShowDone(true);
    useUi.getState().setCalendarDate("2026-10-05");
    expect(stored().calendarShowDone).toBe(true);
    expect(stored()).not.toHaveProperty("calendarDate");
  });
});
