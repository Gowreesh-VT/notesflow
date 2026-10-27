"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Cloud, X } from "lucide-react";
import { countOwnTasks, NUDGE_KEY, shouldNudgeSignIn } from "@/lib/signin-nudge";
import { useSyncStore } from "@/store/sync";
import { useWorkspace } from "@/store/workspace";

const AuthDialog = dynamic(() => import("./AuthDialog").then((m) => m.AuthDialog));

type CloudStatus = {
  configured: boolean;
  google: boolean;
  email?: boolean;
  database: string | null;
};

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(NUDGE_KEY) === "dismissed";
  } catch {
    return false;
  }
}

/** A one-line offer, shown once after a few tasks, to sign in so they sync across devices. */
export function SignInNudge() {
  const [cloud, setCloud] = useState<CloudStatus | null>(null);
  const [dismissed, setDismissed] = useState(readDismissed);
  const [open, setOpen] = useState(false);
  const signedIn = useSyncStore((s) => s.userId !== null);
  const taskCount = useWorkspace((s) => countOwnTasks(s.items));

  useEffect(() => {
    if (dismissed) return;
    let active = true;
    fetch("/api/cloud")
      .then((r) => (r.ok ? (r.json() as Promise<CloudStatus>) : null))
      .then((status) => {
        if (active) setCloud(status);
      })
      .catch(() => {
        // Offline or no server: stay local-only.
      });
    return () => {
      active = false;
    };
  }, [dismissed]);

  const dismiss = () => {
    try {
      window.localStorage.setItem(NUDGE_KEY, "dismissed");
    } catch {
      // Storage unavailable: the message returns on the next start.
    }
    setDismissed(true);
  };

  const accountsAvailable = cloud?.configured === true && cloud.database === "ok";

  if (open && cloud) {
    return (
      <AuthDialog
        google={cloud.google}
        emailReset={cloud.email === true}
        onClose={() => setOpen(false)}
      />
    );
  }
  if (!shouldNudgeSignIn({ accountsAvailable, signedIn, dismissed, taskCount })) return null;

  return (
    <div className="flex items-center gap-2 border-b border-stone-200 bg-accent-50 px-4 py-2 text-sm text-stone-700 sm:px-6 dark:border-stone-800 dark:bg-stone-950 dark:text-stone-300">
      <Cloud size={16} aria-hidden className="shrink-0" />
      <span className="min-w-0 flex-1">
        Sign in to keep your tasks on all your devices. They stay on this device too.
      </span>
      <button
        type="button"
        className="btn btn-primary px-3 py-1 text-xs"
        onClick={() => setOpen(true)}
      >
        Sign in
      </button>
      <button
        type="button"
        className="btn btn-ghost px-2 py-1"
        aria-label="Not now"
        onClick={dismiss}
      >
        <X size={14} aria-hidden />
      </button>
    </div>
  );
}
