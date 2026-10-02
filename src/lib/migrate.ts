import { INBOX_ID, type Item, type Priority, type TaskList } from "./types";

/** Shapes used by Notesflow before lists existed (separate notes and tasks stores). */
export type LegacyNote = {
  id: string;
  title: string;
  body: string;
  createdAt: number;
  updatedAt: number;
  pinned: boolean;
  archived: boolean;
  deletedAt: number | null;
};

export type LegacyTask = {
  id: string;
  title: string;
  details: string;
  done: boolean;
  priority: Priority;
  due: string | null;
  createdAt: number;
  completedAt: number | null;
  subtasks: { id: string; title: string; done: boolean }[];
};

export const LEGACY_ARCHIVE_LIST_ID = "legacy-archive";

/** Converts the old separate stores into the unified model. Nothing is dropped. */
export function migrateLegacyData(
  notes: LegacyNote[],
  tasks: LegacyTask[],
  now = Date.now(),
): { items: Item[]; lists: TaskList[] } {
  const items: Item[] = [];
  let usesArchive = false;

  for (const note of notes) {
    if (note.archived) usesArchive = true;
    items.push({
      id: note.id,
      kind: "note",
      title: note.title,
      body: note.body,
      listId: note.archived ? LEGACY_ARCHIVE_LIST_ID : INBOX_ID,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      deletedAt: note.deletedAt,
      pinned: note.pinned,
      status: "open",
      completedAt: null,
      priority: "none",
      due: null,
      subtasks: [],
    });
  }

  for (const task of tasks) {
    items.push({
      id: task.id,
      kind: "task",
      title: task.title,
      body: task.details,
      listId: INBOX_ID,
      createdAt: task.createdAt,
      updatedAt: task.completedAt ?? task.createdAt,
      deletedAt: null,
      pinned: false,
      status: task.done ? "done" : "open",
      completedAt: task.completedAt,
      priority: task.priority,
      due: task.due,
      subtasks: task.subtasks,
    });
  }

  const lists: TaskList[] = usesArchive
    ? [{ id: LEGACY_ARCHIVE_LIST_ID, name: "Archived", folderId: null, createdAt: now }]
    : [];

  return { items, lists };
}
