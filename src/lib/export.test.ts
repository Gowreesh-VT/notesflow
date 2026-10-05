import { describe, expect, it } from "vitest";
import { csvCell, toCsv, toICalendar, toMarkdown } from "./export";
import { INBOX_ID, type Item, type TaskList } from "./types";

const item = (patch: Partial<Item>): Item => ({
  id: "i1",
  kind: "task",
  title: "Task",
  body: "",
  listId: INBOX_ID,
  createdAt: Date.UTC(2026, 9, 1),
  updatedAt: 0,
  deletedAt: null,
  pinned: false,
  status: "open",
  completedAt: null,
  priority: "none",
  due: null,
  subtasks: [],
  sectionId: null,
  ...patch,
});

const lists: TaskList[] = [
  { id: "work", name: "Work", createdAt: 0, updatedAt: 0, folderId: null, sections: [] },
];

describe("CSV export", () => {
  it("quotes cells that need it and defuses spreadsheet formulas", () => {
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell('say "hi", ok')).toBe('"say ""hi"", ok"');
    expect(csvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvCell("line\nbreak")).toBe('"line\nbreak"');
  });

  it("writes a header and one row per item, leaving out trash and templates", () => {
    const csv = toCsv(
      [
        item({ title: "Ship #release", listId: "work", priority: "high", due: "2026-10-09" }),
        item({ id: "n1", kind: "note", title: "Ideas", body: "Some, text" }),
        item({ id: "t", title: "Gone", deletedAt: 1 }),
        item({ id: "tpl", title: "Template", template: true }),
      ],
      lists,
    );
    const rows = csv.replace(/^﻿/, "").split("\r\n");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatch(/^Type,Title,List,Status/);
    expect(rows[1]).toMatch(/^task,Ship #release,Work,open,high,2026-10-09,/);
    expect(rows[1]).toContain(",release,");
    expect(rows[2]).toMatch(/^note,Ideas,Inbox,,,/);
    expect(rows[2]).toContain('"Some, text"');
  });
});

describe("Markdown export", () => {
  it("groups items by list with checklists and notes", () => {
    const md = toMarkdown(
      [
        item({
          title: "Write report",
          listId: "work",
          due: "2026-10-09",
          priority: "medium",
          subtasks: [{ id: "s", title: "Outline", done: true }],
        }),
        item({ id: "d", title: "Done thing", status: "done" }),
        item({ id: "n", kind: "note", title: "Meeting", body: "Notes here", listId: "work" }),
      ],
      lists,
      "2026-10-05",
    );
    expect(md).toContain("## Inbox\n\n- [x] Done thing");
    expect(md).toContain("## Work\n\n- [ ] Write report (due 2026-10-09) !medium\n  - [x] Outline");
    expect(md).toContain("### Meeting\n\nNotes here");
  });
});

describe("iCal export", () => {
  it("turns open dated tasks into all-day or timed events", () => {
    const ics = toICalendar(
      [
        item({ title: "All day, really", due: "2026-10-09", startDate: "2026-10-07" }),
        item({
          id: "timed",
          title: "Call",
          due: "2026-10-09",
          dueTime: "23:45",
          estimate: 30,
          repeat: { unit: "week", every: 1, weekdays: [5, 1] },
        }),
        item({ id: "nodate", title: "Someday" }),
        item({ id: "done", title: "Old", due: "2026-10-01", status: "done" }),
      ],
      lists,
      Date.UTC(2026, 9, 5, 12),
    );
    const lines = ics.split("\r\n");
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(lines.filter((l) => l === "BEGIN:VEVENT")).toHaveLength(2);
    expect(lines).toContain("DTSTART;VALUE=DATE:20261007");
    expect(lines).toContain("DTEND;VALUE=DATE:20261010");
    expect(lines).toContain("SUMMARY:All day\\, really");
    expect(lines).toContain("DTSTART:20261009T234500");
    expect(lines).toContain("DTEND:20261010T001500");
    expect(lines).toContain("RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,FR");
    expect(lines).toContain("DTSTAMP:20261005T120000Z");
  });

  it("folds long lines", () => {
    const ics = toICalendar([item({ title: "x".repeat(200), due: "2026-10-09" })], [], 0);
    for (const line of ics.split("\r\n")) expect(line.length).toBeLessThanOrEqual(75);
  });
});
