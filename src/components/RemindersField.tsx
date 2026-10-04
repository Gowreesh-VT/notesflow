"use client";

import { Bell, X } from "lucide-react";
import { parseDuration } from "@/lib/duration";
import { useNow } from "@/lib/hooks";
import {
  MAX_REMINDER_LEAD,
  MAX_REMINDERS,
  REMINDER_PRESETS,
  reminderLabel,
  reminderTimes,
} from "@/lib/reminders";
import type { Item } from "@/lib/types";
import { formatClock } from "@/lib/utils";
import { useUi } from "@/store/ui";
import { useWorkspace } from "@/store/workspace";
import { NotificationPermission } from "./NotificationPermission";

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
  const updateItem = useWorkspace((s) => s.updateItem);
  const snooze = useWorkspace((s) => s.snooze);
  const now = useNow(Boolean(item.snoozedUntil), 30_000);
  const defaultTime = useUi((s) => s.defaultReminderTime);
  const times = reminderTimes(item, defaultTime);
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
      {item.snoozedUntil && item.snoozedUntil > now ? (
        <p className="flex items-center gap-2 text-xs text-stone-600 dark:text-stone-300">
          Snoozed until {formatWhen(item.snoozedUntil)}
          {!readOnly && (
            <button
              type="button"
              className="btn btn-ghost px-1.5 py-0.5 text-xs"
              onClick={() => snooze(item.id, null)}
            >
              Unsnooze
            </button>
          )}
        </p>
      ) : null}
      {times.length > 0 && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(item.constantReminder)}
            disabled={readOnly}
            onChange={(e) => updateItem(item.id, { constantReminder: e.target.checked })}
            className="size-4 accent-accent-600"
          />
          Keep reminding me every 5 minutes until it’s done
        </label>
      )}
      {times.length > 0 && !readOnly && <NotificationPermission />}
      {!item.dueTime && times.length > 0 && (
        <p className="text-xs text-stone-500 dark:text-stone-400">
          All-day task: reminders count back from {formatClock(defaultTime)} on the due date (change
          this in reminder settings).
        </p>
      )}
    </div>
  );
}
