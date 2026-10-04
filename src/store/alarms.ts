import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Alarm } from "@/lib/alarms";

type AlarmState = {
  /** Reminder keys already shown on this device, with when they fired. */
  fired: Record<string, number>;
  /** Reminders currently shown inside the app. */
  active: Alarm[];
  markFired: (alarms: Alarm[], now: number) => void;
  dismiss: (key: string) => void;
  dismissItem: (itemId: string) => void;
  setFired: (fired: Record<string, number>) => void;
};

/** Device-local reminder state: which reminders fired here and which are on screen. Never synced. */
export const useAlarms = create<AlarmState>()(
  persist(
    (set) => ({
      fired: {},
      active: [],
      markFired: (alarms, now) =>
        set((s) => ({
          fired: { ...s.fired, ...Object.fromEntries(alarms.map((a) => [a.key, now])) },
          active: [
            ...s.active.filter((a) => !alarms.some((n) => n.itemId === a.itemId)),
            ...alarms,
          ],
        })),
      dismiss: (key) => set((s) => ({ active: s.active.filter((a) => a.key !== key) })),
      dismissItem: (itemId) =>
        set((s) => ({ active: s.active.filter((a) => a.itemId !== itemId) })),
      setFired: (fired) => set({ fired }),
    }),
    {
      name: "notesflow:alarms",
      version: 1,
      skipHydration: true,
      partialize: (s) => ({ fired: s.fired }),
    },
  ),
);
