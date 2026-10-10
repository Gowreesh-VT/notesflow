"use client";

import { useEffect, useRef, useState } from "react";
import { moveSelection, resolveShortcut, type ShortcutAction } from "@/lib/shortcuts";
import { INBOX_ID } from "@/lib/types";
import { addDays, displayTitle, toDateKey } from "@/lib/utils";
import { getPreferences } from "@/store/preferences";
import { useUi } from "@/store/ui";
import { toggleDoneWithUndo, trashWithUndo } from "@/store/undo";
import { useWorkspace } from "@/store/workspace";
import { openDailyNote } from "./CommandPalette";

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/** Widgets that use the arrow keys themselves. */
const ARROW_WIDGETS =
  '[role="radiogroup"], [role="menu"], [role="listbox"], [role="grid"], [role="tablist"], [role="slider"]';

/** The task and note rows currently shown in the main area, top to bottom. */
const visibleRows = (): string[] => [
  ...new Set(
    [...document.querySelectorAll<HTMLElement>("#main [data-item-id]")]
      .filter((el) => el.offsetParent !== null)
      .map((el) => el.dataset.itemId!),
  ),
];

const PRIORITY_NAMES = { high: "High", medium: "Medium", low: "Low", none: "No" } as const;

/** Runs a shortcut; returns what to announce to screen readers, or null when it did nothing. */
function run(action: ShortcutAction): string | null {
  const ui = useUi.getState();
  const workspace = useWorkspace.getState();
  const selected = workspace.items.find((i) => i.id === ui.selectedItemId) ?? null;
  const today = toDateKey(new Date());

  switch (action.type) {
    case "palette":
      ui.setPaletteOpen(!ui.paletteOpen);
      return null;
    case "help":
      ui.setHelpOpen(!ui.helpOpen);
      return null;
    case "newNote": {
      const listId = ui.view.kind === "list" ? ui.view.id : INBOX_ID;
      ui.selectItem(workspace.addItem({ kind: "note", listId }));
      return "New note";
    }
    case "newTask":
      if (
        ui.view.kind !== "list" &&
        !(
          ui.view.kind === "smart" &&
          ["inbox", "today", "tomorrow", "week", "all"].includes(ui.view.id)
        )
      ) {
        ui.setView({ kind: "smart", id: "inbox" });
      }
      window.setTimeout(() => document.getElementById("quick-add")?.focus(), 0);
      return null;
    case "dailyNote":
      openDailyNote();
      return null;
    case "search": {
      // The list search is hidden in narrow layouts; fall back to the command palette there.
      const search = document.getElementById("list-search");
      if (search && search.offsetParent !== null) search.focus();
      else ui.setPaletteOpen(true);
      return null;
    }
    case "go":
      ui.setView(action.view);
      return null;
    case "move": {
      const id = moveSelection(visibleRows(), ui.selectedItemId, action.to);
      if (!id) return null;
      ui.selectItem(id);
      document
        .querySelector(`#main [data-item-id="${CSS.escape(id)}"]`)
        ?.scrollIntoView({ block: "nearest" });
      const item = workspace.items.find((i) => i.id === id);
      return item ? displayTitle(item) : null;
    }
    case "close":
      // The "How did it go?" card closes first, then the details.
      if (ui.outcomePromptId) {
        ui.promptOutcome(null);
        return null;
      }
      if (!selected) return null;
      ui.selectItem(null);
      return null;
  }

  if (!selected || selected.deletedAt !== null) return null;
  const title = displayTitle(selected);
  switch (action.type) {
    case "edit":
      document
        .querySelector<HTMLInputElement>('[aria-label="Task title"], [aria-label="Note title"]')
        ?.focus();
      return null;
    case "pin":
      workspace.togglePin(selected.id);
      return selected.pinned ? `Unpinned “${title}”` : `Pinned “${title}”`;
    case "trash": {
      const rows = visibleRows();
      const next =
        rows[rows.indexOf(selected.id) + 1] ?? rows[rows.indexOf(selected.id) - 1] ?? null;
      trashWithUndo(selected.id);
      ui.selectItem(next);
      return `Moved “${title}” to the trash`;
    }
  }

  if (selected.kind !== "task") return null;
  switch (action.type) {
    case "toggleDone": {
      const finishedId = toggleDoneWithUndo(selected.id);
      if (finishedId) ui.promptOutcome(finishedId);
      return finishedId ? `Completed “${title}”` : `Reopened “${title}”`;
    }
    case "priority":
      workspace.updateItem(selected.id, { priority: action.priority });
      return `${PRIORITY_NAMES[action.priority]} priority`;
    case "due": {
      const due =
        action.when === "today" ? today : action.when === "tomorrow" ? addDays(today, 1) : null;
      workspace.updateItem(selected.id, { due });
      return due ? `Due ${action.when}` : "Due date removed";
    }
  }
  return null;
}

/** Global keyboard shortcuts (see SHORTCUT_HELP), with optional vim-style navigation. */
export function KeyboardShortcuts() {
  const pending = useRef({ key: "", at: 0 });
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return;
      const ui = useUi.getState();
      // Modal dialogs handle their own keys; only the palette shortcut works over them.
      const modal = document.querySelector('[aria-modal="true"]') !== null;
      const arrows = event.key === "ArrowUp" || event.key === "ArrowDown";
      const target = event.target instanceof HTMLElement ? event.target : null;
      const typing =
        isTypingTarget(target) || modal || (arrows && Boolean(target?.closest(ARROW_WIDGETS)));
      // Sequences ("g i") must be typed within a second and a half.
      const stillPending = Date.now() - pending.current.at < 1500 ? pending.current.key : "";
      const { action, pending: next } = resolveShortcut(
        {
          key: event.key,
          code: event.code,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          altKey: event.altKey,
          shiftKey: event.shiftKey,
          typing,
        },
        stillPending,
        getPreferences().vimKeys,
      );
      pending.current = { key: next, at: Date.now() };
      if (next) {
        event.preventDefault();
        return;
      }
      if (!action) return;
      if (modal && action.type !== "palette") return;
      // Esc with nothing open is left to other handlers (such as clearing a multi-selection).
      if (action.type === "close" && !ui.selectedItemId && !ui.outcomePromptId) return;
      event.preventDefault();
      const message = run(action);
      if (message) setAnnouncement(message);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <p role="status" aria-live="polite" className="sr-only">
      {announcement}
    </p>
  );
}
