import { create } from "zustand";
import { persist } from "zustand/middleware";
import { migrateLegacyData, type LegacyNote, type LegacyTask } from "@/lib/migrate";
import {
  INBOX_ID,
  type Folder,
  type Item,
  type ItemKind,
  type Priority,
  type TaskList,
  type TaskStatus,
} from "@/lib/types";
import { createId } from "@/lib/utils";

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
};

type ItemPatch = Partial<Pick<Item, "title" | "body" | "listId" | "priority" | "due">>;

type WorkspaceState = {
  items: Item[];
  lists: TaskList[];
  folders: Folder[];

  addItem: (input: NewItem) => string;
  updateItem: (id: string, patch: ItemPatch) => void;
  setStatus: (id: string, status: TaskStatus) => void;
  toggleDone: (id: string) => void;
  togglePin: (id: string) => void;
  trashItem: (id: string) => void;
  restoreItem: (id: string) => void;
  deleteForever: (id: string) => void;
  emptyTrash: () => void;
  duplicateItem: (id: string) => string | null;

  addSubtask: (itemId: string, title: string) => void;
  toggleSubtask: (itemId: string, subtaskId: string) => void;
  deleteSubtask: (itemId: string, subtaskId: string) => void;

  addList: (name: string, folderId?: string | null) => string | null;
  renameList: (id: string, name: string) => void;
  moveList: (id: string, folderId: string | null) => void;
  deleteList: (id: string) => void;
  addFolder: (name: string) => string | null;
  renameFolder: (id: string, name: string) => void;
  deleteFolder: (id: string) => void;

  mergeData: (incoming: { items: Item[]; lists: TaskList[]; folders: Folder[] }) => {
    items: number;
    lists: number;
  };
};

const mapItem = (items: Item[], id: string, fn: (item: Item) => Item): Item[] =>
  items.map((item) => (item.id === id ? fn(item) : item));

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

      addItem: ({
        kind,
        title = "",
        body = "",
        listId = INBOX_ID,
        priority = "none",
        due = null,
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
          subtasks: [],
        };
        set((s) => ({ items: [item, ...s.items] }));
        return item.id;
      },

      updateItem: (id, patch) =>
        set((s) => ({ items: mapItem(s.items, id, (item) => touch(item, patch)) })),

      setStatus: (id, status) =>
        set((s) => ({
          items: mapItem(s.items, id, (item) =>
            touch(item, { status, completedAt: status === "open" ? null : Date.now() }),
          ),
        })),

      toggleDone: (id) => {
        const item = get().items.find((i) => i.id === id);
        if (item) get().setStatus(id, item.status === "open" ? "done" : "open");
      },

      togglePin: (id) =>
        set((s) => ({
          items: mapItem(s.items, id, (item) => touch(item, { pinned: !item.pinned })),
        })),

      trashItem: (id) =>
        set((s) => ({
          items: mapItem(s.items, id, (item) =>
            touch(item, { deletedAt: Date.now(), pinned: false }),
          ),
        })),

      restoreItem: (id) =>
        set((s) => ({ items: mapItem(s.items, id, (item) => touch(item, { deletedAt: null })) })),

      deleteForever: (id) => set((s) => ({ items: s.items.filter((item) => item.id !== id) })),

      emptyTrash: () => set((s) => ({ items: s.items.filter((item) => item.deletedAt === null) })),

      duplicateItem: (id) => {
        const source = get().items.find((item) => item.id === id);
        if (!source) return null;
        const newId = get().addItem({
          kind: source.kind,
          title: source.title ? `${source.title} (copy)` : "",
          body: source.body,
          listId: source.listId,
          priority: source.priority,
          due: source.due,
        });
        if (source.subtasks.length) {
          set((s) => ({
            items: mapItem(s.items, newId, (item) => ({
              ...item,
              subtasks: source.subtasks.map((st) => ({ ...st, id: createId(), done: false })),
            })),
          }));
        }
        return newId;
      },

      addSubtask: (itemId, title) => {
        const trimmed = title.trim();
        if (!trimmed) return;
        set((s) => ({
          items: mapItem(s.items, itemId, (item) =>
            touch(item, {
              subtasks: [...item.subtasks, { id: createId(), title: trimmed, done: false }],
            }),
          ),
        }));
      },

      toggleSubtask: (itemId, subtaskId) =>
        set((s) => ({
          items: mapItem(s.items, itemId, (item) =>
            touch(item, {
              subtasks: item.subtasks.map((st) =>
                st.id === subtaskId ? { ...st, done: !st.done } : st,
              ),
            }),
          ),
        })),

      deleteSubtask: (itemId, subtaskId) =>
        set((s) => ({
          items: mapItem(s.items, itemId, (item) =>
            touch(item, { subtasks: item.subtasks.filter((st) => st.id !== subtaskId) }),
          ),
        })),

      addList: (name, folderId = null) => {
        const trimmed = name.trim();
        if (!trimmed) return null;
        const list: TaskList = { id: createId(), name: trimmed, folderId, createdAt: Date.now() };
        set((s) => ({ lists: [...s.lists, list] }));
        return list.id;
      },

      renameList: (id, name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        set((s) => ({ lists: s.lists.map((l) => (l.id === id ? { ...l, name: trimmed } : l)) }));
      },

      moveList: (id, folderId) =>
        set((s) => ({ lists: s.lists.map((l) => (l.id === id ? { ...l, folderId } : l)) })),

      // Items in a deleted list are kept and moved to the Inbox.
      deleteList: (id) =>
        set((s) => ({
          lists: s.lists.filter((l) => l.id !== id),
          items: s.items.map((item) => (item.listId === id ? { ...item, listId: INBOX_ID } : item)),
        })),

      addFolder: (name) => {
        const trimmed = name.trim();
        if (!trimmed) return null;
        const folder: Folder = { id: createId(), name: trimmed, createdAt: Date.now() };
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
        set((s) => ({
          folders: s.folders.filter((f) => f.id !== id),
          lists: s.lists.map((l) => (l.folderId === id ? { ...l, folderId: null } : l)),
        })),

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
    }),
    {
      name: WORKSPACE_KEY,
      version: 1,
      skipHydration: true,
      partialize: (s) => ({ items: s.items, lists: s.lists, folders: s.folders }),
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
    JSON.stringify({ state: { items, lists, folders: [] }, version: 1 }),
  );
  return true;
}
