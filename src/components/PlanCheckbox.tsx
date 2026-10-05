"use client";

import { Check } from "lucide-react";
import clsx from "clsx";
import type { Item, Priority } from "@/lib/types";
import { displayTitle } from "@/lib/utils";
import { useUi } from "@/store/ui";
import { useWorkspace } from "@/store/workspace";

const PRIORITY_BOX: Record<Priority, string> = {
  none: "border-stone-300 dark:border-stone-600",
  low: "border-sky-500 bg-sky-500/10",
  medium: "border-amber-500 bg-amber-500/10",
  high: "border-red-500 bg-red-500/10",
};

/** The rounded, priority-coloured task checkbox used in the plan view; completing asks for an outcome. */
export function PlanCheckbox({ item, small = false }: { item: Item; small?: boolean }) {
  const toggleDone = useWorkspace((s) => s.toggleDone);
  const promptOutcome = useUi((s) => s.promptOutcome);
  const done = item.status === "done";
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={`Mark “${displayTitle(item)}” as ${done ? "not done" : "done"}`}
      onClick={() => {
        const finishedId = toggleDone(item.id);
        if (finishedId) promptOutcome(finishedId);
      }}
      className={clsx(
        "flex shrink-0 items-center justify-center border-2 transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500",
        small ? "size-3.5 rounded-[4px]" : "size-[18px] rounded-[5px]",
        done
          ? "border-stone-400 bg-stone-400 text-white dark:border-stone-600 dark:bg-stone-600"
          : clsx(PRIORITY_BOX[item.priority], "hover:border-accent-500"),
      )}
    >
      {done && <Check size={small ? 9 : 12} strokeWidth={3.5} aria-hidden />}
    </button>
  );
}
