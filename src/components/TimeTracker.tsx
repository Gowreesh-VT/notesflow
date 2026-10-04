"use client";

import { useState } from "react";
import { Pause, Play, Plus, X } from "lucide-react";
import { formatDuration, parseDuration } from "@/lib/duration";
import { useNow } from "@/lib/hooks";
import { formatElapsed, runningEntry, trackedMinutes } from "@/lib/time-tracking";
import type { Item } from "@/lib/types";
import { useWorkspace } from "@/store/workspace";

const formatEntryDate = (ms: number) =>
  new Date(ms).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

/** Start/stop timer, manual entries and the total tracked time for a task. */
export function TimeTracker({ item, readOnly }: { item: Item; readOnly: boolean }) {
  const { startTimer, stopTimer, addTimeEntry, deleteTimeEntry } = useWorkspace.getState();
  const running = runningEntry(item);
  const now = useNow(Boolean(running));
  const [draft, setDraft] = useState("");
  const [showEntries, setShowEntries] = useState(false);
  const [invalid, setInvalid] = useState(false);

  const entries = item.timeEntries ?? [];
  const total = trackedMinutes(entries, now);
  const finished = entries.filter((e) => e.end !== null).reverse();

  return (
    <section aria-label="Time tracking" className="px-4 pb-3">
      <h2 className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
        Time
        {(total > 0 || running) && (
          <span className="font-normal normal-case tabular-nums">
            {formatDuration(Math.max(total, 0)) === "0m" ? "under a minute" : formatDuration(total)}{" "}
            tracked
            {item.estimate ? ` of ${formatDuration(item.estimate)} estimated` : ""}
          </span>
        )}
      </h2>
      <div className="flex flex-wrap items-center gap-2">
        {!readOnly &&
          (running ? (
            <button
              type="button"
              className="btn bg-accent-600 text-white hover:bg-accent-700 dark:bg-accent-500"
              onClick={() => stopTimer(item.id)}
            >
              <Pause size={15} aria-hidden /> Stop
              <span className="tabular-nums" aria-live="off">
                {formatElapsed(now - running.start)}
              </span>
            </button>
          ) : (
            <button type="button" className="btn btn-ghost" onClick={() => startTimer(item.id)}>
              <Play size={15} aria-hidden /> Start timer
            </button>
          ))}
        {!readOnly && (
          <form
            className="flex items-center gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              const minutes = parseDuration(draft);
              if (!minutes) {
                setInvalid(true);
                return;
              }
              addTimeEntry(item.id, minutes);
              setDraft("");
              setInvalid(false);
            }}
          >
            <input
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                setInvalid(false);
              }}
              placeholder="Add time, e.g. 20m"
              aria-label="Add time manually"
              aria-invalid={invalid}
              className="field w-36 py-1"
            />
            <button
              type="submit"
              className="btn btn-ghost px-2"
              aria-label="Add time"
              disabled={!draft.trim()}
            >
              <Plus size={15} />
            </button>
          </form>
        )}
        {finished.length > 0 && (
          <button
            type="button"
            className="btn btn-ghost px-2 text-xs"
            aria-expanded={showEntries}
            onClick={() => setShowEntries(!showEntries)}
          >
            {showEntries ? "Hide" : "Show"} {finished.length}{" "}
            {finished.length === 1 ? "entry" : "entries"}
          </button>
        )}
      </div>
      {invalid && (
        <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
          Try something like 20m, 1h or 1h15.
        </p>
      )}
      {showEntries && (
        <ul className="mt-2 space-y-0.5 text-sm">
          {finished.map((e) => (
            <li
              key={e.id}
              className="group flex items-center gap-2 text-stone-600 dark:text-stone-300"
            >
              <span className="w-16 tabular-nums">
                {formatDuration(Math.max(1, Math.round((e.end! - e.start) / 60_000)))}
              </span>
              <span className="flex-1 text-xs text-stone-500 dark:text-stone-400">
                {e.manual ? "Added " : ""}
                {formatEntryDate(e.manual ? e.end! : e.start)}
              </span>
              {!readOnly && (
                <button
                  type="button"
                  className="btn btn-ghost px-1 py-0.5 opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
                  aria-label="Delete time entry"
                  onClick={() => deleteTimeEntry(item.id, e.id)}
                >
                  <X size={13} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
