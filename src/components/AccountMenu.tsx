"use client";

import { useEffect, useState } from "react";
import { SessionProvider, signOut, useSession } from "next-auth/react";
import { Cloud, CloudOff, LogIn, LogOut, RefreshCw } from "lucide-react";
import { runSync, wipeLocalAccountData } from "@/lib/sync-client";
import { formatRelativeTime } from "@/lib/utils";
import { disablePush } from "@/lib/push-client";
import { useSyncStore } from "@/store/sync";
import dynamic from "next/dynamic";
import { askConfirm } from "@/store/dialog";
import { authErrorMessage } from "./auth-errors";

const AuthDialog = dynamic(() => import("./AuthDialog").then((m) => m.AuthDialog));
const ResetPasswordDialog = dynamic(() =>
  import("./ResetPasswordDialog").then((m) => m.ResetPasswordDialog),
);
import { SyncRunner } from "./SyncRunner";

type CloudStatus = {
  configured: boolean;
  google: boolean;
  email?: boolean;
  database: "ok" | "missing-tables" | "unreachable" | null;
};

function AccountPanel({ google, emailReset }: { google: boolean; emailReset: boolean }) {
  const { data, status: authStatus } = useSession();
  const sync = useSyncStore();
  // Sign-in failures from the Google redirect come back as ?error=..., and the landing page links with ?signin=1.
  const [initialError] = useState<string | null>(() =>
    typeof window === "undefined"
      ? null
      : authErrorMessage(new URLSearchParams(window.location.search).get("error")),
  );
  const [open, setOpen] = useState(
    () =>
      typeof window !== "undefined" &&
      (initialError !== null || new URLSearchParams(window.location.search).has("signin")),
  );

  // The link in a password reset email opens /app?reset=<token>.
  const [resetToken, setResetToken] = useState<string | null>(() =>
    typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("reset"),
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("error") || params.has("signin") || params.has("reset")) {
      params.delete("error");
      params.delete("signin");
      params.delete("reset");
      const rest = params.toString();
      window.history.replaceState(null, "", window.location.pathname + (rest ? `?${rest}` : ""));
    }
  }, []);

  if (authStatus === "loading") return null;

  if (resetToken) {
    return <ResetPasswordDialog token={resetToken} onClose={() => setResetToken(null)} />;
  }

  if (!data?.user) {
    return (
      <>
        <button
          type="button"
          className="btn btn-ghost w-full justify-start text-xs"
          onClick={() => setOpen(true)}
        >
          <LogIn size={14} aria-hidden /> Sign in to sync
        </button>
        {open && (
          <AuthDialog
            google={google}
            emailReset={emailReset}
            initialError={initialError}
            onClose={() => setOpen(false)}
          />
        )}
      </>
    );
  }

  const statusText =
    sync.status === "syncing"
      ? "Syncing…"
      : sync.status === "offline"
        ? "Offline — will sync when back online"
        : sync.status === "error"
          ? (sync.error ?? "Sync failed")
          : sync.lastSyncedAt
            ? `Synced ${formatRelativeTime(sync.lastSyncedAt)}`
            : "Waiting to sync";

  return (
    <div className="space-y-1 rounded-lg bg-stone-200/60 p-2 text-xs dark:bg-stone-800/60">
      <p
        className="flex items-center gap-1.5 truncate font-medium"
        title={data.user.email ?? undefined}
      >
        {sync.status === "offline" ? (
          <CloudOff size={13} aria-hidden />
        ) : (
          <Cloud size={13} aria-hidden />
        )}
        <span className="truncate">{data.user.email ?? data.user.name}</span>
      </p>
      <p role="status" aria-live="polite" className="text-stone-600 dark:text-stone-400">
        {statusText}
      </p>
      <div className="flex gap-1">
        <button
          type="button"
          className="btn btn-ghost px-2 py-1 text-xs"
          onClick={() => void runSync()}
        >
          <RefreshCw size={12} aria-hidden /> Sync now
        </button>
        <button
          type="button"
          className="btn btn-ghost px-2 py-1 text-xs"
          onClick={async () => {
            const confirmed = await askConfirm({
              title: "Sign out?",
              message: "Your data stays in your account, but it will be removed from this device.",
              confirmLabel: "Sign out",
              danger: true,
            });
            if (!confirmed) return;
            await runSync();
            if (useSyncStore.getState().status === "error") {
              const anyway = await askConfirm({
                title: "Sign out anyway?",
                message: "The last sync failed, so recent changes may be lost.",
                confirmLabel: "Sign out anyway",
                danger: true,
              });
              if (!anyway) return;
            }
            // This device must stop receiving this account's reminders.
            await disablePush();
            await signOut({ redirect: false });
            wipeLocalAccountData();
          }}
        >
          <LogOut size={12} aria-hidden /> Sign out
        </button>
      </div>
    </div>
  );
}

/** Account and sync controls. Renders nothing unless accounts are set up on this deployment. */
export function AccountMenu() {
  const [cloud, setCloud] = useState<CloudStatus | null>(null);

  useEffect(() => {
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
  }, []);

  if (!cloud?.configured) return null;

  if (cloud.database !== "ok") {
    return (
      <p role="status" className="px-2 text-xs text-stone-500 dark:text-stone-400">
        Sync is not available yet: the account database is still being set up.
      </p>
    );
  }

  return (
    <SessionProvider>
      <SyncRunner />
      <AccountPanel google={cloud.google} emailReset={cloud.email === true} />
    </SessionProvider>
  );
}
