"use client";

import { Ban, Check } from "lucide-react";
import clsx from "clsx";
import type { Item, Priority } from "@/lib/types";
import { useUi } from "@/store/ui";
import { useWorkspace } from "@/store/workspace";

const PRIORITY_BOX: Record<Priority, string> = {
  none: "border-stone-300 dark:border-stone-600",
  low: "border-sky-500 bg-sky-500/10",
  medium: "border-amber-500 bg-amber-500/10",
  high: "border-red-500 bg-red-500/10",
};

/** The rounded-square task checkbox, coloured by priority; finishing a task asks for its outcome. */
export function TaskCheckbox({ item, disabled = false }: { item: Item; disabled?: boolean }) {
  const toggleDone = useWorkspace((s) => s.toggleDone);
  const promptOutcome = useUi((s) => s.promptOutcome);
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={item.status === "done"}
      aria-label={`Mark “${item.title}” as ${item.status === "open" ? "done" : "not done"}`}
      disabled={disabled}
      onClick={() => {
        const finishedId = toggleDone(item.id);
        if (finishedId) promptOutcome(finishedId);
      }}
      className={clsx(
        "flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border-2 transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500",
        item.status === "done"
          ? "border-stone-400 bg-stone-400 text-white dark:border-stone-600 dark:bg-stone-600"
          : item.status === "wontdo"
            ? "border-stone-300 bg-stone-300 text-white dark:border-stone-700 dark:bg-stone-700"
            : clsx(PRIORITY_BOX[item.priority], "hover:border-accent-500"),
      )}
    >
      {item.status === "done" && <Check size={12} strokeWidth={3.5} aria-hidden />}
      {item.status === "wontdo" && <Ban size={11} strokeWidth={3} aria-hidden />}
    </button>
  );
}
