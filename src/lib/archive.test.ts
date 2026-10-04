import { describe, expect, it } from "vitest";
import { parseBackup } from "./backup";
import { EMPTY_CRITERIA } from "./filters";
import {
  activeLists,
  archivedListIds,
  archivedLists,
  collectTags,
  countInView,
  filterItems,
} from "./items-logic";
import { sanitizeRecord } from "./sync";
import { INBOX_ID, type Item, type TaskList, type View } from "./types";

const today = "2026-05-10";

const make = (id: string, patch: Partial<Item> = {}): Item => ({
  id,
  kind: "task",
  title: id,
  body: "",
  listId: INBOX_ID,
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

const list = (id: string, archivedAt?: number): TaskList => ({
  id,
  name: id,
  sections: [],
  folderId: null,
  createdAt: 1,
  updatedAt: 2,
  ...(archivedAt ? { archivedAt } : {}),
});

const lists = [list("work"), list("old", 5), list("older", 3)];
const archived = archivedListIds(lists);
const items = [
  make("inbox", { due: today, title: "a #x" }),
  make("work", { listId: "work", due: today }),
  make("old-open", { listId: "old", due: today, title: "b #x #gone" }),
  make("old-done", { listId: "old", status: "done", completedAt: 4 }),
  make("old-trash", { listId: "old", deletedAt: 9 }),
  make("old-note", { listId: "old", kind: "note", body: "#x" }),
];

const ids = (view: View, ctx = { archived }) =>
  filterItems(items, view, "", today, "default", ctx).map((i) => i.id);

describe("archived lists", () => {
  it("splits lists into active and archived (newest archived first)", () => {
    expect(activeLists(lists).map((l) => l.id)).toEqual(["work"]);
    expect(archivedLists(lists).map((l) => l.id)).toEqual(["old", "older"]);
    expect([...archived].sort()).toEqual(["old", "older"]);
  });

  it("keeps their items out of smart and tag views but not out of trash", () => {
    expect(ids({ kind: "smart", id: "today" })).toEqual(["inbox", "work"]);
    expect(ids({ kind: "smart", id: "all" })).toEqual(["inbox", "work"]);
    expect(ids({ kind: "smart", id: "completed" })).toEqual([]);
    expect(ids({ kind: "tag", tag: "x" })).toEqual(["inbox"]);
    expect(ids({ kind: "smart", id: "trash" })).toEqual(["old-trash"]);
    expect(countInView(items, { kind: "smart", id: "today" }, today, { archived })).toBe(2);
  });

  it("still shows them when the archived list itself is open", () => {
    expect(ids({ kind: "list", id: "old" })).toEqual(["old-open", "old-note", "old-done"]);
    expect(countInView(items, { kind: "list", id: "old" }, today, { archived })).toBe(2);
  });

  it("leaves them out of filters unless a filter names the list", () => {
    const filters = [
      { id: "any", name: "Any", criteria: EMPTY_CRITERIA, createdAt: 1, updatedAt: 1 },
      {
        id: "old",
        name: "Old",
        criteria: { ...EMPTY_CRITERIA, lists: ["old"] },
        createdAt: 1,
        updatedAt: 1,
      },
    ];
    const ctx = { archived, filters };
    expect(ids({ kind: "filter", id: "any" }, ctx)).toEqual(["inbox", "work"]);
    expect(ids({ kind: "filter", id: "old" }, ctx)).toEqual(["old-open", "old-note"]);
  });

  it("drops their tags from the tag list", () => {
    expect(collectTags(items, archived)).toEqual([{ tag: "x", count: 1 }]);
    expect(collectTags(items).map((t) => t.tag)).toEqual(["x", "gone"]);
  });

  it("keeps the archived time through backups and sync, and only when it is valid", () => {
    const backup = (raw: object) =>
      parseBackup(JSON.stringify({ app: "notesflow", version: 2, lists: [raw] })).lists[0];
    expect(backup(list("old", 5))).toEqual(list("old", 5));
    expect(backup({ ...list("x"), archivedAt: "yesterday" })).not.toHaveProperty("archivedAt");
    expect(backup({ ...list("x"), archivedAt: null })).not.toHaveProperty("archivedAt");
    expect(
      sanitizeRecord({ collection: "list", id: "old", updatedAt: 2, data: list("old", 5) })?.data,
    ).toEqual(list("old", 5));
  });
});
