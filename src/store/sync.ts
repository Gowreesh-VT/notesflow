import { create } from "zustand";
import { persist } from "zustand/middleware";

export type SyncStatus = "idle" | "syncing" | "synced" | "offline" | "error";

type SyncStore = {
  /** The account this device's data is synced with (so a different account never inherits it). */
  userId: string | null;
  cursor: number;
  lastPushAt: number;
  status: SyncStatus;
  lastSyncedAt: number | null;
  error: string | null;
  /** Records where this device and another both changed something; the newest change was kept. */
  conflictsResolved: number;
  conflictsAt: number | null;
  reset: () => void;
};

export const useSyncStore = create<SyncStore>()(
  persist(
    (set) => ({
      userId: null,
      cursor: 0,
      lastPushAt: 0,
      status: "idle",
      lastSyncedAt: null,
      error: null,
      conflictsResolved: 0,
      conflictsAt: null,
      reset: () =>
        set({
          userId: null,
          cursor: 0,
          lastPushAt: 0,
          status: "idle",
          lastSyncedAt: null,
          error: null,
          conflictsResolved: 0,
          conflictsAt: null,
        }),
    }),
    {
      name: "notesflow:sync",
      version: 1,
      skipHydration: true,
      partialize: (s) => ({ userId: s.userId, cursor: s.cursor, lastPushAt: s.lastPushAt }),
    },
  ),
);
