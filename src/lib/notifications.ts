/** Thin wrappers around the browser Notification API, safe to call where it does not exist. */

export type PermissionState = NotificationPermission | "unsupported";

export function notificationPermission(): PermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<PermissionState> {
  if (notificationPermission() === "unsupported") return "unsupported";
  try {
    return await Notification.requestPermission();
  } catch {
    return notificationPermission();
  }
}

type ShowOptions = { body: string; tag: string; itemId: string; requireInteraction?: boolean };

/**
 * Shows a system notification, through the service worker when there is one (so clicks reopen the app), or
 * directly otherwise. `onClick` only runs for the direct fallback; the service worker posts a message instead.
 */
export async function showNotification(
  title: string,
  { body, tag, itemId, requireInteraction = false }: ShowOptions,
  onClick: () => void,
): Promise<boolean> {
  if (notificationPermission() !== "granted") return false;
  const options: NotificationOptions = {
    body,
    tag,
    requireInteraction,
    icon: "/icons/icon-192",
    badge: "/icons/icon-192",
    data: { itemId },
  };
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration) {
      await registration.showNotification(title, options);
      return true;
    }
    const notification = new Notification(title, options);
    notification.onclick = () => {
      window.focus();
      onClick();
      notification.close();
    };
    return true;
  } catch {
    return false;
  }
}
