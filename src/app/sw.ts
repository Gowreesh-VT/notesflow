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

// Clicking a reminder focuses an open Notesflow window (or opens one) and asks it to show the task.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const itemId = (event.notification.data as { itemId?: string } | null)?.itemId;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const client = windows.find((w) => new URL(w.url).pathname.startsWith("/app")) ?? windows[0];
      if (client) {
        await client.focus();
        if (itemId) client.postMessage({ type: "open-item", itemId });
      } else {
        await self.clients.openWindow("/app");
      }
    })(),
  );
});
