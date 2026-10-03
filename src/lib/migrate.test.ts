import { describe, expect, it } from "vitest";
import { LEGACY_ARCHIVE_LIST_ID, migrateLegacyData } from "./migrate";
import { INBOX_ID } from "./types";

const note = (id: string, patch = {}) => ({
  id,
  title: `T${id}`,
  body: `B${id}`,
  createdAt: 1,
  updatedAt: 2,
  pinned: false,
  archived: false,
  deletedAt: null,
  ...patch,
});

const task = (id: string, patch = {}) => ({
  id,
  title: `Task ${id}`,
  details: "d",
  done: false,
  priority: "high" as const,
  due: "2026-01-01",
  createdAt: 5,
  completedAt: null,
  subtasks: [{ id: "s", title: "sub", done: true }],
  ...patch,
});

describe("migrateLegacyData", () => {
  it("keeps every note and task, mapped into the Inbox", () => {
    const { items, lists } = migrateLegacyData(
      [note("n1", { pinned: true }), note("n2", { deletedAt: 9 })],
      [task("t1"), task("t2", { done: true, completedAt: 8 })],
    );
    expect(items).toHaveLength(4);
    expect(lists).toEqual([]);
    expect(items.find((i) => i.id === "n1")).toMatchObject({
      kind: "note",
      pinned: true,
      listId: INBOX_ID,
      body: "Bn1",
    });
    expect(items.find((i) => i.id === "n2")?.deletedAt).toBe(9);
    expect(items.find((i) => i.id === "t1")).toMatchObject({
      kind: "task",
      body: "d",
      status: "open",
      priority: "high",
      due: "2026-01-01",
      subtasks: [{ id: "s", title: "sub", done: true }],
    });
    expect(items.find((i) => i.id === "t2")).toMatchObject({ status: "done", completedAt: 8 });
  });

  it("moves archived notes into an Archived list instead of losing the distinction", () => {
    const { items, lists } = migrateLegacyData([note("n1", { archived: true })], [], 100);
    expect(lists).toEqual([
      {
        id: LEGACY_ARCHIVE_LIST_ID,
        name: "Archived",
        sections: [],
        folderId: null,
        createdAt: 100,
        updatedAt: 100,
      },
    ]);
    expect(items[0].listId).toBe(LEGACY_ARCHIVE_LIST_ID);
  });
});
