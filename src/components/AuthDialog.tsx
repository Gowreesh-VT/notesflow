"use client";

import { useEffect, useRef, useState } from "react";
import { useModalFocus } from "@/lib/hooks";
import { createPortal } from "react-dom";
import { signIn } from "next-auth/react";

type Mode = "signin" | "signup" | "forgot";

const AUTH_ERRORS: Record<string, string> = {
  OAuthAccountNotLinked:
    "That email already has an account that uses a different sign-in method. Sign in the way you did before.",
  CredentialsSignin: "Wrong email or password, or too many attempts. Try again in a few minutes.",
  AccessDenied: "Access was denied.",
  Configuration: "Sign-in is not available right now because the server is not fully set up yet.",
};

export function authErrorMessage(code: string | null | undefined): string | null {
  if (!code) return null;
  return AUTH_ERRORS[code] ?? "Could not sign in. Please try again.";
}

export function AuthDialog({
  google,
  emailReset = false,
  initialError,
  onClose,
}: {
  google: boolean;
  /** Password reset by email is set up on this server. */
  emailReset?: boolean;
  initialError?: string | null;
  onClose: () => void;
}) {
  const modalRef = useRef<HTMLDivElement>(null);
  useModalFocus(modalRef);
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const emailInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    emailInput.current?.focus();
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === "forgot") {
        const response = await fetch("/api/password-reset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const body = (await response.json().catch(() => null)) as {
          message?: string;
          error?: string;
        } | null;
        if (response.ok) setNotice(body?.message ?? "Check your email for a reset link.");
        else setError(body?.error ?? "Could not send a reset link.");
        return;
      }
      if (mode === "signup") {
        const response = await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, name }),
        });
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          setError(body?.error ?? "Could not create the account.");
          return;
        }
      }
      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) {
        setError(authErrorMessage(result.error));
        return;
      }
      onClose();
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  // Rendered in a portal: the sidebar is transformed, which would otherwise trap a fixed overlay inside it.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[12vh]"
      onMouseDown={onClose}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
        className="w-full max-w-sm rounded-xl border border-stone-200 bg-white p-5 shadow-lift dark:border-stone-700 dark:bg-stone-900"
      >
        <h2 id="auth-title" className="text-lg font-semibold">
          {mode === "signin"
            ? "Sign in to sync"
            : mode === "signup"
              ? "Create your account"
              : "Reset your password"}
        </h2>
        <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
          {mode === "forgot"
            ? "Enter your account’s email and we’ll send you a link to choose a new password."
            : "Your tasks and notes stay on this device and sync to your account across devices."}
        </p>

        {google && mode !== "forgot" && (
          <>
            <button
              type="button"
              className="btn mt-4 w-full border border-stone-300 dark:border-stone-700"
              onClick={() => void signIn("google", { callbackUrl: "/app" })}
            >
              Continue with Google
            </button>
            <p className="my-3 text-center text-xs text-stone-500 dark:text-stone-400">
              or with email
            </p>
          </>
        )}

        <form
          onSubmit={submit}
          className={google && mode !== "forgot" ? "space-y-3" : "mt-4 space-y-3"}
        >
          {mode === "signup" && (
            <label className="block text-sm">
              Name <span className="text-stone-500 dark:text-stone-400">(optional)</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                maxLength={80}
                className="field mt-1"
              />
            </label>
          )}
          <label className="block text-sm">
            Email
            <input
              ref={emailInput}
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="field mt-1"
            />
          </label>
          {mode !== "forgot" && (
            <label className="block text-sm">
              Password
              <input
                type="password"
                required
                minLength={mode === "signup" ? 10 : 1}
                maxLength={128}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                className="field mt-1"
              />
              {mode === "signup" && (
                <span className="mt-1 block text-xs text-stone-500 dark:text-stone-400">
                  At least 10 characters.
                </span>
              )}
              {mode === "signin" && emailReset && (
                <button
                  type="button"
                  className="mt-1 block text-xs text-accent-600 hover:underline dark:text-accent-400"
                  onClick={() => {
                    setMode("forgot");
                    setError(null);
                  }}
                >
                  Forgot your password?
                </button>
              )}
            </label>
          )}

          <p
            role="alert"
            aria-live="polite"
            className="min-h-5 text-sm text-red-600 dark:text-red-400"
          >
            {error}
          </p>
          {notice && (
            <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
              {notice}
            </p>
          )}

          <button type="submit" className="btn btn-primary w-full" disabled={busy}>
            {busy
              ? "Please wait…"
              : mode === "signin"
                ? "Sign in"
                : mode === "signup"
                  ? "Create account"
                  : "Send reset link"}
          </button>
        </form>

        <div className="mt-3 flex items-center justify-between text-sm">
          <button
            type="button"
            className="text-accent-600 hover:underline dark:text-accent-400"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
              setNotice(null);
            }}
          >
            {mode === "signin" ? "Create an account" : "Back to sign in"}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Not now
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
