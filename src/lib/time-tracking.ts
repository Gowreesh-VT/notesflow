import type { Item, TimeEntry } from "./types";
import { createId } from "./utils";

/** At most this many entries are kept per task, newest last. */
export const MAX_TIME_ENTRIES = 500;

export const runningEntry = (item: Pick<Item, "timeEntries">): TimeEntry | undefined =>
  item.timeEntries?.find((e) => e.end === null);

/** Total tracked time in whole minutes; a running entry counts up to `now`. */
export function trackedMinutes(entries: TimeEntry[] | undefined, now: number): number {
  const ms = (entries ?? []).reduce((sum, e) => sum + Math.max(0, (e.end ?? now) - e.start), 0);
  return Math.floor(ms / 60_000);
}

/** Elapsed time as "12:05" or "1:02:05". */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(h ? 2 : 1, "0");
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export const startEntry = (now: number): TimeEntry => ({ id: createId(), start: now, end: null });

export const stopEntries = (entries: TimeEntry[], now: number): TimeEntry[] =>
  entries.map((e) => (e.end === null ? { ...e, end: Math.max(e.start, now) } : e));

/** A finished manual entry of `minutes`, ending now. */
export const manualEntry = (minutes: number, now: number): TimeEntry => ({
  id: createId(),
  start: now - minutes * 60_000,
  end: now,
  manual: true,
});

/** Sanitises stored entries: valid times, at most one running entry, capped length. */
export function parseTimeEntries(raw: unknown): TimeEntry[] {
  if (!Array.isArray(raw)) return [];
  let running = false;
  const entries = raw.flatMap((value: unknown): TimeEntry[] => {
    if (!value || typeof value !== "object") return [];
    const r = value as Record<string, unknown>;
    if (typeof r.id !== "string" || !r.id) return [];
    if (typeof r.start !== "number" || !Number.isFinite(r.start)) return [];
    const end =
      typeof r.end === "number" && Number.isFinite(r.end) && r.end >= r.start ? r.end : null;
    if (end === null) {
      if (running) return [];
      running = true;
    }
    const entry: TimeEntry = { id: r.id, start: r.start, end };
    if (r.manual === true) entry.manual = true;
    if (r.focus === true) entry.focus = true;
    return [entry];
  });
  return entries.slice(-MAX_TIME_ENTRIES);
}
