"use client";

import { useEffect, useState } from "react";
import { signIn, signOut } from "next-auth/react";
import { KeyRound, Trash2 } from "lucide-react";
import { disablePush } from "@/lib/push-client";
import { wipeLocalAccountData } from "@/lib/sync-client";
import { useSyncStore } from "@/store/sync";
import { SettingsSection } from "./SettingsView";

type Info = { email: string; hasPassword: boolean };

async function call(method: string, url: string, body?: unknown): Promise<string | null> {
  const response = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (response.ok) return null;
  const data = (await response.json().catch(() => null)) as { error?: string } | null;
  return data?.error ?? "Something went wrong. Please try again.";
}

function ChangePassword({ info, onChanged }: { info: Info; onChanged: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  return (
    <form
      className="space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (next !== confirm) {
          setMessage("The new passwords don’t match.");
          return;
        }
        setBusy(true);
        setMessage("");
        const error = await call("POST", "/api/account/password", {
          current: info.hasPassword ? current : undefined,
          next,
        }).catch(() => "You’re offline. Try again when you’re connected.");
        if (error) {
          setMessage(error);
          setBusy(false);
          return;
        }
        // Other sessions ended with the change; sign this device in again with the new password.
        await signIn("credentials", { email: info.email, password: next, redirect: false }).catch(
          () => null,
        );
        setCurrent("");
        setNext("");
        setConfirm("");
        setBusy(false);
        setMessage(
          info.hasPassword
            ? "Password changed. Other devices were signed out."
            : "Password added. You can now also sign in with your email and password.",
        );
        onChanged();
      }}
    >
      <h3 className="flex items-center gap-1.5 text-sm font-semibold">
        <KeyRound size={14} aria-hidden /> {info.hasPassword ? "Change password" : "Add a password"}
      </h3>
      {info.hasPassword && (
        <input
          type="password"
          autoComplete="current-password"
          placeholder="Current password"
          aria-label="Current password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          className="field w-full max-w-sm"
          required
        />
      )}
      <input
        type="password"
        autoComplete="new-password"
        placeholder="New password (at least 10 characters)"
        aria-label="New password"
        minLength={10}
        maxLength={128}
        value={next}
        onChange={(e) => setNext(e.target.value)}
        className="field w-full max-w-sm"
        required
      />
      <input
        type="password"
        autoComplete="new-password"
        placeholder="Repeat the new password"
        aria-label="Repeat the new password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        className="field w-full max-w-sm"
        required
      />
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Saving…" : info.hasPassword ? "Change password" : "Add password"}
        </button>
        <p role="status" aria-live="polite" className="text-xs text-stone-500 dark:text-stone-400">
          {message}
        </p>
      </div>
    </form>
  );
}

function DeleteAccount({ info }: { info: Info }) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  if (!open) {
    return (
      <button
        type="button"
        className="btn btn-ghost text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
        onClick={() => setOpen(true)}
      >
        <Trash2 size={15} aria-hidden /> Delete account…
      </button>
    );
  }

  return (
    <form
      className="space-y-2 rounded-xl border border-red-200 bg-red-50/60 p-3 dark:border-red-900 dark:bg-red-950/30"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMessage("");
        const error = await call(
          "DELETE",
          "/api/account",
          info.hasPassword ? { password: confirmation } : { email: confirmation },
        ).catch(() => "You’re offline. Try again when you’re connected.");
        if (error) {
          setMessage(error);
          setBusy(false);
          return;
        }
        await disablePush();
        await signOut({ redirect: false }).catch(() => null);
        wipeLocalAccountData();
        setBusy(false);
      }}
    >
      <h3 className="text-sm font-semibold text-red-800 dark:text-red-300">Delete your account</h3>
      <p className="text-sm text-stone-700 dark:text-stone-300">
        This permanently deletes your account and every task, note, list, habit and setting stored
        in it, on the server and on this device. It can’t be undone. Export a backup first if you
        want to keep a copy.
      </p>
      <input
        type={info.hasPassword ? "password" : "email"}
        autoComplete={info.hasPassword ? "current-password" : "off"}
        aria-label={info.hasPassword ? "Your password" : "Your email address"}
        placeholder={info.hasPassword ? "Your password" : `Type ${info.email} to confirm`}
        value={confirmation}
        onChange={(e) => setConfirmation(e.target.value)}
        className="field w-full max-w-sm"
        required
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={busy || !confirmation}
          className="btn bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
        >
          {busy ? "Deleting…" : "Delete account and data"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
          Cancel
        </button>
        <p role="alert" className="text-xs text-red-700 dark:text-red-400">
          {message}
        </p>
      </div>
    </form>
  );
}

/** Password and account deletion for the signed-in account. Hidden when not signed in. */
export function AccountSettings() {
  const userId = useSyncStore((s) => s.userId);
  const [info, setInfo] = useState<Info | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    fetch("/api/account")
      .then((r) => (r.ok ? (r.json() as Promise<Info>) : null))
      .then((data) => active && setInfo(data))
      .catch(() => {
        // Offline: the section stays hidden until the account can be reached.
      });
    return () => {
      active = false;
    };
  }, [userId, version]);

  if (!userId || !info) return null;
  return (
    <SettingsSection title="Account" description={`Signed in as ${info.email}.`}>
      <ChangePassword info={info} onChanged={() => setVersion((v) => v + 1)} />
      <div className="pt-2">
        <DeleteAccount info={info} />
      </div>
    </SettingsSection>
  );
}
