import type { Note } from "./types";

const WIKI_LINK = /\[\[([^[\]|\n]+)\]\]/g;
const CODE = /(```[\s\S]*?```|`[^`\n]*`)/;

export const WIKI_HREF_PREFIX = "wiki:";

const normalize = (title: string) => title.trim().toLowerCase();

/** Applies `fn` to every part of a body that is not inside code. */
function mapOutsideCode(body: string, fn: (text: string) => string): string {
  return body
    .split(CODE)
    .map((part, i) => (i % 2 === 1 ? part : fn(part)))
    .join("");
}

/** Unique titles referenced as `[[Title]]` in a body, ignoring code. */
export function extractWikiLinks(body: string): string[] {
  const titles = new Map<string, string>();
  mapOutsideCode(body, (text) => {
    for (const match of text.matchAll(WIKI_LINK)) {
      const title = match[1].trim();
      if (title && !titles.has(normalize(title))) titles.set(normalize(title), title);
    }
    return text;
  });
  return [...titles.values()];
}

/** Finds the live note with this title (case-insensitive); the most recently updated wins. */
export function findNoteByTitle(notes: Note[], title: string): Note | undefined {
  const key = normalize(title);
  if (!key) return undefined;
  return notes
    .filter((n) => n.deletedAt === null && normalize(n.title) === key)
    .sort((a, b) => b.updatedAt - a.updatedAt)[0];
}

/** Live notes, other than the target, that link to the target's title. */
export function findBacklinks(notes: Note[], target: Pick<Note, "id" | "title">): Note[] {
  const key = normalize(target.title);
  if (!key) return [];
  return notes
    .filter(
      (n) =>
        n.id !== target.id &&
        n.deletedAt === null &&
        extractWikiLinks(n.body).some((t) => normalize(t) === key),
    )
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Rewrites `[[from]]` links to `[[to]]` so links survive a rename. */
export function renameWikiLinks(body: string, from: string, to: string): string {
  const key = normalize(from);
  const replacement = to.trim();
  if (!key || !replacement || /[[\]|\n]/.test(replacement)) return body;
  return mapOutsideCode(body, (text) =>
    text.replace(WIKI_LINK, (whole, title: string) =>
      normalize(title) === key ? `[[${replacement}]]` : whole,
    ),
  );
}

/** Turns `[[Title]]` into a Markdown link with a `wiki:` href for the preview. */
export function wikiLinksToMarkdown(body: string): string {
  return mapOutsideCode(body, (text) =>
    text.replace(WIKI_LINK, (whole, title: string) => {
      const trimmed = title.trim();
      return trimmed ? `[${trimmed}](${WIKI_HREF_PREFIX}${encodeURIComponent(trimmed)})` : whole;
    }),
  );
}

/** Title encoded in a `wiki:` href, or null when the href is not a wiki link. */
export function wikiTitleFromHref(href: string | undefined): string | null {
  if (!href?.startsWith(WIKI_HREF_PREFIX)) return null;
  try {
    return decodeURIComponent(href.slice(WIKI_HREF_PREFIX.length));
  } catch {
    return null;
  }
}
