import { describe, expect, it } from "vitest";
import {
  collectTags,
  countInView,
  dueBucket,
  effectiveSort,
  filterByEnergy,
  filterItems,
  groupByDue,
  groupByPriority,
  groupBySections,
  groupByTag,
  isEnergy,
  isPlannerView,
  resolveGroupBy,
  viewKey,
  listTemplates,
  moveSectionBy,
  parseClock,
  parseQuickAdd,
  sameView,
  subtaskProgress,
  viewTitle,
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

describe("due time ordering", () => {
  it("puts all-day tasks first on a day, then timed tasks by time", () => {
    const sorted = filterItems(
      [
        make("late", { due: today, dueTime: "18:00" }),
        make("allday", { due: today }),
        make("early", { due: today, dueTime: "08:15" }),
        make("yesterday", { due: "2026-05-09", dueTime: "23:00" }),
      ],
      smart("today"),
      "",
      today,
    );
    expect(sorted.map((i) => i.id)).toEqual(["yesterday", "allday", "early", "late"]);
  });
});

describe("energy filter", () => {
  it("keeps only tasks with the chosen energy", () => {
    const list = [
      make("q", { energy: "quick" }),
      make("d", { energy: "deep" }),
      make("none"),
      make("n", { kind: "note" }),
    ];
    expect(filterByEnergy(list, "quick").map((i) => i.id)).toEqual(["q"]);
    expect(filterByEnergy(list, null)).toBe(list);
    expect(isEnergy("deep")).toBe(true);
    expect(isEnergy("hyper")).toBe(false);
  });
});

describe("templates are hidden from views", () => {
  it("never shows templates in views, counts or tags, but lists them", () => {
    const list = [
      make("t", { template: true, title: "Tpl #work" }),
      make("real", { title: "Real #work" }),
    ];
    expect(filterItems(list, smart("all"), "", today).map((i) => i.id)).toEqual(["real"]);
    expect(filterItems(list, smart("inbox"), "", today).map((i) => i.id)).toEqual(["real"]);
    expect(countInView(list, smart("inbox"), today)).toBe(1);
    expect(collectTags(list)).toEqual([{ tag: "work", count: 1 }]);
    expect(listTemplates(list).map((i) => i.id)).toEqual(["t"]);
  });
});

describe("smarter quick add", () => {
  // 2026-05-10 is a Sunday.
  const lists = [
    { id: "w", name: "Work" },
    { id: "h", name: "Home Projects" },
  ];

  it("understands times, weekdays, lists, priority and estimates", () => {
    expect(parseQuickAdd("Call Sam friday 5pm @work !high ~30m #clients", today, lists)).toEqual({
      title: "Call Sam #clients",
      priority: "high",
      due: "2026-05-15",
      dueTime: "17:00",
      listId: "w",
      estimate: 30,
    });
    expect(
      parseQuickAdd("Paint fence next sat at 9:30am @home-projects", today, lists),
    ).toMatchObject({
      title: "Paint fence",
      due: "2026-05-16",
      dueTime: "09:30",
      listId: "h",
    });
  });

  it("puts a lone time on today and keeps unknown lists and short weekday words in the title", () => {
    expect(parseQuickAdd("Standup 17:45", today)).toMatchObject({ due: today, dueTime: "17:45" });
    expect(parseQuickAdd("Email @nobody", today, lists)).toMatchObject({ title: "Email @nobody" });
    expect(parseQuickAdd("Sun cream", today).title).toBe("Sun cream");
    expect(parseQuickAdd("sunday", today).due).toBe("2026-05-17");
    expect(parseQuickAdd("Move to @inbox", today, lists).listId).toBe(INBOX_ID);
  });

  it("parses clock words", () => {
    expect(parseClock("12am")).toBe("00:00");
    expect(parseClock("12pm")).toBe("12:00");
    expect(parseClock("7:05pm")).toBe("19:05");
    expect(parseClock("13pm")).toBeNull();
    expect(parseClock("24:00")).toBeNull();
  });
});

describe("multi-day tasks", () => {
  it("show in Today and Next 7 Days once they have started", () => {
    const list = [
      make("running", { startDate: "2026-05-08", due: "2026-05-20" }),
      make("later", { startDate: "2026-05-14", due: "2026-05-20" }),
      make("far", { startDate: "2026-05-30", due: "2026-06-02" }),
    ];
    expect(filterItems(list, smart("today"), "", today).map((i) => i.id)).toEqual(["running"]);
    expect(filterItems(list, smart("week"), "", today).map((i) => i.id)).toEqual([
      "running",
      "later",
    ]);
  });
});

describe("manual order", () => {
  it("sorts open tasks and notes together by position, unpositioned items first and newest first", () => {
    const items = [
      make("b", { order: 2 }),
      make("note", { kind: "note", order: 1.5, pinned: true }),
      make("a", { order: 1 }),
      make("old", { createdAt: 1 }),
      make("new", { createdAt: 5 }),
      make("done", { status: "done", completedAt: 9, order: 0 }),
    ];
    expect(filterItems(items, smart("inbox"), "", today, "manual").map((i) => i.id)).toEqual([
      "new",
      "old",
      "a",
      "note",
      "b",
      "done",
    ]);
  });

  it("leaves other sorts unchanged by positions", () => {
    const items = [make("b", { order: 1, priority: "high" }), make("a", { order: 2 })];
    expect(filterItems(items, smart("inbox"), "", today, "title").map((i) => i.id)).toEqual([
      "a",
      "b",
    ]);
  });
});

describe("grouping", () => {
  const ids = (groups: { id: string; items: Item[] }[]) =>
    groups.map((g) => `${g.id}=${g.items.map((i) => i.id).join(",")}`);

  it("groups by priority, high first, notes last, keeping order and skipping empty groups", () => {
    const items = [
      make("n", { kind: "note" }),
      make("l1", { priority: "low" }),
      make("h", { priority: "high" }),
      make("x"),
      make("l2", { priority: "low" }),
    ];
    expect(ids(groupByPriority(items))).toEqual(["high=h", "low=l1,l2", "none=x", "notes=n"]);
    expect(groupByPriority(items).map((g) => g.label)).toEqual([
      "High priority",
      "Low priority",
      "No priority",
      "Notes",
    ]);
  });

  it("groups by tag alphabetically, listing multi-tag items under each tag and untagged items last", () => {
    const items = [
      make("both", { title: "Plan #work #home" }),
      make("plain"),
      make("note", { kind: "note", title: "Idea", body: "about #home" }),
      make("w", { title: "Ship #work" }),
    ];
    expect(ids(groupByTag(items))).toEqual(["#home=both,note", "#work=both,w", "none=plain"]);
    expect(groupByTag(items).map((g) => g.label)).toEqual(["#home", "#work", "No tag"]);
    expect(groupByTag([make("a", { title: "x #t" })]).map((g) => g.id)).toEqual(["#t"]);
  });

  it("keys views for per-view settings", () => {
    expect(viewKey(smart("today"))).toBe("smart:today");
    expect(viewKey({ kind: "list", id: "abc" })).toBe("list:abc");
    expect(viewKey({ kind: "tag", tag: "work" })).toBe("tag:work");
  });

  it("uses the chosen grouping, or a sensible default", () => {
    const ctx = { hasSections: false, sort: "default" as const, readOnly: false };
    expect(resolveGroupBy(undefined, ctx)).toBe("due");
    expect(resolveGroupBy(undefined, { ...ctx, readOnly: true })).toBe("none");
    expect(resolveGroupBy(undefined, { ...ctx, sort: "manual" })).toBe("none");
    expect(resolveGroupBy(undefined, { ...ctx, hasSections: true })).toBe("section");
    expect(resolveGroupBy("tag", { ...ctx, hasSections: true })).toBe("tag");
    expect(resolveGroupBy("priority", ctx)).toBe("priority");
    expect(resolveGroupBy("section", ctx)).toBe("due");
    expect(resolveGroupBy("bogus", ctx)).toBe("due");
  });
});

describe("effectiveSort", () => {
  it("only keeps manual order inside lists and the Inbox", () => {
    expect(effectiveSort("manual", { kind: "list", id: "w" })).toBe("manual");
    expect(effectiveSort("manual", smart("inbox"))).toBe("manual");
    expect(effectiveSort("manual", smart("today"))).toBe("default");
    expect(effectiveSort("manual", { kind: "tag", tag: "x" })).toBe("default");
    expect(effectiveSort("priority", smart("today"))).toBe("priority");
  });
});

describe("planner views", () => {
  it("are recognised, titled, compared and never list items", () => {
    const calendar = { kind: "calendar" } as const;
    expect(isPlannerView(calendar)).toBe(true);
    expect(isPlannerView(smart("today"))).toBe(false);
    expect(sameView(calendar, { kind: "calendar" })).toBe(true);
    expect(sameView(calendar, { kind: "plan" })).toBe(false);
    expect(viewTitle({ kind: "plan" }, [])).toBe("Plan my day");
    expect(filterItems([make("x", { due: today })], calendar, "", today)).toEqual([]);
  });
});
