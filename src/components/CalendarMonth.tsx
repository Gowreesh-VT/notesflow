"use client";

import clsx from "clsx";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { monthMatrix, monthOf, tasksByDay, type DayEntry } from "@/lib/calendar";
import type { Item } from "@/lib/types";
import { useUi } from "@/store/ui";
import {
  DayQuickAdd,
  DROP_HIGHLIGHT,
  dropTaskOn,
  formatDay,
  fullDate,
  PRIORITY_DOT,
  TaskChip,
  useTaskDropTarget,
} from "./CalendarParts";

/** Tasks shown in a month cell before "+N more". */
const CELL_LIMIT = 3;

const countLabel = (n: number) => (n === 0 ? "no tasks" : n === 1 ? "1 task" : `${n} tasks`);

function MonthCell({
  day,
  entries,
  today,
  inMonth,
  selected,
  onOpenDay,
}: {
  day: string;
  entries: DayEntry[];
  today: string;
  inMonth: boolean;
  selected: boolean;
  onOpenDay: (day: string) => void;
}) {
  const setCalendarDate = useUi((s) => s.setCalendarDate);
  const [expanded, setExpanded] = useState(false);
  const [adding, setAdding] = useState(false);
  const drop = useTaskDropTarget((event) => dropTaskOn(event, day));
  const isToday = day === today;
  const shown = expanded ? entries : entries.slice(0, CELL_LIMIT);
  const hidden = entries.length - shown.length;
  const dayNumber = Number(day.slice(8));

  return (
    <li
      {...drop.props}
      className={clsx(
        "group flex min-h-0 min-w-0 flex-col border-b border-r border-stone-200 dark:border-stone-800",
        drop.over ? DROP_HIGHLIGHT : !inMonth && "bg-stone-100/60 dark:bg-stone-900/60",
      )}
    >
      {/* Phones: the cell is one button showing dots; the chosen day's tasks are listed below the grid. */}
      <button
        type="button"
        onClick={() => setCalendarDate(day)}
        aria-pressed={selected}
        aria-label={`${fullDate(day)}, ${countLabel(entries.length)}`}
        className={clsx(
          "flex h-full w-full flex-col items-center gap-1 py-1.5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-500 md:hidden",
          selected && "bg-accent-50 dark:bg-accent-950",
        )}
      >
        <DayNumber n={dayNumber} isToday={isToday} inMonth={inMonth} />
        <span className="flex h-1.5 gap-0.5" aria-hidden>
          {entries.slice(0, CELL_LIMIT).map(({ item }) => (
            <span
              key={item.id}
              className={clsx("size-1.5 rounded-full", PRIORITY_DOT[item.priority])}
            />
          ))}
        </span>
      </button>

      <div className="hidden min-h-0 flex-1 flex-col gap-0.5 p-1 md:flex">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => onOpenDay(day)}
            aria-label={`Open ${fullDate(day)}`}
            className="rounded-full hover:bg-stone-200 focus-visible:outline-2 focus-visible:outline-accent-500 dark:hover:bg-stone-700"
          >
            <DayNumber n={dayNumber} isToday={isToday} inMonth={inMonth} />
          </button>
          <button
            type="button"
            onClick={() => setAdding(true)}
            aria-label={`Add a task on ${fullDate(day)}`}
            className="rounded-md p-0.5 text-stone-500 opacity-0 hover:bg-stone-200 hover:text-stone-800 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-accent-500 group-hover:opacity-100 dark:text-stone-400 dark:hover:bg-stone-700 dark:hover:text-stone-100"
          >
            <Plus size={14} aria-hidden />
          </button>
        </div>
        <ul
          aria-label={`${fullDate(day)}, ${countLabel(entries.length)}`}
          className={clsx("flex min-h-0 flex-col gap-0.5", expanded && "overflow-y-auto")}
        >
          {shown.map(({ item, first, last }) => (
            <li key={item.id} className={clsx(!first && "-ml-1", !last && "-mr-1")}>
              <TaskChip item={item} day={day} today={today} first={first} last={last} />
            </li>
          ))}
        </ul>
        {(hidden > 0 || expanded) && entries.length > CELL_LIMIT && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
            className="self-start rounded-md px-1.5 text-xs font-medium text-stone-600 hover:bg-stone-200 focus-visible:outline-2 focus-visible:outline-accent-500 dark:text-stone-300 dark:hover:bg-stone-700"
          >
            {expanded ? "Show less" : `+${hidden} more`}
          </button>
        )}
        {adding && <DayQuickAdd day={day} onClose={() => setAdding(false)} />}
      </div>
    </li>
  );
}

function DayNumber({ n, isToday, inMonth }: { n: number; isToday: boolean; inMonth: boolean }) {
  return (
    <span
      aria-hidden
      className={clsx(
        "flex size-6 items-center justify-center rounded-full text-xs tabular-nums",
        isToday
          ? "bg-accent-600 font-semibold text-white dark:bg-accent-500"
          : inMonth
            ? "text-stone-700 dark:text-stone-200"
            : "text-stone-400 dark:text-stone-500",
      )}
    >
      {n}
    </span>
  );
}

/** Month grid (weeks start on Monday) with each day's tasks; on phones, dots per day and a list for the chosen day. */
export function CalendarMonth({
  anchor,
  today,
  tasks,
  onOpenDay,
}: {
  anchor: string;
  today: string;
  tasks: Item[];
  /** Shows a day on its own (the day layout). */
  onOpenDay: (day: string) => void;
}) {
  const weeks = useMemo(() => monthMatrix(anchor), [anchor]);
  const byDay = useMemo(() => tasksByDay(tasks, weeks.flat()), [tasks, weeks]);
  const [adding, setAdding] = useState(false);
  const month = monthOf(anchor);
  const chosen = byDay.get(anchor) ?? [];

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 pb-4 sm:px-4">
      <div
        aria-hidden
        className="grid grid-cols-7 border-b border-stone-200 text-xs font-medium text-stone-500 dark:border-stone-800 dark:text-stone-400"
      >
        {weeks[0].map((day) => (
          <div key={day} className="px-1 py-1.5 text-center md:px-2 md:text-left">
            <span className="sm:hidden">{formatDay(day, { weekday: "narrow" })}</span>
            <span className="hidden sm:inline">{formatDay(day, { weekday: "short" })}</span>
          </div>
        ))}
      </div>
      <ol
        aria-label={formatDay(anchor, { month: "long", year: "numeric" })}
        className="grid shrink-0 grid-cols-7 border-l border-stone-200 md:flex-1 md:auto-rows-[minmax(6.5rem,1fr)] dark:border-stone-800"
      >
        {weeks.flat().map((day) => (
          <MonthCell
            key={day}
            day={day}
            entries={byDay.get(day) ?? []}
            today={today}
            inMonth={monthOf(day) === month}
            selected={day === anchor}
            onOpenDay={onOpenDay}
          />
        ))}
      </ol>

      <section aria-label={fullDate(anchor)} className="mt-4 md:hidden">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-stone-700 dark:text-stone-200">
            {fullDate(anchor)}
          </h2>
          <button
            type="button"
            className="btn btn-ghost px-2"
            onClick={() => setAdding(true)}
            aria-label={`Add a task on ${fullDate(anchor)}`}
          >
            <Plus size={16} aria-hidden />
          </button>
        </div>
        {adding && (
          <div className="mb-2">
            <DayQuickAdd key={anchor} day={anchor} onClose={() => setAdding(false)} />
          </div>
        )}
        {chosen.length === 0 ? (
          <p className="text-sm text-stone-500 dark:text-stone-400">Nothing due.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {chosen.map(({ item }) => (
              <li key={item.id}>
                <TaskChip item={item} day={anchor} today={today} large />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
