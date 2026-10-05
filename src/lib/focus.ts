/** Pomodoro focus timer: phases, durations and transitions. Pure functions; the store keeps the state. */

export type FocusPhase = "work" | "short" | "long";

export type FocusSettings = {
  /** Minutes. */
  work: number;
  short: number;
  long: number;
  /** A long break after this many work sessions. */
  longEvery: number;
  /** Start the next phase automatically when one ends. */
  autoStart: boolean;
};

export const DEFAULT_FOCUS_SETTINGS: FocusSettings = {
  work: 25,
  short: 5,
  long: 15,
  longEvery: 4,
  autoStart: false,
};

export const FOCUS_LIMITS = {
  work: [5, 180],
  short: [1, 60],
  long: [1, 90],
  longEvery: [2, 12],
} as const;

const clamp = (value: unknown, [min, max]: readonly [number, number], fallback: number) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, Math.round(value)))
    : fallback;

export function cleanFocusSettings(raw: Partial<FocusSettings> | undefined): FocusSettings {
  const d = DEFAULT_FOCUS_SETTINGS;
  return {
    work: clamp(raw?.work, FOCUS_LIMITS.work, d.work),
    short: clamp(raw?.short, FOCUS_LIMITS.short, d.short),
    long: clamp(raw?.long, FOCUS_LIMITS.long, d.long),
    longEvery: clamp(raw?.longEvery, FOCUS_LIMITS.longEvery, d.longEvery),
    autoStart: raw?.autoStart === true,
  };
}

export const phaseMinutes = (phase: FocusPhase, settings: FocusSettings): number =>
  phase === "work" ? settings.work : phase === "short" ? settings.short : settings.long;

export const PHASE_LABEL: Record<FocusPhase, string> = {
  work: "Focus",
  short: "Short break",
  long: "Long break",
};

/** The phase after `phase` ends, given how many work sessions are complete (including the one just ended). */
export function nextPhase(
  phase: FocusPhase,
  completedWork: number,
  settings: FocusSettings,
): FocusPhase {
  if (phase !== "work") return "work";
  return completedWork > 0 && completedWork % settings.longEvery === 0 ? "long" : "short";
}

/** Remaining milliseconds of a session: frozen while paused, counting down to `endsAt` while running. */
export function remainingMs(
  session: { endsAt: number | null; pausedRemaining: number | null },
  now: number,
): number {
  if (session.pausedRemaining !== null) return Math.max(0, session.pausedRemaining);
  return session.endsAt === null ? 0 : Math.max(0, session.endsAt - now);
}
