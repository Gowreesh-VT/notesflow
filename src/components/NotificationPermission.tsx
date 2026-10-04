"use client";

import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import {
  notificationPermission,
  requestNotificationPermission,
  type PermissionState,
} from "@/lib/notifications";

/** Explains and requests notification permission; reminders still show inside the app without it. */
export function NotificationPermission() {
  const [permission, setPermission] = useState<PermissionState | null>(null);
  useEffect(() => {
    const read = () => setPermission(notificationPermission());
    const id = window.setTimeout(read, 0);
    return () => window.clearTimeout(id);
  }, []);

  if (permission === null || permission === "granted") return null;
  if (permission === "unsupported") {
    return (
      <p className="text-xs text-stone-500 dark:text-stone-400">
        This browser can’t show notifications, so reminders appear inside Notesflow while it’s open.
      </p>
    );
  }
  if (permission === "denied") {
    return (
      <p className="text-xs text-stone-500 dark:text-stone-400">
        Notifications are blocked for this site. Allow them in your browser’s site settings to get
        reminders outside the app; until then they appear inside Notesflow.
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-accent-50 px-3 py-2 text-xs text-accent-900 dark:bg-accent-950/60 dark:text-accent-100">
      <BellRing size={14} aria-hidden className="shrink-0" />
      <span className="min-w-0 flex-1">
        Get reminders as notifications while Notesflow is open, even in another tab.
      </span>
      <button
        type="button"
        className="btn btn-primary px-2 py-1 text-xs"
        onClick={async () => setPermission(await requestNotificationPermission())}
      >
        Turn on
      </button>
    </div>
  );
}
