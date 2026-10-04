import { create } from "zustand";
import { pruneSelection, selectRange, toggleId } from "@/lib/selection";
import { useUi } from "./ui";

/** Multi-select state for the item list. Lives on this page only: never persisted or synced. */
type SelectionState = {
  /** Selection mode is on: rows show checkboxes and clicking a row toggles it. */
  active: boolean;
  ids: string[];
  /** The row that a shift-click range starts from. */
  anchor: string | null;
  start: () => void;
  /** Leaves selection mode and forgets the selection. */
  exit: () => void;
  toggle: (id: string) => void;
  /** Selects every row between the anchor and `id` in the visible `order`. */
  extend: (order: string[], id: string, fallbackAnchor?: string | null) => void;
  setIds: (ids: string[]) => void;
  /** Drops selected ids that are no longer shown. */
  prune: (present: string[]) => void;
};

export const useSelection = create<SelectionState>()((set) => ({
  active: false,
  ids: [],
  anchor: null,
  start: () => set({ active: true }),
  exit: () => set({ active: false, ids: [], anchor: null }),
  toggle: (id) => set((s) => ({ active: true, ids: toggleId(s.ids, id), anchor: id })),
  extend: (order, id, fallbackAnchor = null) =>
    set((s) => {
      const anchor = s.anchor ?? fallbackAnchor;
      return { active: true, ids: selectRange(s.ids, order, anchor, id), anchor: anchor ?? id };
    }),
  setIds: (ids) => set({ active: true, ids }),
  prune: (present) =>
    set((s) => {
      const ids = pruneSelection(s.ids, present);
      return ids === s.ids
        ? s
        : { ids, anchor: s.anchor && ids.includes(s.anchor) ? s.anchor : null };
    }),
}));

// Switching to another view starts fresh.
useUi.subscribe((state, previous) => {
  if (state.view !== previous.view) useSelection.getState().exit();
});
