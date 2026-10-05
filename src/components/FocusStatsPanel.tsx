"use client";

import { useMemo } from "react";
import { formatDuration } from "@/lib/duration";
import { focusStats } from "@/lib/focus-stats";
import { useToday } from "@/lib/hooks";
import { INBOX_ID } from "@/lib/types";
import { useWorkspace } from "@/store/workspace";
import { formatDate } from "@/lib/locale";

const dayLabel = (date: string, today: string) => {
  if (date === today) return "Today";
  const [y, m, d] = date.split("-").map(Number);
  return formatDate(new Date(y, m - 1, d), { weekday: "short" });
};

const minutesLabel = (minutes: number) => (minutes ? formatDuration(minutes) : "0m");

/** Focus time today, this week, per day for the last week, and per list. */
export function FocusStatsPanel() {
  const items = useWorkspace((s) => s.items);
  const lists = useWorkspace((s) => s.lists);
  const today = useToday();
  const stats = useMemo(() => focusStats(items, today), [items, today]);
  const peak = Math.max(1, ...stats.days.map((d) => d.minutes));
  const listName = (id: string) =>
    id === INBOX_ID ? "Inbox" : (lists.find((l) => l.id === id)?.name ?? "Deleted list");
  const listPeak = Math.max(1, ...stats.byList.map((l) => l.minutes));

  return (
    <section aria-label="Focus statistics" className="space-y-4">
      <h2 className="text-sm font-semibold">Focus time</h2>
      <dl className="grid grid-cols-3 gap-2 text-center">
        {[
          ["Today", minutesLabel(stats.todayMinutes)],
          ["This week", minutesLabel(stats.weekMinutes)],
          ["Sessions this week", String(stats.weekSessions)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-stone-100 px-2 py-3 dark:bg-stone-900">
            <dt className="text-xs text-stone-500 dark:text-stone-400">{label}</dt>
            <dd className="heading-display text-xl font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <figure>
        <figcaption className="mb-2 text-xs text-stone-500 dark:text-stone-400">
          Last 7 days
        </figcaption>
        <ol className="flex h-32 items-end gap-2" aria-label="Focus time per day">
          {stats.days.map((d) => (
            <li key={d.date} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <span className="text-[10px] tabular-nums text-stone-500 dark:text-stone-400">
                {d.minutes ? minutesLabel(d.minutes) : ""}
              </span>
              <span
                role="img"
                aria-label={`${dayLabel(d.date, today)}: ${minutesLabel(d.minutes)}`}
                className={
                  d.date === today
                    ? "w-full rounded-t-md bg-accent-500"
                    : "w-full rounded-t-md bg-accent-200 dark:bg-accent-900"
                }
                style={{ height: `${Math.max(d.minutes ? 4 : 1, (d.minutes / peak) * 88)}%` }}
              />
              <span className="text-[11px] text-stone-500 dark:text-stone-400">
                {dayLabel(d.date, today)}
              </span>
            </li>
          ))}
        </ol>
      </figure>

      {stats.byList.length > 0 && (
        <figure>
          <figcaption className="mb-2 text-xs text-stone-500 dark:text-stone-400">
            This week by list
          </figcaption>
          <ul className="space-y-1.5">
            {stats.byList.map((l) => (
              <li key={l.listId} className="flex items-center gap-3 text-sm">
                <span className="w-28 truncate">{listName(l.listId)}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800">
                  <span
                    className="block h-full rounded-full bg-accent-500"
                    style={{ width: `${(l.minutes / listPeak) * 100}%` }}
                  />
                </span>
                <span className="w-16 text-right text-xs tabular-nums text-stone-500 dark:text-stone-400">
                  {minutesLabel(l.minutes)}
                </span>
              </li>
            ))}
          </ul>
        </figure>
      )}
    </section>
  );
}
