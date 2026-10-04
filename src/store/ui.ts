import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ItemSort, View } from "@/lib/types";

export type Theme = "system" | "light" | "dark";
export type EditorMode = "edit" | "split" | "preview";

const INBOX_VIEW: View = { kind: "smart", id: "inbox" };

type UiState = {
  theme: Theme;
  editorMode: EditorMode;
  sort: ItemSort;
  view: View;
  query: string;
  selectedItemId: string | null;
  paletteOpen: boolean;
  helpOpen: boolean;
  sidebarOpen: boolean;
  /** Desktop only: hides the lists sidebar to give the task list more room. */
  sidebarCollapsed: boolean;
  setTheme: (theme: Theme) => void;
  setEditorMode: (mode: EditorMode) => void;
  setSort: (sort: ItemSort) => void;
  setView: (view: View) => void;
  setQuery: (query: string) => void;
  selectItem: (id: string | null) => void;
  setPaletteOpen: (open: boolean) => void;
  setHelpOpen: (open: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebarCollapsed: () => void;
};

export const useUi = create<UiState>()(
  persist(
    (set) => ({
      theme: "system",
      editorMode: "split",
      sort: "default",
      view: INBOX_VIEW,
      query: "",
      selectedItemId: null,
      paletteOpen: false,
      helpOpen: false,
      sidebarOpen: false,
      sidebarCollapsed: false,
      setTheme: (theme) => set({ theme }),
      setEditorMode: (editorMode) => set({ editorMode }),
      setSort: (sort) => set({ sort }),
      setView: (view) => set({ view, query: "", selectedItemId: null, sidebarOpen: false }),
      setQuery: (query) => set({ query }),
      selectItem: (selectedItemId) => set({ selectedItemId }),
      setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
      setHelpOpen: (helpOpen) => set({ helpOpen }),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      toggleSidebarCollapsed: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
    }),
    {
      name: "notesflow:ui",
      version: 2,
      skipHydration: true,
      partialize: (s) => ({
        theme: s.theme,
        editorMode: s.editorMode,
        sort: s.sort,
        sidebarCollapsed: s.sidebarCollapsed,
      }),
      // v1 stored a different sort field; only theme and editor mode carry over.
      migrate: (persisted) => {
        const old = (persisted ?? {}) as { theme?: Theme; editorMode?: EditorMode };
        return {
          theme: old.theme ?? "system",
          editorMode: old.editorMode ?? "split",
          sort: "default",
        };
      },
    },
  ),
);
