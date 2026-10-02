import type { Backup, Note, Priority, Task } from "./types";
import { createId } from "./utils";

const PRIORITIES: Priority[] = ["none", "low", "medium", "high"];

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asTime(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function parseNote(raw: unknown, now: number): Note | null {
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
  };
}

function parseTask(raw: unknown, now: number): Task | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.title !== "string" || !r.title.trim()) return null;
  const subtasks = Array.isArray(r.subtasks)
    ? r.subtasks.flatMap((s: unknown) => {
        if (!s || typeof s !== "object") return [];
        const sub = s as Record<string, unknown>;
        if (typeof sub.title !== "string") return [];
        return [{ id: asString(sub.id) || createId(), title: sub.title, done: sub.done === true }];
      })
    : [];
  return {
    id: asString(r.id) || createId(),
    title: r.title,
    details: asString(r.details),
    done: r.done === true,
    priority: PRIORITIES.includes(r.priority as Priority) ? (r.priority as Priority) : "none",
    due: typeof r.due === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.due) ? r.due : null,
    createdAt: asTime(r.createdAt, now),
    completedAt: typeof r.completedAt === "number" ? r.completedAt : null,
    subtasks,
  };
}

export function createBackup(notes: Note[], tasks: Task[], now = Date.now()): Backup {
  return { app: "notesflow", version: 1, exportedAt: now, notes, tasks };
}

/** Parses and sanitises a backup file. Throws an Error with a readable message when invalid. */
export function parseBackup(text: string, now = Date.now()): { notes: Note[]; tasks: Task[] } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("That file is not valid JSON.");
  }
  if (!data || typeof data !== "object" || (data as Backup).app !== "notesflow") {
    throw new Error("That file is not a Notesflow backup.");
  }
  const { notes, tasks } = data as Record<string, unknown>;
  return {
    notes: Array.isArray(notes) ? notes.flatMap((n) => parseNote(n, now) ?? []) : [],
    tasks: Array.isArray(tasks) ? tasks.flatMap((t) => parseTask(t, now) ?? []) : [],
  };
}
