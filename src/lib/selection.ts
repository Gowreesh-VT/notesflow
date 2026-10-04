/** Pure helpers for selecting many items at once and editing their tags in bulk. */

/** Adds the id to the selection, or removes it when it is already selected. */
export function toggleId(selected: string[], id: string): string[] {
  return selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
}

/**
 * Shift-click selection: adds every id between the anchor and `id` (inclusive, in the visible `order`) to the
 * selection. Without a usable anchor only `id` is added.
 */
export function selectRange(
  selected: string[],
  order: string[],
  anchor: string | null,
  id: string,
): string[] {
  const from = anchor ? order.indexOf(anchor) : -1;
  const to = order.indexOf(id);
  const range =
    from === -1 || to === -1 ? [id] : order.slice(Math.min(from, to), Math.max(from, to) + 1);
  const next = new Set(selected);
  for (const x of range) next.add(x);
  return [...next];
}

/** Keeps only the selected ids that are still present, preserving the original array when nothing changes. */
export function pruneSelection(selected: string[], present: Iterable<string>): string[] {
  const keep = new Set(present);
  const next = selected.filter((id) => keep.has(id));
  return next.length === selected.length ? selected : next;
}

/** Turns user input such as "#Work" or " work " into a tag name, or null when it is not a valid tag. */
export function normalizeTag(input: string): string | null {
  const tag = input.trim().replace(/^#/, "").toLowerCase();
  return /^[a-z][\w-]*$/.test(tag) ? tag : null;
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Matches `#tag` as a whole tag (case-insensitive), keeping the character in front of it in group 1. */
const tagPattern = (tag: string) => new RegExp(`(^|[\\s(])#${escapeRegExp(tag)}(?![\\w-])`, "gi");

/** Appends ` #tag` to a title unless the title already carries the tag. */
export function addTagToTitle(title: string, tag: string): string {
  if (tagPattern(tag).test(title)) return title;
  const trimmed = title.trimEnd();
  return trimmed ? `${trimmed} #${tag}` : `#${tag}`;
}

/** Removes every `#tag` from a title and tidies the spaces it leaves behind. */
export function removeTagFromTitle(title: string, tag: string): string {
  const next = title.replace(tagPattern(tag), "$1");
  return next === title ? title : next.replace(/\s{2,}/g, " ").trim();
}

/** Removes every `#tag` from Markdown text, leaving code spans and code blocks untouched. */
export function removeTagFromText(text: string, tag: string): string {
  const withSpace = new RegExp(`${tagPattern(tag).source}[ \\t]?`, "gi");
  return text
    .split(/(```[\s\S]*?```|`[^`\n]*`)/)
    .map((part, index) => (index % 2 === 1 ? part : part.replace(withSpace, "$1")))
    .join("");
}
