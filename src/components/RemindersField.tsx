"use client";

import { Bell, X } from "lucide-react";
import { parseDuration } from "@/lib/duration";
import {
  MAX_REMINDER_LEAD,
  MAX_REMINDERS,
  REMINDER_PRESETS,
  reminderLabel,
  reminderTimes,
} from "@/lib/reminders";
import type { Item } from "@/lib/types";
import { useWorkspace } from "@/store/workspace";

const formatWhen = (ms: number) =>
  new Date(ms).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

/** Lists a task's reminders with their firing times, and adds presets or a custom lead time. */
export function RemindersField({ item, readOnly }: { item: Item; readOnly: boolean }) {
  const addReminder = useWorkspace((s) => s.addReminder);
  const removeReminder = useWorkspace((s) => s.removeReminder);
  const times = reminderTimes(item);
  const used = new Set((item.reminders ?? []).map((r) => r.before));
  const full = used.size >= MAX_REMINDERS;

  return (
    <div className="space-y-1.5">
      {times.length > 0 && (
        <ul className="space-y-1">
          {times.map(({ reminder, at }) => (
            <li key={reminder.id} className="flex items-center gap-2 text-sm">
              <Bell
                size={13}
                aria-hidden
                className="shrink-0 text-accent-600 dark:text-accent-400"
              />
              <span className="min-w-0 flex-1">
                {reminderLabel(reminder.before)}
                <span className="ml-1.5 text-xs text-stone-500 dark:text-stone-400">
                  {formatWhen(at)}
                </span>
              </span>
              {!readOnly && (
                <button
                  type="button"
                  className="btn btn-ghost px-1 py-0.5"
                  aria-label={`Remove reminder ${reminderLabel(reminder.before)}`}
                  onClick={() => removeReminder(item.id, reminder.id)}
                >
                  <X size={13} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!readOnly && !full && (
        <select
          aria-label="Add a reminder"
          value=""
          onChange={(e) => {
            const value = e.target.value;
            if (value === "custom") {
              const text = window.prompt("Remind me how long before? For example 45m, 3h or 2d");
              if (!text) return;
              const days = /^\s*(\d+)\s*d(ays?)?\s*$/i.exec(text);
              const minutes = days ? Number(days[1]) * 1440 : parseDuration(text);
              if (minutes && minutes <= MAX_REMINDER_LEAD) addReminder(item.id, minutes);
              else window.alert("Try something like 45m, 3h or 2d (up to a week).");
            } else if (value) {
              addReminder(item.id, Number(value));
            }
          }}
          className="field w-auto"
        >
          <option value="">{times.length ? "Add another reminder…" : "Add a reminder…"}</option>
          {REMINDER_PRESETS.filter((p) => !used.has(p)).map((p) => (
            <option key={p} value={p}>
              {reminderLabel(p)}
            </option>
          ))}
          <option value="custom">Custom…</option>
        </select>
      )}
      {!item.dueTime && times.length > 0 && (
        <p className="text-xs text-stone-500 dark:text-stone-400">
          All-day task: reminders count back from 9:00 AM on the due date.
        </p>
      )}
    </div>
  );
}
