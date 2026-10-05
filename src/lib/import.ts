import { parseItem, parseList } from "./backup";
import { parseQuickAdd } from "./items-logic";
import {
  INBOX_ID,
  type Item,
  type Priority,
  type Repeat,
  type Subtask,
  type TaskList,
  type TaskStatus,
} from "./types";
import { createId, toDateKey } from "./utils";

/**
 * Importers for other apps' exports: TickTick's CSV backup, Todoist's CSV project export, JSON task lists (such as
 * API dumps from either app) and plain CSV files with a title column (including Notesflow's own CSV export).
 * Everything is turned into raw records and run through the same sanitisers as backups and sync.
 */

export type ImportSource = "TickTick" | "Todoist" | "Notesflow CSV" | "CSV" | "JSON";

export type ImportResult = {
  source: ImportSource;
  /** New lists to create (lists whose name matches an existing one are reused instead). */
  lists: TaskList[];
  items: Item[];
};

/** Parses CSV text (RFC 4180: quoted fields, doubled quotes, line breaks inside quotes) into rows. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const input = text.replace(/^﻿/, "");
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (quoted) {
      if (c === '"' && input[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && field === "") quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && input[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

/** Local date (and time, unless it is midnight or the task is all-day) of a timestamp string. */
function localDue(value: string, allDay = false): { due: string; dueTime?: string } | null {
  if (!value.trim()) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return { due: value.trim() };
  // "+0000" offsets are not understood everywhere; make them "+00:00".
  const date = new Date(value.trim().replace(/([+-]\d{2})(\d{2})$/, "$1:$2"));
  if (Number.isNaN(date.getTime())) return null;
  const time = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  return allDay || time === "00:00"
    ? { due: toDateKey(date) }
    : { due: toDateKey(date), dueTime: time };
}

const timestamp = (value: string | undefined, fallback: number): number => {
  if (!value?.trim()) return fallback;
  const ms = new Date(value.trim().replace(/([+-]\d{2})(\d{2})$/, "$1:$2")).getTime();
  return Number.isNaN(ms) ? fallback : ms;
};

const RRULE_DAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const UNITS = { DAILY: "day", WEEKLY: "week", MONTHLY: "month", YEARLY: "year" } as const;

/** "RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TH" (TickTick) → a repeat rule. */
export function repeatFromRRule(value: string): Repeat | null {
  const parts = Object.fromEntries(
    value
      .replace(/^RRULE:/i, "")
      .split(";")
      .map((p) => p.split("=").map((s) => s.trim().toUpperCase()) as [string, string]),
  );
  const unit = UNITS[parts.FREQ as keyof typeof UNITS];
  if (!unit) return null;
  const every = Math.max(1, Math.min(99, Number(parts.INTERVAL) || 1));
  const weekdays = (parts.BYDAY ?? "")
    .split(",")
    .map((d: string) => RRULE_DAYS.indexOf(d.replace(/^[+-]?\d+/, "")))
    .filter((d: number) => d >= 0);
  return { unit, every, ...(unit === "week" && weekdays.length ? { weekdays } : {}) };
}

const WEEKDAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

/** Todoist's "every day", "every 2 weeks", "every monday", "daily"… → a repeat rule. */
export function repeatFromText(value: string): Repeat | null {
  const text = value.trim().toLowerCase();
  const simple = { daily: "day", weekly: "week", monthly: "month", yearly: "year" } as const;
  if (text in simple) return { unit: simple[text as keyof typeof simple], every: 1 };
  const unit = text.match(/^every\s+(\d+\s+)?(day|week|month|year)s?\b/);
  if (unit) return { unit: unit[2] as Repeat["unit"], every: Number(unit[1]) || 1 };
  const day = text.match(/^every\s+([a-z]+)/);
  const index = day ? WEEKDAY_NAMES.findIndex((w) => w.startsWith(day[1].slice(0, 3))) : -1;
  return index >= 0 ? { unit: "week", every: 1, weekdays: [index] } : null;
}

/** Finds or creates a list by name; new lists are collected for the result. */
function listResolver(existing: TaskList[], now: number) {
  const byName = new Map(existing.map((l) => [l.name.trim().toLowerCase(), l.id]));
  byName.set("inbox", INBOX_ID);
  const created: TaskList[] = [];
  const sectionIds = new Map<string, string>();
  return {
    created,
    listId(name: string | undefined): string {
      const clean = (name ?? "").trim().slice(0, 100);
      if (!clean) return INBOX_ID;
      const key = clean.toLowerCase();
      const known = byName.get(key);
      if (known) return known;
      const list = parseList({ id: createId(), name: clean, createdAt: now }, now)!;
      created.push(list);
      byName.set(key, list.id);
      return list.id;
    },
    /** A section in a list created by this import (existing lists keep their own sections). */
    sectionId(listId: string, name: string | undefined): string | null {
      const clean = (name ?? "").trim().slice(0, 100);
      const list = created.find((l) => l.id === listId);
      if (!clean || !list) return null;
      const key = `${listId}:${clean.toLowerCase()}`;
      if (!sectionIds.has(key)) {
        const id = createId();
        list.sections.push({ id, name: clean });
        sectionIds.set(key, id);
      }
      return sectionIds.get(key)!;
    },
  };
}

type Raw = Record<string, unknown>;

const finish = (raws: Raw[], now: number): Item[] =>
  raws.flatMap(
    (r) =>
      parseItem(
        {
          createdAt: now,
          ...r,
          updatedAt: now,
          // Finished tasks need a completion time to show up in Completed and the reviews.
          completedAt: r.status && r.status !== "open" ? (r.completedAt ?? now) : null,
        },
        now,
      ) ?? [],
  );

const header = (row: string[]) => row.map((h) => h.trim().toLowerCase());

const TICKTICK_PRIORITY: Record<string, Priority> = { "1": "low", "3": "medium", "5": "high" };

/** TickTick checklist content: one item per line, "▪" for done and "▫" for open. */
function tickTickChecklist(content: string): Subtask[] {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ({
      id: createId(),
      title: line.replace(/^[▪▫]\s*/, "").slice(0, 500),
      done: line.startsWith("▪"),
    }));
}

function fromTickTick(
  rows: string[][],
  start: number,
  lists: TaskList[],
  now: number,
): ImportResult {
  const cols = header(rows[start]);
  const at = (row: string[], name: string) => row[cols.indexOf(name)] ?? "";
  const resolve = listResolver(lists, now);
  const raws: Raw[] = [];
  const byTaskId = new Map<string, Raw>();
  const children: [string, Raw][] = [];

  for (const row of rows.slice(start + 1)) {
    const title = at(row, "title").trim();
    if (!title) continue;
    const listId = resolve.listId(at(row, "list name"));
    const status = at(row, "status").trim();
    const isChecklist = at(row, "is check list").trim().toUpperCase() === "Y";
    const content = at(row, "content");
    const isNote = at(row, "kind").trim().toUpperCase() === "NOTE";
    const due = localDue(at(row, "due date"), at(row, "is all day").trim() === "true");
    const startDate = localDue(at(row, "start date"), true);
    const tags = at(row, "tags")
      .split(",")
      .map((t) => t.trim().replace(/\s+/g, "-"))
      .filter(Boolean)
      .map((t) => `#${t}`);
    const finished: TaskStatus =
      status === "1" || status === "2" ? "done" : status === "-1" ? "wontdo" : "open";
    const raw: Raw = {
      id: createId(),
      kind: isNote ? "note" : "task",
      title: [title, ...tags].join(" "),
      body: isChecklist ? "" : content,
      listId,
      sectionId: resolve.sectionId(listId, at(row, "column name")),
      status: finished,
      priority: TICKTICK_PRIORITY[at(row, "priority").trim()] ?? "none",
      due: due?.due ?? null,
      dueTime: due?.dueTime,
      startDate: startDate && due && startDate.due < due.due ? startDate.due : undefined,
      repeat: at(row, "repeat").trim() ? repeatFromRRule(at(row, "repeat")) : undefined,
      subtasks: isChecklist ? tickTickChecklist(content) : [],
      createdAt: timestamp(at(row, "created time"), now),
      completedAt: finished === "open" ? null : timestamp(at(row, "completed time"), now),
    };
    const parent = at(row, "parentid").trim();
    if (parent) children.push([parent, raw]);
    else raws.push(raw);
    const taskId = at(row, "taskid").trim();
    if (taskId) byTaskId.set(taskId, raw);
  }
  // Child tasks become subtasks of their parent (or stay tasks when the parent is missing).
  for (const [parentId, child] of children) {
    const parent = byTaskId.get(parentId);
    if (parent) {
      (parent.subtasks as Subtask[]).push({
        id: createId(),
        title: String(child.title),
        done: child.status !== "open",
      });
    } else raws.push(child);
  }
  return { source: "TickTick", lists: resolve.created, items: finish(raws, now) };
}

/** Todoist shows p1 (most urgent) as priority 1 in its CSV files. */
const TODOIST_CSV_PRIORITY: Record<string, Priority> = { "1": "high", "2": "medium", "3": "low" };

function fromTodoist(
  rows: string[][],
  fileName: string,
  lists: TaskList[],
  today: string,
  now: number,
): ImportResult {
  const cols = header(rows[0]);
  const at = (row: string[], name: string) => row[cols.indexOf(name)] ?? "";
  const resolve = listResolver(lists, now);
  // A Todoist CSV holds one project, named after the file.
  const listId = resolve.listId(fileName.replace(/\.csv$/i, "").replace(/[_-]+/g, " "));
  const raws: Raw[] = [];
  let section: string | null = null;
  let lastTop: Raw | null = null;

  for (const row of rows.slice(1)) {
    const type = at(row, "type").trim().toLowerCase();
    const content = at(row, "content").trim();
    if (!content) continue;
    if (type === "section") {
      section = resolve.sectionId(listId, content);
      continue;
    }
    if (type !== "task") continue;
    const indent = Number(at(row, "indent")) || 1;
    if (indent > 1 && lastTop) {
      (lastTop.subtasks as Subtask[]).push({ id: createId(), title: content, done: false });
      continue;
    }
    const date = at(row, "date").trim();
    const parsed = date ? parseQuickAdd(date, today) : null;
    const duration = Number(at(row, "duration"));
    const raw: Raw = {
      id: createId(),
      kind: "task",
      title: content.slice(0, 500),
      body: at(row, "description"),
      listId,
      sectionId: section,
      priority: TODOIST_CSV_PRIORITY[at(row, "priority").trim()] ?? "none",
      due: parsed?.due ?? null,
      dueTime: parsed?.due ? parsed.dueTime : undefined,
      repeat: repeatFromText(date) ?? undefined,
      estimate:
        duration > 0
          ? at(row, "duration_unit").trim() === "day"
            ? duration * 480
            : duration
          : undefined,
      subtasks: [],
    };
    // A repeating task needs a first due date.
    if (raw.repeat && !raw.due) raw.due = today;
    raws.push(raw);
    lastTop = raw;
  }
  return { source: "Todoist", lists: resolve.created, items: finish(raws, now) };
}

const PRIORITY_WORDS: Record<string, Priority> = {
  high: "high",
  medium: "medium",
  low: "low",
  none: "none",
};

/** Any CSV with a title column; other columns are used when their names are recognised. */
function fromGenericCsv(rows: string[][], lists: TaskList[], now: number): ImportResult | null {
  const cols = header(rows[0]);
  const find = (...names: string[]) => cols.findIndex((c) => names.includes(c));
  const titleCol = find("title", "name", "task", "content", "subject");
  if (titleCol < 0) return null;
  const own = cols[0] === "type" && cols.includes("content") && cols.includes("subtasks");
  const col = {
    kind: find("type", "kind"),
    list: find("list", "project", "list name", "folder"),
    status: find("status", "completed", "done"),
    priority: find("priority"),
    due: find("due date", "due", "date", "deadline"),
    time: find("due time", "time"),
    start: find("start date", "start"),
    estimate: find("estimate (minutes)", "estimate"),
    body: find("content", "notes", "note", "description", "details", "body"),
    subtasks: find("subtasks"),
  };
  const resolve = listResolver(lists, now);
  const raws: Raw[] = [];
  for (const row of rows.slice(1)) {
    const get = (i: number) => (i >= 0 ? (row[i] ?? "").trim() : "");
    const title = get(titleCol);
    if (!title) continue;
    const kind = get(col.kind).toLowerCase() === "note" ? "note" : "task";
    const status = get(col.status).toLowerCase();
    const due = localDue(get(col.due));
    const time = get(col.time).match(/^(\d{1,2}):(\d{2})/);
    const subtasks = get(col.subtasks)
      .split("\n")
      .filter((s) => s.trim())
      .map((s) => ({
        id: createId(),
        title: s.trim().replace(/^\[[ x]\]\s*/, ""),
        done: /^\s*\[x\]/.test(s),
      }));
    raws.push({
      id: createId(),
      kind,
      title: title.slice(0, 500),
      body: col.body === titleCol ? "" : get(col.body),
      listId: resolve.listId(get(col.list)),
      status: ["done", "completed", "true", "yes", "x", "1"].includes(status)
        ? "done"
        : status === "wontdo"
          ? "wontdo"
          : "open",
      priority: PRIORITY_WORDS[get(col.priority).toLowerCase()] ?? "none",
      due: due?.due ?? null,
      dueTime: time ? `${time[1].padStart(2, "0")}:${time[2]}` : due?.dueTime,
      startDate: localDue(get(col.start))?.due,
      estimate: Number(get(col.estimate)) || undefined,
      subtasks,
    });
  }
  return {
    source: own ? "Notesflow CSV" : "CSV",
    lists: resolve.created,
    items: finish(raws, now),
  };
}

const TICKTICK_API_PRIORITY: Record<number, Priority> = { 1: "low", 3: "medium", 5: "high" };
const TODOIST_API_PRIORITY: Record<number, Priority> = { 4: "high", 3: "medium", 2: "low" };

/**
 * JSON task lists: an array of tasks, or an object with `tasks`/`items` (and optionally `projects`/`lists` for
 * names). Understands TickTick's API fields (title, content, dueDate, priority 0–5, items) and Todoist's
 * (content, description, due.date, priority 1–4, project_id, checked, parent_id).
 */
function fromJson(data: unknown, lists: TaskList[], now: number): ImportResult | null {
  const root = data as Raw;
  const tasks: unknown = Array.isArray(data) ? data : (root?.tasks ?? root?.items);
  if (!Array.isArray(tasks)) return null;
  const projects = ((root && !Array.isArray(data) && (root.projects ?? root.lists)) || []) as Raw[];
  const projectNames = new Map(
    Array.isArray(projects) ? projects.map((p) => [String(p.id), String(p.name ?? "")]) : [],
  );
  const resolve = listResolver(lists, now);
  const raws: Raw[] = [];
  const byId = new Map<string, Raw>();
  const children: [string, Raw][] = [];

  for (const t of tasks as Raw[]) {
    if (!t || typeof t !== "object") continue;
    const todoist = typeof t.content === "string" && !("title" in t);
    const title = String((todoist ? t.content : t.title) ?? "").trim();
    if (!title) continue;
    const dueValue = todoist
      ? ((t.due as Raw | null)?.datetime ?? (t.due as Raw | null)?.date)
      : (t.dueDate ?? t.due);
    const due = typeof dueValue === "string" ? localDue(dueValue, t.isAllDay === true) : null;
    const projectId = String(t.project_id ?? t.projectId ?? t.listId ?? "");
    const listName = projectNames.get(projectId) ?? (typeof t.list === "string" ? t.list : "");
    const done = todoist
      ? t.checked === true || t.is_completed === true
      : Number(t.status) === 2 || t.completed === true;
    const items = Array.isArray(t.items) ? (t.items as Raw[]) : [];
    const raw: Raw = {
      id: createId(),
      kind: "task",
      title: title.slice(0, 500),
      body: String((todoist ? t.description : t.content) ?? ""),
      listId: resolve.listId(listName),
      status: done ? "done" : "open",
      completedAt: done ? now : null,
      priority:
        (todoist ? TODOIST_API_PRIORITY : TICKTICK_API_PRIORITY)[Number(t.priority)] ??
        (typeof t.priority === "string" ? PRIORITY_WORDS[t.priority] : undefined) ??
        "none",
      due: due?.due ?? null,
      dueTime: due?.dueTime,
      repeat:
        typeof t.repeatFlag === "string"
          ? (repeatFromRRule(t.repeatFlag) ?? undefined)
          : todoist && (t.due as Raw | null)?.is_recurring
            ? (repeatFromText(String((t.due as Raw).string ?? "")) ?? undefined)
            : undefined,
      subtasks: items.map((i) => ({
        id: createId(),
        title: String(i.title ?? i.content ?? "").slice(0, 500),
        done: Number(i.status) === 1 || i.checked === true,
      })),
      createdAt: typeof t.createdTime === "string" ? timestamp(t.createdTime, now) : now,
    };
    const parent = String(t.parent_id ?? t.parentId ?? "");
    if (parent) children.push([parent, raw]);
    else raws.push(raw);
    if (t.id !== undefined) byId.set(String(t.id), raw);
  }
  for (const [parentId, child] of children) {
    const parent = byId.get(parentId);
    if (parent) {
      (parent.subtasks as Subtask[]).push({
        id: createId(),
        title: String(child.title),
        done: child.status === "done",
      });
    } else raws.push(child);
  }
  return { source: "JSON", lists: resolve.created, items: finish(raws, now) };
}

/** Works out what kind of file this is and converts it. Throws an Error with a readable message otherwise. */
export function importTasks(
  fileName: string,
  text: string,
  lists: TaskList[],
  today: string,
  now = Date.now(),
): ImportResult {
  const trimmed = text.replace(/^﻿/, "").trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    let data: unknown;
    try {
      data = JSON.parse(trimmed);
    } catch {
      throw new Error("That file is not valid JSON.");
    }
    const result = fromJson(data, lists, now);
    if (!result) throw new Error("No tasks found in that JSON file.");
    return result;
  }
  const rows = parseCsv(trimmed);
  if (!rows.length) throw new Error("That file is empty.");
  // TickTick backups start with a few lines of metadata before the header row.
  const tickTickHeader = rows.findIndex((r) => {
    const h = header(r);
    return h.includes("list name") && h.includes("title") && h.includes("taskid");
  });
  if (tickTickHeader >= 0) return fromTickTick(rows, tickTickHeader, lists, now);
  const first = header(rows[0]);
  if (first.includes("type") && first.includes("content") && first.includes("indent")) {
    return fromTodoist(rows, fileName, lists, today, now);
  }
  const generic = fromGenericCsv(rows, lists, now);
  if (!generic) throw new Error("Couldn’t find a title column in that CSV file.");
  return generic;
}
