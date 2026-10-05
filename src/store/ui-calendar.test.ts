import { beforeEach, describe, expect, it } from "vitest";
import type { CalendarLayout } from "@/lib/calendar";
import { useUi } from "./ui";

beforeEach(() => {
  useUi.setState({ calendarLayout: "month", calendarDate: null, calendarShowDone: false });
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

  it("remembers the chosen layout and ignores unknown ones", () => {
    useUi.getState().setCalendarLayout("week");
    useUi.getState().setCalendarLayout("year" as CalendarLayout);
    expect(useUi.getState().calendarLayout).toBe("week");
    expect(stored().calendarLayout).toBe("week");
  });

  it("remembers whether completed tasks show, but always reopens on today", () => {
    useUi.getState().setCalendarShowDone(true);
    useUi.getState().setCalendarDate("2026-10-05");
    expect(stored().calendarShowDone).toBe(true);
    expect(stored()).not.toHaveProperty("calendarDate");
  });
});
