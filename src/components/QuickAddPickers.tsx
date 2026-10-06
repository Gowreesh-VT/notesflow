"use client";

import { ArrowUp, CalendarDays, Check, Flag, ListTodo, X } from "lucide-react";
import clsx from "clsx";
import { activeLists, viewTitle, type QuickAddPicks } from "@/lib/items-logic";
import { INBOX_ID, type Priority } from "@/lib/types";
import { addDays, formatDueWithTime } from "@/lib/utils";
import { useWorkspace } from "@/store/workspace";

const PRIORITIES: { value: Priority; label: string; flag: string }[] = [
  { value: "high", label: "High", flag: "fill-red-500 text-red-500" },
  { value: "medium", label: "Medium", flag: "fill-amber-500 text-amber-500" },
  { value: "low", label: "Low", flag: "fill-sky-500 text-sky-500" },
  { value: "none", label: "None", flag: "text-stone-400 dark:text-stone-500" },
];

type Picker = "date" | "priority" | "list";

const CHIP =
  "inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-accent-500";

function Option({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={clsx(
        "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-base",
        selected
          ? "bg-accent-50 font-medium text-accent-800 dark:bg-accent-950 dark:text-accent-200"
          : "text-stone-700 hover:bg-stone-100 dark:text-stone-200 dark:hover:bg-stone-800",
      )}
    >
      {children}
      <span className="ml-auto">{selected && <Check size={16} aria-hidden />}</span>
    </button>
  );
}

/**
 * The add sheet's toolbar on phones: date, priority and list chips showing what the new task will get (typed words
 * included), each opening a short list of choices, and the send button.
 */
export function QuickAddPickers({
  resolved,
  picker,
  onPicker,
  onPick,
  today,
  canSubmit,
}: {
  resolved: { due: string | null; dueTime: string | null; priority: Priority; listId: string };
  picker: Picker | null;
  onPicker: (picker: Picker | null) => void;
  onPick: (picks: QuickAddPicks) => void;
  today: string;
  canSubmit: boolean;
}) {
  const lists = useWorkspace((s) => s.lists);
  const listName = viewTitle({ kind: "list", id: resolved.listId }, lists);
  const priority = PRIORITIES.find((p) => p.value === resolved.priority)!;
  const toggle = (next: Picker) => onPicker(picker === next ? null : next);
  const chipTone = (active: boolean) =>
    active
      ? "bg-accent-50 text-accent-800 dark:bg-accent-950 dark:text-accent-200"
      : "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300";
  const dates = [
    { label: "Today", value: today },
    { label: "Tomorrow", value: addDays(today, 1) },
    { label: "Next week", value: addDays(today, 7) },
  ];

  return (
    <div className="md:hidden">
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          aria-expanded={picker === "date"}
          onClick={() => toggle("date")}
          className={clsx(CHIP, chipTone(Boolean(resolved.due)))}
        >
          <CalendarDays size={16} aria-hidden />
          {resolved.due ? formatDueWithTime(resolved.due, resolved.dueTime, today) : "Date"}
        </button>
        <button
          type="button"
          aria-expanded={picker === "priority"}
          aria-label={`Priority: ${priority.label}`}
          onClick={() => toggle("priority")}
          className={clsx(CHIP, chipTone(resolved.priority !== "none"))}
        >
          <Flag size={16} aria-hidden className={priority.flag} />
          {resolved.priority !== "none" && priority.label}
        </button>
        <button
          type="button"
          aria-expanded={picker === "list"}
          aria-label={`List: ${listName}`}
          onClick={() => toggle("list")}
          className={clsx(CHIP, chipTone(false), "min-w-0")}
        >
          <ListTodo size={16} aria-hidden className="shrink-0" />
          <span className="truncate">{listName}</span>
        </button>
        <button
          type="submit"
          aria-label="Add task"
          disabled={!canSubmit}
          className="ml-auto flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-600 text-white shadow-sm transition-colors hover:bg-accent-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500 disabled:bg-stone-200 disabled:text-stone-400 dark:disabled:bg-stone-800 dark:disabled:text-stone-500"
        >
          <ArrowUp size={20} aria-hidden />
        </button>
      </div>

      {picker === "date" && (
        <div role="radiogroup" aria-label="Date" className="mt-3 space-y-1">
          {dates.map((d) => (
            <Option
              key={d.label}
              selected={resolved.due === d.value}
              onClick={() => onPick({ due: d.value })}
            >
              {d.label}
            </Option>
          ))}
          <label className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-base text-stone-700 dark:text-stone-200">
            Pick a date
            <input
              type="date"
              value={resolved.due ?? ""}
              onChange={(e) => onPick({ due: e.target.value || null })}
              className="field ml-auto w-auto py-1"
            />
          </label>
          {resolved.due && (
            <button
              type="button"
              onClick={() => onPick({ due: null })}
              className="btn btn-ghost w-full justify-center"
            >
              <X size={14} aria-hidden /> No date
            </button>
          )}
        </div>
      )}

      {picker === "priority" && (
        <div role="radiogroup" aria-label="Priority" className="mt-3 space-y-1">
          {PRIORITIES.map((p) => (
            <Option
              key={p.value}
              selected={resolved.priority === p.value}
              onClick={() => onPick({ priority: p.value })}
            >
              <Flag size={16} aria-hidden className={p.flag} />
              {p.label}
            </Option>
          ))}
        </div>
      )}

      {picker === "list" && (
        <div
          role="radiogroup"
          aria-label="List"
          className="mt-3 max-h-[40dvh] space-y-1 overflow-y-auto"
        >
          {[{ id: INBOX_ID, name: "Inbox" }, ...activeLists(lists)].map((l) => (
            <Option
              key={l.id}
              selected={resolved.listId === l.id}
              onClick={() => onPick({ listId: l.id })}
            >
              <ListTodo size={16} aria-hidden />
              {l.name}
            </Option>
          ))}
        </div>
      )}
    </div>
  );
}
