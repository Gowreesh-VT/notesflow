"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { signIn } from "next-auth/react";

/** Opened from the link in a password reset email (/app?reset=…): choose a new password, then sign in. */
export function ResetPasswordDialog({ token, onClose }: { token: string; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[12vh]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reset-title"
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
        className="w-full max-w-sm rounded-xl border border-stone-200 bg-white p-5 shadow-lift dark:border-stone-700 dark:bg-stone-900"
      >
        <h2 id="reset-title" className="text-lg font-semibold">
          Choose a new password
        </h2>
        <form
          className="mt-4 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (password !== confirm) {
              setError("The passwords don’t match.");
              return;
            }
            setBusy(true);
            setError(null);
            try {
              const response = await fetch("/api/password-reset/confirm", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, password }),
              });
              const body = (await response.json().catch(() => null)) as {
                email?: string;
                error?: string;
              } | null;
              if (!response.ok || !body?.email) {
                setError(body?.error ?? "Could not reset the password.");
                return;
              }
              await signIn("credentials", { email: body.email, password, redirect: false });
              onClose();
            } catch {
              setError("Could not reach the server. Check your connection and try again.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="block text-sm">
            New password
            <input
              type="password"
              required
              minLength={10}
              maxLength={128}
              autoComplete="new-password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field mt-1"
            />
            <span className="mt-1 block text-xs text-stone-500">At least 10 characters.</span>
          </label>
          <label className="block text-sm">
            Repeat it
            <input
              type="password"
              required
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="field mt-1"
            />
          </label>
          <p role="alert" className="min-h-5 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary flex-1" disabled={busy}>
              {busy ? "Please wait…" : "Set password and sign in"}
            </button>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
