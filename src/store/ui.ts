import { create } from "zustand";
import { persist } from "zustand/middleware";
import { isCalendarLayout, isDateKey, type CalendarLayout } from "@/lib/calendar";
import { isGroupBy, type GroupBy } from "@/lib/items-logic";
import { DEFAULT_REMINDER_TIME, isClock, type QuietHours } from "@/lib/reminders";
import type { Energy, ItemSort, View } from "@/lib/types";

// Theme, editor mode and outcome choices are account preferences now (synced; see src/store/preferences.ts).
export type { EditorMode, Theme } from "@/lib/types";

const INBOX_VIEW: View = { kind: "smart", id: "inbox" };

type UiState = {
  sort: ItemSort;
  /** Grouping chosen per view (keyed by `viewKey`); views without a choice use their default grouping. */
  groupBy: Record<string, GroupBy>;
  /** Lists shown as a board (sections as columns) instead of a list, by list id. */
  listLayout: Record<string, "list" | "board">;
  /** A list pinned beside the current view (split view), or null. */
  splitListId: string | null;
  view: View;
  query: string;
  selectedItemId: string | null;
  paletteOpen: boolean;
  helpOpen: boolean;
  sidebarOpen: boolean;
  /** Desktop only: hides the lists sidebar to give the task list more room. */
  sidebarCollapsed: boolean;
  /** Sidebar groups (views, lists, filters, …) folded away on this device. */
  foldedSidebarSections: string[];
  /** Task that was just completed and is waiting for an optional outcome. */
  outcomePromptId: string | null;
  /** Shows only tasks with this energy tag, in every view. */
  energyFilter: Energy | null;
  /** All-day tasks are reminded relative to this time; also used for "tomorrow morning" snoozes. */
  defaultReminderTime: string;
  /** No reminders ring during these hours on this device; they ring when quiet hours end. */
  quietHours: QuietHours | null;
  settingsOpen: boolean;
  calendarLayout: CalendarLayout;
  /** Day the calendar is showing (null = today); not persisted, so the calendar opens on today. */
  calendarDate: string | null;
  /** Calendar also shows completed tasks. */
  calendarShowDone: boolean;
  setSort: (sort: ItemSort) => void;
  setGroupBy: (viewKey: string, groupBy: GroupBy) => void;
  setListLayout: (listId: string, layout: "list" | "board") => void;
  setSplitListId: (listId: string | null) => void;
  setView: (view: View) => void;
  setQuery: (query: string) => void;
  selectItem: (id: string | null) => void;
  setPaletteOpen: (open: boolean) => void;
  setHelpOpen: (open: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebarCollapsed: () => void;
  toggleSidebarSection: (id: string) => void;
  promptOutcome: (id: string | null) => void;
  setEnergyFilter: (energy: Energy | null) => void;
  setDefaultReminderTime: (time: string) => void;
  setQuietHours: (quiet: QuietHours | null) => void;
  setSettingsOpen: (open: boolean) => void;
  setCalendarLayout: (layout: CalendarLayout) => void;
  setCalendarDate: (date: string | null) => void;
  setCalendarShowDone: (show: boolean) => void;
};

export const useUi = create<UiState>()(
  persist(
    (set) => ({
      sort: "default",
      groupBy: {},
      listLayout: {},
      splitListId: null,
      view: INBOX_VIEW,
      query: "",
      selectedItemId: null,
      paletteOpen: false,
      helpOpen: false,
      sidebarOpen: false,
      sidebarCollapsed: false,
      foldedSidebarSections: [],
      outcomePromptId: null,
      energyFilter: null,
      defaultReminderTime: DEFAULT_REMINDER_TIME,
      quietHours: null,
      settingsOpen: false,
      calendarLayout: "month",
      calendarDate: null,
      calendarShowDone: false,
      setSort: (sort) => set({ sort }),
      setListLayout: (listId, layout) =>
        set((s) => ({ listLayout: { ...s.listLayout, [listId]: layout } })),
      setSplitListId: (splitListId) => set({ splitListId }),
      setGroupBy: (viewKey, groupBy) => {
        if (isGroupBy(groupBy)) set((s) => ({ groupBy: { ...s.groupBy, [viewKey]: groupBy } }));
      },
      setView: (view) => set({ view, query: "", selectedItemId: null, sidebarOpen: false }),
      setQuery: (query) => set({ query }),
      selectItem: (selectedItemId) => set({ selectedItemId }),
      setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
      setHelpOpen: (helpOpen) => set({ helpOpen }),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      toggleSidebarCollapsed: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      toggleSidebarSection: (id) =>
        set((s) => ({
          foldedSidebarSections: s.foldedSidebarSections.includes(id)
            ? s.foldedSidebarSections.filter((x) => x !== id)
            : [...s.foldedSidebarSections, id],
        })),
      promptOutcome: (outcomePromptId) => set({ outcomePromptId }),
      setEnergyFilter: (energyFilter) => set({ energyFilter }),
      setDefaultReminderTime: (time) => {
        if (isClock(time)) set({ defaultReminderTime: time });
      },
      setQuietHours: (quiet) => {
        if (!quiet || (isClock(quiet.start) && isClock(quiet.end))) set({ quietHours: quiet });
      },
      setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
      setCalendarLayout: (layout) => {
        if (isCalendarLayout(layout)) set({ calendarLayout: layout });
      },
      setCalendarDate: (date) => {
        if (date === null || isDateKey(date)) set({ calendarDate: date });
      },
      setCalendarShowDone: (calendarShowDone) => set({ calendarShowDone }),
    }),
    {
      name: "notesflow:ui",
      version: 2,
      skipHydration: true,
      partialize: (s) => ({
        sort: s.sort,
        groupBy: s.groupBy,
        listLayout: s.listLayout,
        splitListId: s.splitListId,
        sidebarCollapsed: s.sidebarCollapsed,
        foldedSidebarSections: s.foldedSidebarSections,
        defaultReminderTime: s.defaultReminderTime,
        quietHours: s.quietHours,
        calendarLayout: s.calendarLayout,
        calendarShowDone: s.calendarShowDone,
      }),
      // v1 stored a different sort field; nothing else carries over.
      migrate: () => ({ sort: "default" }),
      // Stored state is read back as-is, so a value that is not a list of ids falls back to nothing folded.
      merge: (persisted, current) => {
        const stored = (persisted ?? {}) as Partial<UiState>;
        const folded = stored.foldedSidebarSections;
        return {
          ...current,
          ...stored,
          foldedSidebarSections:
            Array.isArray(folded) && folded.every((id) => typeof id === "string") ? folded : [],
        };
      },
    },
  ),
);
