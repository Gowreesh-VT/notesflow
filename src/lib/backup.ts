import { migrateLegacyData, type LegacyNote, type LegacyTask } from "./migrate";
import {
  INBOX_ID,
  type Backup,
  type Folder,
  type Item,
  type ListSection,
  type Subtask,
  type Priority,
  type Countdown,
  type Preferences,
  type Habit,
  type SavedFilter,
  type TaskList,
  type TaskStatus,
} from "./types";
import { asMinutes } from "./duration";
import { cleanFilterName, parseFilterCriteria } from "./filters";
import { cleanCheckins, cleanHabitName, parseGoal } from "./habits";
import { isEnergy } from "./items-logic";
import { asOrder } from "./ordering";
import { parsePreferences } from "./preferences";
import { parseOutcome } from "./outcomes";
import { parseRepeat } from "./recurrence";
import { parseReminders } from "./reminders";
import { MAX_SUBTASK_DEPTH, rollUp } from "./subtasks";
import { parseTimeEntries } from "./time-tracking";
import { createId } from "./utils";

const PRIORITIES: Priority[] = ["none", "low", "medium", "high"];
const STATUSES: TaskStatus[] = ["open", "done", "wontdo"];

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asTime(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asDue(value: unknown): string | null {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function asClock(value: unknown): string | null {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : null;
}

function parseSubtasks(raw: unknown, levels = MAX_SUBTASK_DEPTH): Subtask[] {
  if (!Array.isArray(raw) || levels <= 0) return [];
  const subtasks = raw.flatMap((s: unknown): Subtask[] => {
    if (!s || typeof s !== "object") return [];
    const sub = s as Record<string, unknown>;
    if (typeof sub.title !== "string") return [];
    const children = parseSubtasks(sub.children, levels - 1);
    const node: Subtask = {
      id: asString(sub.id) || createId(),
      title: sub.title,
      done: sub.done === true,
    };
    return [children.length ? { ...node, children } : node];
  });
  return levels === MAX_SUBTASK_DEPTH ? rollUp(subtasks) : subtasks;
}

function parseSections(raw: unknown): ListSection[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  return raw.flatMap((s: unknown) => {
    if (!s || typeof s !== "object") return [];
    const sec = s as Record<string, unknown>;
    const id = asString(sec.id);
    const name = asString(sec.name).trim();
    if (!id || !name || seen.has(id)) return [];
    seen.add(id);
    return [sec.collapsed === true ? { id, name, collapsed: true } : { id, name }];
  });
}

export function parseItem(raw: unknown, now: number): Item | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const kind = r.kind === "note" ? "note" : r.kind === "task" ? "task" : null;
  if (!kind) return null;
  if (kind === "task" && (typeof r.title !== "string" || !r.title.trim())) return null;
  if (kind === "note" && typeof r.title !== "string" && typeof r.body !== "string") return null;
  return {
    id: asString(r.id) || createId(),
    kind,
    title: asString(r.title),
    body: asString(r.body),
    listId: asString(r.listId) || INBOX_ID,
    createdAt: asTime(r.createdAt, now),
    updatedAt: asTime(r.updatedAt, now),
    deletedAt: typeof r.deletedAt === "number" ? r.deletedAt : null,
    pinned: r.pinned === true,
    status: STATUSES.includes(r.status as TaskStatus) ? (r.status as TaskStatus) : "open",
    completedAt: typeof r.completedAt === "number" ? r.completedAt : null,
    priority: PRIORITIES.includes(r.priority as Priority) ? (r.priority as Priority) : "none",
    due: asDue(r.due),
    subtasks: parseSubtasks(r.subtasks),
    sectionId: asString(r.sectionId) || null,
    ...optionalItemFields(r),
  };
}

/** Optional item fields are only written when set, so older records and backups stay unchanged. */
function optionalItemFields(r: Record<string, unknown>): Partial<Item> {
  const fields: Partial<Item> = {};
  const dueTime = asDue(r.due) ? asClock(r.dueTime) : null;
  if (dueTime) fields.dueTime = dueTime;
  const due = asDue(r.due);
  const startDate = asDue(r.startDate);
  if (due && startDate && startDate <= due) fields.startDate = startDate;
  const estimate = asMinutes(r.estimate);
  if (estimate) fields.estimate = estimate;
  const timeEntries = parseTimeEntries(r.timeEntries);
  if (timeEntries.length) fields.timeEntries = timeEntries;
  const outcome = r.status === "done" ? parseOutcome(r.outcome, Date.now()) : null;
  if (outcome) fields.outcome = outcome;
  if (isEnergy(r.energy)) fields.energy = r.energy;
  if (r.template === true && r.kind === "task") fields.template = true;
  const reminders = parseReminders(r.reminders);
  if (reminders.length) fields.reminders = reminders;
  if (r.constantReminder === true) fields.constantReminder = true;
  const repeat = r.kind === "task" ? parseRepeat(r.repeat) : null;
  if (repeat) fields.repeat = repeat;
  const dailyNote = r.kind === "note" ? asDue(r.dailyNote) : null;
  if (dailyNote) fields.dailyNote = dailyNote;
  const order = asOrder(r.order);
  if (order !== null) fields.order = order;
  if (typeof r.snoozedUntil === "number" && Number.isFinite(r.snoozedUntil) && r.snoozedUntil > 0) {
    fields.snoozedUntil = r.snoozedUntil;
  }
  return fields;
}

export function parseList(raw: unknown, now: number): TaskList | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const name = asString(r.name).trim();
  if (!name || !asString(r.id)) return null;
  const order = asOrder(r.order);
  return {
    id: asString(r.id),
    name,
    sections: parseSections(r.sections),
    folderId: asString(r.folderId) || null,
    ...(order !== null ? { order } : {}),
    createdAt: asTime(r.createdAt, now),
    updatedAt: asTime(r.updatedAt, asTime(r.createdAt, now)),
    // Only written while archived, so older records stay unchanged.
    ...(typeof r.archivedAt === "number" && Number.isFinite(r.archivedAt) && r.archivedAt > 0
      ? { archivedAt: r.archivedAt }
      : {}),
  };
}

export function parseFolder(raw: unknown, now: number): Folder | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const name = asString(r.name).trim();
  if (!name || !asString(r.id)) return null;
  return {
    id: asString(r.id),
    name,
    createdAt: asTime(r.createdAt, now),
    updatedAt: asTime(r.updatedAt, asTime(r.createdAt, now)),
  };
}

export function parseFilter(raw: unknown, now: number): SavedFilter | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const name = cleanFilterName(asString(r.name));
  if (!name || !asString(r.id)) return null;
  return {
    id: asString(r.id),
    name,
    criteria: parseFilterCriteria(r.criteria),
    createdAt: asTime(r.createdAt, now),
    updatedAt: asTime(r.updatedAt, asTime(r.createdAt, now)),
  };
}

export function parseHabit(raw: unknown, now: number): Habit | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const name = cleanHabitName(asString(r.name));
  if (!name || !asString(r.id)) return null;
  const habit: Habit = {
    id: asString(r.id),
    name,
    goal: parseGoal(r.goal),
    checkins: cleanCheckins(r.checkins),
    createdAt: asTime(r.createdAt, now),
    updatedAt: asTime(r.updatedAt, asTime(r.createdAt, now)),
  };
  if (typeof r.archivedAt === "number" && Number.isFinite(r.archivedAt))
    habit.archivedAt = r.archivedAt;
  return habit;
}

export function parseCountdown(raw: unknown, now: number): Countdown | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const name = asString(r.name).trim().replace(/\s+/g, " ").slice(0, 80);
  const date = asDue(r.date);
  if (!name || !date || !asString(r.id)) return null;
  return {
    id: asString(r.id),
    name,
    date,
    createdAt: asTime(r.createdAt, now),
    updatedAt: asTime(r.updatedAt, asTime(r.createdAt, now)),
  };
}

function parseArray<T>(raw: unknown, parse: (value: unknown) => T | null): T[] {
  return Array.isArray(raw) ? raw.flatMap((value) => parse(value) ?? []) : [];
}

export type BackupData = {
  items: Item[];
  lists: TaskList[];
  folders: Folder[];
  filters: SavedFilter[];
  habits: Habit[];
  countdowns: Countdown[];
  /** The synced preferences record (at most one). */
  settings: Preferences[];
};

export function createBackup(data: BackupData, now = Date.now()): Backup {
  return { app: "notesflow", version: 2, exportedAt: now, ...data };
}

/**
 * Parses and sanitises a backup file (current format, or the older notes+tasks format).
 * Throws an Error with a readable message when the file is not usable.
 */
export function parseBackup(text: string, now = Date.now()): BackupData {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("That file is not valid JSON.");
  }
  if (!data || typeof data !== "object" || (data as { app?: unknown }).app !== "notesflow") {
    throw new Error("That file is not a Notesflow backup.");
  }
  const record = data as Record<string, unknown>;

  if (record.version === 2) {
    return {
      items: parseArray(record.items, (v) => parseItem(v, now)),
      lists: parseArray(record.lists, (v) => parseList(v, now)),
      folders: parseArray(record.folders, (v) => parseFolder(v, now)),
      // Backups made before saved filters existed have none.
      filters: parseArray(record.filters, (v) => parseFilter(v, now)),
      habits: parseArray(record.habits, (v) => parseHabit(v, now)),
      countdowns: parseArray(record.countdowns, (v) => parseCountdown(v, now)),
      settings: parseArray(record.settings, (v) => parsePreferences(v, now)),
    };
  }

  // Original format: separate notes and tasks.
  const legacyNotes = parseArray(record.notes, (raw) => {
    if (!raw || typeof raw !== "object") return null;
    const r = raw as Record<string, unknown>;
    if (typeof r.body !== "string" && typeof r.title !== "string") return null;
    return {
      id: asString(r.id) || createId(),
      title: asString(r.title),
      body: asString(r.body),
      createdAt: asTime(r.createdAt, now),
      updatedAt: asTime(r.updatedAt, now),
      pinned: r.pinned === true,
      archived: r.archived === true,
      deletedAt: typeof r.deletedAt === "number" ? r.deletedAt : null,
    } satisfies LegacyNote;
  });
  const legacyTasks = parseArray(record.tasks, (raw) => {
    if (!raw || typeof raw !== "object") return null;
    const r = raw as Record<string, unknown>;
    if (typeof r.title !== "string" || !r.title.trim()) return null;
    return {
      id: asString(r.id) || createId(),
      title: r.title,
      details: asString(r.details),
      done: r.done === true,
      priority: PRIORITIES.includes(r.priority as Priority) ? (r.priority as Priority) : "none",
      due: asDue(r.due),
      createdAt: asTime(r.createdAt, now),
      completedAt: typeof r.completedAt === "number" ? r.completedAt : null,
      subtasks: parseSubtasks(r.subtasks),
    } satisfies LegacyTask;
  });
  const { items, lists } = migrateLegacyData(legacyNotes, legacyTasks, now);
  return { items, lists, folders: [], filters: [], habits: [], countdowns: [], settings: [] };
}
