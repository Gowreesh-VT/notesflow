import type { Note, NoteFilter, NoteSort } from "./types";
import { displayTitle, extractTags } from "./utils";

export function filterNotes(
  notes: Note[],
  filter: NoteFilter,
  query: string,
  sort: NoteSort,
): Note[] {
  const q = query.trim().toLowerCase();

  const visible = notes.filter((note) => {
    const trashed = note.deletedAt !== null;
    if (filter.kind === "trash") return trashed;
    if (trashed) return false;
    if (filter.kind === "archive") return note.archived;
    if (note.archived) return false;
    if (filter.kind === "pinned" && !note.pinned) return false;
    if (filter.kind === "tag" && !extractTags(note.body).includes(filter.tag)) return false;
    return true;
  });

  const matching = q
    ? visible.filter(
        (note) => note.title.toLowerCase().includes(q) || note.body.toLowerCase().includes(q),
      )
    : visible;

  const compare = (a: Note, b: Note): number => {
    if (sort === "title") return displayTitle(a).localeCompare(displayTitle(b));
    if (sort === "created") return b.createdAt - a.createdAt;
    return b.updatedAt - a.updatedAt;
  };

  return [...matching].sort((a, b) => {
    if (filter.kind !== "trash" && a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return compare(a, b);
  });
}

export function collectTags(notes: Note[]): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const note of notes) {
    if (note.deletedAt !== null || note.archived) continue;
    for (const tag of extractTags(note.body)) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

export function countByFilter(notes: Note[]) {
  let all = 0;
  let pinned = 0;
  let archive = 0;
  let trash = 0;
  for (const note of notes) {
    if (note.deletedAt !== null) trash += 1;
    else if (note.archived) archive += 1;
    else {
      all += 1;
      if (note.pinned) pinned += 1;
    }
  }
  return { all, pinned, archive, trash };
}
