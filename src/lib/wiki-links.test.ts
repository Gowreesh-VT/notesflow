import { describe, expect, it } from "vitest";
import type { Note } from "./types";
import {
  extractWikiLinks,
  findBacklinks,
  findNoteByTitle,
  renameWikiLinks,
  wikiLinksToMarkdown,
  wikiTitleFromHref,
} from "./wiki-links";

const note = (id: string, title: string, body = "", extra: Partial<Note> = {}): Note => ({
  id,
  title,
  body,
  createdAt: 1,
  updatedAt: 1,
  pinned: false,
  archived: false,
  deletedAt: null,
  ...extra,
});

describe("wiki links", () => {
  it("extracts unique titles and ignores code", () => {
    const body = "See [[Alpha]] and [[ alpha ]], [[Beta]].\n`[[Inline]]`\n```\n[[Fenced]]\n```";
    expect(extractWikiLinks(body)).toEqual(["Alpha", "Beta"]);
  });

  it("finds notes by title, skipping trashed ones", () => {
    const notes = [note("1", "Plan", "", { deletedAt: 5 }), note("2", "plan")];
    expect(findNoteByTitle(notes, " PLAN ")?.id).toBe("2");
    expect(findNoteByTitle(notes, "")).toBeUndefined();
    expect(findNoteByTitle(notes, "Missing")).toBeUndefined();
  });

  it("finds backlinks from other live notes", () => {
    const target = note("1", "Plan");
    const notes = [
      target,
      note("2", "A", "see [[plan]]"),
      note("3", "B", "nothing"),
      note("4", "C", "[[Plan]]", { deletedAt: 9 }),
    ];
    expect(findBacklinks(notes, target).map((n) => n.id)).toEqual(["2"]);
    expect(findBacklinks(notes, note("9", ""))).toEqual([]);
  });

  it("renames links but not inside code", () => {
    const body = "[[Old]] and [[old]] and [[Other]] and `[[Old]]`";
    expect(renameWikiLinks(body, "Old", "New")).toBe(
      "[[New]] and [[New]] and [[Other]] and `[[Old]]`",
    );
    expect(renameWikiLinks(body, "Old", "")).toBe(body);
    expect(renameWikiLinks(body, "Old", "a]b")).toBe(body);
  });

  it("converts links to markdown and back from hrefs", () => {
    const md = wikiLinksToMarkdown("go [[My Note?]] `[[x]]`");
    expect(md).toBe("go [My Note?](wiki:My%20Note%3F) `[[x]]`");
    expect(wikiTitleFromHref("wiki:My%20Note%3F")).toBe("My Note?");
    expect(wikiTitleFromHref("https://example.com")).toBeNull();
    expect(wikiTitleFromHref("wiki:%E0%A4%A")).toBeNull();
  });
});
