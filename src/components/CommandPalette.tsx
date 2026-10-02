"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { exportBackup } from "@/lib/data-actions";
import { filterNotes } from "@/lib/notes-logic";
import { displayTitle } from "@/lib/utils";
import { useNotes } from "@/store/notes";
import { useUi, type Theme } from "@/store/ui";

type Command = { id: string; label: string; hint?: string; run: () => void };

const NEXT_THEME: Record<Theme, Theme> = { system: "light", light: "dark", dark: "system" };

function PaletteDialog({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const notes = useNotes((s) => s.notes);

  const commands = useMemo<Command[]>(() => {
    const ui = useUi.getState();
    const base: Command[] = [
      {
        id: "new-note",
        label: "New note",
        hint: "Alt+N",
        run: () => {
          ui.setNoteFilter({ kind: "all" });
          ui.selectNote(useNotes.getState().createNote());
        },
      },
      {
        id: "new-task",
        label: "New task",
        hint: "Alt+T",
        run: () => {
          ui.setSection("tasks");
          window.setTimeout(() => document.getElementById("quick-add")?.focus(), 0);
        },
      },
      { id: "go-notes", label: "Go to notes", run: () => ui.setNoteFilter({ kind: "all" }) },
      { id: "go-today", label: "Go to today’s tasks", run: () => ui.setTaskFilter("today") },
      { id: "go-inbox", label: "Go to task inbox", run: () => ui.setTaskFilter("inbox") },
      { id: "theme", label: "Cycle theme", run: () => ui.setTheme(NEXT_THEME[ui.theme]) },
      { id: "view-edit", label: "Editor: edit only", run: () => ui.setEditorMode("edit") },
      { id: "view-split", label: "Editor: split view", run: () => ui.setEditorMode("split") },
      { id: "view-preview", label: "Editor: preview only", run: () => ui.setEditorMode("preview") },
      {
        id: "shortcuts",
        label: "Keyboard shortcuts",
        hint: "?",
        run: () => ui.setHelpOpen(true),
      },
      { id: "backup", label: "Download backup", run: () => exportBackup() },
    ];
    const q = query.trim().toLowerCase();
    const matchingCommands = q ? base.filter((c) => c.label.toLowerCase().includes(q)) : base;
    const noteResults: Command[] = q
      ? filterNotes(notes, { kind: "all" }, q, "updated")
          .slice(0, 8)
          .map((note) => ({
            id: `note-${note.id}`,
            label: displayTitle(note),
            hint: "Note",
            run: () => {
              ui.setNoteFilter({ kind: "all" });
              ui.selectNote(note.id);
            },
          }))
      : [];
    return [...matchingCommands, ...noteResults];
  }, [query, notes]);

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
        className="w-full max-w-lg overflow-hidden rounded-xl border border-stone-200 bg-white shadow-2xl dark:border-stone-700 dark:bg-stone-900"
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
          placeholder="Type a command or search notes…"
          aria-label="Command or note"
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
                (index === active ? "bg-indigo-100 dark:bg-indigo-950" : "")
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
