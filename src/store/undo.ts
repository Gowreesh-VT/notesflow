import { create } from "zustand";
import { diffItems, isEmptySnapshot, type UndoSnapshot } from "@/lib/undo";
import { useWorkspace } from "./workspace";

interface UndoState {
  /** The most recent action that can be taken back; null when there is nothing to offer. */
  offer: { id: number; message: string; snapshot: UndoSnapshot } | null;
  show: (message: string, snapshot: UndoSnapshot) => void;
  dismiss: () => void;
  undo: () => void;
}

let nextId = 1;

export const useUndo = create<UndoState>((set, get) => ({
  offer: null,
  show: (message, snapshot) => set({ offer: { id: nextId++, message, snapshot } }),
  dismiss: () => set({ offer: null }),
  undo: () => {
    const { offer } = get();
    if (!offer) return;
    useWorkspace.getState().undoItems(offer.snapshot);
    set({ offer: null });
  },
}));

/**
 * Runs an action on the workspace and offers to take it back in a short message. Only items the action changed or
 * created are restored, so edits made elsewhere in the meantime are left alone.
 */
export function withUndo<T>(message: string | ((result: T) => string), action: () => T): T {
  const before = useWorkspace.getState().items;
  const result = action();
  const snapshot = diffItems(before, useWorkspace.getState().items);
  if (!isEmptySnapshot(snapshot)) {
    useUndo.getState().show(typeof message === "function" ? message(result) : message, snapshot);
  }
  return result;
}

/** Completes or reopens a task, offering to take it back. Returns the finished copy's id like `toggleDone`. */
export const toggleDoneWithUndo = (id: string): string | null =>
  withUndo(
    (finishedId) => (finishedId ? "Task completed" : "Task reopened"),
    () => useWorkspace.getState().toggleDone(id),
  );

export const trashWithUndo = (id: string): void =>
  withUndo("Moved to the trash", () => useWorkspace.getState().trashItem(id));
