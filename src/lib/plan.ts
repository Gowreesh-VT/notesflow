import { compareItems } from "./items-logic";
import type { Item } from "./types";

/** Times in the plan view are minutes since local midnight. */
export const DAY_MINUTES = 24 * 60;
/** The visible day window, unless a scheduled task falls outside it. */
export const PLAN_START = 6 * 60;
export const PLAN_END = 23 * 60;
/** Grid rows (drop targets) are half-hour slots; drops and moves snap to a quarter hour. */
export const SLOT_MINUTES = 30;
export const SNAP_MINUTES = 15;
/** Tasks without an estimate take up half an hour. */
export const DEFAULT_BLOCK_MINUTES = 30;

export type PlanWindow = { start: number; end: number };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const pad = (n: number) => String(n).padStart(2, "0");

/** "09:30" → 570, or null for anything that is not a valid HH:MM time. */
export function clockToMinutes(time: string | null | undefined): number | null {
  const match = time ? /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time) : null;
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/** 570 → "09:30"; kept within the day (00:00–23:59). */
export function minutesToClock(minutes: number): string {
  const m = clamp(Math.round(minutes), 0, DAY_MINUTES - 1);
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

/** Rounds to the nearest `step` minutes. */
export const snapMinutes = (minutes: number, step = SNAP_MINUTES): number =>
  Math.round(minutes / step) * step;

/** Start of every slot in the window. */
export function slotStarts(window: PlanWindow, step = SLOT_MINUTES): number[] {
  const slots: number[] = [];
  for (let m = window.start; m < window.end; m += step) slots.push(m);
  return slots;
}

/** Pixel offset from the top of the grid → snapped start time inside the window. */
export function offsetToMinutes(
  offset: number,
  pxPerMinute: number,
  window: PlanWindow,
  step = SNAP_MINUTES,
): number {
  return clamp(
    snapMinutes(window.start + offset / pxPerMinute, step),
    window.start,
    window.end - step,
  );
}

export const minutesToOffset = (minutes: number, pxPerMinute: number, window: PlanWindow): number =>
  (minutes - window.start) * pxPerMinute;

/** How long a task's block is: its estimate, or half an hour. */
export const blockLength = (item: Pick<Item, "estimate">): number =>
  item.estimate && item.estimate > 0 ? item.estimate : DEFAULT_BLOCK_MINUTES;

/** A block's new length while its bottom edge is dragged by `deltaPx`: snapped, at least one step, within the day. */
export function resizeLength(
  length: number,
  deltaPx: number,
  pxPerMinute: number,
  start: number,
  step = SNAP_MINUTES,
): number {
  return clamp(snapMinutes(length + deltaPx / pxPerMinute, step), step, DAY_MINUTES - start);
}

/** A start time moved by `delta` minutes (keyboard moves), kept within the day. */
export const shiftStart = (start: number, delta: number): number =>
  clamp(start + delta, 0, DAY_MINUTES - SNAP_MINUTES);

/** Tasks the plan view can show at all: live tasks outside archived lists, never templates. */
const plannable = (item: Item, archived: ReadonlySet<string>) =>
  item.kind === "task" && item.deletedAt === null && !item.template && !archived.has(item.listId);

/** Tasks with a time on `day` (open or done; skipped tasks are left out), in time order. */
export function scheduledOn(
  items: Item[],
  day: string,
  archived: ReadonlySet<string> = new Set(),
): Item[] {
  return items
    .filter(
      (item) =>
        plannable(item, archived) &&
        item.status !== "wontdo" &&
        item.due === day &&
        clockToMinutes(item.dueTime) !== null,
    )
    .sort((a, b) => (a.dueTime ?? "").localeCompare(b.dueTime ?? "") || a.createdAt - b.createdAt);
}

/**
 * Open tasks waiting for a time on `day`: due that day without a time, multi-day tasks running that day, and (when
 * planning today or later) anything overdue. With `includeUndated`, tasks without a date join in.
 */
export function toPlanOn(
  items: Item[],
  day: string,
  today: string,
  options: { includeUndated?: boolean; archived?: ReadonlySet<string> } = {},
): Item[] {
  const archived = options.archived ?? new Set<string>();
  return items
    .filter((item) => {
      if (!plannable(item, archived) || item.status !== "open") return false;
      if (!item.due) return Boolean(options.includeUndated);
      if (day >= today && item.due < today) return true;
      const timed = clockToMinutes(item.dueTime) !== null;
      if (timed) return false;
      return item.due === day || Boolean(item.startDate && item.startDate <= day && day < item.due);
    })
    .sort((a, b) => compareItems(a, b, "default"));
}

export type PlanBlock = {
  item: Item;
  start: number;
  end: number;
  /** Column within its group of overlapping blocks, and how many columns that group has. */
  column: number;
  columns: number;
};

/**
 * Places scheduled tasks on the time grid. Blocks that overlap (directly or through a chain) form a group and are
 * shown side by side: each takes the first column that is free at its start.
 */
export function layoutBlocks(items: Item[]): PlanBlock[] {
  const blocks = items
    .flatMap((item) => {
      const start = clockToMinutes(item.dueTime);
      return start === null
        ? []
        : [
            {
              item,
              start,
              end: Math.min(DAY_MINUTES, start + blockLength(item)),
              column: 0,
              columns: 1,
            },
          ];
    })
    .sort((a, b) => a.start - b.start || b.end - a.end || a.item.id.localeCompare(b.item.id));

  let group: PlanBlock[] = [];
  let columnEnds: number[] = [];
  let groupEnd = -1;
  const close = () => {
    for (const block of group) block.columns = columnEnds.length;
    group = [];
    columnEnds = [];
  };
  for (const block of blocks) {
    if (block.start >= groupEnd) close();
    let column = columnEnds.findIndex((end) => end <= block.start);
    if (column === -1) column = columnEnds.push(block.end) - 1;
    else columnEnds[column] = block.end;
    block.column = column;
    group.push(block);
    groupEnd = Math.max(groupEnd, block.end);
  }
  close();
  return blocks;
}

/** The visible window: 6:00–23:00, widened to whole hours around any block outside it. */
export function planWindow(blocks: Pick<PlanBlock, "start" | "end">[]): PlanWindow {
  let start = PLAN_START;
  let end = PLAN_END;
  for (const block of blocks) {
    start = Math.min(start, Math.floor(block.start / 60) * 60);
    end = Math.max(end, Math.min(DAY_MINUTES, Math.ceil(block.end / 60) * 60));
  }
  return { start, end };
}

type Span = Pick<PlanBlock, "start" | "end">;

const clipped = (span: Span, from: number, to: number) =>
  Math.max(0, Math.min(span.end, to) - Math.max(span.start, from));

/** Minutes covered by at least one span between `from` and `to` (overlaps counted once). */
function covered(spans: Span[], from: number, to: number): number {
  let total = 0;
  let reach = from;
  for (const span of [...spans].sort((a, b) => a.start - b.start)) {
    const start = Math.max(span.start, reach);
    const end = Math.min(span.end, to);
    if (end > start) {
      total += end - start;
      reach = end;
    }
  }
  return total;
}

export type PlanTotals = {
  /** Scheduled minutes in the window (overlapping blocks each count). */
  planned: number;
  /** Minutes left in the window from `now` on. */
  available: number;
  /** Of those, minutes not covered by any block. */
  free: number;
  /** Minutes of blocks still ahead that do not fit in the time left (0 when everything fits). */
  over: number;
};

/**
 * Planned against free time in the window. `now` is the current time for today, null for a future day (the whole
 * window is ahead), and the window end (or later) for a past day.
 */
export function planTotals(blocks: Span[], window: PlanWindow, now: number | null): PlanTotals {
  const from = clamp(now ?? window.start, window.start, window.end);
  const planned = blocks.reduce((sum, b) => sum + clipped(b, window.start, window.end), 0);
  const ahead = blocks.reduce((sum, b) => sum + clipped(b, from, window.end), 0);
  const available = window.end - from;
  const free = available - covered(blocks, from, window.end);
  return { planned, available, free, over: Math.max(0, ahead - available) };
}

/**
 * The first quarter hour at or after `from` where a block of `length` fits without overlapping `blocks` and ends
 * inside the window; null when there is no such gap.
 */
export function nextFreeStart(
  blocks: Span[],
  from: number,
  length: number,
  window: PlanWindow,
): number | null {
  const first = Math.ceil(Math.max(from, window.start) / SNAP_MINUTES) * SNAP_MINUTES;
  for (let start = first; start + length <= window.end; start += SNAP_MINUTES) {
    if (blocks.every((b) => b.end <= start || b.start >= start + length)) return start;
  }
  return null;
}

/** Default order for the guided planner: overdue first, then priority (high first), then shorter tasks. */
export function plannerOrder(items: Item[], today: string): Item[] {
  const rank = { high: 0, medium: 1, low: 2, none: 3 } as const;
  return [...items].sort(
    (a, b) =>
      Number(Boolean(b.due && b.due < today)) - Number(Boolean(a.due && a.due < today)) ||
      rank[a.priority] - rank[b.priority] ||
      blockLength(a) - blockLength(b),
  );
}

/**
 * Lays tasks out one after another from `start` (minutes after midnight), with an optional break between them.
 * Tasks that would end after `end` are returned as overflow instead.
 */
export function autoSchedule(
  items: Pick<Item, "id" | "estimate">[],
  start: number,
  end: number,
  breakMinutes = 0,
): { blocks: { id: string; start: number; end: number }[]; overflow: string[] } {
  const blocks: { id: string; start: number; end: number }[] = [];
  const overflow: string[] = [];
  // Round up, so planning "from now" never starts in the past.
  let cursor = Math.ceil(start / SNAP_MINUTES) * SNAP_MINUTES;
  for (const item of items) {
    const length = blockLength(item);
    if (cursor + length > end) {
      overflow.push(item.id);
      continue;
    }
    blocks.push({ id: item.id, start: cursor, end: cursor + length });
    cursor = cursor + length + breakMinutes;
  }
  return { blocks, overflow };
}
