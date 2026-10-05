/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { defaultCache } from "@serwist/turbopack/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();

// Push reminders from the server (sent while Notesflow may be closed).
self.addEventListener("push", (event) => {
  let data: {
    title?: string;
    body?: string;
    tag?: string;
    itemId?: string;
    requireInteraction?: boolean;
  } = {};
  try {
    data = event.data?.json() ?? {};
  } catch {
    // Not ours or malformed: still show something, as push requires a visible notification.
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Notesflow reminder", {
      body: data.body || "You have a reminder.",
      // The same tag the open app uses, so a reminder shown by both appears once.
      tag: data.tag,
      requireInteraction: Boolean(data.requireInteraction),
      icon: "/icons/icon-192",
      badge: "/icons/icon-192",
      data: { itemId: data.itemId },
      actions: [
        { action: "done", title: "Done" },
        { action: "snooze", title: "Snooze 10 min" },
      ],
    } as NotificationOptions),
  );
});

// Clicking a reminder focuses an open Notesflow window (or opens one) and asks it to show the task.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const itemId = (event.notification.data as { itemId?: string } | null)?.itemId;
  const action = event.action === "done" || event.action === "snooze" ? event.action : "open-item";
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const client = windows.find((w) => new URL(w.url).pathname.startsWith("/app"));
      if (client) {
        if (action === "open-item") await client.focus();
        if (itemId) client.postMessage({ type: action, itemId });
      } else {
        // Notesflow is closed: open it and let it apply the action once it has loaded.
        const params = new URLSearchParams();
        if (itemId) params.set("item", itemId);
        if (action !== "open-item") params.set("action", action);
        await self.clients.openWindow(`/app${params.size ? `?${params}` : ""}`);
      }
    })(),
  );
});
