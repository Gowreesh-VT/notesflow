"use client";

import { useEffect, useState } from "react";

/** Offers "Reload to update" when a new version of the app has been downloaded and is waiting. */
export function UpdatePrompt() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let cancelled = false;
    let registration: ServiceWorkerRegistration | undefined;
    let tracked: ServiceWorker | null = null;

    // A waiting worker only counts as an update when an older version is already running the page.
    const offer = (worker: ServiceWorker | null) => {
      if (!cancelled && worker && navigator.serviceWorker.controller) setWaiting(worker);
    };
    const track = () => {
      const installing = registration?.installing;
      if (!installing || installing === tracked) return;
      tracked = installing;
      installing.addEventListener("statechange", () => {
        if (installing.state === "installed") offer(installing);
      });
    };

    navigator.serviceWorker.getRegistration().then((reg) => {
      if (cancelled || !reg) return;
      registration = reg;
      offer(reg.waiting);
      track();
      reg.addEventListener("updatefound", track);
    });

    let reloading = false;
    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    return () => {
      cancelled = true;
      registration?.removeEventListener("updatefound", track);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  if (!waiting) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-20 z-50 flex justify-center px-4 md:bottom-6"
    >
      <div className="flex items-center gap-3 rounded-2xl bg-stone-900 py-2 pl-4 pr-2 text-sm text-white shadow-lift dark:bg-stone-100 dark:text-stone-900">
        <span>A new version is ready.</span>
        <button
          type="button"
          onClick={() => waiting.postMessage({ type: "SKIP_WAITING" })}
          className="rounded-xl px-3 py-1.5 font-medium text-accent-300 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500 dark:text-accent-700 dark:hover:bg-black/10"
        >
          Reload to update
        </button>
        <button
          type="button"
          onClick={() => setWaiting(null)}
          className="rounded-xl px-3 py-1.5 text-stone-300 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500 dark:text-stone-600 dark:hover:bg-black/10"
        >
          Later
        </button>
      </div>
    </div>
  );
}
