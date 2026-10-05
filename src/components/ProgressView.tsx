"use client";

import { useMemo, useState } from "react";
import { Flame, Leaf } from "lucide-react";
import clsx from "clsx";
import { useToday } from "@/lib/hooks";
import { completionStreak, completionsPerDay, todayTally } from "@/lib/progress";
import { useWorkspace } from "@/store/workspace";
import { ViewHeader } from "./ViewHeader";
import { formatDate } from "@/lib/locale";

const RANGES = [7, 30, 90] as const;

/** Completion trends, streaks and a calm summary of today. */
export function ProgressView() {
  const items = useWorkspace((s) => s.items);
  const today = useToday();
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const per = useMemo(() => completionsPerDay(items, today, days), [items, today, days]);
  const streak = useMemo(() => completionStreak(items, today), [items, today]);
  const tally = useMemo(() => todayTally(items, today), [items, today]);
  const total = per.reduce((sum, d) => sum + d.count, 0);
  const average = total / days;
  const peak = Math.max(1, ...per.map((d) => d.count));
  const doneForToday = tally.remaining === 0 && tally.finished > 0;

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <ViewHeader title="Progress" />
      <div className="mx-auto w-full max-w-3xl space-y-8 px-4 pb-12 sm:px-6">
        <section
          aria-label="Today"
          className={clsx(
            "flex items-center gap-4 rounded-2xl px-5 py-5",
            doneForToday
              ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100"
              : "bg-stone-100 dark:bg-stone-900",
          )}
        >
          <Leaf
            size={28}
            aria-hidden
            className={doneForToday ? "text-emerald-500" : "text-stone-400"}
          />
          <div>
            <p className="heading-display text-xl font-semibold">
              {doneForToday
                ? "Done for today."
                : tally.remaining
                  ? `${tally.remaining} left for today`
                  : "A clear day"}
            </p>
            <p className="text-sm opacity-80">
              {doneForToday
                ? `You finished ${tally.finished} task${tally.finished === 1 ? "" : "s"}. Rest is part of the work.`
                : tally.finished
                  ? `${tally.finished} finished so far. One thing at a time.`
                  : tally.remaining
                    ? "Pick the smallest one and start there."
                    : "Nothing due. Plan something, or enjoy the space."}
            </p>
          </div>
        </section>

        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["Current streak", `${streak.current} day${streak.current === 1 ? "" : "s"}`],
            ["Best streak", `${streak.best} day${streak.best === 1 ? "" : "s"}`],
            [`Finished in ${days} days`, String(total)],
            ["Daily average", average >= 10 ? average.toFixed(0) : average.toFixed(1)],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-xl bg-stone-100 px-3 py-3 text-center dark:bg-stone-900"
            >
              <dt className="text-xs text-stone-500 dark:text-stone-400">{label}</dt>
              <dd className="heading-display flex items-center justify-center gap-1 text-2xl font-semibold tabular-nums">
                {label === "Current streak" && streak.current > 0 && (
                  <Flame size={18} aria-hidden className="text-amber-500" />
                )}
                {value}
              </dd>
            </div>
          ))}
        </dl>

        <section aria-label="Completion trend">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-sm font-semibold">Tasks finished</h2>
            <div
              role="radiogroup"
              aria-label="Range"
              className="ml-auto flex rounded-lg bg-stone-100 p-0.5 text-xs dark:bg-stone-800"
            >
              {RANGES.map((r) => (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={days === r}
                  onClick={() => setDays(r)}
                  className={clsx(
                    "rounded-md px-2 py-0.5 font-medium",
                    days === r
                      ? "bg-white shadow-sm dark:bg-stone-900"
                      : "text-stone-500 dark:text-stone-400",
                  )}
                >
                  {r} days
                </button>
              ))}
            </div>
          </div>
          <ol
            className="flex h-40 items-end gap-px"
            aria-label={`Tasks finished per day, last ${days} days`}
          >
            {per.map((d) => (
              <li
                key={d.date}
                className="flex h-full flex-1 items-end"
                title={`${d.date}: ${d.count}`}
              >
                <span
                  aria-label={`${formatDate(new Date(`${d.date}T00:00`), { month: "short", day: "numeric" })}: ${d.count}`}
                  className={clsx(
                    "w-full rounded-t-sm",
                    d.date === today ? "bg-accent-500" : "bg-accent-300 dark:bg-accent-800",
                  )}
                  style={{ height: `${Math.max(d.count ? 4 : 1, (d.count / peak) * 100)}%` }}
                />
              </li>
            ))}
          </ol>
          <div className="mt-1 flex justify-between text-[11px] text-stone-500 dark:text-stone-400">
            <span>
              {formatDate(new Date(`${per[0].date}T00:00`), {
                month: "short",
                day: "numeric",
              })}
            </span>
            <span>Today</span>
          </div>
        </section>
      </div>
    </div>
  );
}
