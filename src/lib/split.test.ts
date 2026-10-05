import { describe, expect, it } from "vitest";
import { canPin, dropOnListPatch, pinnedList, pinnedTasks, viewListId } from "./split";
import { INBOX_ID, type Item, type TaskList } from "./types";

const list = (id: string, patch: Partial<TaskList> = {}): TaskList => ({
  id,
  name: id.toUpperCase(),
  sections: [],
  folderId: null,
  createdAt: 1,
  updatedAt: 1,
  ...patch,
});

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

const lists = [list("work"), list("home"), list("old", { archivedAt: 5 })];

describe("split view", () => {
  it("knows which list a view shows", () => {
    expect(viewListId({ kind: "list", id: "work" })).toBe("work");
    expect(viewListId({ kind: "smart", id: "inbox" })).toBe(INBOX_ID);
    expect(viewListId({ kind: "smart", id: "today" })).toBeNull();
    expect(viewListId({ kind: "calendar" })).toBeNull();
  });

  it("pins the Inbox and active lists only", () => {
    expect(canPin(lists, INBOX_ID)).toBe(true);
    expect(canPin(lists, "home")).toBe(true);
    expect(canPin(lists, "old")).toBe(false);
    expect(canPin(lists, "deleted")).toBe(false);
  });

  it("shows the pinned list unless it is gone, archived or already the main view", () => {
    const today = { kind: "smart", id: "today" } as const;
    expect(pinnedList(lists, "home", { kind: "list", id: "work" })).toEqual({
      id: "home",
      name: "HOME",
    });
    expect(pinnedList(lists, INBOX_ID, today)).toEqual({ id: INBOX_ID, name: "Inbox" });
    expect(pinnedList(lists, "home", { kind: "list", id: "home" })).toBeNull();
    expect(pinnedList(lists, INBOX_ID, { kind: "smart", id: "inbox" })).toBeNull();
    expect(pinnedList(lists, "old", today)).toBeNull();
    expect(pinnedList(lists, "deleted", today)).toBeNull();
    expect(pinnedList(lists, null, today)).toBeNull();
  });

  it("lists the pinned list's open tasks only", () => {
    const items = [
      make("open", { due: "2026-05-01" }),
      make("later", { due: "2026-06-01" }),
      make("done", { status: "done", completedAt: 2 }),
      make("note", { kind: "note" }),
      make("trashed", { deletedAt: 3 }),
      make("template", { template: true }),
      make("elsewhere", { listId: "home" }),
    ];
    expect(pinnedTasks(items, "work", "2026-05-10").map((i) => i.id)).toEqual(["open", "later"]);
  });

  it("moves a dropped task to the pane's list", () => {
    expect(dropOnListPatch(make("a"), "home")).toEqual({ listId: "home" });
    expect(dropOnListPatch(make("a"), "work")).toBeNull();
    expect(dropOnListPatch(make("a", { deletedAt: 1 }), "home")).toBeNull();
    expect(dropOnListPatch(make("a", { template: true }), "home")).toBeNull();
    expect(dropOnListPatch(undefined, "home")).toBeNull();
  });
});
