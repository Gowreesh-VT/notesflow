import {
  INBOX_ID,
  type Energy,
  type Item,
  type ItemSort,
  type ListSection,
  type Priority,
  type SavedFilter,
  type SmartViewId,
  type TaskList,
  type View,
} from "./types";
import { parseDuration } from "./duration";
import { compareOrder } from "./ordering";
import { findFilter, matchesCriteria } from "./filters";
import { countSubtasks, flattenSubtasks } from "./subtasks";
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

/** A multi-day task that has started by `day`. */
const startedBy = (item: Item, day: string) => Boolean(item.startDate && item.startDate <= day);

export const isOpenTask = (item: Item): boolean => item.kind === "task" && item.status === "open";

/** Unique, lower-cased #tags found in an item's title and body. */
export function itemTags(item: Pick<Item, "title" | "body">): string[] {
  return extractTags(`${item.title}\n${item.body}`);
}

/**
 * What some views need besides the items: saved filters for filter views, and the ids of archived lists, whose
 * items only show up in the list itself (and in filters that name it).
 */
export type ViewContext = { filters?: SavedFilter[]; archived?: ReadonlySet<string> };

export const isArchived = (list: Pick<TaskList, "archivedAt">): boolean => Boolean(list.archivedAt);

/** Lists that are not archived, for the sidebar, pickers and quick add. */
export const activeLists = <T extends Pick<TaskList, "archivedAt">>(lists: T[]): T[] =>
  lists.filter((l) => !isArchived(l));

/** Archived lists, most recently archived first. */
export const archivedLists = <T extends Pick<TaskList, "archivedAt">>(lists: T[]): T[] =>
  lists.filter(isArchived).sort((a, b) => (b.archivedAt ?? 0) - (a.archivedAt ?? 0));

export const archivedListIds = (lists: TaskList[]): ReadonlySet<string> =>
  new Set(archivedLists(lists).map((l) => l.id));

export function sameView(a: View, b: View): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "smart" && b.kind === "smart") return a.id === b.id;
  if (a.kind === "list" && b.kind === "list") return a.id === b.id;
  if (a.kind === "filter" && b.kind === "filter") return a.id === b.id;
  return a.kind === "tag" && b.kind === "tag" && a.tag === b.tag;
}

export function viewTitle(view: View, lists: TaskList[], filters: SavedFilter[] = []): string {
  if (view.kind === "tag") return `#${view.tag}`;
  if (view.kind === "filter") return findFilter(filters, view.id)?.name ?? "Filter";
  if (view.kind === "list") {
    return view.id === INBOX_ID ? "Inbox" : (lists.find((l) => l.id === view.id)?.name ?? "List");
  }
  return SMART_VIEWS.find((v) => v.id === view.id)?.label ?? "";
}

/** Does the item belong in the view at all (before hiding finished tasks)? */
function matchesView(item: Item, view: View, today: string, ctx: ViewContext): boolean {
  if (view.kind === "smart" && view.id === "trash") return item.deletedAt !== null;
  if (item.deletedAt !== null || item.template) return false;

  if (view.kind === "list") return item.listId === view.id;
  if (view.kind === "filter") {
    const filter = findFilter(ctx.filters ?? [], view.id);
    return filter ? matchesCriteria(item, filter.criteria, today, ctx.archived) : false;
  }
  if (ctx.archived?.has(item.listId)) return false;
  if (view.kind === "tag") {
    return (item.kind === "note" || isOpenTask(item)) && itemTags(item).includes(view.tag);
  }

  switch (view.id) {
    case "inbox":
      return item.listId === INBOX_ID;
    case "today":
      return isOpenTask(item) && item.due !== null && (item.due <= today || startedBy(item, today));
    case "tomorrow":
      return isOpenTask(item) && item.due === addDays(today, 1);
    case "week":
      return (
        isOpenTask(item) &&
        item.due !== null &&
        (item.due <= addDays(today, 6) || startedBy(item, addDays(today, 6)))
      );
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

/**
 * Item groups, in display order: open tasks, notes, finished tasks. In manual order, open tasks and notes share
 * one group so they can be arranged freely.
 */
const group = (item: Item, sort: ItemSort): number =>
  item.kind === "note" ? (sort === "manual" ? 0 : 1) : item.status === "open" ? 0 : 2;

function compareDue(a: Item, b: Item): number {
  if (a.due !== b.due) {
    if (!a.due) return 1;
    if (!b.due) return -1;
    return a.due.localeCompare(b.due);
  }
  // On the same day, all-day tasks come first, then timed tasks by time.
  const ta = a.dueTime ?? "";
  const tb = b.dueTime ?? "";
  return ta.localeCompare(tb);
}

function compareWithin(a: Item, b: Item, sort: ItemSort): number {
  if (sort === "manual") return compareOrder(a, b, "first") || a.createdAt - b.createdAt;
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
  const byGroup = group(a, sort) - group(b, sort);
  if (byGroup !== 0) return byGroup;
  if (group(a, sort) === 1 && a.pinned !== b.pinned) return a.pinned ? -1 : 1;
  if (group(a, sort) === 2) {
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
  ctx: ViewContext = {},
): Item[] {
  const q = query.trim().toLowerCase();
  const inView = items.filter((item) => matchesView(item, view, today, ctx));
  const matching = q
    ? inView.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.body.toLowerCase().includes(q) ||
          flattenSubtasks(item.subtasks).some((s) => s.title.toLowerCase().includes(q)),
      )
    : inView;
  return [...matching].sort((a, b) => compareItems(a, b, sort));
}

/** Number shown next to a view: open tasks and notes, or all matches for finished/trash views. */
export function countInView(
  items: Item[],
  view: View,
  today: string,
  ctx: ViewContext = {},
): number {
  const matches = items.filter((item) => matchesView(item, view, today, ctx));
  const isContainer =
    view.kind === "list" ||
    (view.kind === "smart" && view.id === "inbox") ||
    (view.kind === "filter" && findFilter(ctx.filters ?? [], view.id)?.criteria.status === "all");
  return isContainer
    ? matches.filter((item) => item.kind === "note" || item.status === "open").length
    : matches.length;
}

export function collectTags(
  items: Item[],
  archived: ReadonlySet<string> = new Set(),
): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (item.deletedAt !== null || item.template || archived.has(item.listId)) continue;
    if (!(item.kind === "note" || isOpenTask(item))) continue;
    for (const tag of itemTags(item)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/** Progress across every level of subtasks. */
export function subtaskProgress(item: Pick<Item, "subtasks">): { done: number; total: number } {
  return countSubtasks(item.subtasks);
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

const WEEKDAYS: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};
/** Only full weekday names are recognised on their own; short forms need "next" ("next fri"). */
const FULL_WEEKDAYS = new Set([
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
]);

const weekdayOf = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
};

/** The next `day` after today (a week ahead if today is that day). */
function upcomingWeekday(today: string, day: number): string {
  const diff = (day - weekdayOf(today) + 7) % 7 || 7;
  return addDays(today, diff);
}

/** `day` in next week (weeks start on Monday). */
function weekdayNextWeek(today: string, day: number): string {
  const nextMonday = addDays(today, 7 - ((weekdayOf(today) + 6) % 7));
  return addDays(nextMonday, (day + 6) % 7);
}

/** "5pm", "5:30pm", "17:00", "9am" → "HH:MM", or null. */
export function parseClock(word: string): string | null {
  const ampm = /^(\d{1,2})(?::([0-5]\d))?(am|pm)$/.exec(word);
  if (ampm) {
    const hour = Number(ampm[1]);
    if (hour < 1 || hour > 12) return null;
    const h = (hour % 12) + (ampm[3] === "pm" ? 12 : 0);
    return `${String(h).padStart(2, "0")}:${ampm[2] ?? "00"}`;
  }
  const h24 = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(word);
  return h24 ? `${h24[1].padStart(2, "0")}:${h24[2]}` : null;
}

const listKey = (name: string) => name.toLowerCase().replace(/[\s_-]+/g, "");

export type QuickAdd = {
  title: string;
  priority: Priority;
  due: string | null;
  dueTime?: string;
  listId?: string;
  estimate?: number;
};

/**
 * Understands quick-add input such as "Call Sam next fri 5pm @work !high ~30m #clients":
 * dates (today, tomorrow, weekdays, "next <day>", YYYY-MM-DD), times ("5pm", "17:00", "at 9am"), `@list`,
 * `!priority` and `~estimate`. `#tags` stay in the title. Unrecognised words are kept as the title.
 */
export function parseQuickAdd(
  input: string,
  today: string,
  lists: Pick<TaskList, "id" | "name">[] = [],
): QuickAdd {
  const result: QuickAdd = { title: "", priority: "none", due: null };
  const words = input.trim().split(/\s+/);
  const kept: string[] = [];

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const lower = word.toLowerCase();
    const next = words[i + 1]?.toLowerCase();

    if (lower in PRIORITY_WORDS) result.priority = PRIORITY_WORDS[lower];
    else if (lower === "today") result.due = today;
    else if (lower === "tomorrow" || lower === "tmrw") result.due = addDays(today, 1);
    else if (/^\d{4}-\d{2}-\d{2}$/.test(lower)) result.due = lower;
    else if (lower === "next" && next !== undefined && next in WEEKDAYS) {
      result.due = weekdayNextWeek(today, WEEKDAYS[next]);
      i++;
    } else if (FULL_WEEKDAYS.has(lower)) result.due = upcomingWeekday(today, WEEKDAYS[lower]);
    else if (lower === "at" && next !== undefined && parseClock(next)) {
      result.dueTime = parseClock(next)!;
      i++;
    } else if (parseClock(lower)) result.dueTime = parseClock(lower)!;
    else if (lower.startsWith("~") && parseDuration(lower.slice(1))) {
      result.estimate = parseDuration(lower.slice(1))!;
    } else if (lower.startsWith("@") && lower.length > 1) {
      const list = lists.find((l) => listKey(l.name) === listKey(lower.slice(1)));
      if (list) result.listId = list.id;
      else if (lower === "@inbox") result.listId = INBOX_ID;
      else kept.push(word);
    } else kept.push(word);
  }

  // A time without a date means today.
  if (result.dueTime && !result.due) result.due = today;
  result.title = kept.join(" ").trim() || input.trim();
  return result;
}

/**
 * Where quick add puts a new task in a view and what it starts with: the open list (or the Inbox), today or tomorrow
 * in date views, and in a filter view the filter's first list and priority and a date it allows.
 */
export function quickAddDefaults(
  view: View,
  today: string,
  filters: SavedFilter[] = [],
): { listId: string; priority: Priority; due: string | null } {
  if (view.kind === "list") return { listId: view.id, priority: "none", due: null };
  if (view.kind === "smart") {
    const due =
      view.id === "today" || view.id === "week"
        ? today
        : view.id === "tomorrow"
          ? addDays(today, 1)
          : null;
    return { listId: INBOX_ID, priority: "none", due };
  }
  const criteria = view.kind === "filter" ? findFilter(filters, view.id)?.criteria : undefined;
  if (!criteria) return { listId: INBOX_ID, priority: "none", due: null };
  const due =
    criteria.due === "today" || criteria.due === "next7"
      ? today
      : criteria.due === "range"
        ? (criteria.dueFrom ?? criteria.dueTo)
        : null;
  return {
    listId: criteria.lists[0] ?? INBOX_ID,
    priority: criteria.priorities[0] ?? "none",
    due,
  };
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

export const ENERGY_OPTIONS: { value: Energy; label: string }[] = [
  { value: "quick", label: "Quick win" },
  { value: "deep", label: "Deep work" },
  { value: "low", label: "Low energy" },
];

export const isEnergy = (value: unknown): value is Energy =>
  ENERGY_OPTIONS.some((o) => o.value === value);

/** Keeps only tasks tagged with `energy` (notes have no energy, so they are hidden too). */
export function filterByEnergy(items: Item[], energy: Energy | null): Item[] {
  return energy ? items.filter((i) => i.kind === "task" && i.energy === energy) : items;
}

/** Saved task templates, by name. */
export const listTemplates = (items: Item[]): Item[] =>
  items
    .filter((i) => i.template && i.deletedAt === null)
    .sort((a, b) => displayTitle(a).localeCompare(displayTitle(b)));

export type DueGroupId = "overdue" | "today" | "tomorrow" | "week" | "later" | "nodate" | "notes";
export type DueGroup = { id: DueGroupId; label: string; items: Item[] };

const DUE_GROUP_LABELS: Record<DueGroupId, string> = {
  overdue: "Overdue",
  today: "Today",
  tomorrow: "Tomorrow",
  week: "Next 7 days",
  later: "Later",
  nodate: "No date",
  notes: "Notes",
};

/**
 * Splits items into date groups (overdue, today, tomorrow, next 7 days, later, no date) with notes last, keeping the
 * incoming order inside each group. Empty groups are left out.
 */
export function groupByDue(items: Item[], today: string): DueGroup[] {
  const tomorrow = addDays(today, 1);
  const weekEnd = addDays(today, 7);
  const groupOf = (item: Item): DueGroupId => {
    if (item.kind === "note") return "notes";
    if (!item.due) return "nodate";
    if (item.due < today) return "overdue";
    if (item.due === today) return "today";
    if (item.due === tomorrow) return "tomorrow";
    if (item.due <= weekEnd) return "week";
    return "later";
  };
  const buckets = new Map<DueGroupId, Item[]>(
    (Object.keys(DUE_GROUP_LABELS) as DueGroupId[]).map((id) => [id, []]),
  );
  for (const item of items) buckets.get(groupOf(item))!.push(item);
  return [...buckets]
    .filter(([, group]) => group.length > 0)
    .map(([id, group]) => ({ id, label: DUE_GROUP_LABELS[id], items: group }));
}

/** How a view's items are split into collapsible groups. */
export type GroupBy = "none" | "due" | "priority" | "section" | "tag";

export const GROUP_BY_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: "none", label: "No groups" },
  { value: "due", label: "Date groups" },
  { value: "priority", label: "Priority groups" },
  { value: "section", label: "Sections" },
  { value: "tag", label: "Tag groups" },
];

export const isGroupBy = (value: unknown): value is GroupBy =>
  GROUP_BY_OPTIONS.some((o) => o.value === value);

export type ItemGroup = { id: string; label: string; items: Item[] };

/** A stable key for remembering per-view settings such as grouping. */
export function viewKey(view: View): string {
  if (view.kind === "tag") return `tag:${view.tag}`;
  return `${view.kind}:${view.id}`;
}

/**
 * The grouping a view uses: the one chosen for it, otherwise sections for a list that has them, date groups in
 * smart order (except the finished and trash views), and no groups otherwise. "Section" only applies to lists with
 * sections.
 */
/** Views that hold items directly (a list or the Inbox), where a manual order makes sense. */
export const isContainerView = (view: View): boolean =>
  view.kind === "list" || (view.kind === "smart" && view.id === "inbox");

/**
 * The sort that applies in a view. The sort choice is shared by all views, but manual order only exists inside a
 * list or the Inbox, so elsewhere (Today, tags, filters…) it falls back to smart order.
 */
export const effectiveSort = (sort: ItemSort, view: View): ItemSort =>
  sort === "manual" && !isContainerView(view) ? "default" : sort;

export function resolveGroupBy(
  chosen: unknown,
  context: { hasSections: boolean; sort: ItemSort; readOnly: boolean },
): GroupBy {
  if (isGroupBy(chosen) && (chosen !== "section" || context.hasSections)) return chosen;
  if (context.hasSections) return "section";
  return context.sort === "default" && !context.readOnly ? "due" : "none";
}

const PRIORITY_GROUPS: { id: Priority; label: string }[] = [
  { id: "high", label: "High priority" },
  { id: "medium", label: "Medium priority" },
  { id: "low", label: "Low priority" },
  { id: "none", label: "No priority" },
];

/** Splits items by priority (high first) with notes last, keeping the incoming order. Empty groups are left out. */
export function groupByPriority(items: Item[]): ItemGroup[] {
  const groups: ItemGroup[] = [
    ...PRIORITY_GROUPS.map(({ id, label }) => ({
      id,
      label,
      items: items.filter((i) => i.kind === "task" && i.priority === id),
    })),
    { id: "notes", label: "Notes", items: items.filter((i) => i.kind === "note") },
  ];
  return groups.filter((g) => g.items.length > 0);
}

/**
 * Splits items by #tag, alphabetically, keeping the incoming order inside each group. An item with several tags is
 * listed under each of them; items without tags come last under "No tag". Empty groups are left out.
 */
export function groupByTag(items: Item[]): ItemGroup[] {
  const byTag = new Map<string, Item[]>();
  const untagged: Item[] = [];
  for (const item of items) {
    const tags = itemTags(item);
    if (tags.length === 0) untagged.push(item);
    for (const tag of tags) byTag.set(tag, [...(byTag.get(tag) ?? []), item]);
  }
  const groups = [...byTag.keys()]
    .sort((a, b) => a.localeCompare(b))
    .map((tag) => ({ id: `#${tag}`, label: `#${tag}`, items: byTag.get(tag)! }));
  return untagged.length ? [...groups, { id: "none", label: "No tag", items: untagged }] : groups;
}
