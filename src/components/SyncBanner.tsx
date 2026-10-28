"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CloudOff, Loader2, RefreshCw } from "lucide-react";
import clsx from "clsx";
import { runSync } from "@/lib/sync-client";
import { useSyncStore } from "@/store/sync";

/** Tracks the browser's online state. */
function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    const id = window.setTimeout(update, 0);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

/** True once `active` has stayed true for `delayMs`, so quick syncs never flash a banner. */
function useDelayed(active: boolean, delayMs: number): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setShown(active), active ? delayMs : 0);
    return () => window.clearTimeout(id);
  }, [active, delayMs]);
  return active && shown;
}

function Banner({
  tone,
  icon,
  children,
  action,
}: {
  tone: "neutral" | "warning" | "error";
  icon: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={clsx(
        "flex items-center gap-2 border-b px-4 py-2 text-sm sm:px-6",
        tone === "neutral" &&
          "border-stone-200 bg-stone-50 text-stone-600 dark:border-stone-800 dark:bg-stone-950 dark:text-stone-300",
        tone === "warning" &&
          "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/50 dark:text-amber-100",
        tone === "error" &&
          "border-red-200 bg-red-50 text-red-900 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-100",
      )}
    >
      <span aria-hidden className="shrink-0">
        {icon}
      </span>
      <span className="min-w-0 flex-1">{children}</span>
      {action}
    </div>
  );
}

/** One-line status above the list, only while changes are waiting to sync, after a failed sync, or offline. */
export function SyncBanner() {
  const online = useOnline();
  const { userId, status, error } = useSyncStore();
  // The sync store knows the signed-in account once sync has started; signing out clears it.
  const signedIn = userId !== null;
  const slowSync = useDelayed(signedIn && status === "syncing", 1500);

  if (!online || (signedIn && status === "offline")) {
    return (
      <Banner tone="warning" icon={<CloudOff size={16} />}>
        You’re offline. Everything still works and is saved on this device
        {signedIn ? "; it will sync when you’re back online." : "."}
      </Banner>
    );
  }
  if (signedIn && status === "error") {
    return (
      <Banner
        tone="error"
        icon={<AlertTriangle size={16} />}
        action={
          <button
            type="button"
            className="btn btn-ghost px-2 py-1 text-xs"
            onClick={() => void runSync()}
          >
            <RefreshCw size={13} aria-hidden /> Retry
          </button>
        }
      >
        Sync failed: {error ?? "something went wrong"}. Your changes are safe on this device.
      </Banner>
    );
  }
  if (slowSync) {
    return (
      <Banner tone="neutral" icon={<Loader2 size={16} className="animate-spin" />}>
        Syncing your changes…
      </Banner>
    );
  }
  return null;
}
