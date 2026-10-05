"use client";

import { useState } from "react";
import { CalendarClock, Hourglass } from "lucide-react";
import clsx from "clsx";
import { getDragItem, isItemDrag, setDragItem } from "@/lib/dnd";
import { formatDuration } from "@/lib/duration";
import { ENERGY_OPTIONS } from "@/lib/items-logic";
import { blockLength, clockToMinutes, minutesToClock } from "@/lib/plan";
import type { Item } from "@/lib/types";
import { displayTitle, formatDueWithTime } from "@/lib/utils";
import { useUi } from "@/store/ui";
import { EnergyIcon } from "./EnergyField";
import { TaskCheckbox } from "./TaskCheckbox";

type QueueProps = {
  items: Item[];
  day: string;
  today: string;
  includeUndated: boolean;
  onIncludeUndated: (include: boolean) => void;
  /** Suggested start for a task picked with the keyboard: the next gap that fits it. */
  suggest: (item: Item) => number | null;
  onSchedule: (id: string, minutes: number) => void;
  onUnschedule: (id: string) => void;
  onDragStart: (item: Item, grab: number) => void;
  onDragEnd: () => void;
  /** The task being dragged in this view, if any. */
  dragId: string | null;
  className?: string;
};

function QueueRow({
  item,
  day,
  today,
  suggest,
  onSchedule,
  onDragStart,
  onDragEnd,
}: { item: Item } & Pick<
  QueueProps,
  "day" | "today" | "suggest" | "onSchedule" | "onDragStart" | "onDragEnd"
>) {
  const selectItem = useUi((s) => s.selectItem);
  const selected = useUi((s) => s.selectedItemId === item.id);
  const [time, setTime] = useState<string | null>(null);
  const title = displayTitle(item);
  const overdue = item.due !== null && item.due < today;
  const energy = ENERGY_OPTIONS.find((o) => o.value === item.energy)?.label;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const minutes = clockToMinutes(time);
    if (minutes === null) return;
    setTime(null);
    onSchedule(item.id, minutes);
  };

  return (
    <li>
      <div
        draggable
        onDragStart={(e) => {
          setDragItem(e, item.id);
          onDragStart(item, 0);
        }}
        onDragEnd={onDragEnd}
        className={clsx(
          "group flex min-h-11 cursor-grab items-center gap-2.5 rounded-lg px-2 py-1 transition-colors active:cursor-grabbing",
          selected
            ? "bg-accent-50 dark:bg-accent-950/50"
            : "hover:bg-stone-100 dark:hover:bg-stone-800/60",
        )}
      >
        <TaskCheckbox item={item} />
        <button
          type="button"
          onClick={() => selectItem(item.id)}
          aria-current={selected ? "true" : undefined}
          className="min-w-0 flex-1 self-stretch py-0.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
        >
          <span className="block truncate text-sm text-stone-800 dark:text-stone-100">{title}</span>
          <span className="flex flex-wrap items-center gap-x-2 text-xs text-stone-500 dark:text-stone-400">
            {item.due !== day && (
              <span className={clsx(overdue && "font-medium text-red-600 dark:text-red-400")}>
                {item.due ? formatDueWithTime(item.due, item.dueTime, today) : "No date"}
              </span>
            )}
            <span className="inline-flex items-center gap-1" title="Estimated time">
              <Hourglass size={11} aria-hidden />
              <span className="sr-only">Estimate </span>
              {item.estimate ? formatDuration(item.estimate) : "No estimate"}
            </span>
            {energy && item.energy && (
              <span className="inline-flex items-center gap-1">
                <EnergyIcon energy={item.energy} size={11} />
                {energy}
              </span>
            )}
          </span>
        </button>
        <button
          type="button"
          aria-label={`Schedule “${title}” at a time`}
          title="Schedule at…"
          aria-expanded={time !== null}
          onClick={() => {
            setTime(time !== null ? null : minutesToClock(suggest(item) ?? 9 * 60));
          }}
          className="shrink-0 rounded-md p-1.5 text-stone-400 hover:bg-stone-200 hover:text-stone-700 focus-visible:outline-2 focus-visible:outline-accent-500 dark:hover:bg-stone-700 dark:hover:text-stone-200"
        >
          <CalendarClock size={16} aria-hidden />
        </button>
      </div>
      {time !== null && (
        <form
          onSubmit={submit}
          onKeyDown={(e) => {
            if (e.key === "Escape") setTime(null);
          }}
          className="flex flex-wrap items-center gap-2 pb-2 pl-9 pr-2 pt-1"
        >
          <input
            type="time"
            required
            value={time}
            onChange={(e) => setTime(e.target.value)}
            aria-label={`Time for “${title}” (${formatDuration(blockLength(item))})`}
            className="field w-32 py-1"
          />
          <button type="submit" className="btn btn-primary px-2.5 py-1 text-xs">
            Schedule
          </button>
          <button
            type="button"
            className="btn btn-ghost px-2 py-1 text-xs"
            onClick={() => setTime(null)}
          >
            Cancel
          </button>
        </form>
      )}
    </li>
  );
}

/** "To plan": open tasks for the day without a time. Dropping a scheduled block here takes its time away. */
export function PlanQueue({
  items,
  includeUndated,
  onIncludeUndated,
  onUnschedule,
  dragId,
  className,
  ...rowProps
}: QueueProps) {
  const [over, setOver] = useState(false);
  const total = items.reduce((sum, item) => sum + (item.estimate ?? 0), 0);

  return (
    <section
      aria-labelledby="plan-queue-heading"
      onDragOver={(e) => {
        // A task already waiting here has nowhere to go.
        if (!isItemDrag(e) || items.some((i) => i.id === dragId)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (!over) setOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const id = getDragItem(e);
        if (id) onUnschedule(id);
      }}
      className={clsx(
        "flex min-h-0 flex-col rounded-2xl border transition-colors",
        over
          ? "border-accent-400 bg-accent-50 dark:border-accent-600 dark:bg-accent-950/40"
          : "border-stone-200 bg-white/70 dark:border-stone-800 dark:bg-stone-900/40",
        className,
      )}
    >
      <div className="flex items-baseline gap-2 px-3 pb-1 pt-3">
        <h2
          id="plan-queue-heading"
          className="text-[13px] font-semibold text-stone-700 dark:text-stone-200"
        >
          To plan
        </h2>
        <span className="text-xs tabular-nums text-stone-400 dark:text-stone-500">
          {items.length}
        </span>
        {total > 0 && (
          <span className="ml-auto text-xs tabular-nums text-stone-500 dark:text-stone-400">
            {formatDuration(total)} estimated
          </span>
        )}
      </div>
      <label className="flex items-center gap-2 px-3 pb-2 text-xs text-stone-600 dark:text-stone-300">
        <input
          type="checkbox"
          checked={includeUndated}
          onChange={(e) => onIncludeUndated(e.target.checked)}
        />
        Include tasks without a date
      </label>
      {items.length > 0 ? (
        <ul className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2">
          {items.map((item) => (
            <QueueRow key={item.id} item={item} {...rowProps} />
          ))}
        </ul>
      ) : (
        <p className="px-3 pb-4 pt-1 text-xs text-stone-500 dark:text-stone-400">
          Nothing left to plan. Drag a block here to take its time away.
        </p>
      )}
    </section>
  );
}
