"use client";

import clsx from "clsx";
import { ChevronLeft, ChevronRight, CircleCheck } from "lucide-react";
import { useMemo, useSyncExternalStore } from "react";
import {
  addMonths,
  CALENDAR_LAYOUTS,
  calendarTasks,
  isCalendarLayout,
  weekDays,
  type CalendarLayout,
} from "@/lib/calendar";
import { useToday } from "@/lib/hooks";
import { archivedListIds, filterByEnergy } from "@/lib/items-logic";
import { addDays } from "@/lib/utils";
import { useUi } from "@/store/ui";
import { useWorkspace } from "@/store/workspace";
import { CalendarMonth } from "./CalendarMonth";
import { formatDay, fullDate } from "./CalendarParts";
import { CalendarWeek } from "./CalendarWeek";
import { ViewHeader } from "./ViewHeader";

const WIDE_QUERY = "(min-width: 768px)";

/** Whether the screen is wide enough for seven time-grid columns (assumed during server rendering). */
function useWideScreen(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(WIDE_QUERY);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia(WIDE_QUERY).matches,
    () => true,
  );
}

/** What the arrows step by in each layout, and how the shown period is named. */
const PERIOD: Record<
  CalendarLayout | "day",
  { noun: string; step: (day: string, n: number) => string }
> = {
  month: { noun: "month", step: addMonths },
  week: { noun: "week", step: (day, n) => addDays(day, 7 * n) },
  day: { noun: "day", step: addDays },
};

function periodLabel(layout: CalendarLayout | "day", anchor: string, days: string[]): string {
  if (layout === "month") return formatDay(anchor, { month: "long", year: "numeric" });
  if (layout === "day") return fullDate(anchor);
  const first = formatDay(days[0], { month: "short", day: "numeric" });
  const last = formatDay(days[6], { month: "short", day: "numeric", year: "numeric" });
  return `${first} – ${last}`;
}

/** Tasks from every list on their due dates, by month or by week with times. */
export function CalendarView() {
  const items = useWorkspace((s) => s.items);
  const lists = useWorkspace((s) => s.lists);
  const today = useToday();
  const anchor = useUi((s) => s.calendarDate) ?? today;
  const setCalendarDate = useUi((s) => s.setCalendarDate);
  const chosenLayout = useUi((s) => s.calendarLayout);
  const setLayout = useUi((s) => s.setCalendarLayout);
  const showDone = useUi((s) => s.calendarShowDone);
  const setShowDone = useUi((s) => s.setCalendarShowDone);
  const energyFilter = useUi((s) => s.energyFilter);
  const wide = useWideScreen();

  const layout = isCalendarLayout(chosenLayout) ? chosenLayout : "month";
  // Seven time-grid columns do not fit on a phone: the week shows one day at a time there.
  const shown = layout === "week" && !wide ? "day" : layout;

  const tasks = useMemo(
    () =>
      filterByEnergy(
        calendarTasks(items, { archived: archivedListIds(lists), showDone }),
        energyFilter,
      ),
    [items, lists, showDone, energyFilter],
  );
  const days = useMemo(
    () => (shown === "week" ? weekDays(anchor) : shown === "day" ? [anchor] : []),
    [shown, anchor],
  );

  const period = PERIOD[shown];

  return (
    <div className="flex h-full flex-col">
      <ViewHeader title="Calendar">
        <div
          role="group"
          aria-label="Calendar layout"
          className="flex rounded-xl bg-stone-200/60 p-0.5 dark:bg-stone-800"
        >
          {CALENDAR_LAYOUTS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              aria-pressed={layout === value}
              onClick={() => setLayout(value)}
              className={clsx(
                "rounded-[0.6rem] px-2.5 py-1 text-sm font-medium focus-visible:outline-2 focus-visible:outline-accent-500",
                layout === value
                  ? "bg-white text-stone-900 shadow-soft dark:bg-stone-950 dark:text-stone-100"
                  : "text-stone-600 hover:text-stone-900 dark:text-stone-300 dark:hover:text-stone-100",
              )}
            >
              {label}
            </button>
          ))}
        </div>
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
          aria-label={`Previous ${period.noun}`}
          onClick={() => setCalendarDate(period.step(anchor, -1))}
        >
          <ChevronLeft size={18} aria-hidden />
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => setCalendarDate(null)}>
          Today
        </button>
        <button
          type="button"
          className="btn btn-ghost px-2"
          aria-label={`Next ${period.noun}`}
          onClick={() => setCalendarDate(period.step(anchor, 1))}
        >
          <ChevronRight size={18} aria-hidden />
        </button>
        <h2 aria-live="polite" className="ml-1 truncate text-base font-semibold">
          {periodLabel(shown, anchor, days)}
        </h2>
      </div>

      {shown === "month" ? (
        <CalendarMonth anchor={anchor} today={today} tasks={tasks} />
      ) : (
        <CalendarWeek days={days} today={today} tasks={tasks} />
      )}
    </div>
  );
}
