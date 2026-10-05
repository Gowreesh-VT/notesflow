"use client";

import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { activeLists, parseQuickAdd } from "@/lib/items-logic";
import { INBOX_ID, type Item, type Priority } from "@/lib/types";
import { displayTitle, formatClock, formatDueRange } from "@/lib/utils";
import { useUi } from "@/store/ui";
import { useWorkspace } from "@/store/workspace";

/** Pieces shared by the calendar layouts: task chips, date labels and quick add on a day. */

const dateOf = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const formatDay = (day: string, options: Intl.DateTimeFormatOptions): string =>
  dateOf(day).toLocaleDateString(undefined, options);

/** "Monday, October 5, 2026", for labels. */
export const fullDate = (day: string): string =>
  formatDay(day, { weekday: "long", month: "long", day: "numeric", year: "numeric" });

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
 * A task on a calendar day; opens the detail panel. A multi-day task is drawn as a bar that continues into the
 * neighbouring days (`first`/`last` say where it starts and ends).
 */
export function TaskChip({
  item,
  day,
  today,
  first = true,
  last = true,
  className,
}: {
  item: Item;
  day: string;
  today: string;
  first?: boolean;
  last?: boolean;
  className?: string;
}) {
  const selected = useUi((s) => s.selectedItemId === item.id);
  const selectItem = useUi((s) => s.selectItem);
  const multiDay = !(first && last);
  return (
    <button
      type="button"
      data-calendar-item={item.id}
      data-day={day}
      onClick={() => selectItem(item.id)}
      aria-label={taskLabel(item, today)}
      aria-current={selected ? "true" : undefined}
      title={displayTitle(item)}
      className={clsx(
        "flex w-full min-w-0 items-center gap-1 px-1.5 py-0.5 text-left text-xs leading-5 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-500",
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
      <span className="truncate">{displayTitle(item)}</span>
    </button>
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
