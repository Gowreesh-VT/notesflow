"use client";

import { useMemo } from "react";
import { filterNotes } from "@/lib/notes-logic";
import { useNotes } from "@/store/notes";
import { useUi } from "@/store/ui";
import { NoteEditor } from "./NoteEditor";
import { NoteList } from "./NoteList";

export function NotesView() {
  const notes = useNotes((s) => s.notes);
  const { noteFilter, query, noteSort, selectedNoteId } = useUi();

  const filtered = useMemo(
    () => filterNotes(notes, noteFilter, query, noteSort),
    [notes, noteFilter, query, noteSort],
  );
  const selected = notes.find((n) => n.id === selectedNoteId) ?? null;

  return (
    <div className="flex h-full">
      <div
        className={
          selected ? "hidden w-full md:block md:w-80 md:shrink-0" : "w-full md:w-80 md:shrink-0"
        }
      >
        <NoteList notes={filtered} />
      </div>
      <section
        aria-label="Note editor"
        className={selected ? "min-w-0 flex-1" : "hidden min-w-0 flex-1 md:block"}
      >
        {selected ? (
          <NoteEditor key={selected.id} note={selected} />
        ) : (
          <div className="flex h-full items-center justify-center p-6 text-center text-sm text-stone-500 dark:text-stone-400">
            Select a note, or press Alt+N to start a new one.
          </div>
        )}
      </section>
    </div>
  );
}
