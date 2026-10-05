"use client";

import { useMemo, useState } from "react";
import { Timer } from "lucide-react";
import clsx from "clsx";
import { formatDuration } from "@/lib/duration";
import { useToday } from "@/lib/hooks";
import { archivedListIds, ENERGY_OPTIONS } from "@/lib/items-logic";
import { quickPicks } from "@/lib/quick";
import type { Energy } from "@/lib/types";
import { displayTitle, formatDueLabel } from "@/lib/utils";
import { useFocus } from "@/store/focus";
import { useUi } from "@/store/ui";
import { useWorkspace } from "@/store/workspace";
import { EnergyIcon } from "./EnergyField";
import { TaskCheckbox } from "./TaskCheckbox";
import { ViewHeader } from "./ViewHeader";

const TIMES = [5, 15, 30, 60];

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-colors",
        active
          ? "border-accent-500 bg-accent-50 text-accent-800 dark:bg-accent-950 dark:text-accent-200"
          : "border-stone-200 text-stone-600 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800",
      )}
    >
      {children}
    </button>
  );
}

/** "What can I do in 15 minutes?": tasks that fit the time you have, matched to your energy. */
export function QuickView() {
  const items = useWorkspace((s) => s.items);
  const lists = useWorkspace((s) => s.lists);
  const selectItem = useUi((s) => s.selectItem);
  const setView = useUi((s) => s.setView);
  const today = useToday();
  const [minutes, setMinutes] = useState(15);
  const [energy, setEnergy] = useState<Energy | null>(null);
  const picks = useMemo(
    () => quickPicks(items, minutes, today, { energy, archived: archivedListIds(lists) }),
    [items, minutes, today, energy, lists],
  );

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <ViewHeader title="Got a few minutes?" />
      <div className="mx-auto w-full max-w-3xl space-y-5 px-4 pb-12 sm:px-6">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-24 text-sm text-stone-500 dark:text-stone-400">I have</span>
            <div role="radiogroup" aria-label="Time available" className="flex flex-wrap gap-1.5">
              {TIMES.map((t) => (
                <Chip key={t} active={minutes === t} onClick={() => setMinutes(t)}>
                  {formatDuration(t)}
                </Chip>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-24 text-sm text-stone-500 dark:text-stone-400">and I feel</span>
            <div role="radiogroup" aria-label="Energy" className="flex flex-wrap gap-1.5">
              <Chip active={energy === null} onClick={() => setEnergy(null)}>
                Anything
              </Chip>
              {ENERGY_OPTIONS.map((o) => (
                <Chip key={o.value} active={energy === o.value} onClick={() => setEnergy(o.value)}>
                  <EnergyIcon energy={o.value} size={13} />
                  {o.value === "quick"
                    ? "Up for a quick win"
                    : o.value === "deep"
                      ? "Focused"
                      : "Low on energy"}
                </Chip>
              ))}
            </div>
          </div>
        </div>

        {picks.length === 0 ? (
          <p className="rounded-2xl bg-stone-100 px-4 py-8 text-center text-sm text-stone-500 dark:bg-stone-900 dark:text-stone-400">
            Nothing fits yet. Add estimates (like “~15m” in quick add) or tag tasks as quick wins,
            and they’ll show up here.
          </p>
        ) : (
          <ul className="space-y-1" aria-label={`Tasks that fit in ${formatDuration(minutes)}`}>
            {picks.map((item) => (
              <li
                key={item.id}
                className="group flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-stone-100 dark:hover:bg-stone-800/60"
              >
                <TaskCheckbox item={item} />
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate text-left text-[15px]"
                  onClick={() => selectItem(item.id)}
                >
                  {displayTitle(item)}
                </button>
                <span className="flex shrink-0 items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
                  {item.energy && <EnergyIcon energy={item.energy} />}
                  {item.due && <span>{formatDueLabel(item.due, today)}</span>}
                  <span className="tabular-nums">
                    {item.estimate ? formatDuration(item.estimate) : "quick"}
                  </span>
                </span>
                <button
                  type="button"
                  className="btn btn-ghost px-2 py-1 text-xs"
                  title="Start a focus session on this task"
                  onClick={() => {
                    useFocus.getState().start(item.id);
                    setView({ kind: "focus" });
                  }}
                >
                  <Timer size={13} aria-hidden /> Start
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
