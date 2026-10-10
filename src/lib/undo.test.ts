import { describe, expect, it } from "vitest";
import { applyUndo, diffItems, isEmptySnapshot } from "./undo";
import type { Item } from "./types";

const make = (id: string, patch: Partial<Item> = {}): Item =>
  ({
    id,
    kind: "task",
    title: id,
    body: "",
    listId: "inbox",
    status: "open",
    priority: 0,
    due: null,
    subtasks: [],
    pinned: false,
    createdAt: 1,
    updatedAt: 1,
    deletedAt: null,
    ...patch,
  }) as Item;

describe("undo", () => {
  it("finds changed and created items", () => {
    const a = make("a");
    const b = make("b");
    const done = { ...a, status: "done" as const, updatedAt: 5 };
    const snapshot = diffItems([a, b], [done, b, make("c")]);
    expect(snapshot.restore).toEqual([a]);
    expect(snapshot.remove).toEqual(["c"]);
    expect(isEmptySnapshot(diffItems([a, b], [a, b]))).toBe(true);
  });

  it("restores earlier versions as newer edits and drops created items", () => {
    const a = make("a");
    const done = { ...a, status: "done" as const, updatedAt: 5 };
    const result = applyUndo([done, make("c")], { restore: [a], remove: ["c"] }, 3);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "a", status: "open", updatedAt: 6 });
  });

  it("leaves other items alone", () => {
    const other = make("z", { title: "edited" });
    expect(applyUndo([other], { restore: [make("a")], remove: [] }, 9)).toEqual([other]);
  });
});
