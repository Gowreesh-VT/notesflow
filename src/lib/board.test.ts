import { describe, expect, it } from "vitest";
import {
  boardColumns,
  columnOf,
  moveSectionTo,
  NO_SECTION,
  planCardDrop,
  planCardStep,
} from "./board";
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

describe("moving cards", () => {
  const board = () =>
    boardColumns(
      [
        make("a", { order: 1024 }),
        make("b", { order: 2048 }),
        make("c", { sectionId: "doing", order: 1024 }),
        make("d", { sectionId: "doing", order: 2048 }),
      ],
      sections,
    );

  it("drops a card into another column at the drop position", () => {
    const columns = board();
    const a = columns[0].items[0];
    expect(planCardDrop(columns, a, "doing", 1)).toEqual({
      orders: { a: 1536 },
      sectionId: "doing",
    });
    expect(planCardDrop(columns, a, "done", 0)).toEqual({
      orders: { a: 1024 },
      sectionId: "done",
    });
    const c = columns[1].items[0];
    expect(planCardDrop(columns, c, NO_SECTION, 2)).toEqual({
      orders: { c: 3072 },
      sectionId: null,
    });
    expect(planCardDrop(columns, a, "missing", 0)).toBeNull();
  });

  it("reorders within a column and ignores drops that change nothing", () => {
    const columns = board();
    const a = columns[0].items[0];
    expect(planCardDrop(columns, a, NO_SECTION, 2)).toEqual({
      orders: { a: 3072 },
      sectionId: null,
    });
    expect(planCardDrop(columns, a, NO_SECTION, 0)).toBeNull();
    expect(planCardDrop(columns, a, NO_SECTION, 1)).toBeNull();
  });

  it("takes cards from another list onto the board", () => {
    const columns = board();
    expect(columnOf(columns, "elsewhere")).toBeUndefined();
    expect(columnOf(columns, "c")?.id).toBe("doing");
    expect(planCardDrop(columns, make("elsewhere", { order: 1024 }), "doing", 0)).toEqual({
      orders: { elsewhere: 0 },
      sectionId: "doing",
    });
  });

  it("steps a card with the keyboard within and across columns", () => {
    const columns = board();
    expect(planCardStep(columns, "a", "down")).toEqual({
      orders: { a: 3072 },
      sectionId: null,
      columnId: NO_SECTION,
      index: 1,
    });
    expect(planCardStep(columns, "a", "up")).toBeNull();
    expect(planCardStep(columns, "a", "left")).toBeNull();
    expect(planCardStep(columns, "b", "right")).toEqual({
      orders: { b: 1536 },
      sectionId: "doing",
      columnId: "doing",
      index: 1,
    });
    expect(planCardStep(columns, "d", "right")).toEqual({
      orders: { d: 1024 },
      sectionId: "done",
      columnId: "done",
      index: 0,
    });
    expect(planCardStep(columns, "c", "left")).toMatchObject({ sectionId: null, index: 0 });
    expect(planCardStep(columns, "missing", "down")).toBeNull();
  });
});

describe("moving sections", () => {
  const three: ListSection[] = [
    { id: "x", name: "X" },
    { id: "y", name: "Y" },
    { id: "z", name: "Z" },
  ];
  const order = (sections: ListSection[]) => sections.map((s) => s.id);

  it("moves a section before the one at the drop index", () => {
    expect(order(moveSectionTo(three, "x", 3))).toEqual(["y", "z", "x"]);
    expect(order(moveSectionTo(three, "x", 2))).toEqual(["y", "x", "z"]);
    expect(order(moveSectionTo(three, "z", 0))).toEqual(["z", "x", "y"]);
    expect(order(moveSectionTo(three, "y", 99))).toEqual(["x", "z", "y"]);
  });

  it("returns the same array when nothing moves", () => {
    expect(moveSectionTo(three, "y", 1)).toBe(three);
    expect(moveSectionTo(three, "y", 2)).toBe(three);
    expect(moveSectionTo(three, "missing", 0)).toBe(three);
  });
});
