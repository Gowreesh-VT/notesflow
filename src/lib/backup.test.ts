import { describe, expect, it } from "vitest";
import { createBackup, parseBackup } from "./backup";
import { INBOX_ID, type Item } from "./types";

const item: Item = {
  id: "i1",
  kind: "task",
  title: "Do",
  body: "d",
  listId: "work",
  createdAt: 1,
  updatedAt: 2,
  deletedAt: null,
  pinned: false,
  status: "wontdo",
  completedAt: 3,
  priority: "high",
  due: "2026-01-01",
  subtasks: [{ id: "s1", title: "sub", done: true }],
  sectionId: "sec",
};

describe("backup", () => {
  it("round-trips items, lists and folders", () => {
    const data = {
      items: [item],
      lists: [
        {
          id: "work",
          name: "Work",
          sections: [{ id: "sec", name: "Doing" }],
          folderId: "f",
          createdAt: 1,
          updatedAt: 2,
        },
      ],
      folders: [{ id: "f", name: "Life", createdAt: 1, updatedAt: 2 }],
    };
    expect(parseBackup(JSON.stringify(createBackup(data, 5)))).toEqual(data);
  });

  it("sanitises sections and defaults them for older data", () => {
    const text = JSON.stringify({
      app: "notesflow",
      version: 2,
      items: [
        { ...item, sectionId: 5 },
        { ...item, id: "i2", sectionId: undefined },
      ],
      lists: [
        {
          id: "a",
          name: "A",
          sections: [
            { id: "s", name: " X ", collapsed: true },
            { id: "s", name: "dup" },
            1,
            { id: "t" },
            { id: "u", name: "U", collapsed: "yes" },
          ],
        },
        { id: "b", name: "B", sections: "nope" },
      ],
      folders: [],
    });
    const parsed = parseBackup(text);
    expect(parsed.items.map((i) => i.sectionId)).toEqual([null, null]);
    expect(parsed.lists.map((l) => l.sections)).toEqual([
      [
        { id: "s", name: "X", collapsed: true },
        { id: "u", name: "U" },
      ],
      [],
    ]);
  });

  it("imports the original notes+tasks format", () => {
    const text = JSON.stringify({
      app: "notesflow",
      version: 1,
      notes: [{ id: "n1", title: "N", body: "B", createdAt: 1, updatedAt: 2, archived: true }],
      tasks: [
        { id: "t1", title: "T", done: true, priority: "low", due: "2026-02-02", completedAt: 4 },
      ],
    });
    const result = parseBackup(text, 7);
    expect(result.items).toHaveLength(2);
    expect(result.items.find((i) => i.id === "t1")).toMatchObject({
      kind: "task",
      status: "done",
      priority: "low",
      listId: INBOX_ID,
    });
    expect(result.items.find((i) => i.id === "n1")?.listId).toBe("legacy-archive");
    expect(result.lists.map((l) => l.name)).toEqual(["Archived"]);
  });

  it("rejects invalid files", () => {
    expect(() => parseBackup("nope")).toThrow("not valid JSON");
    expect(() => parseBackup(JSON.stringify({ hello: 1 }))).toThrow("not a Notesflow backup");
  });

  it("sanitises malformed entries", () => {
    const text = JSON.stringify({
      app: "notesflow",
      version: 2,
      items: [
        null,
        5,
        { kind: "task", title: "  " },
        { kind: "task", title: "ok", priority: "urgent", due: "tomorrow", status: "weird" },
        { kind: "note", body: "n", pinned: "yes" },
        { kind: "other", title: "x" },
      ],
      lists: [
        { id: "", name: "x" },
        { id: "l", name: "  " },
        { id: "l2", name: "Real" },
      ],
      folders: "nope",
    });
    const result = parseBackup(text, 7);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      priority: "none",
      due: null,
      status: "open",
      listId: INBOX_ID,
    });
    expect(result.items[1]).toMatchObject({ kind: "note", pinned: false, createdAt: 7 });
    expect(result.lists).toEqual([
      { id: "l2", name: "Real", sections: [], folderId: null, createdAt: 7, updatedAt: 7 },
    ]);
    expect(result.folders).toEqual([]);
  });
});

describe("nested subtasks in backups", () => {
  it("keeps nesting, drops levels beyond five and rolls done up", () => {
    let deep: unknown = { id: "x6", title: "six", done: true };
    for (let level = 5; level >= 1; level--) {
      deep = { id: `x${level}`, title: `L${level}`, done: false, children: [deep] };
    }
    const raw = JSON.stringify({
      app: "notesflow",
      version: 2,
      items: [{ ...item, subtasks: [deep] }],
      lists: [],
      folders: [],
    });
    const [parsed] = parseBackup(raw).items;
    let node = parsed.subtasks[0];
    let levels = 1;
    while (node.children?.length) {
      node = node.children[0];
      levels++;
    }
    expect(levels).toBe(5);
    expect(node.title).toBe("L5");
    expect(parsed.subtasks[0].done).toBe(false);
  });
});

describe("due time in backups", () => {
  it("keeps a valid time with a date and drops invalid or dateless ones", () => {
    const raw = (fields: object) =>
      JSON.stringify({
        app: "notesflow",
        version: 2,
        items: [{ ...item, ...fields }],
        lists: [],
        folders: [],
      });
    expect(parseBackup(raw({ dueTime: "07:45" })).items[0].dueTime).toBe("07:45");
    expect(parseBackup(raw({ dueTime: "25:00" })).items[0]).not.toHaveProperty("dueTime");
    expect(parseBackup(raw({ due: null, dueTime: "07:45" })).items[0]).not.toHaveProperty(
      "dueTime",
    );
  });
});
