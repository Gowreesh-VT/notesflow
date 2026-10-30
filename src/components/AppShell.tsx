"use client";

import { useEffect, useState } from "react";
import { EXAMPLE_TASKS, FIRST_RUN_KEY, shouldSeedExamples } from "@/lib/first-run";
import { SMART_VIEWS } from "@/lib/items-logic";
import { addDays, toDateKey } from "@/lib/utils";
import { setLocalePrefs } from "@/lib/locale";
import { usePreferences } from "@/store/preferences";
import { useUi } from "@/store/ui";
import { useSyncStore } from "@/store/sync";
import { upgradeLegacyStorage, useWorkspace } from "@/store/workspace";
import { LoadingRows } from "./LoadingRows";
import { NavRail } from "./NavRail";
import { OutcomePrompt } from "./Outcome";
import { FocusBar } from "./FocusBar";
import { ReminderRunner } from "./ReminderRunner";
import { ReminderSettings } from "./ReminderSettings";
import { PushOffer } from "./PushOffer";
import { SignInNudge } from "./SignInNudge";
import { SyncBanner } from "./SyncBanner";
import { DialogHost } from "./DialogHost";
import { UndoToast } from "./UndoToast";
import { CommandPalette } from "./CommandPalette";
import { KeyboardShortcuts } from "./KeyboardShortcuts";
import { MobileTabBar } from "./MobileTabBar";
import { ShortcutHelp } from "./ShortcutHelp";
import { Sidebar } from "./Sidebar";
import { Workspace } from "./Workspace";
import { ThemeSync } from "./ThemeSync";

/** Gives a brand-new, empty device a few example tasks, once. */
function seedExamples() {
  try {
    const ws = useWorkspace.getState();
    const seed = shouldSeedExamples({
      items: ws.items,
      listCount: ws.lists.length,
      signedIn: useSyncStore.getState().userId !== null,
      alreadySeeded: window.localStorage.getItem(FIRST_RUN_KEY) !== null,
    });
    window.localStorage.setItem(FIRST_RUN_KEY, "1");
    if (!seed) return;
    const today = toDateKey(new Date());
    // New items go to the top, so add the last example first.
    for (const task of [...EXAMPLE_TASKS].reverse()) {
      ws.addItem({
        kind: "task",
        title: task.title,
        body: task.body,
        priority: task.priority,
        due: task.dueInDays === undefined ? null : addDays(today, task.dueInDays),
      });
    }
  } catch {
    // Storage unavailable: start empty.
  }
}

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
      seedExamples();
      if (smart) useUi.getState().setView({ kind: "smart", id: smart.id });
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="flex h-dvh overflow-hidden pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pt-[env(safe-area-inset-top)]">
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
        {ready && <SignInNudge />}
        {ready && <PushOffer />}
        <main id="main" className="min-h-0 flex-1 bg-white dark:bg-stone-900">
          {!ready ? <LoadingRows label="Loading your workspace" /> : <Workspace key={localeKey} />}
        </main>
        {ready && <MobileTabBar />}
      </div>
      {ready && <CommandPalette />}
      {ready && <ShortcutHelp />}
      {ready && <KeyboardShortcuts />}
      {ready && <OutcomePrompt />}
      {ready && <ReminderRunner />}
      {ready && <FocusBar />}
      {ready && <ReminderSettings />}
      <UndoToast />
      <DialogHost />
    </div>
  );
}
