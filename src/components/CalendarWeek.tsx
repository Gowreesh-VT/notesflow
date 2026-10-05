"use client";

import clsx from "clsx";
import { Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { isTimedOn, layoutTimedTasks, MINUTES_PER_DAY, tasksByDay } from "@/lib/calendar";
import { useNow } from "@/lib/hooks";
import type { Item } from "@/lib/types";
import { DayQuickAdd, formatDay, formatHour, fullDate, TaskChip } from "./CalendarParts";

/** Height of one hour in the time grid, in pixels. */
export const HOUR_HEIGHT = 48;
const HOURS = Array.from({ length: 24 }, (_, h) => h);
/** Blocks at least this long show the time above the title. */
const TALL_BLOCK_MINUTES = 45;

const minutesNow = (now: number) => {
  const date = new Date(now);
  return date.getHours() * 60 + date.getMinutes();
};

/**
 * Days side by side (a week, or a single day): an all-day row for tasks without a time (and multi-day tasks before
 * their due day), then an hourly grid where timed tasks sit at their due time, sized by their estimate.
 */
export function CalendarWeek({
  days,
  today,
  tasks,
}: {
  days: string[];
  today: string;
  tasks: Item[];
}) {
  const byDay = useMemo(() => tasksByDay(tasks, days), [tasks, days]);
  const scroller = useRef<HTMLDivElement>(null);
  const now = useNow(days.includes(today), 60_000);
  const [adding, setAdding] = useState<string | null>(null);
  const columns = { gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))` };

  // Open on the working day: an hour before now when today is shown, otherwise 8 AM.
  const showsToday = days.includes(today);
  useEffect(() => {
    if (!scroller.current) return;
    const minutes = showsToday ? Math.max(minutesNow(Date.now()) - 60, 0) : 8 * 60;
    scroller.current.scrollTop = (minutes / 60) * HOUR_HEIGHT;
  }, [showsToday]);

  return (
    <div className="flex min-h-0 flex-1 flex-col px-2 pb-3 sm:px-4">
      <div
        ref={scroller}
        className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900"
      >
        <div
          className="sticky top-0 z-20 grid border-b border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900"
          style={columns}
        >
          <div />
          {days.map((day) => (
            <div
              key={day}
              className="group flex min-w-0 items-center justify-between gap-1 border-l border-stone-200 px-1.5 py-1.5 dark:border-stone-800"
            >
              <span className="flex min-w-0 items-baseline gap-1">
                <span className="truncate text-xs text-stone-500 dark:text-stone-400">
                  {formatDay(day, { weekday: "short" })}
                </span>
                <span
                  className={clsx(
                    "flex size-6 shrink-0 items-center justify-center rounded-full text-sm tabular-nums",
                    day === today
                      ? "bg-accent-600 font-semibold text-white dark:bg-accent-500"
                      : "text-stone-800 dark:text-stone-100",
                  )}
                >
                  {Number(day.slice(8))}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setAdding(day)}
                aria-label={`Add a task on ${fullDate(day)}`}
                className="rounded-md p-0.5 text-stone-500 opacity-0 hover:bg-stone-200 hover:text-stone-800 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-accent-500 group-hover:opacity-100 dark:text-stone-400 dark:hover:bg-stone-700 dark:hover:text-stone-100"
              >
                <Plus size={14} aria-hidden />
              </button>
            </div>
          ))}

          <div className="px-1 py-1 text-right text-[11px] leading-5 text-stone-500 dark:text-stone-400">
            All day
          </div>
          {days.map((day) => {
            const allDay = (byDay.get(day) ?? []).filter((e) => !isTimedOn(e.item, day));
            return (
              <div
                key={day}
                className="max-h-28 min-w-0 overflow-y-auto border-l border-stone-200 p-0.5 dark:border-stone-800"
              >
                <ul
                  aria-label={`All-day tasks, ${fullDate(day)}`}
                  className="flex flex-col gap-0.5"
                >
                  {allDay.map(({ item, first, last }) => (
                    <li key={item.id}>
                      <TaskChip item={item} day={day} today={today} first={first} last={last} />
                    </li>
                  ))}
                </ul>
                {adding === day && <DayQuickAdd day={day} onClose={() => setAdding(null)} />}
              </div>
            );
          })}
        </div>

        <div className="relative grid" style={{ ...columns, height: 24 * HOUR_HEIGHT }}>
          <div aria-hidden className="relative">
            {HOURS.slice(1).map((hour) => (
              <span
                key={hour}
                className="absolute right-1.5 -translate-y-1/2 text-[11px] text-stone-500 tabular-nums dark:text-stone-400"
                style={{ top: hour * HOUR_HEIGHT }}
              >
                {formatHour(hour)}
              </span>
            ))}
          </div>
          {days.map((day) => (
            <DayColumn
              key={day}
              day={day}
              today={today}
              tasks={(byDay.get(day) ?? [])
                .filter((e) => isTimedOn(e.item, day))
                .map((e) => e.item)}
              nowMinutes={day === today ? minutesNow(now) : null}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function DayColumn({
  day,
  today,
  tasks,
  nowMinutes,
}: {
  day: string;
  today: string;
  tasks: Item[];
  nowMinutes: number | null;
}) {
  const blocks = useMemo(() => layoutTimedTasks(tasks), [tasks]);
  return (
    <div className="relative min-w-0 border-l border-stone-200 dark:border-stone-800">
      {HOURS.slice(1).map((hour) => (
        <div
          key={hour}
          aria-hidden
          className="absolute inset-x-0 border-t border-stone-100 dark:border-stone-800/70"
          style={{ top: hour * HOUR_HEIGHT }}
        />
      ))}
      <ol aria-label={`Timed tasks, ${fullDate(day)}`}>
        {blocks.map(({ item, start, end, column, columns }) => (
          <li
            key={item.id}
            className="absolute z-10 p-px"
            style={{
              top: (start / 60) * HOUR_HEIGHT,
              height: Math.max(((end - start) / 60) * HOUR_HEIGHT, 20),
              left: `${(column / columns) * 100}%`,
              width: `${100 / columns}%`,
            }}
          >
            <TaskChip
              item={item}
              day={day}
              today={today}
              block={end - start >= TALL_BLOCK_MINUTES}
              className="h-full shadow-soft"
            />
          </li>
        ))}
      </ol>
      {nowMinutes !== null && nowMinutes < MINUTES_PER_DAY && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 z-[15] border-t-2 border-red-500"
          style={{ top: (nowMinutes / 60) * HOUR_HEIGHT }}
        >
          <span className="absolute -left-1 -top-[5px] size-2 rounded-full bg-red-500" />
        </div>
      )}
    </div>
  );
}
