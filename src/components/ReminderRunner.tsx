"use client";

import { useEffect } from "react";
import { Bell, Check, ExternalLink, X } from "lucide-react";
import { dueAlarms, pruneFired, repeatAlarms } from "@/lib/alarms";
import { showNotification } from "@/lib/notifications";
import { useAlarms } from "@/store/alarms";
import { useUi } from "@/store/ui";
import { useWorkspace } from "@/store/workspace";

const CHECK_MS = 15_000;

const item = (itemId: string) => useWorkspace.getState().items.find((i) => i.id === itemId);

const openItem = (itemId: string) => {
  const ui = useUi.getState();
  const item = useWorkspace.getState().items.find((i) => i.id === itemId);
  if (!item) return;
  ui.setView(
    item.listId === "inbox" ? { kind: "smart", id: "inbox" } : { kind: "list", id: item.listId },
  );
  ui.selectItem(itemId);
};

/** Checks reminders while the app is open and shows them as system notifications and in-app cards. */
export function ReminderRunner() {
  useEffect(() => {
    let active = true;
    void useAlarms.persist.rehydrate();

    const check = () => {
      if (!active || !useAlarms.persist.hasHydrated()) return;
      const now = Date.now();
      const alarms = useAlarms.getState();
      const fired = pruneFired(alarms.fired, now);
      if (fired !== alarms.fired) alarms.setFired(fired);
      const items = useWorkspace.getState().items;
      const due = [...dueAlarms(items, now, fired), ...repeatAlarms(items, now, alarms.lastShown)];
      if (!due.length) return;
      alarms.markFired(due, now);
      for (const alarm of due) {
        void showNotification(
          alarm.title,
          {
            body: `Reminder · ${alarm.label}`,
            // Repeats replace the previous notification for the task instead of stacking.
            tag: alarm.repeat ? `repeat:${alarm.itemId}` : alarm.key,
            itemId: alarm.itemId,
            requireInteraction: Boolean(item(alarm.itemId)?.constantReminder),
          },
          () => openItem(alarm.itemId),
        );
      }
    };

    check();
    const interval = window.setInterval(check, CHECK_MS);
    const onVisible = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVisible);
    // Clicking a notification shown by the service worker focuses this tab and asks it to open the task.
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "open-item" && typeof event.data.itemId === "string") {
        openItem(event.data.itemId);
      }
    };
    navigator.serviceWorker?.addEventListener("message", onMessage);
    // Finishing a task clears its reminder cards.
    const unsubscribe = useWorkspace.subscribe((state) => {
      const { active: shown, dismissItem } = useAlarms.getState();
      for (const alarm of shown) {
        const item = state.items.find((i) => i.id === alarm.itemId);
        if (!item || item.status !== "open" || item.deletedAt !== null) dismissItem(alarm.itemId);
      }
    });
    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      navigator.serviceWorker?.removeEventListener("message", onMessage);
      unsubscribe();
    };
  }, []);

  return <ReminderCards />;
}

function ReminderCards() {
  const shown = useAlarms((s) => s.active);
  const dismiss = useAlarms((s) => s.dismiss);
  const toggleDone = useWorkspace((s) => s.toggleDone);
  if (!shown.length) return null;
  return (
    <div
      aria-live="assertive"
      className="fixed inset-x-3 bottom-3 z-40 flex flex-col gap-2 sm:inset-x-auto sm:bottom-5 sm:left-24 sm:w-80"
    >
      {shown.slice(-3).map((alarm) => (
        <div
          key={alarm.key}
          role="alert"
          className="rounded-2xl border border-stone-200 bg-white p-3 shadow-lift dark:border-stone-700 dark:bg-stone-900"
        >
          <div className="flex items-start gap-2">
            <Bell
              size={16}
              aria-hidden
              className="mt-0.5 shrink-0 text-accent-600 dark:text-accent-400"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{alarm.title}</p>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Reminder · {alarm.label}
                {item(alarm.itemId)?.constantReminder && " · repeats every 5 minutes until done"}
              </p>
            </div>
            <button
              type="button"
              className="btn btn-ghost -mr-1 -mt-1 px-1.5"
              aria-label="Dismiss reminder"
              onClick={() => dismiss(alarm.key)}
            >
              <X size={15} />
            </button>
          </div>
          <div className="mt-2 flex flex-wrap justify-end gap-1">
            <button
              type="button"
              className="btn btn-ghost px-2 py-1 text-xs"
              onClick={() => {
                openItem(alarm.itemId);
                dismiss(alarm.key);
              }}
            >
              <ExternalLink size={13} aria-hidden /> Open
            </button>
            <button
              type="button"
              className="btn btn-primary px-2 py-1 text-xs"
              onClick={() => toggleDone(alarm.itemId)}
            >
              <Check size={13} aria-hidden /> Done
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
