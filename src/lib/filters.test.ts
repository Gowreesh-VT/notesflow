import { describe, expect, it } from "vitest";
import { EMPTY_CRITERIA, matchesCriteria, parseFilterCriteria, sortFilters } from "./filters";
import { countInView, filterItems, quickAddDefaults, sameView, viewTitle } from "./items-logic";
import { INBOX_ID, type FilterCriteria, type Item, type SavedFilter } from "./types";

const TODAY = "2026-03-10";

const item = (id: string, patch: Partial<Item> = {}): Item => ({
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

const criteria = (patch: Partial<FilterCriteria>): FilterCriteria => ({
  ...EMPTY_CRITERIA,
  ...patch,
});

const saved = (id: string, patch: Partial<FilterCriteria>, name = id): SavedFilter => ({
  id,
  name,
  criteria: criteria(patch),
  createdAt: 1,
  updatedAt: 1,
});

const matching = (items: Item[], c: Partial<FilterCriteria>) =>
  items.filter((i) => matchesCriteria(i, criteria(c), TODAY)).map((i) => i.id);

describe("parseFilterCriteria", () => {
  it("defaults to open tasks and notes anywhere", () => {
    expect(parseFilterCriteria(undefined)).toEqual(EMPTY_CRITERIA);
    expect(parseFilterCriteria("nope")).toEqual(EMPTY_CRITERIA);
  });

  it("keeps known values once and drops the rest", () => {
    expect(
      parseFilterCriteria({
        kind: "task",
        lists: ["inbox", "work", "work", "", 5],
        tags: ["Home", "home", "#bad", "ok-tag"],
        priorities: ["high", "urgent", "none"],
        due: "next7",
        dueFrom: "2026-01-01",
        energies: ["deep", "sleepy"],
        status: "done",
        extra: true,
      }),
    ).toEqual({
      kind: "task",
      lists: ["inbox", "work"],
      tags: ["home", "ok-tag"],
      priorities: ["high", "none"],
      due: "next7",
      dueFrom: null,
      dueTo: null,
      energies: ["deep"],
      status: "done",
    });
  });

  it("orders a date range and falls back to any date without bounds", () => {
    expect(
      parseFilterCriteria({ due: "range", dueFrom: "2026-05-01", dueTo: "2026-04-01" }),
    ).toMatchObject({ due: "range", dueFrom: "2026-04-01", dueTo: "2026-05-01" });
    expect(parseFilterCriteria({ due: "range", dueFrom: "soon" })).toMatchObject({
      due: "any",
      dueFrom: null,
      dueTo: null,
    });
    expect(parseFilterCriteria({ due: "whenever", status: "maybe", kind: "x" })).toMatchObject({
      due: "any",
      status: "open",
      kind: "both",
    });
  });
});

describe("matchesCriteria", () => {
  const items = [
    item("work-high", { listId: "work", priority: "high", due: TODAY, energy: "deep" }),
    item("inbox-low", { priority: "low", due: "2026-03-01", title: "Pay #bills" }),
    item("nodate", { listId: "home", title: "Fix #home" }),
    item("later", { due: "2026-03-17" }),
    item("soon", { due: "2026-03-15", energy: "quick" }),
    item("done", { status: "done", due: TODAY }),
    item("skipped", { status: "wontdo" }),
    item("note", { kind: "note", listId: "home", body: "about #home" }),
  ];

  it("matches open tasks and notes when nothing is set", () => {
    expect(matching(items, {})).toEqual([
      "work-high",
      "inbox-low",
      "nodate",
      "later",
      "soon",
      "note",
    ]);
  });

  it("filters by list, including the Inbox", () => {
    expect(matching(items, { lists: [INBOX_ID] })).toEqual(["inbox-low", "later", "soon"]);
    expect(matching(items, { lists: ["home", "work"] })).toEqual(["work-high", "nodate", "note"]);
  });

  it("matches any chosen tag, priority or energy, and all criteria together", () => {
    expect(matching(items, { tags: ["home", "bills"] })).toEqual(["inbox-low", "nodate", "note"]);
    expect(matching(items, { priorities: ["high", "low"] })).toEqual(["work-high", "inbox-low"]);
    expect(matching(items, { priorities: ["none"] })).toEqual(["nodate", "later", "soon"]);
    expect(matching(items, { energies: ["deep", "quick"] })).toEqual(["work-high", "soon"]);
    expect(matching(items, { priorities: ["high", "low"], lists: [INBOX_ID] })).toEqual([
      "inbox-low",
    ]);
  });

  it("filters by due date", () => {
    expect(matching(items, { due: "overdue" })).toEqual(["inbox-low"]);
    expect(matching(items, { due: "today" })).toEqual(["work-high"]);
    expect(matching(items, { due: "next7" })).toEqual(["work-high", "soon"]);
    expect(matching(items, { due: "nodate" })).toEqual(["nodate"]);
    expect(matching(items, { due: "range", dueFrom: "2026-03-11", dueTo: null })).toEqual([
      "later",
      "soon",
    ]);
    expect(matching(items, { due: "range", dueFrom: null, dueTo: "2026-03-01" })).toEqual([
      "inbox-low",
    ]);
  });

  it("filters by status and kind; task-only criteria leave notes out", () => {
    expect(matching(items, { status: "done" })).toEqual(["done"]);
    expect(matching(items, { status: "wontdo" })).toEqual(["skipped"]);
    expect(matching(items, { status: "all", lists: [INBOX_ID] })).toEqual([
      "inbox-low",
      "later",
      "soon",
      "done",
      "skipped",
    ]);
    expect(matching(items, { kind: "note" })).toEqual(["note"]);
    expect(matching(items, { kind: "task", lists: ["home"] })).toEqual(["nodate"]);
    expect(matching(items, { lists: ["home"], due: "nodate" })).toEqual(["nodate"]);
  });
});

describe("filter views", () => {
  const filters = [saved("f1", { priorities: ["high"], lists: ["work"] }, "Urgent work")];
  const ctx = { filters };
  const view = { kind: "filter", id: "f1" } as const;

  it("lists matching items and never templates or trashed items", () => {
    const items = [
      item("a", { listId: "work", priority: "high" }),
      item("b", { listId: "work", priority: "high", template: true }),
      item("c", { listId: "work", priority: "high", deletedAt: 5 }),
      item("d", { listId: "work", priority: "low" }),
    ];
    expect(filterItems(items, view, "", TODAY, "default", ctx).map((i) => i.id)).toEqual(["a"]);
    expect(countInView(items, view, TODAY, ctx)).toBe(1);
    expect(filterItems(items, { kind: "filter", id: "gone" }, "", TODAY, "default", ctx)).toEqual(
      [],
    );
    expect(filterItems(items, view, "", TODAY)).toEqual([]);
  });

  it("counts only open items when a filter shows every status", () => {
    const all = { filters: [saved("f2", { status: "all" })] };
    const items = [item("open"), item("done", { status: "done" })];
    expect(countInView(items, { kind: "filter", id: "f2" }, TODAY, all)).toBe(1);
  });

  it("has a title and compares by id", () => {
    expect(viewTitle(view, [], filters)).toBe("Urgent work");
    expect(viewTitle({ kind: "filter", id: "gone" }, [], filters)).toBe("Filter");
    expect(sameView(view, { kind: "filter", id: "f1" })).toBe(true);
    expect(sameView(view, { kind: "filter", id: "f2" })).toBe(false);
    expect(sameView(view, { kind: "list", id: "f1" })).toBe(false);
  });

  it("adds new tasks with the filter's first list, priority and an allowed date", () => {
    expect(quickAddDefaults(view, TODAY, filters)).toEqual({
      listId: "work",
      priority: "high",
      due: null,
    });
    const dated = [saved("t", { due: "today" }), saved("r", { due: "range", dueTo: "2026-04-01" })];
    expect(quickAddDefaults({ kind: "filter", id: "t" }, TODAY, dated)).toEqual({
      listId: INBOX_ID,
      priority: "none",
      due: TODAY,
    });
    expect(quickAddDefaults({ kind: "filter", id: "r" }, TODAY, dated).due).toBe("2026-04-01");
    expect(quickAddDefaults({ kind: "smart", id: "tomorrow" }, TODAY).due).toBe("2026-03-11");
    expect(quickAddDefaults({ kind: "list", id: "work" }, TODAY).listId).toBe("work");
    expect(quickAddDefaults({ kind: "tag", tag: "x" }, TODAY).listId).toBe(INBOX_ID);
  });

  it("sorts saved filters by name", () => {
    expect(sortFilters([saved("1", {}, "Zed"), saved("2", {}, "alpha")]).map((f) => f.id)).toEqual([
      "2",
      "1",
    ]);
  });
});
