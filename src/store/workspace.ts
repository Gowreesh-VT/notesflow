import { create } from "zustand";
import { persist } from "zustand/middleware";
import { moveSectionBy } from "@/lib/items-logic";
import { migrateLegacyData, type LegacyNote, type LegacyTask } from "@/lib/migrate";
import {
  INBOX_ID,
  type Folder,
  type Item,
  type ItemKind,
  type Priority,
  type TaskList,
  type TaskStatus,
  type Tombstone,
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

type ItemPatch = Partial<
  Pick<Item, "title" | "body" | "listId" | "priority" | "due" | "sectionId">
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
            return touch(item, { ...patch, sectionId });
          }),
        })),

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
        if (!source) return null;
        const newId = get().addItem({
          kind: source.kind,
          title: source.title ? `${source.title} (copy)` : "",
          body: source.body,
          listId: source.listId,
          priority: source.priority,
          due: source.due,
        });
        set((s) => ({
          items: mapItem(s.items, newId, (item) => ({
            ...item,
            sectionId: source.sectionId,
            subtasks: source.subtasks.map((st) => ({ ...st, id: createId(), done: false })),
          })),
        }));
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
