import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  cleanFocusSettings,
  DEFAULT_FOCUS_SETTINGS,
  nextPhase,
  phaseMinutes,
  type FocusPhase,
  type FocusSettings,
} from "@/lib/focus";
import { useWorkspace } from "./workspace";

export type FocusSession = {
  itemId: string | null;
  phase: FocusPhase;
  /** When the running phase ends; null while paused. */
  endsAt: number | null;
  /** Milliseconds left while paused; null while running. */
  pausedRemaining: number | null;
  /** Start of the current uninterrupted stretch of focus, recorded on the task when it ends. */
  segmentStart: number | null;
  completedWork: number;
};

type FocusState = {
  settings: FocusSettings;
  session: FocusSession | null;
  setSettings: (patch: Partial<FocusSettings>) => void;
  start: (itemId: string | null, now?: number) => void;
  setTask: (itemId: string | null, now?: number) => void;
  pause: (now?: number) => void;
  resume: (now?: number) => void;
  /** Ends the current phase early and moves to the next one. */
  skip: (now?: number) => void;
  /** Called when the countdown reaches zero. Returns the phase that just ended. */
  finishPhase: (now?: number) => FocusPhase | null;
  stop: (now?: number) => void;
};

/** Saves the focused stretch on the task as a focus time entry. */
function recordSegment(session: FocusSession, now: number) {
  if (session.phase !== "work" || !session.itemId || session.segmentStart === null) return;
  useWorkspace.getState().addFocusEntry(session.itemId, session.segmentStart, now);
}

const startPhase = (
  phase: FocusPhase,
  settings: FocusSettings,
  now: number,
  base: Pick<FocusSession, "itemId" | "completedWork">,
  running: boolean,
): FocusSession => {
  const ms = phaseMinutes(phase, settings) * 60_000;
  return {
    ...base,
    phase,
    endsAt: running ? now + ms : null,
    pausedRemaining: running ? null : ms,
    segmentStart: running && phase === "work" ? now : null,
  };
};

/** The running Pomodoro and its settings. Device-local: the focused time itself syncs with the task. */
export const useFocus = create<FocusState>()(
  persist(
    (set, get) => ({
      settings: DEFAULT_FOCUS_SETTINGS,
      session: null,

      setSettings: (patch) =>
        set((s) => ({ settings: cleanFocusSettings({ ...s.settings, ...patch }) })),

      start: (itemId, now = Date.now()) => {
        const current = get().session;
        if (current) recordSegment(current, now);
        // The plain stopwatch and a Pomodoro must not count the same time twice.
        const workspace = useWorkspace.getState();
        for (const item of workspace.items) {
          if (item.timeEntries?.some((e) => e.end === null)) workspace.stopTimer(item.id);
        }
        set({
          session: startPhase("work", get().settings, now, { itemId, completedWork: 0 }, true),
        });
      },

      setTask: (itemId, now = Date.now()) => {
        const session = get().session;
        if (!session) return;
        recordSegment(session, now);
        set({
          session: {
            ...session,
            itemId,
            segmentStart: session.phase === "work" && session.endsAt !== null ? now : null,
          },
        });
      },

      pause: (now = Date.now()) => {
        const session = get().session;
        if (!session || session.endsAt === null) return;
        recordSegment(session, now);
        set({
          session: {
            ...session,
            endsAt: null,
            pausedRemaining: Math.max(0, session.endsAt - now),
            segmentStart: null,
          },
        });
      },

      resume: (now = Date.now()) => {
        const session = get().session;
        if (!session || session.pausedRemaining === null) return;
        set({
          session: {
            ...session,
            endsAt: now + session.pausedRemaining,
            pausedRemaining: null,
            segmentStart: session.phase === "work" ? now : null,
          },
        });
      },

      skip: (now = Date.now()) => {
        const session = get().session;
        if (!session) return;
        recordSegment(session, now);
        const completedWork = session.completedWork + (session.phase === "work" ? 1 : 0);
        const phase = nextPhase(session.phase, completedWork, get().settings);
        set({
          session: startPhase(
            phase,
            get().settings,
            now,
            { itemId: session.itemId, completedWork },
            get().settings.autoStart,
          ),
        });
      },

      finishPhase: (now = Date.now()) => {
        const session = get().session;
        if (!session || session.endsAt === null) return null;
        recordSegment(session, Math.min(now, session.endsAt));
        const completedWork = session.completedWork + (session.phase === "work" ? 1 : 0);
        const phase = nextPhase(session.phase, completedWork, get().settings);
        set({
          session: startPhase(
            phase,
            get().settings,
            now,
            { itemId: session.itemId, completedWork },
            get().settings.autoStart,
          ),
        });
        return session.phase;
      },

      stop: (now = Date.now()) => {
        const session = get().session;
        if (session) recordSegment(session, now);
        set({ session: null });
      },
    }),
    {
      name: "notesflow:focus",
      version: 1,
      skipHydration: true,
      partialize: (s) => ({ settings: s.settings, session: s.session }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<FocusState>;
        return { ...current, settings: cleanFocusSettings(p.settings), session: p.session ?? null };
      },
    },
  ),
);
