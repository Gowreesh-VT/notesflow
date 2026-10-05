"use client";

import clsx from "clsx";
import { Check } from "lucide-react";
import { useMemo } from "react";
import { AGENDA_DAYS, agendaGroups } from "@/lib/calendar";
import { INBOX_ID, type Item, type Priority } from "@/lib/types";
import { addDays, displayTitle, formatClock, formatDueRange } from "@/lib/utils";
import { useUi } from "@/store/ui";
import { useWorkspace } from "@/store/workspace";
import { formatDay, fullDate, taskLabel } from "./CalendarParts";

const PRIORITY_BOX: Record<Priority, string> = {
  none: "border-stone-300 dark:border-stone-600",
  low: "border-sky-500 bg-sky-500/10",
  medium: "border-amber-500 bg-amber-500/10",
  high: "border-red-500 bg-red-500/10",
};

function groupTitle(day: string, today: string): string {
  if (day === "overdue") return "Overdue";
  const date = formatDay(day, { weekday: "short", month: "short", day: "numeric" });
  if (day === today) return `Today · ${date}`;
  if (day === addDays(today, 1)) return `Tomorrow · ${date}`;
  return date;
}

function AgendaRow({ item, today, overdue }: { item: Item; today: string; overdue: boolean }) {
  const lists = useWorkspace((s) => s.lists);
  const toggleDone = useWorkspace((s) => s.toggleDone);
  const selected = useUi((s) => s.selectedItemId === item.id);
  const selectItem = useUi((s) => s.selectItem);
  const promptOutcome = useUi((s) => s.promptOutcome);
  const done = item.status !== "open";
  const listName =
    item.listId === INBOX_ID ? "Inbox" : lists.find((l) => l.id === item.listId)?.name;
  // Under its day heading a task only needs its time, unless it is overdue or spans several days.
  const multiDay = Boolean(item.startDate && item.due && item.startDate < item.due);
  const when =
    (overdue || multiDay) && item.due
      ? formatDueRange(item.due, item.dueTime, item.startDate, today)
      : item.dueTime
        ? formatClock(item.dueTime)
        : "";

  return (
    <li
      className={clsx(
        "flex items-center gap-3 rounded-xl px-3 py-2",
        selected ? "bg-accent-50 dark:bg-accent-950" : "hover:bg-stone-100 dark:hover:bg-stone-900",
      )}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={item.status === "done"}
        aria-label={`Mark “${displayTitle(item)}” as ${done ? "not done" : "done"}`}
        onClick={() => {
          const finishedId = toggleDone(item.id);
          if (finishedId) promptOutcome(finishedId);
        }}
        className={clsx(
          "flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border-2 transition-colors",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500",
          done
            ? "border-stone-400 bg-stone-400 text-white dark:border-stone-600 dark:bg-stone-600"
            : clsx(PRIORITY_BOX[item.priority], "hover:border-accent-500"),
        )}
      >
        {done && <Check size={12} strokeWidth={3.5} aria-hidden />}
      </button>
      <button
        type="button"
        data-calendar-item={item.id}
        data-day={item.due}
        onClick={() => selectItem(item.id)}
        aria-label={taskLabel(item, today)}
        aria-current={selected ? "true" : undefined}
        className="flex min-w-0 flex-1 items-center gap-3 self-stretch text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
      >
        <span
          className={clsx(
            "min-w-0 flex-1 truncate text-sm",
            done && "text-stone-500 line-through dark:text-stone-400",
          )}
        >
          {displayTitle(item)}
        </span>
        {listName && (
          <span className="hidden shrink-0 text-xs text-stone-500 sm:inline dark:text-stone-400">
            {listName}
          </span>
        )}
        {when && (
          <span
            className={clsx(
              "shrink-0 text-xs tabular-nums",
              overdue ? "text-red-600 dark:text-red-400" : "text-stone-500 dark:text-stone-400",
            )}
          >
            {when}
          </span>
        )}
      </button>
    </li>
  );
}

/** Upcoming days with their tasks, overdue tasks first. */
export function CalendarAgenda({ today, tasks }: { today: string; tasks: Item[] }) {
  const groups = useMemo(() => agendaGroups(tasks, today), [tasks, today]);

  if (groups.length === 0) {
    return (
      <p className="px-6 py-10 text-center text-sm text-stone-500 dark:text-stone-400">
        Nothing due in the next {AGENDA_DAYS} days.
      </p>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-6 sm:px-4">
      {groups.map(({ day, items }) => (
        <section
          key={day}
          aria-label={day === "overdue" ? "Overdue" : fullDate(day)}
          className="mb-3"
        >
          <h3
            className={clsx(
              "sticky top-0 z-10 bg-stone-50 px-3 py-1.5 text-[13px] font-semibold dark:bg-stone-950",
              day === "overdue"
                ? "text-red-700 dark:text-red-400"
                : day === today
                  ? "text-accent-700 dark:text-accent-300"
                  : "text-stone-700 dark:text-stone-200",
            )}
          >
            {groupTitle(day, today)}
            <span className="ml-2 font-normal text-stone-500 dark:text-stone-400">
              {items.length}
            </span>
          </h3>
          <ul>
            {items.map((item) => (
              <AgendaRow key={item.id} item={item} today={today} overdue={day === "overdue"} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
