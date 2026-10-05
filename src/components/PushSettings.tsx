"use client";

import { useEffect, useState } from "react";
import { BellPlus, BellOff } from "lucide-react";
import { currentPushSubscription, disablePush, enablePush, pushSupported } from "@/lib/push-client";
import { useSyncStore } from "@/store/sync";
import { useUi } from "@/store/ui";

type State = "loading" | "unavailable" | "signed-out" | "unsupported" | "off" | "on";

/** Turns push reminders (which ring even when Notesflow is closed) on or off for this device. */
export function PushSettings() {
  const signedIn = useSyncStore((s) => s.userId !== null);
  const [publicKey, setPublicKey] = useState<string | null | undefined>(undefined);
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/cloud")
      .then((r) => (r.ok ? (r.json() as Promise<{ push?: string | null }>) : null))
      .then((cloud) => active && setPublicKey(cloud?.push ?? null))
      .catch(() => active && setPublicKey(null));
    currentPushSubscription()
      .then((s) => active && setSubscribed(Boolean(s)))
      .catch(() => active && setSubscribed(false));
    return () => {
      active = false;
    };
  }, []);

  const state: State =
    publicKey === undefined || subscribed === null
      ? "loading"
      : !publicKey
        ? "unavailable"
        : !signedIn
          ? "signed-out"
          : !pushSupported()
            ? "unsupported"
            : subscribed
              ? "on"
              : "off";

  const toggle = async () => {
    setBusy(true);
    setMessage("");
    try {
      if (state === "on") {
        await disablePush();
        setSubscribed(false);
        setMessage("Push reminders are off for this device.");
      } else if (publicKey) {
        const { defaultReminderTime, quietHours } = useUi.getState();
        await enablePush(publicKey, { defaultReminderTime, quietHours });
        setSubscribed(true);
        setMessage("Done. Reminders will reach this device even when Notesflow is closed.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const explanation: Record<State, string> = {
    loading: "Checking…",
    unavailable: "Not set up on this server yet.",
    "signed-out": "Sign in to sync first: the server needs your tasks to know when to remind you.",
    unsupported:
      "This browser can’t receive push reminders. On iPhone and iPad, add Notesflow to your Home Screen first.",
    off: "Get reminders on this device even when Notesflow is closed.",
    on: "On for this device. Reminders arrive even when Notesflow is closed.",
  };

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">When Notesflow is closed</h3>
      <p className="text-xs text-stone-500 dark:text-stone-400">{explanation[state]}</p>
      {(state === "on" || state === "off") && (
        <button
          type="button"
          className={
            state === "on" ? "btn btn-ghost px-2 py-1 text-xs" : "btn btn-primary px-2 py-1 text-xs"
          }
          disabled={busy}
          onClick={() => void toggle()}
        >
          {state === "on" ? <BellOff size={13} aria-hidden /> : <BellPlus size={13} aria-hidden />}
          {state === "on" ? "Turn off push reminders" : "Turn on push reminders"}
        </button>
      )}
      <p role="status" aria-live="polite" className="text-xs text-stone-600 dark:text-stone-300">
        {message}
      </p>
    </section>
  );
}
