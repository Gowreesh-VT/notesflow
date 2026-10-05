import webpush from "web-push";
import type { Sender } from "./push";

/** The VAPID public key when push reminders are set up on this deployment, otherwise null. */
export function vapidPublicKey(): string | null {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;
  return VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY ? VAPID_PUBLIC_KEY : null;
}

let configured = false;

/** Sends through the browsers' push services, signed with this deployment's VAPID keys. */
export function webPushSender(): Sender | null {
  const publicKey = vapidPublicKey();
  if (!publicKey) return null;
  if (!configured) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:admin@example.com",
      publicKey,
      process.env.VAPID_PRIVATE_KEY!,
    );
    configured = true;
  }
  return async (subscription, payload) => {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        JSON.stringify(payload),
        // Reminders are useless once stale; let the push service drop them after an hour offline.
        { TTL: 60 * 60, urgency: "high" },
      );
      return "sent";
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      // 404/410: the browser unsubscribed or the subscription expired.
      if (status === 404 || status === 410) return "gone";
      console.error("push failed:", status ?? (error instanceof Error ? error.message : "unknown"));
      return "failed";
    }
  };
}
