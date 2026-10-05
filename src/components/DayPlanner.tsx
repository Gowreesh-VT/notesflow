"use client";

import { useMemo, useRef, useState } from "react";
import { useModalFocus } from "@/lib/hooks";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import clsx from "clsx";
import { formatDuration } from "@/lib/duration";
import { archivedListIds, isOpenTask } from "@/lib/items-logic";
import {
  autoSchedule,
  blockLength,
  clockToMinutes,
  DEFAULT_BLOCK_MINUTES,
  minutesToClock,
  plannerOrder,
} from "@/lib/plan";
import type { Item } from "@/lib/types";
import { addDays, displayTitle, formatClock, formatDueLabel } from "@/lib/utils";
import { useWorkspace } from "@/store/workspace";

type Step = 0 | 1 | 2 | 3;
const STEPS = ["Pick tasks", "Your time", "Order", "Time-block"];

const nowMinutes = () => {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
};

/**
 * "Plan my day" as a guided flow: pick tasks, say how much time you have, put them in order, then time-block
 * them. Confirming gives each task today's date, a time and (if it had none) a default estimate.
 */
export function DayPlanner({
  day,
  today,
  onClose,
}: {
  day: string;
  today: string;
  onClose: () => void;
}) {
  const modalRef = useRef<HTMLDivElement>(null);
  useModalFocus(modalRef);
  const items = useWorkspace((s) => s.items);
  const lists = useWorkspace((s) => s.lists);
  const updateItem = useWorkspace((s) => s.updateItem);
  const [step, setStep] = useState<Step>(0);

  // Candidates: open tasks due by this day (overdue included) without a time, plus anything else on request.
  const candidates = useMemo(() => {
    const archived = archivedListIds(lists);
    return plannerOrder(
      items.filter(
        (i) =>
          isOpenTask(i) &&
          i.deletedAt === null &&
          !i.template &&
          !archived.has(i.listId) &&
          !(i.due === day && clockToMinutes(i.dueTime) !== null),
      ),
      today,
    );
  }, [items, lists, day, today]);
  const dueSoon = candidates.filter((i) => i.due && i.due <= day);
  const [picked, setPicked] = useState<string[]>(() => dueSoon.map((i) => i.id));
  const [showAll, setShowAll] = useState(false);

  const isToday = day === today;
  const [start, setStart] = useState(() =>
    minutesToClock(isToday ? Math.max(9 * 60, Math.ceil(nowMinutes() / 15) * 15) : 9 * 60),
  );
  const [end, setEnd] = useState("18:00");
  const [breakMinutes, setBreakMinutes] = useState(5);
  const [order, setOrder] = useState<string[]>([]);

  const byId = (id: string) => items.find((i) => i.id === id);
  const pickedItems = picked.map(byId).filter((i): i is Item => Boolean(i));
  const startMin = clockToMinutes(start) ?? 9 * 60;
  const endMin = clockToMinutes(end) ?? 18 * 60;
  const available = Math.max(0, endMin - startMin);
  const needed =
    pickedItems.reduce((sum, i) => sum + blockLength(i) + breakMinutes, 0) -
    (pickedItems.length ? breakMinutes : 0);
  const ordered = order.map(byId).filter((i): i is Item => Boolean(i));
  const schedule = autoSchedule(ordered, startMin, endMin, breakMinutes);

  const goTo = (next: Step) => {
    if (next === 2 && step < 2) {
      // Keep any order the user already set, adding newly picked tasks at the end.
      const kept = order.filter((id) => picked.includes(id));
      setOrder([...kept, ...picked.filter((id) => !kept.includes(id))]);
    }
    setStep(next);
  };

  const move = (index: number, delta: -1 | 1) =>
    setOrder((current) => {
      const next = [...current];
      const target = index + delta;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const confirm = () => {
    for (const block of schedule.blocks) {
      const item = byId(block.id);
      updateItem(block.id, {
        due: day,
        dueTime: minutesToClock(block.start),
        ...(item && !item.estimate ? { estimate: DEFAULT_BLOCK_MINUTES } : {}),
      });
    }
    onClose();
  };

  const moveOverflowToTomorrow = () => {
    for (const id of schedule.overflow) updateItem(id, { due: addDays(day, 1), dueTime: null });
    setOrder((current) => current.filter((id) => !schedule.overflow.includes(id)));
  };

  const list = showAll ? candidates : dueSoon;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[8vh]"
      onMouseDown={onClose}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="day-planner-title"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
        className="flex max-h-[84vh] w-full max-w-lg flex-col rounded-2xl border border-stone-200 bg-white shadow-lift dark:border-stone-700 dark:bg-stone-900"
      >
        <div className="flex items-center gap-2 border-b border-stone-200 px-5 py-4 dark:border-stone-800">
          <h2 id="day-planner-title" className="heading-display text-xl font-semibold">
            Plan {isToday ? "today" : formatDueLabel(day, today).toLowerCase()}
          </h2>
          <button
            type="button"
            className="btn btn-ghost ml-auto px-1.5"
            aria-label="Close"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>
        <ol className="flex gap-1 px-5 pt-3 text-xs" aria-label="Steps">
          {STEPS.map((label, i) => (
            <li
              key={label}
              aria-current={i === step ? "step" : undefined}
              className={clsx(
                "flex-1 rounded-full px-2 py-1 text-center",
                i === step
                  ? "bg-accent-100 font-semibold text-accent-800 dark:bg-accent-950 dark:text-accent-200"
                  : i < step
                    ? "text-accent-700 dark:text-accent-300"
                    : "text-stone-500 dark:text-stone-400",
              )}
            >
              {i + 1}. {label}
            </li>
          ))}
        </ol>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {step === 0 && (
            <div className="space-y-3">
              <p className="text-sm text-stone-600 dark:text-stone-300">
                What do you want to get done? Overdue tasks and tasks due by then are picked for
                you.
              </p>
              <ul className="space-y-1">
                {list.map((item) => (
                  <li key={item.id}>
                    <label className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-stone-100 dark:hover:bg-stone-800">
                      <input
                        type="checkbox"
                        checked={picked.includes(item.id)}
                        onChange={(e) =>
                          setPicked((p) =>
                            e.target.checked ? [...p, item.id] : p.filter((id) => id !== item.id),
                          )
                        }
                        className="size-4 accent-accent-600"
                      />
                      <span className="min-w-0 flex-1 truncate">{displayTitle(item)}</span>
                      <span className="shrink-0 text-xs text-stone-500 dark:text-stone-400">
                        {item.due ? formatDueLabel(item.due, today) : "No date"} ·{" "}
                        {formatDuration(blockLength(item))}
                      </span>
                    </label>
                  </li>
                ))}
                {list.length === 0 && (
                  <li className="py-4 text-center text-sm text-stone-500 dark:text-stone-400">
                    Nothing due. Show all tasks to pick some.
                  </li>
                )}
              </ul>
              {candidates.length > dueSoon.length && (
                <button
                  type="button"
                  className="btn btn-ghost px-2 text-xs"
                  onClick={() => setShowAll(!showAll)}
                >
                  {showAll
                    ? "Only show tasks due by then"
                    : `Show all ${candidates.length} open tasks`}
                </button>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4 text-sm">
              <p className="text-stone-600 dark:text-stone-300">When can you work on them?</p>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2">
                  From
                  <input
                    type="time"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                    className="field w-auto"
                  />
                </label>
                <label className="flex items-center gap-2">
                  to
                  <input
                    type="time"
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                    className="field w-auto"
                  />
                </label>
              </div>
              <label className="flex items-center gap-2">
                Break between tasks
                <select
                  value={breakMinutes}
                  onChange={(e) => setBreakMinutes(Number(e.target.value))}
                  className="field w-auto"
                >
                  {[0, 5, 10, 15].map((m) => (
                    <option key={m} value={m}>
                      {m ? `${m} minutes` : "None"}
                    </option>
                  ))}
                </select>
              </label>
              <p
                className={clsx(
                  "rounded-xl px-3 py-2",
                  needed > available
                    ? "bg-amber-50 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100"
                    : "bg-stone-100 dark:bg-stone-800",
                )}
              >
                {pickedItems.length} task{pickedItems.length === 1 ? "" : "s"} need about{" "}
                {formatDuration(Math.max(needed, 0) || 0) || "0m"}; you have{" "}
                {formatDuration(available) || "no time"}.
                {needed > available &&
                  " Some tasks won’t fit. You can drop some or move them to tomorrow later."}{" "}
                Tasks without an estimate count as {DEFAULT_BLOCK_MINUTES} minutes.
              </p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-2">
              <p className="text-sm text-stone-600 dark:text-stone-300">
                Put them in the order you’ll do them.
              </p>
              <ol className="space-y-1">
                {ordered.map((item, index) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-2 rounded-lg bg-stone-50 px-2 py-1.5 text-sm dark:bg-stone-800/60"
                  >
                    <span className="w-5 text-right text-xs tabular-nums text-stone-500 dark:text-stone-400">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{displayTitle(item)}</span>
                    <span className="text-xs text-stone-500 dark:text-stone-400">
                      {formatDuration(blockLength(item))}
                    </span>
                    <button
                      type="button"
                      className="btn btn-ghost px-1 py-0.5"
                      aria-label={`Move ${displayTitle(item)} up`}
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost px-1 py-0.5"
                      aria-label={`Move ${displayTitle(item)} down`}
                      disabled={index === ordered.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDown size={14} />
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3 text-sm">
              <p className="text-stone-600 dark:text-stone-300">
                Here’s your day. Confirm to put these times on the tasks.
              </p>
              <ol className="space-y-1">
                {schedule.blocks.map((b) => (
                  <li
                    key={b.id}
                    className="flex items-center gap-3 rounded-lg bg-accent-50 px-3 py-1.5 dark:bg-accent-950/40"
                  >
                    <span className="w-32 shrink-0 text-xs tabular-nums text-accent-800 dark:text-accent-200">
                      {formatClock(minutesToClock(b.start))} – {formatClock(minutesToClock(b.end))}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{displayTitle(byId(b.id)!)}</span>
                  </li>
                ))}
              </ol>
              {schedule.overflow.length > 0 && (
                <div className="space-y-2 rounded-xl bg-amber-50 px-3 py-2 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100">
                  <p>
                    {schedule.overflow.length} task
                    {schedule.overflow.length === 1 ? " doesn’t" : "s don’t"} fit:{" "}
                    {schedule.overflow.map((id) => displayTitle(byId(id)!)).join(", ")}.
                  </p>
                  <button
                    type="button"
                    className="btn btn-ghost px-2 py-1 text-xs"
                    onClick={moveOverflowToTomorrow}
                  >
                    Move {schedule.overflow.length === 1 ? "it" : "them"} to tomorrow
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-stone-200 px-5 py-3 dark:border-stone-800">
          {step > 0 && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setStep((step - 1) as Step)}
            >
              Back
            </button>
          )}
          <span className="ml-auto" />
          {step < 3 ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={picked.length === 0}
              onClick={() => goTo((step + 1) as Step)}
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              disabled={schedule.blocks.length === 0}
              onClick={confirm}
            >
              Plan {schedule.blocks.length} task{schedule.blocks.length === 1 ? "" : "s"}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
