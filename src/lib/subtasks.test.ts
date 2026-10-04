import { describe, expect, it } from "vitest";
import {
  cloneSubtasks,
  countSubtasks,
  findSubtask,
  limitDepth,
  rollUp,
  setDoneDeep,
  subtreeHeight,
  updateSubtask,
} from "./subtasks";
import type { Subtask } from "./types";

const tree: Subtask[] = [
  {
    id: "a",
    title: "A",
    done: false,
    children: [
      { id: "a1", title: "A1", done: true },
      { id: "a2", title: "A2", done: false, children: [{ id: "a2x", title: "A2x", done: false }] },
    ],
  },
  { id: "b", title: "B", done: true },
];

describe("subtask trees", () => {
  it("finds nodes with their depth and parent", () => {
    expect(findSubtask(tree, "a2x")).toMatchObject({ depth: 3, parentId: "a2" });
    expect(findSubtask(tree, "b")).toMatchObject({ depth: 1, parentId: null });
    expect(findSubtask(tree, "nope")).toBeNull();
    expect(subtreeHeight(tree[0])).toBe(3);
  });

  it("counts every level", () => {
    expect(countSubtasks(tree)).toEqual({ done: 2, total: 5 });
  });

  it("cascades done down and rolls it up to parents", () => {
    const done = rollUp(updateSubtask(tree, "a2", (n) => setDoneDeep(n, true)));
    expect(findSubtask(done, "a2x")?.node.done).toBe(true);
    expect(findSubtask(done, "a")?.node.done).toBe(true);
    const reopened = rollUp(updateSubtask(done, "a2x", (n) => setDoneDeep(n, false)));
    expect(findSubtask(reopened, "a2")?.node.done).toBe(false);
    expect(findSubtask(reopened, "a")?.node.done).toBe(false);
  });

  it("removes nested nodes and returns the same array when nothing matches", () => {
    const removed = updateSubtask(tree, "a2", () => null);
    expect(findSubtask(removed, "a2x")).toBeNull();
    expect(findSubtask(removed, "a")?.node.children).toHaveLength(1);
    expect(updateSubtask(tree, "missing", () => null)).toBe(tree);
  });

  it("clones with fresh ids and limits depth", () => {
    const copy = cloneSubtasks(tree, true);
    expect(copy[0].id).not.toBe("a");
    expect(countSubtasks(copy)).toEqual({ done: 0, total: 5 });
    expect(countSubtasks(limitDepth(tree, 2)).total).toBe(4);
    expect(limitDepth(tree, 1)[0].children).toBeUndefined();
  });
});
