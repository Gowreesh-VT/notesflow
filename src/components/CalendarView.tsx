"use client";

import clsx from "clsx";
import { ChevronLeft, ChevronRight, CircleCheck } from "lucide-react";
import { useMemo } from "react";
import { addMonths, calendarTasks } from "@/lib/calendar";
import { useToday } from "@/lib/hooks";
import { archivedListIds, filterByEnergy } from "@/lib/items-logic";
import { useUi } from "@/store/ui";
import { useWorkspace } from "@/store/workspace";
import { CalendarMonth } from "./CalendarMonth";
import { formatDay } from "./CalendarParts";
import { ViewHeader } from "./ViewHeader";

/** Tasks from every list on their due dates, by month. */
export function CalendarView() {
  const items = useWorkspace((s) => s.items);
  const lists = useWorkspace((s) => s.lists);
  const today = useToday();
  const anchor = useUi((s) => s.calendarDate) ?? today;
  const setCalendarDate = useUi((s) => s.setCalendarDate);
  const showDone = useUi((s) => s.calendarShowDone);
  const setShowDone = useUi((s) => s.setCalendarShowDone);
  const energyFilter = useUi((s) => s.energyFilter);

  const tasks = useMemo(
    () =>
      filterByEnergy(
        calendarTasks(items, { archived: archivedListIds(lists), showDone }),
        energyFilter,
      ),
    [items, lists, showDone, energyFilter],
  );

  const step = (delta: -1 | 1) => setCalendarDate(addMonths(anchor, delta));

  return (
    <div className="flex h-full flex-col">
      <ViewHeader title="Calendar">
        <button
          type="button"
          aria-pressed={showDone}
          onClick={() => setShowDone(!showDone)}
          className={clsx(
            "btn px-2",
            showDone
              ? "bg-accent-50 text-accent-800 dark:bg-accent-950 dark:text-accent-200"
              : "btn-ghost",
          )}
        >
          <CircleCheck size={16} aria-hidden />
          <span className="hidden sm:inline">Show completed</span>
          <span className="sr-only sm:hidden">Show completed</span>
        </button>
      </ViewHeader>

      <div className="flex items-center gap-1 px-4 pb-2 sm:px-6">
        <button
          type="button"
          className="btn btn-ghost px-2"
          aria-label="Previous month"
          onClick={() => step(-1)}
        >
          <ChevronLeft size={18} aria-hidden />
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => setCalendarDate(null)}>
          Today
        </button>
        <button
          type="button"
          className="btn btn-ghost px-2"
          aria-label="Next month"
          onClick={() => step(1)}
        >
          <ChevronRight size={18} aria-hidden />
        </button>
        <h2 aria-live="polite" className="ml-1 truncate text-base font-semibold">
          {formatDay(anchor, { month: "long", year: "numeric" })}
        </h2>
      </div>

      <CalendarMonth anchor={anchor} today={today} tasks={tasks} />
    </div>
  );
}
