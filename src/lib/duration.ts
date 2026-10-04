/** Longest duration accepted for estimates and manual time entries: one week, in minutes. */
export const MAX_MINUTES = 7 * 24 * 60;

/**
 * Parses a short duration into whole minutes: "25m", "25", "1h", "1h30", "1h 30m", "1.5h", "90 min".
 * Returns null for anything else, zero, or more than a week.
 */
export function parseDuration(input: string): number | null {
  const text = input.trim().toLowerCase().replace(/\s+/g, "");
  if (!text) return null;
  let minutes: number;
  const hm = /^(\d+(?:\.\d+)?)h(?:(\d+)(?:m|min|mins)?)?$/.exec(text);
  const m = /^(\d+)(?:m|min|mins)?$/.exec(text);
  if (hm) minutes = Number(hm[1]) * 60 + (hm[2] ? Number(hm[2]) : 0);
  else if (m) minutes = Number(m[1]);
  else return null;
  minutes = Math.round(minutes);
  return minutes > 0 && minutes <= MAX_MINUTES ? minutes : null;
}

/** 90 → "1h 30m", 45 → "45m", 120 → "2h". */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** Keeps a stored minute count only when it is a sensible positive number. */
export function asMinutes(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0 && value <= MAX_MINUTES
    ? value
    : null;
}
