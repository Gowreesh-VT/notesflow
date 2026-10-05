"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import clsx from "clsx";
import { isDoneOn, monthGrid } from "@/lib/habits";
import type { Habit } from "@/lib/types";
import { useWorkspace } from "@/store/workspace";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

/** A month of check-ins as a grid of squares; past days can be toggled. */
export function HabitHeatmap({ habit, today }: { habit: Habit; today: string }) {
  const toggleHabit = useWorkspace((s) => s.toggleHabit);
  const [ty, tm] = today.split("-").map(Number);
  const [month, setMonth] = useState({ y: ty, m: tm });
  const grid = monthGrid(month.y, month.m);
  const title = new Date(month.y, month.m - 1, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
  const inMonth = grid.flat().filter((d): d is string => d !== null);
  const doneCount = inMonth.filter((d) => isDoneOn(habit, d)).length;
  const shift = (delta: number) =>
    setMonth(({ y, m }) => {
      const date = new Date(y, m - 1 + delta, 1);
      return { y: date.getFullYear(), m: date.getMonth() + 1 };
    });

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center gap-1 text-sm">
        <button
          type="button"
          className="btn btn-ghost px-1.5 py-1"
          aria-label="Previous month"
          onClick={() => shift(-1)}
        >
          <ChevronLeft size={15} />
        </button>
        <span className="min-w-32 text-center font-medium">{title}</span>
        <button
          type="button"
          className="btn btn-ghost px-1.5 py-1"
          aria-label="Next month"
          onClick={() => shift(1)}
        >
          <ChevronRight size={15} />
        </button>
        <span className="ml-auto text-xs text-stone-500 dark:text-stone-400">
          {doneCount} day{doneCount === 1 ? "" : "s"} this month
        </span>
      </div>
      <div
        className="grid w-max grid-cols-7 gap-1"
        role="grid"
        aria-label={`${habit.name}, ${title}`}
      >
        {WEEKDAYS.map((d, i) => (
          <span key={i} aria-hidden className="text-center text-[10px] text-stone-400">
            {d}
          </span>
        ))}
        {grid.flat().map((date, i) =>
          date ? (
            <button
              key={date}
              type="button"
              aria-pressed={isDoneOn(habit, date)}
              aria-label={`${new Date(`${date}T00:00`).toLocaleDateString(undefined, { month: "long", day: "numeric" })}${isDoneOn(habit, date) ? ", done" : ""}`}
              disabled={date > today}
              onClick={() => toggleHabit(habit.id, date)}
              className={clsx(
                "size-7 rounded-md text-[10px] tabular-nums transition-colors disabled:opacity-40",
                "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-500",
                isDoneOn(habit, date)
                  ? "bg-emerald-500 text-white"
                  : "bg-stone-100 text-stone-500 hover:bg-emerald-100 dark:bg-stone-800 dark:text-stone-400 dark:hover:bg-emerald-950",
                date === today && "ring-1 ring-stone-400",
              )}
            >
              {Number(date.slice(8))}
            </button>
          ) : (
            <span key={`pad-${i}`} />
          ),
        )}
      </div>
    </div>
  );
}
