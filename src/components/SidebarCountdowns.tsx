"use client";

import { useMemo, useState } from "react";
import { Hourglass, Plus, X } from "lucide-react";
import clsx from "clsx";
import { countdownLabel, visibleCountdowns } from "@/lib/countdowns";
import { useToday } from "@/lib/hooks";
import { useWorkspace } from "@/store/workspace";
import { formatDate } from "@/lib/locale";

/** Countdowns to important dates, with a small form to add one. */
export function SidebarCountdowns() {
  const countdowns = useWorkspace((s) => s.countdowns);
  const { addCountdown, deleteCountdown, updateCountdown } = useWorkspace.getState();
  const today = useToday();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const shown = useMemo(() => visibleCountdowns(countdowns, today), [countdowns, today]);

  return (
    <section aria-label="Countdowns">
      <div className="flex items-center justify-between px-2.5 pb-1 pt-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
          Countdowns
        </h2>
        <button
          type="button"
          className="btn btn-ghost px-1.5 py-0.5"
          aria-label="New countdown"
          title="New countdown"
          onClick={() => setAdding(!adding)}
        >
          <Plus size={14} />
        </button>
      </div>
      {adding && (
        <form
          className="space-y-1 px-1 pb-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (addCountdown(name, date)) {
              setName("");
              setDate("");
              setAdding(false);
            }
          }}
        >
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="What’s coming up?"
            aria-label="Countdown name"
            className="field py-1"
          />
          <div className="flex gap-1">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              aria-label="Countdown date"
              className="field min-w-0 flex-1 py-1"
            />
            <button
              type="submit"
              className="btn btn-primary px-2 py-1 text-xs"
              disabled={!name.trim() || !date}
            >
              Add
            </button>
          </div>
        </form>
      )}
      {shown.map((c) => {
        const past = c.date < today;
        return (
          <div
            key={c.id}
            className="group flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-sm"
          >
            <Hourglass
              size={16}
              aria-hidden
              className="shrink-0 text-stone-500 dark:text-stone-400"
            />
            <button
              type="button"
              className={clsx(
                "min-w-0 flex-1 truncate text-left",
                past ? "text-stone-500 dark:text-stone-400" : "text-stone-600 dark:text-stone-300",
              )}
              title={`${c.name}: ${formatDate(new Date(`${c.date}T00:00`), { dateStyle: "long" })}. Click to rename.`}
              onClick={() => {
                const renamed = window.prompt("Rename countdown", c.name);
                if (renamed) updateCountdown(c.id, { name: renamed });
              }}
            >
              {c.name}
            </button>
            <span
              className={clsx(
                "shrink-0 text-xs tabular-nums",
                c.date === today
                  ? "font-semibold text-accent-600 dark:text-accent-400"
                  : "text-stone-500 dark:text-stone-400",
              )}
            >
              {countdownLabel(c.date, today)}
            </span>
            <button
              type="button"
              className="btn btn-ghost px-1 py-0.5 opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
              aria-label={`Delete countdown ${c.name}`}
              onClick={() => deleteCountdown(c.id)}
            >
              <X size={13} />
            </button>
          </div>
        );
      })}
      {shown.length === 0 && !adding && (
        <p className="px-2.5 py-1 text-xs text-stone-500 dark:text-stone-400">
          Count down to birthdays, trips or deadlines.
        </p>
      )}
    </section>
  );
}
