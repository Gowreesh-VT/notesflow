"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { exportBackup } from "@/lib/data-actions";
import { sortFilters } from "@/lib/filters";
import { activeLists, filterItems, SMART_VIEWS } from "@/lib/items-logic";
import { useToday } from "@/lib/hooks";
import { INBOX_ID, type Item } from "@/lib/types";
import { displayTitle, toDateKey } from "@/lib/utils";
import type { Theme } from "@/lib/types";
import { getPreferences, setPreferences } from "@/store/preferences";
import { useUi } from "@/store/ui";
import { useWorkspace } from "@/store/workspace";

type Command = { id: string; label: string; hint?: string; run: () => void };

const NEXT_THEME: Record<Theme, Theme> = { system: "light", light: "dark", dark: "system" };

function openItem(item: Item) {
  const ui = useUi.getState();
  ui.setView(
    item.listId === INBOX_ID ? { kind: "smart", id: "inbox" } : { kind: "list", id: item.listId },
  );
  ui.selectItem(item.id);
}

/** Opens (creating it the first time) the daily note for a date, today by default. */
export function openDailyNote(date = toDateKey(new Date())) {
  const workspace = useWorkspace.getState();
  const id = workspace.openDailyNote(date);
  const note = useWorkspace.getState().items.find((i) => i.id === id);
  if (note) openItem(note);
}

function PaletteDialog({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const items = useWorkspace((s) => s.items);
  const lists = useWorkspace((s) => s.lists);
  const filters = useWorkspace((s) => s.filters);
  const today = useToday();

  const commands = useMemo<Command[]>(() => {
    const ui = useUi.getState();
    const base: Command[] = [
      {
        id: "new-task",
        label: "New task",
        hint: "Alt+T",
        run: () => {
          if (ui.view.kind === "smart" && ["trash", "completed", "wontdo"].includes(ui.view.id)) {
            ui.setView({ kind: "smart", id: "inbox" });
          }
          window.setTimeout(() => document.getElementById("quick-add")?.focus(), 0);
        },
      },
      {
        id: "new-note",
        label: "New note",
        hint: "Alt+N",
        run: () => {
          const listId = ui.view.kind === "list" ? ui.view.id : INBOX_ID;
          ui.selectItem(useWorkspace.getState().addItem({ kind: "note", listId }));
        },
      },
      {
        id: "daily-note",
        label: "Open today’s daily note",
        hint: "Alt+J",
        run: () => openDailyNote(today),
      },
      ...SMART_VIEWS.map((v) => ({
        id: `go-${v.id}`,
        label: `Go to ${v.label}`,
        run: () => ui.setView({ kind: "smart", id: v.id }),
      })),
      ...activeLists(lists).map((l) => ({
        id: `list-${l.id}`,
        label: `Open list: ${l.name}`,
        run: () => ui.setView({ kind: "list", id: l.id }),
      })),
      ...sortFilters(filters).map((f) => ({
        id: `filter-${f.id}`,
        label: `Open filter: ${f.name}`,
        run: () => ui.setView({ kind: "filter", id: f.id }),
      })),
      {
        id: "theme",
        label: "Cycle theme",
        run: () => setPreferences({ theme: NEXT_THEME[getPreferences().theme] }),
      },
      {
        id: "view-edit",
        label: "Editor: edit only",
        run: () => setPreferences({ editorMode: "edit" }),
      },
      {
        id: "view-split",
        label: "Editor: split view",
        run: () => setPreferences({ editorMode: "split" }),
      },
      {
        id: "view-preview",
        label: "Editor: preview only",
        run: () => setPreferences({ editorMode: "preview" }),
      },
      { id: "backup", label: "Download backup", run: () => exportBackup() },
      { id: "shortcuts", label: "Keyboard shortcuts", hint: "?", run: () => ui.setHelpOpen(true) },
    ];
    const q = query.trim().toLowerCase();
    const matchingCommands = q ? base.filter((c) => c.label.toLowerCase().includes(q)) : base;
    const itemResults: Command[] = q
      ? filterItems(items, { kind: "smart", id: "all" }, q, today)
          .slice(0, 8)
          .map((item) => ({
            id: `item-${item.id}`,
            label: displayTitle(item),
            hint: item.kind === "task" ? "Task" : "Note",
            run: () => openItem(item),
          }))
      : [];
    return [...matchingCommands, ...itemResults];
  }, [query, items, lists, filters, today]);

  useEffect(() => {
    input.current?.focus();
  }, []);

  const choose = (command: Command | undefined) => {
    if (!command) return;
    onClose();
    command.run();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => Math.min(i + 1, commands.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(commands[active]);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[15vh]"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
        className="w-full max-w-lg overflow-hidden rounded-xl border border-stone-200 bg-white shadow-lift dark:border-stone-700 dark:bg-stone-900"
      >
        <input
          ref={input}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-results"
          aria-activedescendant={commands[active] ? `palette-${commands[active].id}` : undefined}
          placeholder="Type a command or search tasks and notes…"
          aria-label="Command, task or note"
          className="w-full border-b border-stone-200 bg-transparent px-4 py-3 text-sm outline-none dark:border-stone-700"
        />
        <ul id="palette-results" role="listbox" className="max-h-72 overflow-y-auto p-1">
          {commands.map((command, index) => (
            <li
              key={command.id}
              id={`palette-${command.id}`}
              role="option"
              aria-selected={index === active}
              onMouseEnter={() => setActive(index)}
              onClick={() => choose(command)}
              className={
                "flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm " +
                (index === active ? "bg-accent-100 dark:bg-accent-950" : "")
              }
            >
              <span className="truncate">{command.label}</span>
              {command.hint && (
                <span className="ml-3 shrink-0 text-xs text-stone-500">{command.hint}</span>
              )}
            </li>
          ))}
          {commands.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-stone-500">No results.</li>
          )}
        </ul>
      </div>
    </div>
  );
}

export function CommandPalette() {
  const open = useUi((s) => s.paletteOpen);
  const setOpen = useUi((s) => s.setPaletteOpen);
  return open ? <PaletteDialog onClose={() => setOpen(false)} /> : null;
}
