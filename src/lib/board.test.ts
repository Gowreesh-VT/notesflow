import { describe, expect, it } from "vitest";
import { boardColumns, NO_SECTION } from "./board";
import type { Item, ListSection } from "./types";

const make = (id: string, patch: Partial<Item> = {}): Item => ({
  id,
  kind: "task",
  title: id,
  body: "",
  listId: "work",
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
  ...patch,
});

const sections: ListSection[] = [
  { id: "doing", name: "Doing" },
  { id: "done", name: "Done", collapsed: true },
];

const ids = (items: Item[]) => items.map((i) => i.id);

describe("board columns", () => {
  it("makes one column per section, in order, keeping empty ones", () => {
    const columns = boardColumns([make("a", { sectionId: "doing" })], sections);
    expect(columns.map((c) => c.id)).toEqual(["doing", "done"]);
    expect(columns[0].section).toBe(sections[0]);
    expect(ids(columns[0].items)).toEqual(["a"]);
    expect(columns[1].items).toEqual([]);
  });

  it("shows a No section column only when it holds something or there are no sections", () => {
    expect(boardColumns([], [])).toEqual([
      { id: NO_SECTION, section: null, items: [], finished: [] },
    ]);
    const columns = boardColumns(
      [make("loose"), make("lost", { sectionId: "deleted" }), make("b", { sectionId: "done" })],
      sections,
    );
    expect(columns.map((c) => c.id)).toEqual([NO_SECTION, "doing", "done"]);
    expect(ids(columns[0].items)).toEqual(["loose", "lost"]);
    const onlyFinished = boardColumns([make("x", { status: "done", completedAt: 5 })], sections);
    expect(onlyFinished.map((c) => c.id)).toEqual([NO_SECTION, "doing", "done"]);
  });

  it("orders cards manually and keeps finished tasks apart, latest first", () => {
    const columns = boardColumns(
      [
        make("second", { order: 2048 }),
        make("first", { order: 1024 }),
        make("note", { kind: "note", order: 1536 }),
        make("new", { createdAt: 9 }),
        make("old-done", { status: "done", completedAt: 1 }),
        make("skipped", { status: "wontdo", completedAt: 3 }),
      ],
      [],
    );
    expect(ids(columns[0].items)).toEqual(["new", "first", "note", "second"]);
    expect(ids(columns[0].finished)).toEqual(["skipped", "old-done"]);
  });
});
