"use client";

import { useEffect, useState } from "react";
import { SMART_VIEWS } from "@/lib/items-logic";
import { INBOX_ID } from "@/lib/types";
import { useUi } from "@/store/ui";
import { useSyncStore } from "@/store/sync";
import { upgradeLegacyStorage, useWorkspace } from "@/store/workspace";
import { NavRail } from "./NavRail";
import { OutcomePrompt } from "./Outcome";
import { ReminderRunner } from "./ReminderRunner";
import { SyncBanner } from "./SyncBanner";
import { CommandPalette } from "./CommandPalette";
import { ShortcutHelp } from "./ShortcutHelp";
import { Sidebar } from "./Sidebar";
import { Workspace } from "./Workspace";
import { ThemeSync } from "./ThemeSync";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export function AppShell() {
  const [ready, setReady] = useState(false);

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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const ui = useUi.getState();
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        ui.setPaletteOpen(!ui.paletteOpen);
      } else if (event.altKey && event.code === "KeyN") {
        event.preventDefault();
        const view = ui.view;
        const listId = view.kind === "list" ? view.id : INBOX_ID;
        ui.selectItem(useWorkspace.getState().addItem({ kind: "note", listId }));
      } else if (event.altKey && event.code === "KeyT") {
        event.preventDefault();
        if (ui.view.kind === "smart" && ["trash", "completed", "wontdo"].includes(ui.view.id)) {
          ui.setView({ kind: "smart", id: "inbox" });
        }
        window.setTimeout(() => document.getElementById("quick-add")?.focus(), 0);
      } else if (event.key === "/" && !isTypingTarget(event.target)) {
        event.preventDefault();
        document.getElementById("list-search")?.focus();
      } else if (event.key === "?" && !isTypingTarget(event.target) && !ui.paletteOpen) {
        event.preventDefault();
        ui.setHelpOpen(!ui.helpOpen);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
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
            <Workspace />
          )}
        </main>
      </div>
      {ready && <CommandPalette />}
      {ready && <ShortcutHelp />}
      {ready && <OutcomePrompt />}
      {ready && <ReminderRunner />}
    </div>
  );
}
