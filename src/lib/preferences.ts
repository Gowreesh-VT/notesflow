import { DEFAULT_ACCENT, isAccent } from "./accent";
import { CLOCK_FORMATS, DATE_ORDERS, DEFAULT_LOCALE_PREFS, WEEK_STARTS } from "./locale";
import { cleanOutcomeLabels, DEFAULT_OUTCOME_LABELS } from "./outcomes";
import { isClock } from "./reminders";
import type {
  Density,
  EditorMode,
  FontChoice,
  PlannerViewKind,
  Preferences,
  TextSize,
  Theme,
} from "./types";

export const PREFERENCES_ID = "preferences";

export const THEMES: Theme[] = ["system", "light", "dark"];
export const EDITOR_MODES: EditorMode[] = ["edit", "split", "preview"];
export const DENSITIES: Density[] = ["comfortable", "compact"];
export const FONTS: FontChoice[] = ["default", "system", "serif", "mono"];
export const TEXT_SIZES: TextSize[] = ["small", "default", "large"];

/** Views that can be hidden from the sidebar (Settings itself always stays reachable). */
export const HIDEABLE_VIEWS: PlannerViewKind[] = [
  "calendar",
  "matrix",
  "timeline",
  "plan",
  "focus",
  "habits",
  "review",
  "progress",
  "quick",
];

/** Everything a preference record holds, without its id and timestamp. */
export type PreferenceValues = Omit<Preferences, "id" | "updatedAt">;

export const DEFAULT_PREFERENCES: PreferenceValues = {
  theme: "system",
  accent: DEFAULT_ACCENT,
  density: "comfortable",
  font: "default",
  textSize: "default",
  ...DEFAULT_LOCALE_PREFS,
  editorMode: "split",
  vimKeys: false,
  outcomeLabels: DEFAULT_OUTCOME_LABELS,
  dayEnd: "21:00",
  hiddenViews: [],
};

const pick = <T>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

/** Keeps only valid values, filling the rest with defaults. */
export function cleanPreferenceValues(raw: Record<string, unknown>): PreferenceValues {
  const d = DEFAULT_PREFERENCES;
  return {
    theme: pick(raw.theme, THEMES, d.theme),
    accent: isAccent(raw.accent) ? raw.accent.toLowerCase() : d.accent,
    density: pick(raw.density, DENSITIES, d.density),
    font: pick(raw.font, FONTS, d.font),
    textSize: pick(raw.textSize, TEXT_SIZES, d.textSize),
    weekStart: pick(raw.weekStart, WEEK_STARTS, d.weekStart),
    dateOrder: pick(raw.dateOrder, DATE_ORDERS, d.dateOrder),
    clock: pick(raw.clock, CLOCK_FORMATS, d.clock),
    editorMode: pick(raw.editorMode, EDITOR_MODES, d.editorMode),
    vimKeys: raw.vimKeys === true,
    outcomeLabels: Array.isArray(raw.outcomeLabels)
      ? cleanOutcomeLabels(raw.outcomeLabels.filter((l): l is string => typeof l === "string"))
      : d.outcomeLabels,
    dayEnd: isClock(raw.dayEnd) ? raw.dayEnd : d.dayEnd,
    hiddenViews: Array.isArray(raw.hiddenViews)
      ? HIDEABLE_VIEWS.filter((v) => (raw.hiddenViews as unknown[]).includes(v))
      : d.hiddenViews,
  };
}

/** Sanitises a synced or imported preference record. Only the single "preferences" record is accepted. */
export function parsePreferences(raw: unknown, now: number): Preferences | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r.id !== PREFERENCES_ID) return null;
  const updatedAt =
    typeof r.updatedAt === "number" && Number.isFinite(r.updatedAt) && r.updatedAt > 0
      ? r.updatedAt
      : now;
  return { id: PREFERENCES_ID, ...cleanPreferenceValues(r), updatedAt };
}

/** The preferences in effect: the synced record, or the defaults when there is none yet. */
export function currentPreferences(records: Preferences[]): PreferenceValues {
  const record = records.find((r) => r.id === PREFERENCES_ID);
  return record ? cleanPreferenceValues(record) : DEFAULT_PREFERENCES;
}

/** Applies a change, producing the next record (stamped `now`, so it wins over older copies). */
export function updatePreferences(
  records: Preferences[],
  patch: Partial<PreferenceValues>,
  now: number,
): Preferences[] {
  const next: Preferences = {
    id: PREFERENCES_ID,
    ...cleanPreferenceValues({ ...currentPreferences(records), ...patch }),
    updatedAt: now,
  };
  return [...records.filter((r) => r.id !== PREFERENCES_ID), next];
}

/**
 * Preferences that older versions kept only on the device (in the "notesflow:ui" store). They are carried over
 * with a very old timestamp, so a record already saved in the account wins. Returns null when nothing differs
 * from the defaults.
 */
export function legacyPreferences(uiJson: string | null): Preferences | null {
  try {
    const state = JSON.parse(uiJson ?? "null")?.state;
    if (!state || typeof state !== "object") return null;
    const values = cleanPreferenceValues(state as Record<string, unknown>);
    const changed = (Object.keys(values) as (keyof PreferenceValues)[]).some(
      (key) => JSON.stringify(values[key]) !== JSON.stringify(DEFAULT_PREFERENCES[key]),
    );
    return changed ? { id: PREFERENCES_ID, ...values, updatedAt: 1 } : null;
  } catch {
    return null;
  }
}

/** "21:30" → minutes after midnight. */
export const clockMinutes = (clock: string): number => {
  const [h, m] = clock.split(":").map(Number);
  return h * 60 + m;
};
