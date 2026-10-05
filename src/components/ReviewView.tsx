"use client";

import { useMemo, useState } from "react";
import { CalendarArrowUp, Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import clsx from "clsx";
import { formatDuration } from "@/lib/duration";
import { focusStats } from "@/lib/focus-stats";
import { useToday } from "@/lib/hooks";
import { filterByOutcome, outcomeBreakdown } from "@/lib/outcomes";
import { nextMonday, reviewRange, weeklyReview } from "@/lib/review";
import { INBOX_ID, type Item } from "@/lib/types";
import { addDays, daysBetween, displayTitle, formatDueLabel } from "@/lib/utils";
import { useUi } from "@/store/ui";
import { useWorkspace } from "@/store/workspace";
import { ViewHeader } from "./ViewHeader";
import { formatDate } from "@/lib/locale";

const shortDate = (date: string) =>
  formatDate(new Date(`${date}T00:00`), { month: "short", day: "numeric" });

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-stone-100 px-3 py-3 text-center dark:bg-stone-900">
      <dt className="text-xs text-stone-500 dark:text-stone-400">{label}</dt>
      <dd className="heading-display text-2xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

/** A guided look back at the week: what got done, what slipped (with one-click rescheduling), and how it went. */
export function ReviewView() {
  const items = useWorkspace((s) => s.items);
  const lists = useWorkspace((s) => s.lists);
  const habits = useWorkspace((s) => s.habits);
  const updateItem = useWorkspace((s) => s.updateItem);
  const updateItems = useWorkspace((s) => s.updateItems);
  const selectItem = useUi((s) => s.selectItem);
  const today = useToday();
  const [weeksBack, setWeeksBack] = useState(0);
  const [outcome, setOutcome] = useState<string | null>(null);
  const range = useMemo(() => reviewRange(today, weeksBack), [today, weeksBack]);
  const review = useMemo(() => weeklyReview(items, today, range), [items, today, range]);
  // Focus time over the same 7 days as the rest of the review.
  const focusMinutes = useMemo(
    () => focusStats(items, range.to, 7).days.reduce((sum, d) => sum + d.minutes, 0),
    [items, range.to],
  );
  const checkins = habits
    .filter((h) => !h.archivedAt)
    .reduce((sum, h) => sum + h.checkins.filter((d) => d >= range.from && d <= range.to).length, 0);
  const breakdown = useMemo(() => outcomeBreakdown(review.finished), [review.finished]);
  const listName = (id: string) =>
    id === INBOX_ID ? "Inbox" : (lists.find((l) => l.id === id)?.name ?? "List");
  const peak = Math.max(1, ...review.perDay.map((d) => d.count));
  const monday = nextMonday(today);
  const tomorrow = addDays(today, 1);

  const reschedule = (item: Item, date: string) => {
    // A multi-day task keeps its length.
    const startDate =
      item.startDate && item.due ? addDays(item.startDate, daysBetween(item.due, date)) : undefined;
    updateItem(item.id, { due: date, ...(startDate ? { startDate } : {}) });
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <ViewHeader title="Weekly review">
        <button
          type="button"
          className="btn btn-ghost px-2"
          aria-label="Previous week"
          onClick={() => setWeeksBack(weeksBack + 1)}
        >
          <ChevronLeft size={18} />
        </button>
        <span className="text-sm tabular-nums">
          {shortDate(range.from)} – {shortDate(range.to)}
        </span>
        <button
          type="button"
          className="btn btn-ghost px-2"
          aria-label="Next week"
          disabled={weeksBack === 0}
          onClick={() => setWeeksBack(weeksBack - 1)}
        >
          <ChevronRight size={18} />
        </button>
      </ViewHeader>

      <div className="mx-auto w-full max-w-3xl space-y-8 px-4 pb-12 sm:px-6">
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Finished" value={review.finished.length} />
          <Stat label="Slipped" value={review.slipped.length} />
          <Stat label="Focus time" value={focusMinutes ? formatDuration(focusMinutes) : "0m"} />
          <Stat label="Habit check-ins" value={checkins} />
        </dl>

        <section aria-label="Finished per day">
          <h2 className="mb-2 text-sm font-semibold">Done each day</h2>
          <ol className="flex h-28 items-end gap-2">
            {review.perDay.map((d) => (
              <li
                key={d.date}
                className="flex h-full flex-1 flex-col items-center justify-end gap-1"
              >
                <span className="text-[10px] tabular-nums text-stone-500 dark:text-stone-400">
                  {d.count || ""}
                </span>
                <span
                  aria-label={`${shortDate(d.date)}: ${d.count} finished`}
                  className="w-full rounded-t-md bg-emerald-400 dark:bg-emerald-600"
                  style={{ height: `${Math.max(d.count ? 6 : 1, (d.count / peak) * 85)}%` }}
                />
                <span className="text-[11px] text-stone-500 dark:text-stone-400">
                  {formatDate(new Date(`${d.date}T00:00`), { weekday: "short" })}
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section aria-label="Slipped tasks" className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold">What slipped</h2>
            {review.slipped.length > 1 && (
              <span className="ml-auto flex gap-1">
                <button
                  type="button"
                  className="btn btn-ghost px-2 py-1 text-xs"
                  onClick={() =>
                    updateItems(
                      review.slipped.map((i) => i.id),
                      { due: tomorrow },
                    )
                  }
                >
                  All to tomorrow
                </button>
                <button
                  type="button"
                  className="btn btn-ghost px-2 py-1 text-xs"
                  onClick={() =>
                    updateItems(
                      review.slipped.map((i) => i.id),
                      { due: monday },
                    )
                  }
                >
                  All to next Monday
                </button>
              </span>
            )}
          </div>
          {review.slipped.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-stone-500 dark:text-stone-400">
              <Check size={15} aria-hidden className="text-emerald-500" /> Nothing slipped. Nice
              week.
            </p>
          ) : (
            <ul className="space-y-1">
              {review.slipped.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-stone-100 dark:hover:bg-stone-800/60"
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate text-left"
                    onClick={() => selectItem(item.id)}
                  >
                    {displayTitle(item)}
                  </button>
                  <span className="text-xs text-red-600 dark:text-red-400">
                    {formatDueLabel(item.due!, today)}
                  </span>
                  <span className="flex items-center gap-1">
                    <CalendarArrowUp size={13} aria-hidden className="text-stone-400" />
                    {[
                      ["Today", today],
                      ["Tomorrow", tomorrow],
                      ["Next Mon", monday],
                    ].map(([label, date]) => (
                      <button
                        key={label}
                        type="button"
                        className="btn btn-ghost px-1.5 py-0.5 text-xs"
                        aria-label={`Move ${displayTitle(item)} to ${label}`}
                        onClick={() => reschedule(item, date)}
                      >
                        {label}
                      </button>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {breakdown.length > 0 && (
          <section aria-label="How it went" className="space-y-2">
            <h2 className="text-sm font-semibold">How it went</h2>
            <ul className="space-y-1.5">
              {breakdown.map((row) => {
                const active = outcome === row.label;
                return (
                  <li key={row.label || "none"}>
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => setOutcome(active ? null : row.label)}
                      className={clsx(
                        "flex w-full items-center gap-3 rounded-lg px-2 py-1 text-left text-sm transition-colors",
                        active
                          ? "bg-accent-50 dark:bg-accent-950/50"
                          : "hover:bg-stone-100 dark:hover:bg-stone-800/60",
                      )}
                    >
                      <span
                        className={clsx(
                          "w-40 truncate",
                          !row.label && "italic text-stone-500 dark:text-stone-400",
                        )}
                      >
                        {row.label || "No outcome"}
                      </span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800">
                        <span
                          className={clsx(
                            "block h-full rounded-full",
                            row.label ? "bg-accent-500" : "bg-stone-300 dark:bg-stone-600",
                          )}
                          style={{ width: `${(row.count / review.finished.length) * 100}%` }}
                        />
                      </span>
                      <span className="w-14 text-right text-xs tabular-nums text-stone-500 dark:text-stone-400">
                        {row.count} · {Math.round((row.count / review.finished.length) * 100)}%
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Click an outcome to see only those tasks below.
            </p>
          </section>
        )}

        <section aria-label="Finished tasks" className="space-y-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            What you finished
            {outcome !== null && (
              <button
                type="button"
                className="btn btn-ghost px-1.5 py-0.5 text-xs font-normal"
                onClick={() => setOutcome(null)}
              >
                {outcome || "No outcome"} <X size={12} aria-hidden />
              </button>
            )}
          </h2>
          {review.finished.length === 0 ? (
            <p className="text-sm text-stone-500 dark:text-stone-400">
              Nothing finished in this week yet.
            </p>
          ) : (
            <ul className="space-y-1">
              {filterByOutcome(review.finished, outcome).map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-stone-100 dark:hover:bg-stone-800/60"
                >
                  <Check size={14} aria-hidden className="shrink-0 text-emerald-500" />
                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate text-left"
                    onClick={() => selectItem(item.id)}
                  >
                    {displayTitle(item)}
                  </button>
                  {item.outcome && (
                    <span className="hidden truncate rounded-md bg-stone-100 px-1.5 py-0.5 text-xs sm:inline dark:bg-stone-800">
                      {item.outcome.label}
                    </span>
                  )}
                  <span className="shrink-0 text-xs text-stone-500 dark:text-stone-400">
                    {listName(item.listId)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {review.skipped.length > 0 && (
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Also let go of {review.skipped.length} task{review.skipped.length === 1 ? "" : "s"}{" "}
              (won’t do).
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
