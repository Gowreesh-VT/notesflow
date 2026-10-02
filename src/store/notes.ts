import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Note } from "@/lib/types";
import { createId } from "@/lib/utils";
import { renameWikiLinks } from "@/lib/wiki-links";

type NotesState = {
  notes: Note[];
  createNote: (initial?: Partial<Pick<Note, "title" | "body">>) => string;
  updateNote: (id: string, patch: Partial<Pick<Note, "title" | "body">>) => void;
  togglePin: (id: string) => void;
  setArchived: (id: string, archived: boolean) => void;
  trashNote: (id: string) => void;
  restoreNote: (id: string) => void;
  deleteForever: (id: string) => void;
  emptyTrash: () => void;
  duplicateNote: (id: string) => string | null;
  mergeNotes: (incoming: Note[]) => number;
  replaceNotes: (notes: Note[]) => void;
};

const touch = (note: Note, patch: Partial<Note>): Note => ({
  ...note,
  ...patch,
  updatedAt: Date.now(),
});

export const useNotes = create<NotesState>()(
  persist(
    (set, get) => ({
      notes: [],

      createNote: (initial = {}) => {
        const now = Date.now();
        const note: Note = {
          id: createId(),
          title: initial.title ?? "",
          body: initial.body ?? "",
          createdAt: now,
          updatedAt: now,
          pinned: false,
          archived: false,
          deletedAt: null,
        };
        set((s) => ({ notes: [note, ...s.notes] }));
        return note.id;
      },

      updateNote: (id, patch) =>
        set((s) => {
          const before = s.notes.find((n) => n.id === id);
          const renamedFrom =
            before && patch.title !== undefined && patch.title !== before.title
              ? before.title.trim().toLowerCase()
              : "";
          // Links are only rewritten when the old title was unambiguous.
          const rewrite =
            renamedFrom !== "" &&
            s.notes.filter(
              (n) => n.deletedAt === null && n.title.trim().toLowerCase() === renamedFrom,
            ).length === 1;
          return {
            notes: s.notes.map((n) => {
              if (n.id === id) return touch(n, patch);
              if (!rewrite || n.deletedAt !== null) return n;
              const body = renameWikiLinks(n.body, renamedFrom, patch.title ?? "");
              return body === n.body ? n : touch(n, { body });
            }),
          };
        }),

      togglePin: (id) =>
        set((s) => ({
          notes: s.notes.map((n) => (n.id === id ? touch(n, { pinned: !n.pinned }) : n)),
        })),

      setArchived: (id, archived) =>
        set((s) => ({
          notes: s.notes.map((n) =>
            n.id === id ? touch(n, { archived, pinned: archived ? false : n.pinned }) : n,
          ),
        })),

      trashNote: (id) =>
        set((s) => ({
          notes: s.notes.map((n) =>
            n.id === id ? touch(n, { deletedAt: Date.now(), pinned: false }) : n,
          ),
        })),

      restoreNote: (id) =>
        set((s) => ({
          notes: s.notes.map((n) => (n.id === id ? touch(n, { deletedAt: null }) : n)),
        })),

      deleteForever: (id) => set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),

      emptyTrash: () => set((s) => ({ notes: s.notes.filter((n) => n.deletedAt === null) })),

      duplicateNote: (id) => {
        const source = get().notes.find((n) => n.id === id);
        if (!source) return null;
        return get().createNote({
          title: source.title ? `${source.title} (copy)` : "",
          body: source.body,
        });
      },

      mergeNotes: (incoming) => {
        const existing = new Set(get().notes.map((n) => n.id));
        const fresh = incoming.filter((n) => !existing.has(n.id));
        if (fresh.length) set((s) => ({ notes: [...fresh, ...s.notes] }));
        return fresh.length;
      },

      replaceNotes: (notes) => set({ notes }),
    }),
    { name: "notesflow:notes", version: 1, skipHydration: true },
  ),
);
