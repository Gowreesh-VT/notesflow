import { describe, expect, it } from "vitest";
import { collectTags, countByFilter, filterNotes } from "./notes-logic";
import type { Note } from "./types";

const make = (id: string, patch: Partial<Note> = {}): Note => ({
  id,
  title: id,
  body: "",
  createdAt: 1,
  updatedAt: 1,
  pinned: false,
  archived: false,
  deletedAt: null,
  ...patch,
});

const notes = [
  make("a", { updatedAt: 10, body: "alpha #work" }),
  make("b", { updatedAt: 30, pinned: true, body: "beta" }),
  make("c", { updatedAt: 20, archived: true }),
  make("d", { updatedAt: 40, deletedAt: 5 }),
  make("e", { updatedAt: 5, body: "gamma #work #home", createdAt: 99 }),
];

describe("filterNotes", () => {
  const ids = (list: Note[]) => list.map((n) => n.id);

  it("hides archived and trashed notes and floats pinned ones", () => {
    expect(ids(filterNotes(notes, { kind: "all" }, "", "updated"))).toEqual(["b", "a", "e"]);
  });

  it("supports pinned, archive, trash and tag views", () => {
    expect(ids(filterNotes(notes, { kind: "pinned" }, "", "updated"))).toEqual(["b"]);
    expect(ids(filterNotes(notes, { kind: "archive" }, "", "updated"))).toEqual(["c"]);
    expect(ids(filterNotes(notes, { kind: "trash" }, "", "updated"))).toEqual(["d"]);
    expect(ids(filterNotes(notes, { kind: "tag", tag: "work" }, "", "updated"))).toEqual([
      "a",
      "e",
    ]);
  });

  it("searches title and body case-insensitively", () => {
    expect(ids(filterNotes(notes, { kind: "all" }, "GAMMA", "updated"))).toEqual(["e"]);
  });

  it("sorts by created date and title", () => {
    expect(ids(filterNotes(notes, { kind: "all" }, "", "created"))[1]).toBe("e");
    expect(ids(filterNotes(notes, { kind: "all" }, "", "title"))).toEqual(["b", "a", "e"]);
  });
});

describe("collectTags / countByFilter", () => {
  it("counts tags from active notes only", () => {
    expect(collectTags(notes)).toEqual([
      { tag: "work", count: 2 },
      { tag: "home", count: 1 },
    ]);
  });

  it("counts notes per view", () => {
    expect(countByFilter(notes)).toEqual({ all: 3, pinned: 1, archive: 1, trash: 1 });
  });
});
