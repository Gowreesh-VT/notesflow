"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { adoptUser, requestSync, runSync } from "@/lib/sync-client";
import { useWorkspace } from "@/store/workspace";

const POLL_MS = 60_000;

/** Keeps the signed-in account in sync: on sign-in, after edits, periodically, on focus and when back online. */
export function SyncRunner() {
  const { data } = useSession();
  const userId = data?.user?.id;

  useEffect(() => {
    if (!userId) return;
    adoptUser(userId);
    void runSync();

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void runSync();
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void runSync();
    };
    const onOnline = () => void runSync();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);

    // Local edits (a change to any synced collection) schedule a push.
    const unsubscribe = useWorkspace.subscribe((state, previous) => {
      if (
        state.items !== previous.items ||
        state.lists !== previous.lists ||
        state.folders !== previous.folders ||
        state.filters !== previous.filters ||
        state.habits !== previous.habits ||
        state.countdowns !== previous.countdowns ||
        state.tombstones !== previous.tombstones
      ) {
        requestSync();
      }
    });

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      unsubscribe();
    };
  }, [userId]);

  return null;
}
