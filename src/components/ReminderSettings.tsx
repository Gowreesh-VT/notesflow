"use client";

import { useState } from "react";
import { BellRing } from "lucide-react";
import { notificationPermission, showNotification } from "@/lib/notifications";
import { useUi } from "@/store/ui";
import { NotificationPermission } from "./NotificationPermission";
import { PushSettings } from "./PushSettings";

/** Per-device reminder settings, shown inside the Settings page. */
export function ReminderSettings() {
  const defaultTime = useUi((s) => s.defaultReminderTime);
  const quietHours = useUi((s) => s.quietHours);
  const { setDefaultReminderTime, setQuietHours } = useUi.getState();
  const [testResult, setTestResult] = useState("");

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Notifications</h3>
        <NotificationPermission />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn btn-ghost px-2 py-1 text-xs"
            onClick={async () => {
              const shown = await showNotification(
                "Notesflow reminder",
                { body: "Notifications are working.", tag: "test", itemId: "" },
                () => {},
              );
              setTestResult(
                shown
                  ? "Sent. If you don’t see it, check your system’s notification settings."
                  : notificationPermission() === "granted"
                    ? "This browser could not show it."
                    : "Turn on notifications first. Reminders still appear inside Notesflow.",
              );
            }}
          >
            <BellRing size={13} aria-hidden /> Send a test notification
          </button>
          <span role="status" className="text-xs text-stone-500 dark:text-stone-400">
            {testResult}
          </span>
        </div>
        <p className="text-xs text-stone-500 dark:text-stone-400">
          While Notesflow is open (in a tab or as an installed app), reminders ring from the app
          itself.
        </p>
      </section>

      <PushSettings />

      <section className="space-y-2">
        <label htmlFor="default-reminder-time" className="block text-sm font-semibold">
          Default reminder time
        </label>
        <input
          id="default-reminder-time"
          type="time"
          value={defaultTime}
          onChange={(e) => setDefaultReminderTime(e.target.value)}
          className="field w-auto"
        />
        <p className="text-xs text-stone-500 dark:text-stone-400">
          Used for tasks without a time and for “tomorrow morning” snoozes.
        </p>
      </section>

      <section className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={quietHours !== null}
            onChange={(e) =>
              setQuietHours(e.target.checked ? { start: "22:00", end: "07:00" } : null)
            }
            className="size-4 accent-accent-600"
          />
          Quiet hours
        </label>
        {quietHours && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span>From</span>
            <input
              type="time"
              aria-label="Quiet hours start"
              value={quietHours.start}
              onChange={(e) => setQuietHours({ ...quietHours, start: e.target.value })}
              className="field w-auto"
            />
            <span>to</span>
            <input
              type="time"
              aria-label="Quiet hours end"
              value={quietHours.end}
              onChange={(e) => setQuietHours({ ...quietHours, end: e.target.value })}
              className="field w-auto"
            />
          </div>
        )}
        <p className="text-xs text-stone-500 dark:text-stone-400">
          Nothing rings during quiet hours; held reminders ring when they end. These settings apply
          to this device.
        </p>
      </section>
    </div>
  );
}
