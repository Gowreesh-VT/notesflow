"use client";

import { useEffect, useState } from "react";
import { BellRing, X } from "lucide-react";
import { currentPushSubscription, enablePush, pushSupported } from "@/lib/push-client";
import {
  detectPhone,
  hasReminder,
  PUSH_OFFER_KEY,
  pushSteps,
  shouldOfferPush,
} from "@/lib/push-offer";
import { useSyncStore } from "@/store/sync";
import { useUi } from "@/store/ui";
import { useWorkspace } from "@/store/workspace";

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(PUSH_OFFER_KEY) === "dismissed";
  } catch {
    return false;
  }
}

/** Once a reminder exists, offers reminders that arrive while Notesflow is closed, with steps for this phone. */
export function PushOffer() {
  const signedIn = useSyncStore((s) => s.userId !== null);
  const reminderAdded = useWorkspace((s) => hasReminder(s.items));
  const [dismissed, setDismissed] = useState(readDismissed);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [subscribed, setSubscribed] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const wanted = signedIn && reminderAdded && !dismissed;

  useEffect(() => {
    if (!wanted) return;
    let active = true;
    fetch("/api/cloud")
      .then((r) => (r.ok ? (r.json() as Promise<{ push?: string | null }>) : null))
      .then((cloud) => active && setPublicKey(cloud?.push ?? null))
      .catch(() => {
        // Offline or no server: no offer.
      });
    currentPushSubscription()
      .then((s) => active && setSubscribed(Boolean(s)))
      .catch(() => active && setSubscribed(false));
    return () => {
      active = false;
    };
  }, [wanted]);

  const phone = detectPhone(navigator.userAgent, navigator.maxTouchPoints);
  const canSubscribe = pushSupported();
  const offer = shouldOfferPush({
    pushAvailable: Boolean(publicKey),
    signedIn,
    // iPhone browsers only get push once the app is on the Home Screen, so they still see the steps.
    supported: canSubscribe || phone === "ios",
    subscribed,
    dismissed,
    hasReminder: reminderAdded,
  });
  if (!offer) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(PUSH_OFFER_KEY, "dismissed");
    } catch {
      // Storage unavailable: the message returns on the next start.
    }
    setDismissed(true);
  };

  const turnOn = async () => {
    if (!publicKey) return;
    setBusy(true);
    setMessage("");
    try {
      const { defaultReminderTime, quietHours } = useUi.getState();
      await enablePush(publicKey, { defaultReminderTime, quietHours });
      setSubscribed(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-b border-stone-200 bg-accent-50 px-4 py-2 text-sm text-stone-700 sm:px-6 dark:border-stone-800 dark:bg-stone-950 dark:text-stone-300">
      <div className="flex items-center gap-2">
        <BellRing size={16} aria-hidden className="shrink-0" />
        <span className="min-w-0 flex-1">Get reminders even when Notesflow is closed.</span>
        {canSubscribe && (
          <button
            type="button"
            className="btn btn-primary px-3 py-1 text-xs"
            disabled={busy}
            onClick={() => void turnOn()}
          >
            Turn on
          </button>
        )}
        <button
          type="button"
          className="btn btn-ghost px-2 py-1"
          aria-label="Not now"
          onClick={dismiss}
        >
          <X size={14} aria-hidden />
        </button>
      </div>
      <ol className="mt-1 list-decimal space-y-0.5 pl-9 text-xs text-stone-500 dark:text-stone-400">
        {pushSteps(phone).map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <p
        role="status"
        aria-live="polite"
        className="pl-6 text-xs text-stone-600 dark:text-stone-300"
      >
        {message}
      </p>
    </div>
  );
}
