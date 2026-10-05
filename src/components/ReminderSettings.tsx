"use client";

import { useEffect, useRef, useState } from "react";
import { useModalFocus } from "@/lib/hooks";
import { BellRing, X } from "lucide-react";
import { notificationPermission, showNotification } from "@/lib/notifications";
import { useUi } from "@/store/ui";
import { NotificationPermission } from "./NotificationPermission";
import { PushSettings } from "./PushSettings";

function SettingsDialog({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDivElement>(null);
  useModalFocus(dialog);
  const defaultTime = useUi((s) => s.defaultReminderTime);
  const quietHours = useUi((s) => s.quietHours);
  const { setDefaultReminderTime, setQuietHours } = useUi.getState();
  const [testResult, setTestResult] = useState("");

  useEffect(() => {
    dialog.current?.focus();
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[12vh]"
      onMouseDown={onClose}
    >
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reminder-settings-title"
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onClose();
          }
        }}
        className="w-full max-w-md space-y-5 rounded-2xl border border-stone-200 bg-white p-5 shadow-lift outline-none dark:border-stone-700 dark:bg-stone-900"
      >
        <div className="flex items-center justify-between">
          <h2 id="reminder-settings-title" className="heading-display text-xl font-semibold">
            Reminders
          </h2>
          <button
            type="button"
            className="btn btn-ghost px-1.5"
            aria-label="Close"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

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
            Nothing rings during quiet hours; held reminders ring when they end. These settings
            apply to this device.
          </p>
        </section>
      </div>
    </div>
  );
}

export function ReminderSettings() {
  const open = useUi((s) => s.settingsOpen);
  const setOpen = useUi((s) => s.setSettingsOpen);
  return open ? <SettingsDialog onClose={() => setOpen(false)} /> : null;
}
