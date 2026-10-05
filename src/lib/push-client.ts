import type { QuietHours } from "./reminders";

/** Browser side of push reminders: subscribe this device, keep its settings on the server, unsubscribe. */

export type PushSettings = { defaultReminderTime: string; quietHours: QuietHours | null };

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** VAPID keys are base64url; the Push API wants raw bytes. */
function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported()) return null;
  return (await navigator.serviceWorker.getRegistration()) ?? null;
}

export async function currentPushSubscription(): Promise<PushSubscription | null> {
  return (await (await registration())?.pushManager.getSubscription()) ?? null;
}

async function send(method: "POST" | "DELETE", body: unknown): Promise<void> {
  const response = await fetch("/api/push/subscribe", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const message = ((await response.json().catch(() => null)) as { error?: string } | null)?.error;
    throw new Error(message ?? "The server could not save this device.");
  }
}

const payload = (subscription: PushSubscription, settings: PushSettings) => ({
  ...subscription.toJSON(),
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  defaultReminderTime: settings.defaultReminderTime,
  quietHours: settings.quietHours,
});

/** Asks for permission if needed, subscribes this browser and registers it with the server. */
export async function enablePush(publicKey: string, settings: PushSettings): Promise<void> {
  const reg = await registration();
  if (!reg) {
    throw new Error(
      "This browser can’t receive push reminders here. Try the installed app or another browser.",
    );
  }
  if (Notification.permission !== "granted") {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") throw new Error("Notifications are blocked for this site.");
  }
  const existing = await reg.pushManager.getSubscription();
  const subscription =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBytes(publicKey),
    }));
  await send("POST", payload(subscription, settings));
}

/** Sends this device's reminder settings (time zone, default time, quiet hours) to the server again. */
export async function updatePushSettings(settings: PushSettings): Promise<void> {
  const subscription = await currentPushSubscription();
  if (subscription) await send("POST", payload(subscription, settings));
}

/** Unsubscribes this browser and forgets it on the server. Never throws. */
export async function disablePush(): Promise<void> {
  try {
    const subscription = await currentPushSubscription();
    if (!subscription) return;
    await send("DELETE", { endpoint: subscription.endpoint }).catch(() => {});
    await subscription.unsubscribe();
  } catch {
    // Nothing more we can do; the server drops dead subscriptions on its own.
  }
}
