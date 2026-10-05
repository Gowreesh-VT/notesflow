"use client";

import { useMemo, useState } from "react";
import { Lightbulb, X } from "lucide-react";
import { useNow, useToday } from "@/lib/hooks";
import { scheduleSuggestions } from "@/lib/suggestions";
import { addDays } from "@/lib/utils";
import { useWorkspace } from "@/store/workspace";

/** Gentle suggestions for today (overdue, overloaded, too long), each with a one-click fix. */
export function Suggestions() {
  const items = useWorkspace((s) => s.items);
  const updateItems = useWorkspace((s) => s.updateItems);
  const today = useToday();
  const now = useNow(true, 60_000);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const minutes = new Date(now).getHours() * 60 + new Date(now).getMinutes();
  const suggestions = useMemo(
    () =>
      scheduleSuggestions(items, today, minutes).filter(
        (s) => !dismissed.includes(`${today}:${s.id}`),
      ),
    [items, today, minutes, dismissed],
  );
  if (!suggestions.length) return null;

  return (
    <ul aria-label="Suggestions" className="space-y-1.5 px-4 pb-2 sm:px-6">
      {suggestions.map((s) => (
        <li
          key={s.id}
          className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:bg-amber-950/40 dark:text-amber-100"
        >
          <Lightbulb size={15} aria-hidden className="mt-0.5 shrink-0 text-amber-500" />
          <span className="min-w-0 flex-1">{s.message}</span>
          <button
            type="button"
            className="btn shrink-0 bg-white/70 px-2 py-0.5 text-xs text-amber-950 hover:bg-white dark:bg-amber-900/40 dark:text-amber-100 dark:hover:bg-amber-900/70"
            onClick={() =>
              updateItems(s.action.ids, {
                due: s.action.to === "today" ? today : addDays(today, 1),
              })
            }
          >
            {s.action.label}
          </button>
          <button
            type="button"
            className="btn btn-ghost shrink-0 px-1 py-0.5"
            aria-label="Dismiss suggestion"
            onClick={() => setDismissed((d) => [...d, `${today}:${s.id}`])}
          >
            <X size={13} />
          </button>
        </li>
      ))}
    </ul>
  );
}
