import {
  INBOX_ID,
  type Item,
  type ItemSort,
  type ListSection,
  type Priority,
  type SmartViewId,
  type TaskList,
  type View,
} from "./types";
import { addDays, displayTitle, extractTags } from "./utils";

export const SMART_VIEWS: { id: SmartViewId; label: string }[] = [
  { id: "inbox", label: "Inbox" },
  { id: "today", label: "Today" },
  { id: "tomorrow", label: "Tomorrow" },
  { id: "week", label: "Next 7 Days" },
  { id: "all", label: "All" },
  { id: "completed", label: "Completed" },
  { id: "wontdo", label: "Won’t Do" },
  { id: "trash", label: "Trash" },
];

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2, none: 3 };

export type DueBucket = "overdue" | "today" | "upcoming" | "none";

export function dueBucket(item: Pick<Item, "due">, today: string): DueBucket {
  if (!item.due) return "none";
  if (item.due < today) return "overdue";
  if (item.due === today) return "today";
  return "upcoming";
}

export const isOpenTask = (item: Item): boolean => item.kind === "task" && item.status === "open";

/** Unique, lower-cased #tags found in an item's title and body. */
export function itemTags(item: Pick<Item, "title" | "body">): string[] {
  return extractTags(`${item.title}\n${item.body}`);
}

export function sameView(a: View, b: View): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "smart" && b.kind === "smart") return a.id === b.id;
  if (a.kind === "list" && b.kind === "list") return a.id === b.id;
  return a.kind === "tag" && b.kind === "tag" && a.tag === b.tag;
}

export function viewTitle(view: View, lists: TaskList[]): string {
  if (view.kind === "tag") return `#${view.tag}`;
  if (view.kind === "list") {
    return view.id === INBOX_ID ? "Inbox" : (lists.find((l) => l.id === view.id)?.name ?? "List");
  }
  return SMART_VIEWS.find((v) => v.id === view.id)?.label ?? "";
}

/** Does the item belong in the view at all (before hiding finished tasks)? */
function matchesView(item: Item, view: View, today: string): boolean {
  if (view.kind === "smart" && view.id === "trash") return item.deletedAt !== null;
  if (item.deletedAt !== null) return false;

  if (view.kind === "list") return item.listId === view.id;
  if (view.kind === "tag") {
    return (item.kind === "note" || isOpenTask(item)) && itemTags(item).includes(view.tag);
  }

  switch (view.id) {
    case "inbox":
      return item.listId === INBOX_ID;
    case "today":
      return isOpenTask(item) && item.due !== null && item.due <= today;
    case "tomorrow":
      return isOpenTask(item) && item.due === addDays(today, 1);
    case "week":
      return isOpenTask(item) && item.due !== null && item.due <= addDays(today, 6);
    case "all":
      return item.kind === "note" || isOpenTask(item);
    case "completed":
      return item.kind === "task" && item.status === "done";
    case "wontdo":
      return item.kind === "task" && item.status === "wontdo";
    default:
      return false;
  }
}

/** Item groups, in display order: open tasks, notes, finished tasks. */
const group = (item: Item): number => (item.kind === "note" ? 1 : item.status === "open" ? 0 : 2);

function compareDue(a: Item, b: Item): number {
  if (a.due !== b.due) {
    if (!a.due) return 1;
    if (!b.due) return -1;
    return a.due.localeCompare(b.due);
  }
  return 0;
}

function compareWithin(a: Item, b: Item, sort: ItemSort): number {
  if (sort === "title") return displayTitle(a).localeCompare(displayTitle(b));
  if (sort === "updated") return b.updatedAt - a.updatedAt;
  if (a.kind === "note") return b.updatedAt - a.updatedAt;
  if (sort === "priority") {
    return (
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
      compareDue(a, b) ||
      a.createdAt - b.createdAt
    );
  }
  return (
    compareDue(a, b) ||
    PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
    a.createdAt - b.createdAt
  );
}

export function compareItems(a: Item, b: Item, sort: ItemSort): number {
  const byGroup = group(a) - group(b);
  if (byGroup !== 0) return byGroup;
  if (group(a) === 1 && a.pinned !== b.pinned) return a.pinned ? -1 : 1;
  if (group(a) === 2) {
    return (b.completedAt ?? b.updatedAt) - (a.completedAt ?? a.updatedAt);
  }
  return compareWithin(a, b, sort);
}

export function filterItems(
  items: Item[],
  view: View,
  query: string,
  today: string,
  sort: ItemSort = "default",
): Item[] {
  const q = query.trim().toLowerCase();
  const inView = items.filter((item) => matchesView(item, view, today));
  const matching = q
    ? inView.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.body.toLowerCase().includes(q) ||
          item.subtasks.some((s) => s.title.toLowerCase().includes(q)),
      )
    : inView;
  return [...matching].sort((a, b) => compareItems(a, b, sort));
}

/** Number shown next to a view: open tasks and notes, or all matches for finished/trash views. */
export function countInView(items: Item[], view: View, today: string): number {
  const matches = items.filter((item) => matchesView(item, view, today));
  const isContainer = view.kind === "list" || (view.kind === "smart" && view.id === "inbox");
  return isContainer
    ? matches.filter((item) => item.kind === "note" || item.status === "open").length
    : matches.length;
}

export function collectTags(items: Item[]): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (item.deletedAt !== null || !(item.kind === "note" || isOpenTask(item))) continue;
    for (const tag of itemTags(item)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

export function subtaskProgress(item: Pick<Item, "subtasks">): { done: number; total: number } {
  return { done: item.subtasks.filter((s) => s.done).length, total: item.subtasks.length };
}

const PRIORITY_WORDS: Record<string, Priority> = {
  "!high": "high",
  "!h": "high",
  "!medium": "medium",
  "!med": "medium",
  "!m": "medium",
  "!low": "low",
  "!l": "low",
};

/** Understands quick-add input such as "Buy milk tomorrow !high". */
export function parseQuickAdd(
  input: string,
  today: string,
): { title: string; priority: Priority; due: string | null } {
  let priority: Priority = "none";
  let due: string | null = null;
  const kept: string[] = [];

  for (const word of input.trim().split(/\s+/)) {
    const lower = word.toLowerCase();
    if (lower in PRIORITY_WORDS) priority = PRIORITY_WORDS[lower];
    else if (lower === "today") due = today;
    else if (lower === "tomorrow") due = addDays(today, 1);
    else if (/^\d{4}-\d{2}-\d{2}$/.test(lower)) due = lower;
    else kept.push(word);
  }

  return { title: kept.join(" ").trim() || input.trim(), priority, due };
}

export type SectionGroup = { section: ListSection | null; items: Item[] };

/**
 * Splits a list's items into its sections, keeping the incoming order inside each group. The unsectioned group
 * (section null) comes first and also holds items whose section no longer exists. Empty sections are kept so they
 * can be shown and filled.
 */
export function groupBySections(items: Item[], sections: ListSection[]): SectionGroup[] {
  const known = new Set(sections.map((s) => s.id));
  return [
    { section: null, items: items.filter((i) => !i.sectionId || !known.has(i.sectionId)) },
    ...sections.map((section) => ({
      section,
      items: items.filter((i) => i.sectionId === section.id),
    })),
  ];
}

/** Moves the section with `id` one place up (-1) or down (1); returns the same array when it cannot move. */
export function moveSectionBy(sections: ListSection[], id: string, delta: -1 | 1): ListSection[] {
  const from = sections.findIndex((s) => s.id === id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= sections.length) return sections;
  const next = [...sections];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}
