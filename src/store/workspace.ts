import { create } from "zustand";
import { persist } from "zustand/middleware";
import { moveSectionBy } from "@/lib/items-logic";
import {
  cloneSubtasks,
  findSubtask,
  MAX_SUBTASK_DEPTH,
  rollUp,
  setDoneDeep,
  subtreeHeight,
  updateSubtask,
} from "@/lib/subtasks";
import {
  manualEntry,
  MAX_TIME_ENTRIES,
  runningEntry,
  startEntry,
  stopEntries,
} from "@/lib/time-tracking";
import { makeOutcome } from "@/lib/outcomes";
import { nextDueDate } from "@/lib/recurrence";
import { makeReminder, MAX_REMINDERS, parseReminders } from "@/lib/reminders";
import { renameTagInText } from "@/lib/tags";
import { migrateLegacyData, type LegacyNote, type LegacyTask } from "@/lib/migrate";
import {
  INBOX_ID,
  type Folder,
  type Item,
  type ItemKind,
  type Priority,
  type Subtask,
  type TaskList,
  type TaskStatus,
  type Tombstone,
} from "@/lib/types";
import { addDays, createId, daysBetween, toDateKey } from "@/lib/utils";

export const WORKSPACE_KEY = "notesflow:workspace";
const LEGACY_NOTES_KEY = "notesflow:notes";
const LEGACY_TASKS_KEY = "notesflow:tasks";

type NewItem = {
  kind: ItemKind;
  title?: string;
  body?: string;
  listId?: string;
  priority?: Priority;
  due?: string | null;
  dueTime?: string | null;
  estimate?: number | null;
};

type ItemPatch = Partial<
  Pick<
    Item,
    | "title"
    | "body"
    | "listId"
    | "priority"
    | "due"
    | "dueTime"
    | "startDate"
    | "estimate"
    | "energy"
    | "constantReminder"
    | "repeat"
    | "sectionId"
  >
>;

export type WorkspaceData = {
  items: Item[];
  lists: TaskList[];
  folders: Folder[];
  tombstones: Tombstone[];
};

type WorkspaceState = WorkspaceData & {
  addItem: (input: NewItem) => string;
  updateItem: (id: string, patch: ItemPatch) => void;
  /**
   * Sets a task's status. Finishing a repeating task logs a finished copy and moves the task itself to its next
   * due date. Returns the id of the item that is now finished (the copy for repeating tasks), or null.
   */
  setStatus: (id: string, status: TaskStatus) => string | null;
  toggleDone: (id: string) => string | null;
  togglePin: (id: string) => void;
  trashItem: (id: string) => void;
  restoreItem: (id: string) => void;
  deleteForever: (id: string) => void;
  emptyTrash: () => void;
  duplicateItem: (id: string) => string | null;
  /**
   * Copies an item into a list, with fresh, unchecked subtasks. A copy in the same list gets a "(copy)" title
   * and keeps its section; returns the new item id.
   */
  copyItem: (id: string, listId: string) => string | null;

  /** Adds a subtask under the task, or under another subtask when `parentId` is given (up to 5 levels). */
  addSubtask: (itemId: string, title: string, parentId?: string | null) => string | null;
  renameSubtask: (itemId: string, subtaskId: string, title: string) => void;
  /** Starts the timer on a task, stopping any timer running on another task. */
  /** Saves a copy of a task (with fresh, unchecked subtasks) as a template; returns the template id. */
  saveAsTemplate: (itemId: string) => string | null;
  /** Creates a new open task from a template in the given list; returns the new task id. */
  createFromTemplate: (templateId: string, listId: string, due?: string | null) => string | null;
  deleteTemplate: (templateId: string) => void;
  /** Adds a reminder `before` minutes ahead of the due moment (ignored if it already exists or five are set). */
  addReminder: (itemId: string, before: number) => void;
  removeReminder: (itemId: string, reminderId: string) => void;
  /** Silences a task's reminders until `until`; null clears the snooze. */
  snooze: (itemId: string, until: number | null) => void;
  /** Tags a finished task with how it went; a null or blank label clears it. */
  setOutcome: (itemId: string, label: string | null, note?: string) => void;
  startTimer: (itemId: string) => void;
  stopTimer: (itemId: string) => void;
  addTimeEntry: (itemId: string, minutes: number) => void;
  deleteTimeEntry: (itemId: string, entryId: string) => void;
  /** Turns a subtask (with its own subtasks) into a task in the same list; returns the new task id. */
  subtaskToTask: (itemId: string, subtaskId: string) => string | null;
  /**
   * Moves a task, with its subtasks, under another task (or one of its subtasks). The original task is deleted.
   * Returns false when the target is missing or the result would be deeper than five levels.
   */
  taskToSubtask: (taskId: string, targetId: string, parentSubtaskId?: string | null) => boolean;
  toggleSubtask: (itemId: string, subtaskId: string) => void;
  deleteSubtask: (itemId: string, subtaskId: string) => void;

  /**
   * Renames the tag `from` to `to` in every item (not templates); renaming to an existing tag merges them, and
   * a null name removes the tag but keeps the word. Returns how many items changed.
   */
  renameTag: (from: string, to: string | null) => number;

  addList: (name: string, folderId?: string | null) => string | null;
  renameList: (id: string, name: string) => void;
  moveList: (id: string, folderId: string | null) => void;
  deleteList: (id: string) => void;
  addSection: (listId: string, name: string) => string | null;
  renameSection: (listId: string, sectionId: string, name: string) => void;
  /** Items in a deleted section stay in the list, unsectioned. */
  deleteSection: (listId: string, sectionId: string) => void;
  moveSection: (listId: string, sectionId: string, delta: -1 | 1) => void;
  toggleSectionCollapsed: (listId: string, sectionId: string) => void;
  addFolder: (name: string) => string | null;
  renameFolder: (id: string, name: string) => void;
  deleteFolder: (id: string) => void;

  mergeData: (incoming: { items: Item[]; lists: TaskList[]; folders: Folder[] }) => {
    items: number;
    lists: number;
  };

  /** Replaces the synced collections (used by sync and when signing out). */
  setData: (data: Partial<WorkspaceData>) => void;
  /** Forgets tombstones the server has acknowledged. */
  dropTombstones: (acknowledged: Tombstone[]) => void;
};

const mapItem = (items: Item[], id: string, fn: (item: Item) => Item): Item[] =>
  items.map((item) => (item.id === id ? fn(item) : item));

/** Optional item fields are removed rather than stored as null, keeping records small and stable. */
const OPTIONAL_FIELDS = [
  "dueTime",
  "startDate",
  "estimate",
  "timeEntries",
  "outcome",
  "energy",
  "reminders",
  "constantReminder",
  "snoozedUntil",
  "repeat",
] as const;

const dropEmptyOptionals = (item: Item): Item => {
  const next = { ...item };
  for (const key of OPTIONAL_FIELDS) {
    const value = next[key];
    if (
      value === null ||
      value === undefined ||
      value === false ||
      (Array.isArray(value) && !value.length)
    ) {
      delete next[key];
    }
  }
  return next;
};

/** The parts of a task that a template keeps: content, priority, estimate, energy and fresh subtasks. */
const templateFields = (source: Item) => ({
  title: source.title,
  body: source.body,
  priority: source.priority,
  subtasks: cloneSubtasks(source.subtasks, true),
  ...(source.estimate ? { estimate: source.estimate } : {}),
  ...(source.energy ? { energy: source.energy } : {}),
  ...copyReminders(source),
  ...(source.repeat ? { repeat: source.repeat } : {}),
});

/** Reminders with fresh ids, for copies of a task. */
function copyReminders(source: Item): Partial<Item> {
  return source.reminders?.length
    ? { reminders: source.reminders.map((r) => makeReminder(r.before)) }
    : {};
}

/** Finishing or trashing a task stops its timer. */
const stopTimerPatch = (item: Item, stop: boolean): Partial<Item> =>
  stop && runningEntry(item) ? { timeEntries: stopEntries(item.timeEntries!, Date.now()) } : {};

const touch = (item: Item, patch: Partial<Item>): Item => ({
  ...item,
  ...patch,
  updatedAt: Date.now(),
});

export const useWorkspace = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      items: [],
      lists: [],
      folders: [],
      tombstones: [],

      addItem: ({
        kind,
        title = "",
        body = "",
        listId = INBOX_ID,
        priority = "none",
        due = null,
        dueTime = null,
        estimate = null,
      }) => {
        const now = Date.now();
        const exists = listId === INBOX_ID || get().lists.some((l) => l.id === listId);
        const item: Item = {
          id: createId(),
          kind,
          title: kind === "task" ? title.trim() : title,
          body,
          listId: exists ? listId : INBOX_ID,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
          pinned: false,
          status: "open",
          completedAt: null,
          priority: kind === "task" ? priority : "none",
          due: kind === "task" ? due : null,
          ...(kind === "task" && due && dueTime ? { dueTime } : {}),
          ...(kind === "task" && estimate ? { estimate } : {}),
          subtasks: [],
          sectionId: null,
        };
        set((s) => ({ items: [item, ...s.items] }));
        return item.id;
      },

      // Moving an item to another list takes it out of its section, unless a section is given.
      updateItem: (id, patch) =>
        set((s) => ({
          items: mapItem(s.items, id, (item) => {
            const moved = patch.listId !== undefined && patch.listId !== item.listId;
            const sections = s.lists.find((l) => l.id === (patch.listId ?? item.listId))?.sections;
            const sectionId =
              patch.sectionId !== undefined
                ? patch.sectionId !== null && sections?.some((x) => x.id === patch.sectionId)
                  ? patch.sectionId
                  : null
                : moved
                  ? null
                  : item.sectionId;
            // A time only makes sense with a date: clearing the date clears the time too.
            const due = patch.due !== undefined ? patch.due : item.due;
            // A start date needs a due date on or after it: moving the start later pushes the due date along,
            // and moving the due date before the start drops the start.
            let startDate = patch.startDate !== undefined ? patch.startDate : item.startDate;
            let nextDue = due;
            if (startDate && nextDue && startDate > nextDue) {
              if (patch.startDate !== undefined) nextDue = startDate;
              else startDate = null;
            }
            return dropEmptyOptionals(
              touch(item, {
                ...patch,
                sectionId,
                due: nextDue,
                startDate: nextDue ? startDate : null,
                ...(nextDue ? {} : { dueTime: null }),
              }),
            );
          }),
        })),

      setStatus: (id, status) => {
        const item = get().items.find((i) => i.id === id);
        if (!item) return null;
        if (status !== "open" && item.status === "open" && item.repeat && item.kind === "task") {
          const now = Date.now();
          const copy: Item = dropEmptyOptionals({
            ...item,
            ...stopTimerPatch(item, true),
            id: createId(),
            status,
            completedAt: now,
            updatedAt: now,
            createdAt: now,
            repeat: null,
            reminders: [],
            constantReminder: false,
            snoozedUntil: null,
            outcome: null,
          });
          const nextDue = nextDueDate(item.due, item.repeat, toDateKey(new Date(now)));
          // A multi-day task keeps its length: the start date moves by as many days as the due date.
          const startDate =
            item.startDate && item.due
              ? addDays(item.startDate, daysBetween(item.due, nextDue))
              : null;
          const next = dropEmptyOptionals(
            touch(item, {
              due: nextDue,
              startDate,
              subtasks: item.subtasks.map((st) => setDoneDeep(st, false)),
              timeEntries: [],
              snoozedUntil: null,
              outcome: null,
            }),
          );
          set((s) => ({ items: [copy, ...s.items.map((i) => (i.id === id ? next : i))] }));
          return copy.id;
        }
        set((s) => ({
          items: mapItem(s.items, id, (current) =>
            dropEmptyOptionals(
              touch(current, {
                status,
                completedAt: status === "open" ? null : Date.now(),
                ...stopTimerPatch(current, status !== "open"),
                // An outcome describes a finished task, so it goes away when the task is reopened or skipped.
                ...(status !== "done" ? { outcome: null } : {}),
                ...(status !== "open" ? { snoozedUntil: null } : {}),
              }),
            ),
          ),
        }));
        return status === "open" ? null : id;
      },

      toggleDone: (id) => {
        const item = get().items.find((i) => i.id === id);
        return item ? get().setStatus(id, item.status === "open" ? "done" : "open") : null;
      },

      togglePin: (id) =>
        set((s) => ({
          items: mapItem(s.items, id, (item) => touch(item, { pinned: !item.pinned })),
        })),

      trashItem: (id) =>
        set((s) => ({
          items: mapItem(s.items, id, (item) =>
            touch(item, { deletedAt: Date.now(), pinned: false, ...stopTimerPatch(item, true) }),
          ),
        })),

      restoreItem: (id) =>
        set((s) => ({ items: mapItem(s.items, id, (item) => touch(item, { deletedAt: null })) })),

      deleteForever: (id) =>
        set((s) => ({
          items: s.items.filter((item) => item.id !== id),
          tombstones: [...s.tombstones, { collection: "item", id, at: Date.now() }],
        })),

      emptyTrash: () =>
        set((s) => {
          const at = Date.now();
          const removed = s.items.filter((item) => item.deletedAt !== null);
          return {
            items: s.items.filter((item) => item.deletedAt === null),
            tombstones: [
              ...s.tombstones,
              ...removed.map((item) => ({ collection: "item" as const, id: item.id, at })),
            ],
          };
        }),

      duplicateItem: (id) => {
        const source = get().items.find((item) => item.id === id);
        return source ? get().copyItem(id, source.listId) : null;
      },

      copyItem: (id, listId) => {
        const source = get().items.find((item) => item.id === id);
        if (!source) return null;
        const sameList = listId === source.listId;
        const newId = get().addItem({
          kind: source.kind,
          title: sameList && source.title ? `${source.title} (copy)` : source.title,
          body: source.body,
          listId,
          priority: source.priority,
          due: source.due,
          dueTime: source.dueTime,
        });
        set((s) => ({
          items: mapItem(s.items, newId, (item) => ({
            ...item,
            sectionId: item.listId === source.listId ? source.sectionId : null,
            ...(source.estimate ? { estimate: source.estimate } : {}),
            ...(source.energy ? { energy: source.energy } : {}),
            ...copyReminders(source),
            ...(source.repeat ? { repeat: source.repeat } : {}),
            subtasks: cloneSubtasks(source.subtasks, true),
          })),
        }));
        return newId;
      },

      addSubtask: (itemId, title, parentId = null) => {
        const trimmed = title.trim();
        const item = get().items.find((i) => i.id === itemId);
        if (!trimmed || !item) return null;
        const node = { id: createId(), title: trimmed, done: false };
        let subtasks: Subtask[];
        if (parentId) {
          const parent = findSubtask(item.subtasks, parentId);
          if (!parent || parent.depth >= MAX_SUBTASK_DEPTH) return null;
          subtasks = updateSubtask(item.subtasks, parentId, (p) => ({
            ...p,
            children: [...(p.children ?? []), node],
          }));
        } else {
          subtasks = [...item.subtasks, node];
        }
        set((s) => ({
          items: mapItem(s.items, itemId, (i) => touch(i, { subtasks: rollUp(subtasks) })),
        }));
        return node.id;
      },

      renameSubtask: (itemId, subtaskId, title) => {
        const trimmed = title.trim();
        if (!trimmed) return;
        set((s) => ({
          items: mapItem(s.items, itemId, (item) =>
            touch(item, {
              subtasks: updateSubtask(item.subtasks, subtaskId, (st) => ({
                ...st,
                title: trimmed,
              })),
            }),
          ),
        }));
      },

      saveAsTemplate: (itemId) => {
        const source = get().items.find((i) => i.id === itemId);
        if (!source || source.kind !== "task") return null;
        const now = Date.now();
        const template: Item = {
          ...templateFields(source),
          id: createId(),
          kind: "task",
          listId: INBOX_ID,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
          pinned: false,
          status: "open",
          completedAt: null,
          due: null,
          sectionId: null,
          template: true,
        };
        set((s) => ({ items: [template, ...s.items] }));
        return template.id;
      },

      createFromTemplate: (templateId, listId, due = null) => {
        const template = get().items.find((i) => i.id === templateId && i.template);
        if (!template) return null;
        const now = Date.now();
        const exists = listId === INBOX_ID || get().lists.some((l) => l.id === listId);
        const task: Item = {
          ...templateFields(template),
          id: createId(),
          kind: "task",
          listId: exists ? listId : INBOX_ID,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
          pinned: false,
          status: "open",
          completedAt: null,
          due,
          sectionId: null,
        };
        set((s) => ({ items: [task, ...s.items] }));
        return task.id;
      },

      deleteTemplate: (templateId) =>
        set((s) => {
          if (!s.items.some((i) => i.id === templateId && i.template)) return s;
          return {
            items: s.items.filter((i) => i.id !== templateId),
            tombstones: [
              ...s.tombstones,
              { collection: "item" as const, id: templateId, at: Date.now() },
            ],
          };
        }),

      addReminder: (itemId, before) =>
        set((s) => ({
          items: mapItem(s.items, itemId, (item) => {
            const current = item.reminders ?? [];
            if (current.some((r) => r.before === before) || current.length >= MAX_REMINDERS)
              return item;
            const reminders = parseReminders([...current, makeReminder(before)]);
            return reminders.length > current.length ? touch(item, { reminders }) : item;
          }),
        })),

      removeReminder: (itemId, reminderId) =>
        set((s) => ({
          items: mapItem(s.items, itemId, (item) =>
            dropEmptyOptionals(
              touch(item, { reminders: (item.reminders ?? []).filter((r) => r.id !== reminderId) }),
            ),
          ),
        })),

      snooze: (itemId, until) =>
        set((s) => ({
          items: mapItem(s.items, itemId, (item) =>
            dropEmptyOptionals(touch(item, { snoozedUntil: until })),
          ),
        })),

      setOutcome: (itemId, label, note = "") =>
        set((s) => ({
          items: mapItem(s.items, itemId, (item) => {
            if (item.kind !== "task" || item.status !== "done") return item;
            const outcome = label ? makeOutcome(label, note, Date.now()) : null;
            return dropEmptyOptionals(touch(item, { outcome }));
          }),
        })),

      startTimer: (itemId) =>
        set((s) => {
          const now = Date.now();
          return {
            items: s.items.map((item) => {
              if (item.id === itemId) {
                if (runningEntry(item)) return item;
                return touch(item, { timeEntries: [...(item.timeEntries ?? []), startEntry(now)] });
              }
              return runningEntry(item)
                ? touch(item, { timeEntries: stopEntries(item.timeEntries!, now) })
                : item;
            }),
          };
        }),

      stopTimer: (itemId) =>
        set((s) => ({
          items: mapItem(s.items, itemId, (item) =>
            runningEntry(item)
              ? touch(item, { timeEntries: stopEntries(item.timeEntries!, Date.now()) })
              : item,
          ),
        })),

      addTimeEntry: (itemId, minutes) => {
        if (!Number.isInteger(minutes) || minutes <= 0) return;
        set((s) => ({
          items: mapItem(s.items, itemId, (item) =>
            touch(item, {
              timeEntries: [...(item.timeEntries ?? []), manualEntry(minutes, Date.now())].slice(
                -MAX_TIME_ENTRIES,
              ),
            }),
          ),
        }));
      },

      deleteTimeEntry: (itemId, entryId) =>
        set((s) => ({
          items: mapItem(s.items, itemId, (item) =>
            dropEmptyOptionals(
              touch(item, {
                timeEntries: (item.timeEntries ?? []).filter((e) => e.id !== entryId),
              }),
            ),
          ),
        })),

      subtaskToTask: (itemId, subtaskId) => {
        const item = get().items.find((i) => i.id === itemId);
        const found = item && findSubtask(item.subtasks, subtaskId);
        if (!item || !found) return null;
        const now = Date.now();
        const task: Item = {
          id: createId(),
          kind: "task",
          title: found.node.title,
          body: "",
          listId: item.listId,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
          pinned: false,
          status: found.node.done ? "done" : "open",
          completedAt: found.node.done ? now : null,
          priority: "none",
          due: null,
          subtasks: found.node.children ?? [],
          sectionId: item.sectionId,
        };
        set((s) => ({
          items: [
            task,
            ...mapItem(s.items, itemId, (i) =>
              touch(i, { subtasks: rollUp(updateSubtask(i.subtasks, subtaskId, () => null)) }),
            ),
          ],
        }));
        return task.id;
      },

      taskToSubtask: (taskId, targetId, parentSubtaskId = null) => {
        const { items } = get();
        const source = items.find((i) => i.id === taskId);
        const target = items.find((i) => i.id === targetId);
        if (!source || !target || source.id === target.id || target.kind !== "task") return false;
        const node: Subtask = {
          id: createId(),
          title: source.title || "Untitled task",
          done: source.status !== "open",
          ...(source.subtasks.length ? { children: source.subtasks } : {}),
        };
        let level = 1;
        if (parentSubtaskId) {
          const parent = findSubtask(target.subtasks, parentSubtaskId);
          if (!parent) return false;
          level = parent.depth + 1;
        }
        if (level - 1 + subtreeHeight(node) > MAX_SUBTASK_DEPTH) return false;
        const subtasks = parentSubtaskId
          ? updateSubtask(target.subtasks, parentSubtaskId, (p) => ({
              ...p,
              children: [...(p.children ?? []), node],
            }))
          : [...target.subtasks, node];
        set((s) => ({
          items: mapItem(
            s.items.filter((i) => i.id !== taskId),
            targetId,
            (i) => touch(i, { subtasks: rollUp(subtasks) }),
          ),
          tombstones: [
            ...s.tombstones,
            { collection: "item" as const, id: taskId, at: Date.now() },
          ],
        }));
        return true;
      },

      // Toggling a subtask also toggles everything below it; parents follow their children.
      toggleSubtask: (itemId, subtaskId) =>
        set((s) => ({
          items: mapItem(s.items, itemId, (item) =>
            touch(item, {
              subtasks: rollUp(
                updateSubtask(item.subtasks, subtaskId, (st) => setDoneDeep(st, !st.done)),
              ),
            }),
          ),
        })),

      deleteSubtask: (itemId, subtaskId) =>
        set((s) => ({
          items: mapItem(s.items, itemId, (item) =>
            touch(item, {
              subtasks: rollUp(updateSubtask(item.subtasks, subtaskId, () => null)),
            }),
          ),
        })),

      renameTag: (from, to) => {
        let changed = 0;
        const now = Date.now();
        const items = get().items.map((item) => {
          if (item.template) return item;
          const title = renameTagInText(item.title, from, to);
          const body = renameTagInText(item.body, from, to);
          if (title === item.title && body === item.body) return item;
          changed++;
          return { ...item, title, body, updatedAt: now };
        });
        if (changed) set({ items });
        return changed;
      },

      addList: (name, folderId = null) => {
        const trimmed = name.trim();
        if (!trimmed) return null;
        const now = Date.now();
        const list: TaskList = {
          id: createId(),
          name: trimmed,
          sections: [],
          folderId,
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({ lists: [...s.lists, list] }));
        return list.id;
      },

      renameList: (id, name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        set((s) => ({
          lists: s.lists.map((l) =>
            l.id === id ? { ...l, name: trimmed, updatedAt: Date.now() } : l,
          ),
        }));
      },

      moveList: (id, folderId) =>
        set((s) => ({
          lists: s.lists.map((l) => (l.id === id ? { ...l, folderId, updatedAt: Date.now() } : l)),
        })),

      // Items in a deleted list are kept and moved to the Inbox.
      deleteList: (id) =>
        set((s) => {
          const now = Date.now();
          return {
            lists: s.lists.filter((l) => l.id !== id),
            items: s.items.map((item) =>
              item.listId === id ? { ...item, listId: INBOX_ID, updatedAt: now } : item,
            ),
            tombstones: [...s.tombstones, { collection: "list" as const, id, at: now }],
          };
        }),

      addSection: (listId, name) => {
        const trimmed = name.trim();
        if (!trimmed || !get().lists.some((l) => l.id === listId)) return null;
        const id = createId();
        set((s) => ({
          lists: s.lists.map((l) =>
            l.id === listId
              ? { ...l, sections: [...l.sections, { id, name: trimmed }], updatedAt: Date.now() }
              : l,
          ),
        }));
        return id;
      },

      renameSection: (listId, sectionId, name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        set((s) => ({
          lists: s.lists.map((l) =>
            l.id === listId
              ? {
                  ...l,
                  sections: l.sections.map((x) =>
                    x.id === sectionId ? { ...x, name: trimmed } : x,
                  ),
                  updatedAt: Date.now(),
                }
              : l,
          ),
        }));
      },

      deleteSection: (listId, sectionId) =>
        set((s) => {
          const now = Date.now();
          return {
            lists: s.lists.map((l) =>
              l.id === listId
                ? { ...l, sections: l.sections.filter((x) => x.id !== sectionId), updatedAt: now }
                : l,
            ),
            items: s.items.map((item) =>
              item.listId === listId && item.sectionId === sectionId
                ? { ...item, sectionId: null, updatedAt: now }
                : item,
            ),
          };
        }),

      toggleSectionCollapsed: (listId, sectionId) =>
        set((s) => ({
          lists: s.lists.map((l) =>
            l.id === listId
              ? {
                  ...l,
                  sections: l.sections.map((x) => {
                    if (x.id !== sectionId) return x;
                    const { collapsed, ...rest } = x;
                    return collapsed ? rest : { ...rest, collapsed: true };
                  }),
                  updatedAt: Date.now(),
                }
              : l,
          ),
        })),

      moveSection: (listId, sectionId, delta) =>
        set((s) => ({
          lists: s.lists.map((l) => {
            const sections = moveSectionBy(l.sections, sectionId, delta);
            return l.id === listId && sections !== l.sections
              ? { ...l, sections, updatedAt: Date.now() }
              : l;
          }),
        })),

      addFolder: (name) => {
        const trimmed = name.trim();
        if (!trimmed) return null;
        const now = Date.now();
        const folder: Folder = { id: createId(), name: trimmed, createdAt: now, updatedAt: now };
        set((s) => ({ folders: [...s.folders, folder] }));
        return folder.id;
      },

      renameFolder: (id, name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        set((s) => ({
          folders: s.folders.map((f) => (f.id === id ? { ...f, name: trimmed } : f)),
        }));
      },

      // Lists in a deleted folder are kept and moved to the top level.
      deleteFolder: (id) =>
        set((s) => {
          const now = Date.now();
          return {
            folders: s.folders.filter((f) => f.id !== id),
            lists: s.lists.map((l) =>
              l.folderId === id ? { ...l, folderId: null, updatedAt: now } : l,
            ),
            tombstones: [...s.tombstones, { collection: "folder" as const, id, at: now }],
          };
        }),

      mergeData: (incoming) => {
        const { items, lists, folders } = get();
        const itemIds = new Set(items.map((i) => i.id));
        const listIds = new Set(lists.map((l) => l.id));
        const folderIds = new Set(folders.map((f) => f.id));
        const newFolders = incoming.folders.filter((f) => !folderIds.has(f.id));
        const newLists = incoming.lists.filter((l) => !listIds.has(l.id));
        const knownLists = new Set([INBOX_ID, ...listIds, ...newLists.map((l) => l.id)]);
        const newItems = incoming.items
          .filter((i) => !itemIds.has(i.id))
          .map((i) => (knownLists.has(i.listId) ? i : { ...i, listId: INBOX_ID }));
        set({
          items: [...newItems, ...items],
          lists: [...lists, ...newLists],
          folders: [...folders, ...newFolders],
        });
        return { items: newItems.length, lists: newLists.length };
      },

      setData: (data) => set(data),

      dropTombstones: (acknowledged) =>
        set((s) => {
          const remaining = s.tombstones.filter(
            (t) =>
              !acknowledged.some(
                (a) => a.collection === t.collection && a.id === t.id && a.at === t.at,
              ),
          );
          return remaining.length === s.tombstones.length ? s : { tombstones: remaining };
        }),
    }),
    {
      name: WORKSPACE_KEY,
      version: 3,
      skipHydration: true,
      partialize: (s) => ({
        items: s.items,
        lists: s.lists,
        folders: s.folders,
        tombstones: s.tombstones,
      }),
      // v1 lists and folders had no updatedAt; v1 had no tombstones; before v3 there were no sections.
      migrate: (persisted) => {
        const old = (persisted ?? {}) as Partial<WorkspaceData>;
        const stamp = <T extends { createdAt: number; updatedAt?: number }>(x: T) => ({
          ...x,
          updatedAt: x.updatedAt ?? x.createdAt,
        });
        return {
          items: (old.items ?? []).map((item) => ({ ...item, sectionId: item.sectionId ?? null })),
          lists: (old.lists ?? []).map(stamp).map((l) => ({ ...l, sections: l.sections ?? [] })),
          folders: (old.folders ?? []).map(stamp),
          tombstones: old.tombstones ?? [],
        };
      },
    },
  ),
);

/**
 * One-time upgrade from the original separate notes/tasks stores. Writes the unified workspace to
 * localStorage (in the persist format) when none exists yet; the old keys are left untouched as a backup.
 * Call before rehydrating the workspace store.
 */
export function upgradeLegacyStorage(storage: Pick<Storage, "getItem" | "setItem">): boolean {
  if (storage.getItem(WORKSPACE_KEY)) return false;

  const read = <T>(key: string, field: string): T[] => {
    try {
      const parsed = JSON.parse(storage.getItem(key) ?? "null");
      const value = parsed?.state?.[field];
      return Array.isArray(value) ? (value as T[]) : [];
    } catch {
      return [];
    }
  };

  const notes = read<LegacyNote>(LEGACY_NOTES_KEY, "notes");
  const tasks = read<LegacyTask>(LEGACY_TASKS_KEY, "tasks");
  if (notes.length === 0 && tasks.length === 0) return false;

  const { items, lists } = migrateLegacyData(notes, tasks);
  storage.setItem(
    WORKSPACE_KEY,
    JSON.stringify({ state: { items, lists, folders: [], tombstones: [] }, version: 3 }),
  );
  return true;
}
