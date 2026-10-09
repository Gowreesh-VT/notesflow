"use client";

import { askConfirm, askText } from "@/store/dialog";

import { useMemo, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  CalendarDays,
  Check,
  Flame,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import clsx from "clsx";
import { habitStreaks, isDoneOn, lastDays, periodProgress } from "@/lib/habits";
import { useToday } from "@/lib/hooks";
import type { Habit } from "@/lib/types";
import { useWorkspace } from "@/store/workspace";
import { HabitHeatmap } from "./HabitHeatmap";
import { ViewHeader } from "./ViewHeader";
import { formatDate } from "@/lib/locale";

const weekday = (date: string, style: "narrow" | "short" | "long") => {
  const [y, m, d] = date.split("-").map(Number);
  return formatDate(new Date(y, m - 1, d), { weekday: style });
};
const fullDate = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return formatDate(new Date(y, m - 1, d), {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
};

function HabitRow({ habit, days, today }: { habit: Habit; days: string[]; today: string }) {
  const { toggleHabit, updateHabit, deleteHabit } = useWorkspace.getState();
  const archived = Boolean(habit.archivedAt);
  const [expanded, setExpanded] = useState(false);
  const progress = periodProgress(habit, today);
  const streak = habitStreaks(habit, today);
  return (
    <li className="group rounded-2xl border border-stone-200 bg-white p-3 dark:border-stone-800 dark:bg-stone-900">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          role="checkbox"
          aria-checked={isDoneOn(habit, today)}
          aria-label={`${habit.name}: done today`}
          disabled={archived}
          onClick={() => toggleHabit(habit.id, today)}
          className={clsx(
            "flex size-9 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500",
            isDoneOn(habit, today)
              ? "border-emerald-500 bg-emerald-500 text-white"
              : "border-stone-300 text-transparent hover:border-emerald-400 dark:border-stone-600",
          )}
        >
          <Check size={18} strokeWidth={3} aria-hidden />
        </button>
        <div className="min-w-0 flex-1">
          <p
            className={clsx(
              "truncate font-medium",
              archived && "text-stone-500 dark:text-stone-400",
            )}
          >
            {habit.name}
          </p>
          <p className="flex flex-wrap items-center gap-x-3 text-xs text-stone-500 dark:text-stone-400">
            {habit.goal.per === "week" && (
              <span
                className={clsx(
                  progress.met && "font-medium text-emerald-600 dark:text-emerald-400",
                )}
              >
                {progress.done}/{progress.target} this week
              </span>
            )}
            <span
              className="inline-flex items-center gap-1"
              title={`Best: ${streak.best} ${streak.unit}${streak.best === 1 ? "" : "s"}`}
            >
              <Flame size={12} aria-hidden className={streak.current ? "text-amber-500" : ""} />
              {streak.current} {streak.unit}
              {streak.current === 1 ? "" : "s"} streak
            </span>
            <span>
              {habit.checkins.length} check-in{habit.checkins.length === 1 ? "" : "s"}
            </span>
          </p>
        </div>
        <ol className="flex gap-1" aria-label={`${habit.name}: last 7 days`}>
          {days.map((date) => {
            const done = isDoneOn(habit, date);
            return (
              <li key={date} className="flex flex-col items-center gap-0.5">
                <span className="text-[10px] text-stone-500 dark:text-stone-400">
                  {weekday(date, "narrow")}
                </span>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={done}
                  aria-label={`${habit.name}: ${fullDate(date)}`}
                  disabled={archived}
                  onClick={() => toggleHabit(habit.id, date)}
                  className={clsx(
                    "size-6 rounded-md border transition-colors",
                    "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-500",
                    done
                      ? "border-emerald-500 bg-emerald-500"
                      : "border-stone-200 bg-stone-50 hover:border-emerald-300 dark:border-stone-700 dark:bg-stone-800",
                    date === today && !done && "border-stone-400 dark:border-stone-500",
                  )}
                />
              </li>
            );
          })}
        </ol>
        <select
          aria-label={`${habit.name}: goal`}
          value={habit.goal.per === "day" ? "day" : String(habit.goal.times)}
          disabled={archived}
          onChange={(e) =>
            updateHabit(habit.id, {
              goal:
                e.target.value === "day"
                  ? { per: "day", times: 1 }
                  : { per: "week", times: Number(e.target.value) },
            })
          }
          className="rounded-lg bg-transparent px-1 py-1 text-xs text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
        >
          <option value="day">Every day</option>
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <option key={n} value={n}>
              {n}× a week
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn btn-ghost px-1.5 py-1"
          aria-expanded={expanded}
          aria-label={`${expanded ? "Hide" : "Show"} ${habit.name} history`}
          onClick={() => setExpanded(!expanded)}
        >
          <CalendarDays size={14} />
        </button>
        <span className="flex opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          <button
            type="button"
            className="btn btn-ghost px-1.5 py-1"
            aria-label={`Rename ${habit.name}`}
            onClick={async () => {
              const name = await askText({
                title: "Rename habit",
                label: "Habit name",
                initial: habit.name,
              });
              if (name) updateHabit(habit.id, { name });
            }}
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            className="btn btn-ghost px-1.5 py-1"
            aria-label={archived ? `Restore ${habit.name}` : `Archive ${habit.name}`}
            onClick={() => updateHabit(habit.id, { archived: !archived })}
          >
            {archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
          </button>
          <button
            type="button"
            className="btn btn-ghost px-1.5 py-1 text-red-600 dark:text-red-400"
            aria-label={`Delete ${habit.name}`}
            onClick={async () => {
              const ok = await askConfirm({
                title: `Delete the habit “${habit.name}”?`,
                message: "All its check-ins are deleted too.",
                confirmLabel: "Delete",
                danger: true,
              });
              if (ok) deleteHabit(habit.id);
            }}
          >
            <Trash2 size={14} />
          </button>
        </span>
      </div>
      {expanded && <HabitHeatmap habit={habit} today={today} />}
    </li>
  );
}

/** Habits with today's check-in and the last seven days. */
export function HabitsView() {
  const habits = useWorkspace((s) => s.habits);
  const addHabit = useWorkspace((s) => s.addHabit);
  const today = useToday();
  const [draft, setDraft] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const days = useMemo(() => lastDays(today, 7), [today]);
  const active = habits.filter((h) => !h.archivedAt);
  const archived = habits.filter((h) => h.archivedAt);
  const doneToday = active.filter((h) => isDoneOn(h, today)).length;

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <ViewHeader title="Habits">
        {active.length > 0 && (
          <span className="text-sm text-stone-500 dark:text-stone-400">
            {doneToday} of {active.length} done today
          </span>
        )}
      </ViewHeader>
      <div className="mx-auto w-full max-w-3xl space-y-4 px-4 pb-10 sm:px-6">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (addHabit(draft)) setDraft("");
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="New habit, e.g. “Read 20 pages”"
            aria-label="New habit"
            className="field"
          />
          <button type="submit" className="btn btn-primary" disabled={!draft.trim()}>
            <Plus size={16} aria-hidden /> Add
          </button>
        </form>

        {active.length === 0 ? (
          <p className="py-10 text-center text-sm text-stone-500 dark:text-stone-400">
            Add a habit you want to build, then check it in each day.
          </p>
        ) : (
          <ul className="space-y-2">
            {active.map((h) => (
              <HabitRow key={h.id} habit={h} days={days} today={today} />
            ))}
          </ul>
        )}

        {archived.length > 0 && (
          <section aria-label="Archived habits">
            <button
              type="button"
              className="btn btn-ghost px-2 text-xs"
              aria-expanded={showArchived}
              onClick={() => setShowArchived(!showArchived)}
            >
              {showArchived ? "Hide" : "Show"} {archived.length} archived
            </button>
            {showArchived && (
              <ul className="mt-2 space-y-2">
                {archived.map((h) => (
                  <HabitRow key={h.id} habit={h} days={days} today={today} />
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
