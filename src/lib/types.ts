export type Note = {
  id: string;
  title: string;
  body: string;
  createdAt: number;
  updatedAt: number;
  pinned: boolean;
  archived: boolean;
  deletedAt: number | null;
};

export type Priority = "none" | "low" | "medium" | "high";

export type Subtask = {
  id: string;
  title: string;
  done: boolean;
};

export type Task = {
  id: string;
  title: string;
  details: string;
  done: boolean;
  priority: Priority;
  /** Local calendar date as YYYY-MM-DD, or null when there is no due date. */
  due: string | null;
  createdAt: number;
  completedAt: number | null;
  subtasks: Subtask[];
};

export type NoteFilter =
  | { kind: "all" }
  | { kind: "pinned" }
  | { kind: "archive" }
  | { kind: "trash" }
  | { kind: "tag"; tag: string };

export type NoteSort = "updated" | "created" | "title";

export type TaskFilter = "inbox" | "today" | "upcoming" | "completed";

export type Backup = {
  app: "notesflow";
  version: 1;
  exportedAt: number;
  notes: Note[];
  tasks: Task[];
};
