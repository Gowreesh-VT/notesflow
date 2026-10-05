import type { Outcome } from "./types";

export const DEFAULT_OUTCOME_LABELS = [
  "Went well",
  "Learned something",
  "Needs follow-up",
  "Didn’t go as planned",
];
export const MAX_OUTCOME_LABEL = 40;
export const MAX_OUTCOME_NOTE = 280;
export const MAX_OUTCOME_CHOICES = 8;

/** Builds a valid outcome, or null when the label is empty. */
export function makeOutcome(label: string, note: string, at: number): Outcome | null {
  const cleanLabel = label.trim().slice(0, MAX_OUTCOME_LABEL);
  if (!cleanLabel) return null;
  return {
    label: cleanLabel,
    note: note.trim().replace(/\s+/g, " ").slice(0, MAX_OUTCOME_NOTE),
    at,
  };
}

export function parseOutcome(raw: unknown, now: number): Outcome | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.label !== "string") return null;
  const at = typeof r.at === "number" && Number.isFinite(r.at) ? r.at : now;
  return makeOutcome(r.label, typeof r.note === "string" ? r.note : "", at);
}

/** Cleans the user's list of choices: trimmed, unique, non-empty, capped; falls back to the defaults. */
export function cleanOutcomeLabels(labels: string[]): string[] {
  const seen = new Set<string>();
  const clean = labels
    .map((l) => l.trim().slice(0, MAX_OUTCOME_LABEL))
    .filter((l) => l && !seen.has(l.toLowerCase()) && seen.add(l.toLowerCase()))
    .slice(0, MAX_OUTCOME_CHOICES);
  return clean.length ? clean : DEFAULT_OUTCOME_LABELS;
}

/** The pseudo-label used for finished tasks without an outcome. */
export const NO_OUTCOME = "";

/** How finished tasks went: a count per outcome label (most common first), then those without one. */
export function outcomeBreakdown(
  items: { outcome?: { label: string } | null }[],
): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  let none = 0;
  for (const item of items) {
    if (item.outcome?.label)
      counts.set(item.outcome.label, (counts.get(item.outcome.label) ?? 0) + 1);
    else none++;
  }
  const rows = [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  return none ? [...rows, { label: NO_OUTCOME, count: none }] : rows;
}

/** Keeps items whose outcome is `label` (NO_OUTCOME = none); null keeps everything. */
export function filterByOutcome<T extends { outcome?: { label: string } | null }>(
  items: T[],
  label: string | null,
): T[] {
  if (label === null) return items;
  return items.filter((i) => (i.outcome?.label ?? NO_OUTCOME) === label);
}
