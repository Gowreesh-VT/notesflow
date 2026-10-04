import {
  type Energy,
  type FilterCriteria,
  type FilterDue,
  type FilterKind,
  type FilterStatus,
  type Item,
  type Priority,
  type SavedFilter,
} from "./types";
import { addDays, extractTags } from "./utils";

export const FILTER_DUE_OPTIONS: { value: FilterDue; label: string }[] = [
  { value: "any", label: "Any date" },
  { value: "overdue", label: "Overdue" },
  { value: "today", label: "Today" },
  { value: "next7", label: "Next 7 days" },
  { value: "nodate", label: "No date" },
  { value: "range", label: "Date range" },
];

export const FILTER_STATUS_OPTIONS: { value: FilterStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "done", label: "Completed" },
  { value: "wontdo", label: "Won’t Do" },
  { value: "all", label: "All" },
];

export const FILTER_KIND_OPTIONS: { value: FilterKind; label: string }[] = [
  { value: "both", label: "Tasks and notes" },
  { value: "task", label: "Tasks" },
  { value: "note", label: "Notes" },
];

export const FILTER_PRIORITIES: { value: Priority; label: string }[] = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
  { value: "none", label: "None" },
];

const ENERGIES: Energy[] = ["quick", "deep", "low"];
const MAX_NAME = 80;
const MAX_VALUES = 100;

export const EMPTY_CRITERIA: FilterCriteria = {
  kind: "both",
  lists: [],
  tags: [],
  priorities: [],
  due: "any",
  dueFrom: null,
  dueTo: null,
  energies: [],
  status: "open",
};

const asDate = (value: unknown): string | null =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;

/** Unique strings from `raw` that pass `keep`, in their original order. */
function pick<T extends string>(raw: unknown, keep: (value: string) => boolean): T[] {
  if (!Array.isArray(raw)) return [];
  const values = raw.filter((v): v is string => typeof v === "string" && keep(v));
  return [...new Set(values)].slice(0, MAX_VALUES) as T[];
}

/** Sanitises filter criteria from storage, sync or a backup; unknown values fall back to "any". */
export function parseFilterCriteria(raw: unknown): FilterCriteria {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const kind = FILTER_KIND_OPTIONS.some((o) => o.value === r.kind)
    ? (r.kind as FilterKind)
    : "both";
  const status = FILTER_STATUS_OPTIONS.some((o) => o.value === r.status)
    ? (r.status as FilterStatus)
    : "open";
  const due = FILTER_DUE_OPTIONS.some((o) => o.value === r.due) ? (r.due as FilterDue) : "any";
  let dueFrom = due === "range" ? asDate(r.dueFrom) : null;
  let dueTo = due === "range" ? asDate(r.dueTo) : null;
  if (dueFrom && dueTo && dueFrom > dueTo) [dueFrom, dueTo] = [dueTo, dueFrom];
  return {
    kind,
    lists: pick(r.lists, (v) => v.length > 0 && v.length <= 128),
    tags: [
      ...new Set(pick(r.tags, (v) => /^[a-zA-Z][\w-]{0,63}$/.test(v)).map((t) => t.toLowerCase())),
    ],
    priorities: pick(r.priorities, (v) => FILTER_PRIORITIES.some((o) => o.value === v)),
    due: due === "range" && !dueFrom && !dueTo ? "any" : due,
    dueFrom,
    dueTo,
    energies: pick(r.energies, (v) => ENERGIES.includes(v as Energy)),
    status,
  };
}

/** A cleaned-up filter name, or null when it is blank. */
export function cleanFilterName(name: string): string | null {
  const trimmed = name.trim().slice(0, MAX_NAME);
  return trimmed || null;
}

/** Criteria that only tasks can satisfy, because notes have no such field. */
const needsTask = (c: FilterCriteria) =>
  c.kind === "task" ||
  c.priorities.length > 0 ||
  c.energies.length > 0 ||
  c.due !== "any" ||
  c.status === "done" ||
  c.status === "wontdo";

function matchesDue(due: string | null, c: FilterCriteria, today: string): boolean {
  switch (c.due) {
    case "any":
      return true;
    case "nodate":
      return due === null;
    case "overdue":
      return due !== null && due < today;
    case "today":
      return due === today;
    case "next7":
      return due !== null && due >= today && due <= addDays(today, 6);
    case "range":
      return due !== null && (!c.dueFrom || due >= c.dueFrom) && (!c.dueTo || due <= c.dueTo);
  }
}

/** Does a live (not trashed, not template) item satisfy the criteria? */
export function matchesCriteria(item: Item, c: FilterCriteria, today: string): boolean {
  if (c.lists.length > 0 && !c.lists.includes(item.listId)) return false;
  if (c.tags.length > 0) {
    const tags = extractTags(`${item.title}\n${item.body}`);
    if (!c.tags.some((t) => tags.includes(t))) return false;
  }
  if (item.kind === "note") return c.kind !== "task" && !needsTask(c);
  if (c.kind === "note") return false;
  if (c.status !== "all" && item.status !== c.status) return false;
  if (c.priorities.length > 0 && !c.priorities.includes(item.priority)) return false;
  if (c.energies.length > 0 && !(item.energy && c.energies.includes(item.energy))) return false;
  return matchesDue(item.due, c, today);
}

export const findFilter = (filters: SavedFilter[], id: string): SavedFilter | undefined =>
  filters.find((f) => f.id === id);

/** Saved filters by name, for the sidebar and the command palette. */
export const sortFilters = (filters: SavedFilter[]): SavedFilter[] =>
  [...filters].sort((a, b) => a.name.localeCompare(b.name) || a.createdAt - b.createdAt);
