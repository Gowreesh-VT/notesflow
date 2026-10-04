import { beforeEach, describe, expect, it } from "vitest";
import { INBOX_ID } from "@/lib/types";
import { addDays, toDateKey } from "@/lib/utils";
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

describe("nested subtasks", () => {
  it("nests up to five levels and rolls progress up to the parent", () => {
    const id = state().addItem({ kind: "task", title: "T" });
    let parent = state().addSubtask(id, "L1");
    const ids = [parent];
    for (let level = 2; level <= 5; level++) {
      parent = state().addSubtask(id, `L${level}`, parent);
      ids.push(parent);
    }
    expect(ids.every(Boolean)).toBe(true);
    expect(state().addSubtask(id, "L6", parent)).toBeNull();

    const sibling = state().addSubtask(id, "Sibling", ids[3]);
    state().toggleSubtask(id, ids[4]!);
    expect(state().items[0].subtasks[0].done).toBe(false);
    state().toggleSubtask(id, sibling!);
    // Both children of L4 are done, so L4 and every ancestor roll up to done.
    expect(state().items[0].subtasks[0].done).toBe(true);

    state().toggleSubtask(id, ids[0]!);
    expect(JSON.stringify(state().items[0].subtasks)).not.toContain('"done":true');

    state().renameSubtask(id, ids[2]!, "  Renamed ");
    expect(JSON.stringify(state().items[0].subtasks)).toContain('"title":"Renamed"');
    state().deleteSubtask(id, ids[1]!);
    expect(state().items[0].subtasks[0].children).toBeUndefined();
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

describe("sections", () => {
  const setup = () => {
    const listId = state().addList("Work")!;
    const a = state().addSection(listId, "  Doing ")!;
    const b = state().addSection(listId, "Done");
    const item = state().addItem({ kind: "task", title: "T", listId });
    return { listId, a, b: b!, item };
  };
  const list = (id: string) => state().lists.find((l) => l.id === id)!;

  it("adds, renames and reorders sections, bumping the list's updatedAt", () => {
    const { listId, a, b } = setup();
    expect(list(listId).sections).toEqual([
      { id: a, name: "Doing" },
      { id: b, name: "Done" },
    ]);
    expect(state().addSection(listId, "  ")).toBeNull();
    expect(state().addSection("missing", "X")).toBeNull();

    useWorkspace.setState({ lists: [{ ...list(listId), updatedAt: 0 }] });
    state().renameSection(listId, b, "Finished");
    expect(list(listId).sections[1].name).toBe("Finished");
    expect(list(listId).updatedAt).toBeGreaterThan(0);

    state().moveSection(listId, b, -1);
    expect(list(listId).sections.map((s) => s.id)).toEqual([b, a]);
    state().moveSection(listId, b, -1);
    expect(list(listId).sections.map((s) => s.id)).toEqual([b, a]);
  });

  it("collapses and expands a section, bumping the list's updatedAt", () => {
    const { listId, a } = setup();
    useWorkspace.setState({ lists: [{ ...list(listId), updatedAt: 0 }] });
    state().toggleSectionCollapsed(listId, a);
    expect(list(listId).sections[0]).toEqual({ id: a, name: "Doing", collapsed: true });
    expect(list(listId).updatedAt).toBeGreaterThan(0);
    state().toggleSectionCollapsed(listId, a);
    expect(list(listId).sections[0]).toEqual({ id: a, name: "Doing" });
  });

  it("moves an item between sections and clears the section when the list changes", () => {
    const { listId, a, item } = setup();
    state().updateItem(item, { sectionId: a });
    expect(state().items[0].sectionId).toBe(a);
    state().updateItem(item, { sectionId: "unknown" });
    expect(state().items[0].sectionId).toBeNull();
    state().updateItem(item, { sectionId: a });
    state().updateItem(item, { title: "Renamed" });
    expect(state().items[0].sectionId).toBe(a);
    expect(state().duplicateItem(item)).toBeTruthy();
    expect(state().items[0].sectionId).toBe(a);
    state().updateItem(item, { listId: INBOX_ID });
    expect(state().items.find((i) => i.id === item)?.sectionId).toBeNull();
    expect(listId).toBeTruthy();
  });

  it("keeps the items of a deleted section in the list, unsectioned", () => {
    const { listId, a, item } = setup();
    state().updateItem(item, { sectionId: a });
    state().deleteSection(listId, a);
    expect(list(listId).sections).toHaveLength(1);
    expect(state().items[0]).toMatchObject({ listId, sectionId: null });
  });
});

describe("mergeData", () => {
  it("adds only unseen items and lists, remapping items of unknown lists to the Inbox", () => {
    const id = state().addItem({ kind: "note", title: "mine" });
    const mine = state().items[0];
    const added = state().mergeData({
      items: [mine, { ...mine, id: "new" }, { ...mine, id: "orphan", listId: "nope" }],
      lists: [{ id: "l", name: "L", sections: [], folderId: null, createdAt: 1, updatedAt: 1 }],
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

describe("converting between tasks and subtasks", () => {
  it("turns a subtask into a task in the same list, keeping its children", () => {
    const listId = state().addList("Work")!;
    const id = state().addItem({ kind: "task", title: "Parent", listId });
    const sub = state().addSubtask(id, "Child")!;
    state().addSubtask(id, "Grandchild", sub);
    const newId = state().subtaskToTask(id, sub)!;
    const task = state().items.find((i) => i.id === newId)!;
    expect(task).toMatchObject({ kind: "task", title: "Child", listId, status: "open" });
    expect(task.subtasks.map((s) => s.title)).toEqual(["Grandchild"]);
    expect(state().items.find((i) => i.id === id)!.subtasks).toEqual([]);
    expect(state().subtaskToTask(id, "missing")).toBeNull();
  });

  it("moves a task under another task, records a tombstone and respects the depth limit", () => {
    const target = state().addItem({ kind: "task", title: "Target" });
    const source = state().addItem({ kind: "task", title: "Source" });
    state().addSubtask(source, "Its subtask");
    expect(state().taskToSubtask(source, target)).toBe(true);
    expect(state().items.some((i) => i.id === source)).toBe(false);
    expect(state().tombstones).toContainEqual(expect.objectContaining({ id: source }));
    const moved = state().items.find((i) => i.id === target)!.subtasks[0];
    expect(moved).toMatchObject({ title: "Source", children: [{ title: "Its subtask" }] });

    // A two-level task cannot go under a level-4 subtask (it would reach level 6).
    let parent: string | null = null;
    for (let level = 1; level <= 4; level++)
      parent = state().addSubtask(target, `L${level}`, parent);
    const deep = state().addItem({ kind: "task", title: "Deep" });
    state().addSubtask(deep, "Child");
    expect(state().taskToSubtask(deep, target, parent)).toBe(false);
    expect(state().taskToSubtask(deep, deep)).toBe(false);
  });
});

describe("due time", () => {
  it("keeps a time only while there is a due date", () => {
    const id = state().addItem({
      kind: "task",
      title: "Call",
      due: "2026-05-10",
      dueTime: "09:30",
    });
    expect(state().items[0].dueTime).toBe("09:30");
    state().updateItem(id, { dueTime: "14:00" });
    expect(state().items[0].dueTime).toBe("14:00");
    state().updateItem(id, { due: "2026-05-11" });
    expect(state().items[0].dueTime).toBe("14:00");
    state().updateItem(id, { due: null });
    expect(state().items[0]).not.toHaveProperty("dueTime");
    state().updateItem(id, { dueTime: "10:00" });
    expect(state().items[0]).not.toHaveProperty("dueTime");
  });
});

describe("estimates", () => {
  it("sets, copies and clears an estimate", () => {
    const id = state().addItem({ kind: "task", title: "Write" });
    state().updateItem(id, { estimate: 90 });
    expect(state().items[0].estimate).toBe(90);
    const copy = state().duplicateItem(id)!;
    expect(state().items.find((i) => i.id === copy)!.estimate).toBe(90);
    state().updateItem(id, { estimate: null });
    expect(state().items.find((i) => i.id === id)).not.toHaveProperty("estimate");
  });
});

describe("time tracking", () => {
  it("runs one timer at a time, adds manual time and stops on completion", () => {
    const a = state().addItem({ kind: "task", title: "A" });
    const b = state().addItem({ kind: "task", title: "B" });
    const find = (id: string) => state().items.find((i) => i.id === id)!;
    state().startTimer(a);
    state().startTimer(a);
    expect(find(a).timeEntries).toHaveLength(1);
    state().startTimer(b);
    expect(find(a).timeEntries![0].end).not.toBeNull();
    expect(find(b).timeEntries![0].end).toBeNull();

    state().addTimeEntry(b, 25);
    expect(find(b).timeEntries).toHaveLength(2);
    state().toggleDone(b);
    expect(find(b).timeEntries!.every((e) => e.end !== null)).toBe(true);

    for (const e of find(a).timeEntries!) state().deleteTimeEntry(a, e.id);
    expect(find(a)).not.toHaveProperty("timeEntries");
  });
});

describe("outcomes", () => {
  it("tags only finished tasks and clears the outcome when the task is reopened", () => {
    const id = state().addItem({ kind: "task", title: "Pitch" });
    state().setOutcome(id, "Went well");
    expect(state().items[0]).not.toHaveProperty("outcome");
    state().toggleDone(id);
    state().setOutcome(id, "Went well", " Client said yes ");
    expect(state().items[0].outcome).toMatchObject({ label: "Went well", note: "Client said yes" });
    state().setOutcome(id, null);
    expect(state().items[0]).not.toHaveProperty("outcome");
    state().setOutcome(id, "Needs follow-up");
    state().toggleDone(id);
    expect(state().items[0]).not.toHaveProperty("outcome");
  });
});

describe("energy", () => {
  it("sets, copies and clears the energy tag", () => {
    const id = state().addItem({ kind: "task", title: "Inbox zero" });
    state().updateItem(id, { energy: "quick" });
    expect(state().items[0].energy).toBe("quick");
    const copy = state().duplicateItem(id)!;
    expect(state().items.find((i) => i.id === copy)!.energy).toBe("quick");
    state().updateItem(id, { energy: null });
    expect(state().items.find((i) => i.id === id)).not.toHaveProperty("energy");
  });
});

describe("templates", () => {
  it("saves a template, creates fresh tasks from it and deletes it with a tombstone", () => {
    const listId = state().addList("Work")!;
    const id = state().addItem({ kind: "task", title: "Weekly report", listId, priority: "high" });
    state().updateItem(id, { estimate: 45, energy: "deep", due: "2026-05-10" });
    const sub = state().addSubtask(id, "Collect numbers")!;
    state().toggleSubtask(id, sub);

    const templateId = state().saveAsTemplate(id)!;
    const template = state().items.find((i) => i.id === templateId)!;
    expect(template).toMatchObject({ template: true, due: null, estimate: 45, energy: "deep" });
    expect(template.subtasks[0]).toMatchObject({ title: "Collect numbers", done: false });

    const created = state().createFromTemplate(templateId, listId, "2026-06-01")!;
    const task = state().items.find((i) => i.id === created)!;
    expect(task).toMatchObject({
      title: "Weekly report",
      listId,
      priority: "high",
      due: "2026-06-01",
    });
    expect(task).not.toHaveProperty("template");
    expect(task.subtasks[0].id).not.toBe(template.subtasks[0].id);

    state().deleteTemplate(templateId);
    expect(state().items.some((i) => i.id === templateId)).toBe(false);
    expect(state().tombstones).toContainEqual(expect.objectContaining({ id: templateId }));
    state().deleteTemplate(created);
    expect(state().items.some((i) => i.id === created)).toBe(true);
  });
});

describe("reminders", () => {
  it("adds up to five distinct reminders and removes them", () => {
    const id = state().addItem({ kind: "task", title: "Dentist", due: "2026-05-10" });
    for (const before of [0, 15, 15, 60, 1440, 120, 30]) state().addReminder(id, before);
    const reminders = state().items[0].reminders!;
    expect(reminders.map((r) => r.before)).toEqual([1440, 120, 60, 15, 0]);
    for (const r of reminders) state().removeReminder(id, r.id);
    expect(state().items[0]).not.toHaveProperty("reminders");
  });
});

describe("constant reminder", () => {
  it("is stored only while switched on", () => {
    const id = state().addItem({ kind: "task", title: "Pills", due: "2026-05-10" });
    state().updateItem(id, { constantReminder: true });
    expect(state().items[0].constantReminder).toBe(true);
    state().updateItem(id, { constantReminder: false });
    expect(state().items[0]).not.toHaveProperty("constantReminder");
  });
});

describe("snooze", () => {
  it("snoozes, unsnoozes and clears the snooze when the task is finished", () => {
    const id = state().addItem({ kind: "task", title: "Call" });
    state().snooze(id, 123);
    expect(state().items[0].snoozedUntil).toBe(123);
    state().snooze(id, null);
    expect(state().items[0]).not.toHaveProperty("snoozedUntil");
    state().snooze(id, 456);
    state().toggleDone(id);
    expect(state().items[0]).not.toHaveProperty("snoozedUntil");
  });
});

describe("recurring tasks", () => {
  it("logs a finished copy and moves the task to its next due date", () => {
    const today = toDateKey(new Date());
    const id = state().addItem({ kind: "task", title: "Water plants", due: today });
    state().updateItem(id, { repeat: { unit: "day", every: 2 } });
    const sub = state().addSubtask(id, "Balcony")!;
    state().toggleSubtask(id, sub);
    state().addReminder(id, 15);
    state().addTimeEntry(id, 10);

    const finishedId = state().toggleDone(id)!;
    expect(finishedId).not.toBe(id);
    const finished = state().items.find((i) => i.id === finishedId)!;
    const task = state().items.find((i) => i.id === id)!;
    expect(finished).toMatchObject({ status: "done", title: "Water plants", due: today });
    expect(finished).not.toHaveProperty("repeat");
    expect(finished).not.toHaveProperty("reminders");
    expect(finished.timeEntries).toHaveLength(1);
    expect(task).toMatchObject({ status: "open", due: addDays(today, 2) });
    expect(task.subtasks[0].done).toBe(false);
    expect(task).not.toHaveProperty("timeEntries");
    expect(task.reminders).toHaveLength(1);

    expect(state().setStatus(id, "wontdo")).not.toBe(id);
    expect(state().items.find((i) => i.id === id)!.due).toBe(addDays(today, 4));
  });

  it("finishes normally once the repeat is removed", () => {
    const id = state().addItem({ kind: "task", title: "Once" });
    state().updateItem(id, { repeat: { unit: "week", every: 1 } });
    state().updateItem(id, { repeat: null });
    expect(state().toggleDone(id)).toBe(id);
    expect(state().items).toHaveLength(1);
  });
});

describe("start date", () => {
  it("keeps the start on or before the due date", () => {
    const id = state().addItem({ kind: "task", title: "Trip", due: "2026-05-10" });
    state().updateItem(id, { startDate: "2026-05-07" });
    expect(state().items[0]).toMatchObject({ startDate: "2026-05-07", due: "2026-05-10" });
    state().updateItem(id, { startDate: "2026-05-12" });
    expect(state().items[0]).toMatchObject({ startDate: "2026-05-12", due: "2026-05-12" });
    state().updateItem(id, { due: "2026-05-11" });
    expect(state().items[0]).not.toHaveProperty("startDate");
    state().updateItem(id, { startDate: "2026-05-09" });
    state().updateItem(id, { due: null });
    expect(state().items[0]).not.toHaveProperty("startDate");
  });

  it("moves with a repeating task", () => {
    const today = toDateKey(new Date());
    const id = state().addItem({ kind: "task", title: "Sprint", due: today });
    state().updateItem(id, { startDate: addDays(today, -4), repeat: { unit: "week", every: 2 } });
    state().toggleDone(id);
    expect(state().items.find((i) => i.id === id)).toMatchObject({
      due: addDays(today, 14),
      startDate: addDays(today, 10),
    });
  });
});

describe("manual order", () => {
  it("writes item positions, bumps updatedAt and skips unchanged items", async () => {
    const a = state().addItem({ kind: "task", title: "A" });
    const b = state().addItem({ kind: "task", title: "B" });
    const before = state().items.find((i) => i.id === b)!.updatedAt;
    await new Promise((r) => setTimeout(r, 2));
    state().reorderItems({ [a]: 2048 });
    const moved = state().items.find((i) => i.id === a)!;
    expect(moved.order).toBe(2048);
    expect(moved.updatedAt).toBeGreaterThan(before);
    expect(state().items.find((i) => i.id === b)!.updatedAt).toBe(before);
    const stamp = moved.updatedAt;
    await new Promise((r) => setTimeout(r, 2));
    state().reorderItems({ [a]: 2048 });
    expect(state().items.find((i) => i.id === a)!.updatedAt).toBe(stamp);
  });

  it("moves an item into another section of its list, ignoring unknown sections", () => {
    const listId = state().addList("Work")!;
    const sectionId = state().addSection(listId, "Doing")!;
    const id = state().addItem({ kind: "task", title: "T", listId });
    state().reorderItems({ [id]: 1 }, { id, sectionId });
    expect(state().items[0]).toMatchObject({ order: 1, sectionId });
    state().reorderItems({}, { id, sectionId: "missing" });
    expect(state().items[0]).toMatchObject({ order: 1, sectionId: null });
  });

  it("drops a cleared position instead of storing null", () => {
    const id = state().addItem({ kind: "task", title: "T" });
    state().reorderItems({ [id]: 5 });
    state().updateItem(id, { title: "U" });
    expect(state().items[0].order).toBe(5);
    useWorkspace.setState({ items: [{ ...state().items[0], order: null }] });
    state().updateItem(id, { title: "V" });
    expect(state().items[0]).not.toHaveProperty("order");
  });

  it("writes list positions and bumps updatedAt", async () => {
    const a = state().addList("A")!;
    const b = state().addList("B")!;
    const before = state().lists.find((l) => l.id === b)!.updatedAt;
    await new Promise((r) => setTimeout(r, 2));
    state().reorderLists({ [b]: -1024 });
    const moved = state().lists.find((l) => l.id === b)!;
    expect(moved.order).toBe(-1024);
    expect(moved.updatedAt).toBeGreaterThan(before);
    expect(state().lists.find((l) => l.id === a)).not.toHaveProperty("order");
  });
});
