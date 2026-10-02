"use client";

import { Pin, Plus, Search } from "lucide-react";
import clsx from "clsx";
import { extractTags, formatRelativeTime, displayTitle, getSnippet } from "@/lib/utils";
import type { Note, NoteFilter, NoteSort } from "@/lib/types";
import { useNotes } from "@/store/notes";
import { useUi } from "@/store/ui";

function filterTitle(filter: NoteFilter): string {
  switch (filter.kind) {
    case "all":
      return "All notes";
    case "pinned":
      return "Pinned";
    case "archive":
      return "Archive";
    case "trash":
      return "Trash";
    case "tag":
      return `#${filter.tag}`;
  }
}

const EMPTY_MESSAGES: Record<NoteFilter["kind"], string> = {
  all: "No notes yet. Create your first one.",
  pinned: "Pin important notes to keep them at the top.",
  archive: "Archived notes appear here.",
  trash: "Trash is empty.",
  tag: "No notes use this tag.",
};

export function NoteList({ notes }: { notes: Note[] }) {
  const { noteFilter, query, noteSort, selectedNoteId } = useUi();
  const setQuery = useUi((s) => s.setQuery);
  const setNoteSort = useUi((s) => s.setNoteSort);
  const selectNote = useUi((s) => s.selectNote);
  const createNote = useNotes((s) => s.createNote);
  const emptyTrash = useNotes((s) => s.emptyTrash);

  const newNote = () => {
    if (noteFilter.kind !== "all" && noteFilter.kind !== "tag")
      useUi.getState().setNoteFilter({ kind: "all" });
    selectNote(createNote(noteFilter.kind === "tag" ? { body: `#${noteFilter.tag} ` } : undefined));
  };

  return (
    <div className="flex h-full flex-col border-r border-stone-200 dark:border-stone-800">
      <div className="space-y-2 p-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="truncate text-base font-semibold">{filterTitle(noteFilter)}</h1>
          {noteFilter.kind === "trash" ? (
            <button
              type="button"
              className="btn btn-danger"
              disabled={notes.length === 0}
              onClick={() => {
                if (window.confirm("Permanently delete all notes in the trash?")) emptyTrash();
              }}
            >
              Empty trash
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={newNote}>
              <Plus size={16} aria-hidden /> New
            </button>
          )}
        </div>
        <div className="relative">
          <Search
            size={15}
            aria-hidden
            className="pointer-events-none absolute left-2.5 top-2.5 text-stone-400"
          />
          <input
            id="list-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes  ( / )"
            aria-label="Search notes"
            className="field pl-8"
          />
        </div>
        <label className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
          Sort by
          <select
            value={noteSort}
            onChange={(e) => setNoteSort(e.target.value as NoteSort)}
            className="field w-auto py-1 text-xs"
          >
            <option value="updated">Last edited</option>
            <option value="created">Created</option>
            <option value="title">Title</option>
          </select>
        </label>
      </div>

      <ul className="min-h-0 flex-1 divide-y divide-stone-200 overflow-y-auto border-t border-stone-200 dark:divide-stone-800 dark:border-stone-800">
        {notes.map((note) => {
          const tags = extractTags(note.body);
          const active = note.id === selectedNoteId;
          return (
            <li key={note.id}>
              <button
                type="button"
                onClick={() => selectNote(note.id)}
                aria-current={active ? "true" : undefined}
                className={clsx(
                  "block w-full px-3 py-3 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-500",
                  active
                    ? "bg-indigo-50 dark:bg-indigo-950/40"
                    : "hover:bg-stone-100 dark:hover:bg-stone-900",
                )}
              >
                <span className="flex items-center gap-1.5">
                  {note.pinned && (
                    <Pin size={13} aria-label="Pinned" className="shrink-0 text-indigo-600" />
                  )}
                  <span className="truncate text-sm font-medium">{displayTitle(note)}</span>
                </span>
                <span className="mt-0.5 line-clamp-2 text-xs text-stone-500 dark:text-stone-400">
                  {getSnippet(note.body) || "No content"}
                </span>
                <span className="mt-1.5 flex items-center gap-1.5 text-[11px] text-stone-400">
                  <time dateTime={new Date(note.updatedAt).toISOString()}>
                    {formatRelativeTime(note.updatedAt)}
                  </time>
                  {tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="rounded bg-stone-200 px-1.5 py-0.5 text-stone-600 dark:bg-stone-800 dark:text-stone-300"
                    >
                      #{tag}
                    </span>
                  ))}
                </span>
              </button>
            </li>
          );
        })}
        {notes.length === 0 && (
          <li className="p-6 text-center text-sm text-stone-500 dark:text-stone-400">
            {query ? `No notes match “${query}”.` : EMPTY_MESSAGES[noteFilter.kind]}
          </li>
        )}
      </ul>
    </div>
  );
}
