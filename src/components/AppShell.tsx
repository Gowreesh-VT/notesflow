"use client";

import { useEffect, useState } from "react";
import { SMART_VIEWS } from "@/lib/items-logic";
import { setLocalePrefs } from "@/lib/locale";
import { usePreferences } from "@/store/preferences";
import { useUi } from "@/store/ui";
import { useSyncStore } from "@/store/sync";
import { upgradeLegacyStorage, useWorkspace } from "@/store/workspace";
import { NavRail } from "./NavRail";
import { OutcomePrompt } from "./Outcome";
import { FocusBar } from "./FocusBar";
import { ReminderRunner } from "./ReminderRunner";
import { ReminderSettings } from "./ReminderSettings";
import { SyncBanner } from "./SyncBanner";
import { CommandPalette } from "./CommandPalette";
import { KeyboardShortcuts } from "./KeyboardShortcuts";
import { ShortcutHelp } from "./ShortcutHelp";
import { Sidebar } from "./Sidebar";
import { Workspace } from "./Workspace";
import { ThemeSync } from "./ThemeSync";

export function AppShell() {
  const [ready, setReady] = useState(false);
  // Date formatting reads these module-wide; set them before any child renders. Views keep week-based
  // calculations in memos, so a change remounts the workspace.
  const { weekStart, dateOrder, clock } = usePreferences();
  setLocalePrefs({ weekStart, dateOrder, clock });
  const localeKey = `${weekStart}-${dateOrder}-${clock}`;

  useEffect(() => {
    let active = true;
    try {
      upgradeLegacyStorage(window.localStorage);
    } catch {
      // Storage unavailable: start with an empty workspace.
    }
    Promise.all([
      useUi.persist.rehydrate(),
      useWorkspace.persist.rehydrate(),
      useSyncStore.persist.rehydrate(),
    ]).then(() => {
      if (!active) return;
      // Home-screen shortcuts open a specific smart view, e.g. /?view=today
      const requested = new URLSearchParams(window.location.search).get("view");
      const smart = SMART_VIEWS.find((v) => v.id === requested);
      if (smart) useUi.getState().setView({ kind: "smart", id: smart.id });
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="flex h-dvh overflow-hidden">
      <ThemeSync />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-stone-900"
      >
        Skip to content
      </a>
      <NavRail />
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        {ready && <SyncBanner />}
        <main id="main" className="min-h-0 flex-1 bg-white dark:bg-stone-900">
          {!ready ? (
            <p className="p-6 text-sm text-stone-500" role="status">
              Loading your workspace…
            </p>
          ) : (
            <Workspace key={localeKey} />
          )}
        </main>
      </div>
      {ready && <CommandPalette />}
      {ready && <ShortcutHelp />}
      {ready && <KeyboardShortcuts />}
      {ready && <OutcomePrompt />}
      {ready && <ReminderRunner />}
      {ready && <FocusBar />}
      {ready && <ReminderSettings />}
    </div>
  );
}
