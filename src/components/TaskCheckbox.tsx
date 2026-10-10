"use client";

import { Ban, Check } from "lucide-react";
import clsx from "clsx";
import type { Item, Priority } from "@/lib/types";
import { useUi } from "@/store/ui";
import { toggleDoneWithUndo } from "@/store/undo";

const PRIORITY_BOX: Record<Priority, string> = {
  none: "border-stone-300 dark:border-stone-600",
  low: "border-sky-500 bg-sky-500/10",
  medium: "border-amber-500 bg-amber-500/10",
  high: "border-red-500 bg-red-500/10",
};

/** The rounded-square task checkbox, coloured by priority; finishing a task asks for its outcome. */
export function TaskCheckbox({
  item,
  disabled = false,
  small = false,
}: {
  item: Item;
  disabled?: boolean;
  small?: boolean;
}) {
  const promptOutcome = useUi((s) => s.promptOutcome);
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={item.status === "done"}
      aria-label={`Mark “${item.title}” as ${item.status === "open" ? "done" : "not done"}`}
      disabled={disabled}
      onClick={() => {
        const finishedId = toggleDoneWithUndo(item.id);
        if (finishedId) promptOutcome(finishedId);
      }}
      className={clsx(
        "flex shrink-0 items-center justify-center border-2 transition-colors",
        small ? "size-3.5 rounded-[4px]" : "size-[18px] rounded-[5px]",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500",
        item.status === "done"
          ? "border-stone-400 bg-stone-400 text-white dark:border-stone-600 dark:bg-stone-600"
          : item.status === "wontdo"
            ? "border-stone-300 bg-stone-300 text-white dark:border-stone-700 dark:bg-stone-700"
            : clsx(PRIORITY_BOX[item.priority], "hover:border-accent-500"),
      )}
    >
      {item.status === "done" && <Check size={small ? 9 : 12} strokeWidth={3.5} aria-hidden />}
      {item.status === "wontdo" && <Ban size={small ? 8 : 11} strokeWidth={3} aria-hidden />}
    </button>
  );
}
