import { describe, expect, it } from "vitest";
import { dailyNoteTitle, findDailyNote } from "./daily-notes";
import type { Item } from "./types";

const note = (fields: Partial<Item>): Item => ({
  id: "n",
  kind: "note",
  title: "",
  body: "",
  listId: "inbox",
  createdAt: 1,
  updatedAt: 1,
  deletedAt: null,
  pinned: false,
  status: "open",
  completedAt: null,
  priority: "none",
  due: null,
  subtasks: [],
  sectionId: null,
  ...fields,
});

describe("findDailyNote", () => {
  it("finds the note for the date by its marker, not its title", () => {
    const items = [
      note({ id: "other", title: "2026-10-04", dailyNote: "2026-10-03" }),
      note({ id: "renamed", title: "Anything", dailyNote: "2026-10-04" }),
    ];
    expect(findDailyNote(items, "2026-10-04")?.id).toBe("renamed");
    expect(findDailyNote(items, "2026-10-05")).toBeUndefined();
  });

  it("prefers live notes, then the oldest, and ignores tasks and templates", () => {
    const items = [
      note({ id: "trashed", dailyNote: "2026-10-04", deletedAt: 5, createdAt: 0 }),
      note({ id: "newer", dailyNote: "2026-10-04", createdAt: 3 }),
      note({ id: "older", dailyNote: "2026-10-04", createdAt: 2 }),
      note({ id: "task", kind: "task", dailyNote: "2026-10-04", createdAt: 1 }),
      note({ id: "template", dailyNote: "2026-10-04", template: true, createdAt: 1 }),
    ];
    expect(findDailyNote(items, "2026-10-04")?.id).toBe("older");
    expect(findDailyNote(items.slice(0, 1), "2026-10-04")?.id).toBe("trashed");
  });
});

describe("dailyNoteTitle", () => {
  it("names the local day", () => {
    const title = dailyNoteTitle("2026-10-04");
    expect(title).toContain("2026");
    expect(title).toBe(
      new Date(2026, 9, 4).toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
    );
  });
});
