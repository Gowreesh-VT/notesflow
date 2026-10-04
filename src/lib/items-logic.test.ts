import { describe, expect, it } from "vitest";
import {
  collectTags,
  countInView,
  dueBucket,
  filterItems,
  groupByDue,
  groupBySections,
  moveSectionBy,
  parseQuickAdd,
  subtaskProgress,
} from "./items-logic";
import { INBOX_ID, type Item, type View } from "./types";

const today = "2026-05-10";
const smart = (id: Extract<View, { kind: "smart" }>["id"]): View => ({ kind: "smart", id });

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

const items: Item[] = [
  make("late", { due: "2026-05-01" }),
  make("now", { due: today, priority: "high" }),
  make("tomorrow", { due: "2026-05-11" }),
  make("soon", { due: "2026-05-15" }),
  make("far", { due: "2026-06-30" }),
  make("someday"),
  make("done", { status: "done", completedAt: 50 }),
  make("skipped", { status: "wontdo", completedAt: 60 }),
  make("note", { kind: "note", body: "hello #work", updatedAt: 10 }),
  make("work-task", { listId: "work", title: "Plan #work" }),
  make("gone", { deletedAt: 5 }),
];

const ids = (view: View, query = "", sort: Parameters<typeof filterItems>[4] = "default") =>
  filterItems(items, view, query, today, sort).map((i) => i.id);

describe("dueBucket", () => {
  it("buckets due dates", () => {
    expect(dueBucket({ due: null }, today)).toBe("none");
    expect(dueBucket({ due: "2026-05-09" }, today)).toBe("overdue");
    expect(dueBucket({ due: today }, today)).toBe("today");
    expect(dueBucket({ due: "2026-05-11" }, today)).toBe("upcoming");
  });
});

describe("smart views", () => {
  it("Inbox shows open tasks, notes and finished tasks of the inbox, but not trash or other lists", () => {
    expect(ids(smart("inbox"))).toEqual([
      "late",
      "now",
      "tomorrow",
      "soon",
      "far",
      "someday",
      "note",
      "skipped",
      "done",
    ]);
  });

  it("Today includes overdue; Tomorrow only tomorrow; Next 7 Days includes overdue up to day 7", () => {
    expect(ids(smart("today"))).toEqual(["late", "now"]);
    expect(ids(smart("tomorrow"))).toEqual(["tomorrow"]);
    expect(ids(smart("week"))).toEqual(["late", "now", "tomorrow", "soon"]);
  });

  it("All shows open tasks and notes across lists", () => {
    expect(ids(smart("all"))).toContain("work-task");
    expect(ids(smart("all"))).toContain("note");
    expect(ids(smart("all"))).not.toContain("done");
    expect(ids(smart("all"))).not.toContain("gone");
  });

  it("Completed, Won't Do and Trash", () => {
    expect(ids(smart("completed"))).toEqual(["done"]);
    expect(ids(smart("wontdo"))).toEqual(["skipped"]);
    expect(ids(smart("trash"))).toEqual(["gone"]);
  });
});

describe("list and tag views", () => {
  it("shows a list's items", () => {
    expect(ids({ kind: "list", id: "work" })).toEqual(["work-task"]);
  });

  it("finds items by #tag in title or body", () => {
    expect(ids({ kind: "tag", tag: "work" }).sort()).toEqual(["note", "work-task"]);
  });
});

describe("search and sorting", () => {
  it("searches title, body and subtasks", () => {
    const withSub = [make("x", { subtasks: [{ id: "s", title: "buy milk", done: false }] })];
    expect(filterItems(withSub, smart("inbox"), "MILK", today)).toHaveLength(1);
    expect(filterItems(withSub, smart("inbox"), "eggs", today)).toHaveLength(0);
    expect(ids(smart("all"), "hello")).toEqual(["note"]);
  });

  it("orders open tasks by due date then priority, notes after tasks, finished last", () => {
    const list = ids(smart("inbox"));
    expect(list.indexOf("late")).toBeLessThan(list.indexOf("soon"));
    expect(list.indexOf("someday")).toBeLessThan(list.indexOf("note"));
    expect(list.indexOf("note")).toBeLessThan(list.indexOf("done"));
  });

  it("supports priority and title sorts", () => {
    expect(ids(smart("today"), "", "priority")).toEqual(["now", "late"]);
    expect(ids(smart("today"), "", "title")).toEqual(["late", "now"]);
  });

  it("floats pinned notes", () => {
    const notes = [
      make("a", { kind: "note", updatedAt: 9 }),
      make("b", { kind: "note", updatedAt: 1, pinned: true }),
    ];
    expect(filterItems(notes, smart("inbox"), "", today).map((n) => n.id)).toEqual(["b", "a"]);
  });
});

describe("counts, tags, progress", () => {
  it("counts open tasks and notes for containers, and all matches elsewhere", () => {
    expect(countInView(items, smart("inbox"), today)).toBe(7);
    expect(countInView(items, smart("today"), today)).toBe(2);
    expect(countInView(items, smart("completed"), today)).toBe(1);
    expect(countInView(items, { kind: "list", id: "work" }, today)).toBe(1);
  });

  it("collects tags from active items", () => {
    expect(collectTags(items)).toEqual([{ tag: "work", count: 2 }]);
  });

  it("computes subtask progress", () => {
    const sub = (done: boolean) => ({ id: String(done), title: "t", done });
    expect(subtaskProgress({ subtasks: [sub(true), sub(false), sub(true)] })).toEqual({
      done: 2,
      total: 3,
    });
  });
});

describe("sections", () => {
  const sections = [
    { id: "a", name: "A" },
    { id: "b", name: "B" },
  ];

  it("groups items by section, with orphans and unsectioned items first", () => {
    const groups = groupBySections(
      [make("x", { sectionId: "b" }), make("y"), make("z", { sectionId: "gone" })],
      sections,
    );
    expect(groups.map((g) => [g.section?.id ?? null, g.items.map((i) => i.id)])).toEqual([
      [null, ["y", "z"]],
      ["a", []],
      ["b", ["x"]],
    ]);
  });

  it("moves a section up or down and ignores moves past the ends", () => {
    expect(moveSectionBy(sections, "b", -1).map((s) => s.id)).toEqual(["b", "a"]);
    expect(moveSectionBy(sections, "a", 1).map((s) => s.id)).toEqual(["b", "a"]);
    expect(moveSectionBy(sections, "a", -1)).toBe(sections);
    expect(moveSectionBy(sections, "nope", 1)).toBe(sections);
  });
});

describe("parseQuickAdd", () => {
  it("extracts priority and due keywords", () => {
    expect(parseQuickAdd("Pay rent tomorrow !high", today)).toEqual({
      title: "Pay rent",
      priority: "high",
      due: "2026-05-11",
    });
    expect(parseQuickAdd("call mom 2026-06-01 !m", today)).toEqual({
      title: "call mom",
      priority: "medium",
      due: "2026-06-01",
    });
  });

  it("keeps #tags in the title and falls back to the input when only keywords are given", () => {
    expect(parseQuickAdd("Buy milk #errands", today).title).toBe("Buy milk #errands");
    expect(parseQuickAdd("today", today).title).toBe("today");
  });
});

describe("groupByDue", () => {
  it("groups by date with notes last, keeps order and drops empty groups", () => {
    const groups = groupByDue(
      [
        make("n", { kind: "note" }),
        make("t1", { due: today }),
        make("x", { due: "2026-05-01" }),
        make("t2", { due: today }),
        make("tm", { due: "2026-05-11" }),
        make("wk", { due: "2026-05-17" }),
        make("lt", { due: "2026-05-18" }),
        make("nd"),
      ],
      today,
    );
    expect(groups.map((g) => [g.id, g.items.map((i) => i.id)])).toEqual([
      ["overdue", ["x"]],
      ["today", ["t1", "t2"]],
      ["tomorrow", ["tm"]],
      ["week", ["wk"]],
      ["later", ["lt"]],
      ["nodate", ["nd"]],
      ["notes", ["n"]],
    ]);
    expect(groupByDue([], today)).toEqual([]);
  });
});
