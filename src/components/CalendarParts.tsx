"use client";

import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { shownTitle } from "@/lib/tags";
import { reschedulePatch } from "@/lib/calendar";
import { getDragItem, isItemDrag, setDragItem } from "@/lib/dnd";
import { activeLists, parseQuickAdd } from "@/lib/items-logic";
import { INBOX_ID, type Item, type Priority } from "@/lib/types";
import { addDays, displayTitle, formatClock, formatDueRange } from "@/lib/utils";
import { useUi } from "@/store/ui";
import { useWorkspace } from "@/store/workspace";
import { formatDate, formatTime } from "@/lib/locale";

/** Pieces shared by the calendar layouts: task chips, date labels, quick add on a day and rescheduling. */

const dateOf = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const formatDay = (day: string, options: Intl.DateTimeFormatOptions): string =>
  formatDate(dateOf(day), options);

/** "Monday, October 5, 2026", for labels. */
export const fullDate = (day: string): string =>
  formatDay(day, { weekday: "long", month: "long", day: "numeric", year: "numeric" });

/** An hour of the day as a short local label, such as "9 AM" or "09". */
export const formatHour = (hour: number): string =>
  formatTime(new Date(2000, 0, 1, hour), { hour: "numeric" });

export const PRIORITY_DOT: Record<Priority, string> = {
  none: "bg-stone-400 dark:bg-stone-500",
  low: "bg-sky-500",
  medium: "bg-amber-500",
  high: "bg-red-500",
};

const PRIORITY_EDGE: Record<Priority, string> = {
  none: "border-l-stone-300 dark:border-l-stone-600",
  low: "border-l-sky-500",
  medium: "border-l-amber-500",
  high: "border-l-red-500",
};

/** What a screen reader hears for a task in the calendar. */
export function taskLabel(item: Item, today: string): string {
  const parts = [displayTitle(item)];
  if (item.due) parts.push(formatDueRange(item.due, item.dueTime, item.startDate, today));
  if (item.priority !== "none") parts.push(`${item.priority} priority`);
  if (item.status === "done") parts.push("completed");
  return parts.join(", ");
}

/**
 * Where a calendar task was picked up: the day it was shown on (so a multi-day task moves by the number of days it
 * was dragged) and whether it sat in a time grid. Tasks dragged in from elsewhere have no origin.
 */
let dragOrigin: { id: string; day: string; timed: boolean } | null = null;

/**
 * Reschedules the task being dropped onto `day`. `time` (a slot in a time grid) makes it due on `day` at that time;
 * `allDay` drops a task that came from a time grid into the all-day row, so it loses its time. Otherwise the task
 * moves by as many days as it was dragged and keeps its time. Notes and templates are ignored.
 */
export function dropTaskOn(
  event: React.DragEvent,
  day: string,
  { time, allDay = false }: { time?: string; allDay?: boolean } = {},
): void {
  const id = getDragItem(event);
  const origin = dragOrigin?.id === id ? dragOrigin : null;
  dragOrigin = null;
  const { items, updateItem } = useWorkspace.getState();
  const item = items.find((i) => i.id === id);
  if (!item || item.kind !== "task" || item.template || item.deletedAt !== null) return;
  const from = time ? null : (origin?.day ?? null);
  const dueTime = time ?? (allDay && origin?.timed ? null : undefined);
  updateItem(item.id, reschedulePatch(item, from, day, dueTime));
}

/** Props for an element that accepts dropped tasks, with `over` true while one is dragged over it. */
export function useTaskDropTarget(onDrop: (event: React.DragEvent) => void) {
  const [over, setOver] = useState(false);
  return {
    over,
    props: {
      onDragOver: (event: React.DragEvent) => {
        if (!isItemDrag(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        setOver(true);
      },
      onDragLeave: (event: React.DragEvent) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(false);
      },
      onDrop: (event: React.DragEvent) => {
        if (!isItemDrag(event)) return;
        event.preventDefault();
        setOver(false);
        onDrop(event);
      },
    },
  };
}

/** Classes that mark a day or slot as the drop target. */
export const DROP_HIGHLIGHT = "bg-accent-50 ring-2 ring-inset ring-accent-400 dark:bg-accent-950";

/**
 * Alt+Left / Alt+Right moves a task shown on `day` a day earlier or later (keeping its time) and keeps it focused,
 * moving the calendar along with it.
 */
export function handleMoveKey(event: React.KeyboardEvent, item: Item, day: string): void {
  if (!event.altKey || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
  event.preventDefault();
  const target = addDays(day, event.key === "ArrowLeft" ? -1 : 1);
  useWorkspace.getState().updateItem(item.id, reschedulePatch(item, day, target));
  const ui = useUi.getState();
  if (ui.calendarLayout !== "agenda") ui.setCalendarDate(target);
  requestAnimationFrame(() =>
    document
      .querySelector<HTMLElement>(
        `[data-calendar-item="${CSS.escape(item.id)}"][data-day="${target}"]`,
      )
      ?.focus(),
  );
}

/**
 * A task on a calendar day; opens the detail panel. A multi-day task is drawn as a bar that continues into the
 * neighbouring days (`first`/`last` say where it starts and ends).
 */
export function TaskChip({
  item,
  day,
  today,
  first = true,
  last = true,
  block = false,
  timed = false,
  large = false,
  className,
}: {
  item: Item;
  day: string;
  today: string;
  first?: boolean;
  last?: boolean;
  /** Drawn as a block in a time grid: the time above the title, filling its slot. */
  block?: boolean;
  /** Shown in a time grid (dropping it in the all-day row makes it all-day). */
  timed?: boolean;
  /** Bigger text and padding, for lists on phones. */
  large?: boolean;
  className?: string;
}) {
  const selected = useUi((s) => s.selectedItemId === item.id);
  const selectItem = useUi((s) => s.selectItem);
  const multiDay = !(first && last);
  return (
    // The wrapper carries the drag (some browsers do not drag buttons); the button opens the task.
    <div
      draggable
      onDragStart={(e) => {
        setDragItem(e, item.id);
        dragOrigin = { id: item.id, day, timed };
      }}
      onDragEnd={() => {
        dragOrigin = null;
      }}
      className="flex h-full min-w-0"
    >
      <button
        type="button"
        data-calendar-item={item.id}
        data-day={day}
        onClick={() => selectItem(item.id)}
        onKeyDown={(e) => handleMoveKey(e, item, day)}
        aria-label={taskLabel(item, today)}
        aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight"
        aria-current={selected ? "true" : undefined}
        title={displayTitle(item)}
        className={clsx(
          "flex w-full min-w-0 cursor-pointer px-1.5 text-left leading-5 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-500",
          large ? "py-1.5 text-sm" : "py-0.5 text-xs",
          block ? "h-full flex-col items-stretch overflow-hidden" : "items-center gap-1",
          first ? ["rounded-l-md border-l-2", PRIORITY_EDGE[item.priority]] : "rounded-l-none",
          last ? "rounded-r-md" : "rounded-r-none",
          multiDay
            ? "bg-accent-100 hover:bg-accent-200 dark:bg-accent-900/50 dark:hover:bg-accent-900"
            : "bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700",
          selected && "ring-2 ring-inset ring-accent-500",
          item.status !== "open" && "text-stone-500 line-through dark:text-stone-400",
          className,
        )}
      >
        {item.dueTime && last && (
          <span className="shrink-0 tabular-nums text-stone-600 dark:text-stone-300">
            {formatClock(item.dueTime)}
          </span>
        )}
        <span className="truncate">{shownTitle(item, displayTitle(item))}</span>
      </button>
    </div>
  );
}

/**
 * A small quick-add field for one day. It understands the usual quick-add words (times, `!priority`, `@list`,
 * `~estimate`); without a date the task is due on `day`. Escape, or leaving it empty, closes it.
 */
export function DayQuickAdd({ day, onClose }: { day: string; onClose: () => void }) {
  const lists = useWorkspace((s) => s.lists);
  const addItem = useWorkspace((s) => s.addItem);
  const [draft, setDraft] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
  }, []);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.trim()) return onClose();
    // Relative words ("tomorrow", "fri") count from the day the task is added to.
    const parsed = parseQuickAdd(draft, day, activeLists(lists));
    addItem({
      kind: "task",
      title: parsed.title,
      priority: parsed.priority,
      due: parsed.due ?? day,
      dueTime: parsed.dueTime ?? null,
      estimate: parsed.estimate ?? null,
      listId: parsed.listId ?? INBOX_ID,
    });
    setDraft("");
  };

  return (
    <form onSubmit={submit}>
      <input
        ref={input}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onClose();
          }
        }}
        onBlur={() => {
          if (!draft.trim()) onClose();
        }}
        aria-label={`New task on ${fullDate(day)}`}
        placeholder="New task"
        className="field px-2 py-1 text-xs"
      />
    </form>
  );
}
