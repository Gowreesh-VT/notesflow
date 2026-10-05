"use client";

import { useMemo } from "react";
import { Pause, Play, SkipForward, Square } from "lucide-react";
import clsx from "clsx";
import {
  FOCUS_LIMITS,
  PHASE_LABEL,
  phaseMinutes,
  remainingMs,
  type FocusSettings,
} from "@/lib/focus";
import { useNow } from "@/lib/hooks";
import { activeLists, isOpenTask } from "@/lib/items-logic";
import { formatElapsed } from "@/lib/time-tracking";
import { displayTitle } from "@/lib/utils";
import { useFocus } from "@/store/focus";
import { useWorkspace } from "@/store/workspace";
import { FocusStatsPanel } from "./FocusStatsPanel";
import { ViewHeader } from "./ViewHeader";

function NumberSetting({
  label,
  field,
  suffix,
}: {
  label: string;
  field: "work" | "short" | "long" | "longEvery";
  suffix: string;
}) {
  const value = useFocus((s) => s.settings[field]);
  const setSettings = useFocus((s) => s.setSettings);
  const [min, max] = FOCUS_LIMITS[field];
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span>{label}</span>
      <span className="flex items-center gap-1.5">
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) =>
            setSettings({ [field]: Number(e.target.value) } as Partial<FocusSettings>)
          }
          className="field w-20 py-1 text-right"
        />
        <span className="w-16 text-xs text-stone-500 dark:text-stone-400">{suffix}</span>
      </span>
    </label>
  );
}

/** The Pomodoro page: a big timer, the task being focused on, and timer settings. */
export function FocusView() {
  const session = useFocus((s) => s.session);
  const settings = useFocus((s) => s.settings);
  const { start, pause, resume, skip, stop, setTask, setSettings } = useFocus.getState();
  const items = useWorkspace((s) => s.items);
  const lists = useWorkspace((s) => s.lists);
  const running = Boolean(session && session.endsAt !== null);
  const now = useNow(running, 1000);

  const tasks = useMemo(() => {
    const active = new Set(["inbox", ...activeLists(lists).map((l) => l.id)]);
    return items
      .filter((i) => isOpenTask(i) && i.deletedAt === null && !i.template && active.has(i.listId))
      .sort((a, b) => displayTitle(a).localeCompare(displayTitle(b)));
  }, [items, lists]);

  const phase = session?.phase ?? "work";
  const total = phaseMinutes(phase, settings) * 60_000;
  const left = session ? remainingMs(session, now) : total;
  const progress = total ? 1 - left / total : 0;
  const paused = Boolean(session && session.endsAt === null);
  const selectedTask = session?.itemId ?? "";

  // A ring drawn with SVG: the coloured arc shrinks as the phase runs down.
  const radius = 92;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <ViewHeader title="Focus" />
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 pb-10 sm:px-6">
        <section
          aria-label="Timer"
          className="flex flex-col items-center gap-5 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-8 dark:border-stone-800 dark:bg-stone-950"
        >
          <p
            className={clsx(
              "rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider",
              phase === "work"
                ? "bg-accent-100 text-accent-800 dark:bg-accent-950 dark:text-accent-200"
                : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
            )}
          >
            {PHASE_LABEL[phase]}
            {session ? ` · session ${session.completedWork + (phase === "work" ? 1 : 0)}` : ""}
          </p>
          <div className="relative size-56">
            <svg viewBox="0 0 200 200" className="size-full -rotate-90" aria-hidden>
              <circle
                cx="100"
                cy="100"
                r={radius}
                fill="none"
                strokeWidth="8"
                className="stroke-stone-200 dark:stroke-stone-800"
              />
              <circle
                cx="100"
                cy="100"
                r={radius}
                fill="none"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * progress}
                className={clsx(
                  "transition-[stroke-dashoffset] duration-1000 ease-linear",
                  phase === "work" ? "stroke-accent-500" : "stroke-emerald-500",
                )}
              />
            </svg>
            <p
              role="timer"
              aria-live="off"
              className="heading-display absolute inset-0 flex items-center justify-center text-5xl font-semibold tabular-nums"
            >
              {formatElapsed(left)}
            </p>
          </div>

          <label className="flex w-full max-w-sm flex-col gap-1 text-sm">
            <span className="text-xs text-stone-500 dark:text-stone-400">Focusing on</span>
            <select
              value={selectedTask}
              onChange={(e) =>
                session ? setTask(e.target.value || null) : start(e.target.value || null)
              }
              className="field"
            >
              <option value="">No task (time isn’t recorded)</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {displayTitle(t)}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {!session ? (
              <button type="button" className="btn btn-primary px-5" onClick={() => start(null)}>
                <Play size={16} aria-hidden /> Start focus
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="btn btn-primary px-5"
                  onClick={() => (paused ? resume() : pause())}
                >
                  {paused ? <Play size={16} aria-hidden /> : <Pause size={16} aria-hidden />}
                  {paused
                    ? session.segmentStart === null && left === total
                      ? "Start"
                      : "Resume"
                    : "Pause"}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => skip()}>
                  <SkipForward size={16} aria-hidden /> Skip
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => stop()}>
                  <Square size={15} aria-hidden /> Stop
                </button>
              </>
            )}
          </div>
          <p className="max-w-sm text-center text-xs text-stone-500 dark:text-stone-400">
            Focused time is added to the task’s tracked time. Pick a task first to record it.
          </p>
        </section>

        <FocusStatsPanel />

        <section aria-label="Timer settings" className="space-y-3">
          <h2 className="text-sm font-semibold">Timer</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberSetting label="Focus length" field="work" suffix="minutes" />
            <NumberSetting label="Short break" field="short" suffix="minutes" />
            <NumberSetting label="Long break" field="long" suffix="minutes" />
            <NumberSetting label="Long break every" field="longEvery" suffix="sessions" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.autoStart}
              onChange={(e) => setSettings({ autoStart: e.target.checked })}
              className="size-4 accent-accent-600"
            />
            Start the next focus session or break automatically
          </label>
        </section>
      </div>
    </div>
  );
}
