import { beforeEach, describe, expect, it } from "vitest";
import { INBOX_ID } from "@/lib/types";
import { upgradeLegacyStorage, useWorkspace, WORKSPACE_KEY } from "./workspace";

const state = () => useWorkspace.getState();

beforeEach(() => {
  useWorkspace.setState({ items: [], lists: [], folders: [], tombstones: [] });
});

describe("items", () => {
  it("adds tasks and notes to a list, falling back to the Inbox for unknown lists", () => {
    const listId = state().addList("Work");
    const a = state().addItem({
      kind: "task",
      title: "  Write  ",
      listId: listId!,
      priority: "high",
      due: "2026-01-01",
    });
    const b = state().addItem({
      kind: "note",
      title: "Idea",
      listId: "missing",
      priority: "high",
      due: "2026-01-01",
    });
    const task = state().items.find((i) => i.id === a);
    const note = state().items.find((i) => i.id === b);
    expect(task).toMatchObject({ title: "Write", listId, priority: "high", due: "2026-01-01" });
    expect(note).toMatchObject({ listId: INBOX_ID, priority: "none", due: null });
  });

  it("completes, skips, reopens and toggles tasks", () => {
    const id = state().addItem({ kind: "task", title: "T" });
    state().toggleDone(id);
    expect(state().items[0]).toMatchObject({ status: "done" });
    expect(state().items[0].completedAt).not.toBeNull();
    state().setStatus(id, "wontdo");
    expect(state().items[0].status).toBe("wontdo");
    state().toggleDone(id);
    expect(state().items[0]).toMatchObject({ status: "open", completedAt: null });
  });

  it("moves items through trash", () => {
    const id = state().addItem({ kind: "note", title: "N" });
    state().togglePin(id);
    state().trashItem(id);
    expect(state().items[0]).toMatchObject({ pinned: false });
    expect(state().items[0].deletedAt).not.toBeNull();
    state().restoreItem(id);
    expect(state().items[0].deletedAt).toBeNull();
    state().trashItem(id);
    state().emptyTrash();
    expect(state().items).toHaveLength(0);
    expect(state().tombstones).toEqual([{ collection: "item", id, at: expect.any(Number) }]);
    const other = state().addItem({ kind: "task", title: "x" });
    state().deleteForever(other);
    expect(state().items).toHaveLength(0);
    expect(state().tombstones.map((t) => t.id)).toEqual([id, other]);
  });

  it("duplicates items with fresh, unchecked subtasks", () => {
    const id = state().addItem({ kind: "task", title: "Plan", body: "b" });
    state().addSubtask(id, "step");
    state().toggleSubtask(id, state().items[0].subtasks[0].id);
    const copyId = state().duplicateItem(id)!;
    const copy = state().items.find((i) => i.id === copyId)!;
    expect(copy).toMatchObject({ title: "Plan (copy)", body: "b" });
    expect(copy.subtasks).toHaveLength(1);
    expect(copy.subtasks[0].done).toBe(false);
    expect(copy.subtasks[0].id).not.toBe(state().items.find((i) => i.id === id)!.subtasks[0].id);
    expect(state().duplicateItem("missing")).toBeNull();
  });

  it("manages subtasks and ignores blank ones", () => {
    const id = state().addItem({ kind: "task", title: "Parent" });
    state().addSubtask(id, "  ");
    state().addSubtask(id, "child");
    const sub = state().items[0].subtasks;
    expect(sub).toHaveLength(1);
    state().toggleSubtask(id, sub[0].id);
    expect(state().items[0].subtasks[0].done).toBe(true);
    state().deleteSubtask(id, sub[0].id);
    expect(state().items[0].subtasks).toHaveLength(0);
  });
});

describe("lists and folders", () => {
  it("creates, renames and ignores blank names", () => {
    expect(state().addList("   ")).toBeNull();
    const id = state().addList(" Home ")!;
    expect(state().lists[0].name).toBe("Home");
    state().renameList(id, "House");
    state().renameList(id, " ");
    expect(state().lists[0].name).toBe("House");
  });

  it("moves lists into folders; deleting a folder keeps its lists", () => {
    const folder = state().addFolder("Life")!;
    const list = state().addList("Home", folder)!;
    expect(state().lists[0].folderId).toBe(folder);
    state().deleteFolder(folder);
    expect(state().lists.find((l) => l.id === list)?.folderId).toBeNull();
    expect(state().tombstones).toEqual([
      { collection: "folder", id: folder, at: expect.any(Number) },
    ]);
    state().moveList(list, null);
    expect(state().folders).toHaveLength(0);
  });

  it("deleting a list moves its items to the Inbox", () => {
    const list = state().addList("Work")!;
    const id = state().addItem({ kind: "task", title: "T", listId: list });
    state().deleteList(list);
    expect(state().lists).toHaveLength(0);
    expect(state().items.find((i) => i.id === id)?.listId).toBe(INBOX_ID);
    expect(state().tombstones.map((t) => t.collection)).toEqual(["list"]);
  });

  it("bumps updatedAt on lists and on items moved out of a deleted list", () => {
    const list = state().addList("Work")!;
    const id = state().addItem({ kind: "task", title: "T", listId: list });
    state().updateItem(id, {});
    const before = state().items[0].updatedAt;
    useWorkspace.setState({
      lists: state().lists.map((l) => ({ ...l, updatedAt: 1 })),
      items: state().items.map((i) => ({ ...i, updatedAt: 1 })),
    });
    state().renameList(list, "Work 2");
    expect(state().lists[0].updatedAt).toBeGreaterThan(1);
    state().deleteList(list);
    expect(state().items[0].updatedAt).toBeGreaterThan(1);
    expect(before).toBeGreaterThan(0);
  });
});

describe("mergeData", () => {
  it("adds only unseen items and lists, remapping items of unknown lists to the Inbox", () => {
    const id = state().addItem({ kind: "note", title: "mine" });
    const mine = state().items[0];
    const added = state().mergeData({
      items: [mine, { ...mine, id: "new" }, { ...mine, id: "orphan", listId: "nope" }],
      lists: [{ id: "l", name: "L", folderId: null, createdAt: 1, updatedAt: 1 }],
      folders: [],
    });
    expect(added).toEqual({ items: 2, lists: 1 });
    expect(state().items.find((i) => i.id === "orphan")?.listId).toBe(INBOX_ID);
    expect(id).toBeTruthy();
  });
});

describe("upgradeLegacyStorage", () => {
  const fakeStorage = (initial: Record<string, string>) => {
    const data = { ...initial };
    return {
      data,
      getItem: (k: string) => data[k] ?? null,
      setItem: (k: string, v: string) => {
        data[k] = v;
      },
    };
  };
  const legacyNote = {
    id: "n",
    title: "N",
    body: "B",
    createdAt: 1,
    updatedAt: 1,
    pinned: false,
    archived: false,
    deletedAt: null,
  };
  const legacyTask = {
    id: "t",
    title: "T",
    details: "",
    done: false,
    priority: "none",
    due: null,
    createdAt: 1,
    completedAt: null,
    subtasks: [],
  };

  it("builds the workspace from the old stores once and leaves the old keys intact", () => {
    const storage = fakeStorage({
      "notesflow:notes": JSON.stringify({ state: { notes: [legacyNote] }, version: 1 }),
      "notesflow:tasks": JSON.stringify({ state: { tasks: [legacyTask] }, version: 1 }),
    });
    expect(upgradeLegacyStorage(storage)).toBe(true);
    const saved = JSON.parse(storage.data[WORKSPACE_KEY]);
    expect(saved.state.items.map((i: { id: string }) => i.id).sort()).toEqual(["n", "t"]);
    expect(storage.data["notesflow:notes"]).toBeDefined();
    expect(upgradeLegacyStorage(storage)).toBe(false);
  });

  it("does nothing for a fresh install or when a workspace already exists", () => {
    const fresh = fakeStorage({});
    expect(upgradeLegacyStorage(fresh)).toBe(false);
    expect(fresh.data[WORKSPACE_KEY]).toBeUndefined();

    const existing = fakeStorage({
      [WORKSPACE_KEY]: "{}",
      "notesflow:notes": JSON.stringify({ state: { notes: [legacyNote] } }),
    });
    expect(upgradeLegacyStorage(existing)).toBe(false);
  });

  it("survives corrupt legacy data", () => {
    expect(upgradeLegacyStorage(fakeStorage({ "notesflow:notes": "{bad json" }))).toBe(false);
  });
});
