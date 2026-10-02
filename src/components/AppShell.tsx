"use client";

import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { useNotes } from "@/store/notes";
import { useTasks } from "@/store/tasks";
import { useUi } from "@/store/ui";
import { CommandPalette } from "./CommandPalette";
import { ShortcutHelp } from "./ShortcutHelp";
import { NotesView } from "./NotesView";
import { Sidebar } from "./Sidebar";
import { TasksView } from "./TasksView";
import { ThemeSync } from "./ThemeSync";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export function AppShell() {
  const [ready, setReady] = useState(false);
  const section = useUi((s) => s.section);
  const setSidebarOpen = useUi((s) => s.setSidebarOpen);

  useEffect(() => {
    let active = true;
    Promise.all([
      useUi.persist.rehydrate(),
      useNotes.persist.rehydrate(),
      useTasks.persist.rehydrate(),
    ]).then(() => {
      if (active) setReady(true);
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
        ui.setNoteFilter({ kind: "all" });
        ui.selectNote(useNotes.getState().createNote());
      } else if (event.altKey && event.code === "KeyT") {
        event.preventDefault();
        ui.setSection("tasks");
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
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-stone-200 px-3 py-2 dark:border-stone-800 md:hidden">
          <button
            type="button"
            className="btn btn-ghost"
            aria-label="Open menu"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={20} />
          </button>
          <span className="font-semibold">Notesflow</span>
        </header>
        <main id="main" className="min-h-0 flex-1">
          {!ready ? (
            <p className="p-6 text-sm text-stone-500" role="status">
              Loading your workspace…
            </p>
          ) : section === "notes" ? (
            <NotesView />
          ) : (
            <TasksView />
          )}
        </main>
      </div>
      {ready && <CommandPalette />}
      {ready && <ShortcutHelp />}
    </div>
  );
}
