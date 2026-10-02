import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Note } from "@/lib/types";
import { createId } from "@/lib/utils";

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
        set((s) => ({ notes: s.notes.map((n) => (n.id === id ? touch(n, patch) : n)) })),

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
