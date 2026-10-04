export const INBOX_ID = "inbox";

export type ItemKind = "task" | "note";
export type TaskStatus = "open" | "done" | "wontdo";
export type Priority = "none" | "low" | "medium" | "high";
/** Energy or effort a task needs: a quick win, focused deep work, or something for a low-energy moment. */
export type Energy = "quick" | "deep" | "low";

export type Subtask = {
  id: string;
  title: string;
  done: boolean;
  /** Nested subtasks, up to MAX_SUBTASK_DEPTH levels; absent when there are none. */
  children?: Subtask[];
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
  /** Local time as HH:MM on the due date; absent or null means all-day. */
  dueTime?: string | null;
  /** First day of a multi-day task (YYYY-MM-DD); only kept while there is a due date on or after it. */
  startDate?: string | null;
  /** Estimated effort in minutes; absent when not set. */
  estimate?: number | null;
  /** Tracked time; at most one entry is running across the whole workspace. */
  timeEntries?: TimeEntry[];
  /** Set when a finished task was tagged with how it went; cleared when the task is reopened. */
  outcome?: Outcome | null;
  energy?: Energy | null;
  /** A reusable task template: hidden from every view and only used to create new tasks. */
  template?: boolean;
  /** Up to five reminders relative to the due date and time. */
  reminders?: Reminder[];
  /** Once a reminder fires, keep repeating it until the task is completed or snoozed. */
  constantReminder?: boolean;
  /** Reminders are silenced until this time, then ring once more; cleared when the task is finished. */
  snoozedUntil?: number | null;
  /** Repeat rule: finishing the task logs a finished copy and moves this task to its next due date. */
  repeat?: Repeat | null;
  subtasks: Subtask[];
  /** Section of the item's list it belongs to, or null for the unsectioned top of the list. */
  sectionId: string | null;
};

export type RepeatUnit = "day" | "week" | "month" | "year";

/** How a task recurs: every `every` units; weekly rules may pick weekdays (0 = Sunday). */
export type Repeat = {
  unit: RepeatUnit;
  every: number;
  weekdays?: number[];
  /** Count the next date from the day it was completed instead of from the due date. */
  afterCompletion?: boolean;
};

/** A reminder `before` minutes ahead of the task's due moment (0 = at the due time). */
export type Reminder = {
  id: string;
  before: number;
};

/** A stretch of time spent on a task. `end` is null while the timer is running. */
export type TimeEntry = {
  id: string;
  start: number;
  end: number | null;
  /** Added by hand rather than with the timer. */
  manual?: boolean;
};

/** How a finished task went: a short label (from the editable choices) and an optional one-line note. */
export type Outcome = {
  label: string;
  note: string;
  at: number;
};

export type ListSection = {
  id: string;
  name: string;
  /** Set only while the section is folded away; absent means expanded. */
  collapsed?: boolean;
};

export type TaskList = {
  id: string;
  name: string;
  /** Ordered sections; they are stored on the list, so they sync with it. */
  sections: ListSection[];
  folderId: string | null;
  createdAt: number;
  updatedAt: number;
};

export type Folder = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
};

export type SyncCollection = "item" | "list" | "folder";

/** Records that something was permanently deleted, so the deletion can reach other devices. */
export type Tombstone = {
  collection: SyncCollection;
  id: string;
  at: number;
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
