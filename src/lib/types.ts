export const INBOX_ID = "inbox";

export type ItemKind = "task" | "note";
export type TaskStatus = "open" | "done" | "wontdo";
export type Priority = "none" | "low" | "medium" | "high";

export type Subtask = {
  id: string;
  title: string;
  done: boolean;
};

/**
 * Tasks and notes share one shape and live in the same lists. `body` is the Markdown content of a note or the
 * description of a task. Task-only fields (`status`, `priority`, `due`, `subtasks`) are ignored for notes.
 */
export type Item = {
  id: string;
  kind: ItemKind;
  title: string;
  body: string;
  listId: string;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
  pinned: boolean;
  status: TaskStatus;
  completedAt: number | null;
  priority: Priority;
  /** Local calendar date as YYYY-MM-DD, or null when there is no due date. */
  due: string | null;
  subtasks: Subtask[];
};

export type TaskList = {
  id: string;
  name: string;
  folderId: string | null;
  createdAt: number;
};

export type Folder = {
  id: string;
  name: string;
  createdAt: number;
};

export type SmartViewId =
  "inbox" | "today" | "tomorrow" | "week" | "all" | "completed" | "wontdo" | "trash";

export type View =
  { kind: "smart"; id: SmartViewId } | { kind: "list"; id: string } | { kind: "tag"; tag: string };

export type ItemSort = "default" | "due" | "priority" | "title" | "updated";

export type Backup = {
  app: "notesflow";
  version: 2;
  exportedAt: number;
  items: Item[];
  lists: TaskList[];
  folders: Folder[];
};
