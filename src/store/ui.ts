import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { NoteFilter, NoteSort, TaskFilter } from "@/lib/types";

export type Theme = "system" | "light" | "dark";
export type EditorMode = "edit" | "split" | "preview";
export type Section = "notes" | "tasks";

type UiState = {
  theme: Theme;
  editorMode: EditorMode;
  noteSort: NoteSort;
  section: Section;
  noteFilter: NoteFilter;
  taskFilter: TaskFilter;
  query: string;
  selectedNoteId: string | null;
  paletteOpen: boolean;
  sidebarOpen: boolean;
  setTheme: (theme: Theme) => void;
  setEditorMode: (mode: EditorMode) => void;
  setNoteSort: (sort: NoteSort) => void;
  setSection: (section: Section) => void;
  setNoteFilter: (filter: NoteFilter) => void;
  setTaskFilter: (filter: TaskFilter) => void;
  setQuery: (query: string) => void;
  selectNote: (id: string | null) => void;
  setPaletteOpen: (open: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
};

export const useUi = create<UiState>()(
  persist(
    (set) => ({
      theme: "system",
      editorMode: "split",
      noteSort: "updated",
      section: "notes",
      noteFilter: { kind: "all" },
      taskFilter: "inbox",
      query: "",
      selectedNoteId: null,
      paletteOpen: false,
      sidebarOpen: false,
      setTheme: (theme) => set({ theme }),
      setEditorMode: (editorMode) => set({ editorMode }),
      setNoteSort: (noteSort) => set({ noteSort }),
      setSection: (section) => set({ section, query: "", sidebarOpen: false }),
      setNoteFilter: (noteFilter) =>
        set({ noteFilter, section: "notes", selectedNoteId: null, query: "", sidebarOpen: false }),
      setTaskFilter: (taskFilter) =>
        set({ taskFilter, section: "tasks", query: "", sidebarOpen: false }),
      setQuery: (query) => set({ query }),
      selectNote: (selectedNoteId) => set({ selectedNoteId }),
      setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
    }),
    {
      name: "notesflow:ui",
      version: 1,
      skipHydration: true,
      partialize: (s) => ({ theme: s.theme, editorMode: s.editorMode, noteSort: s.noteSort }),
    },
  ),
);
