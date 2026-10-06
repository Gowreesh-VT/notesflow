const TAG_NAME = /^[a-zA-Z][\w-]*$/;

/** A tag name typed by the user, without its leading "#", or null when it is not a valid tag. */
export function cleanTagName(input: string): string | null {
  const name = input.trim().replace(/^#/, "");
  return TAG_NAME.test(name) ? name : null;
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&");

/**
 * Rewrites the tag `#from` (any case, whole tags only) as `#to`, or as the plain word when `to` is null.
 * Code spans and fenced blocks are left alone, matching how tags are found (see `extractTags`).
 */
export function renameTagInText(text: string, from: string, to: string | null): string {
  if (!text.includes("#")) return text;
  const pattern = new RegExp(`(^|[\\s(])#(${escapeRegExp(from)})(?![\\w-])`, "gi");
  // Splitting on a captured group keeps the code parts at the odd indexes.
  return text
    .split(/(```[\s\S]*?```|`[^`\n]*`)/)
    .map((part, index) =>
      index % 2
        ? part
        : part.replace(pattern, (_match, lead: string, word: string) =>
            to === null ? `${lead}${word}` : `${lead}#${to}`,
          ),
    )
    .join("");
}

/**
 * A title without the `#tags` at its end, for list rows that show tags as chips: "Pay rent #bills" → "Pay rent".
 * Tags inside the sentence stay, since removing them would change its meaning. A title that is only tags is kept.
 */
export function titleWithoutTrailingTags(title: string): string {
  const stripped = title.replace(/(?:\s+#[a-zA-Z][\w-]*)+\s*$/, "").trimEnd();
  return stripped.trim() && !/^#[a-zA-Z][\w-]*$/.test(stripped.trim()) ? stripped : title;
}

/** What a task row or card shows as its title: tasks drop trailing `#tags` (shown as chips), notes are unchanged. */
export function shownTitle(
  item: { kind: string; title: string; body: string },
  title: string,
): string {
  return item.kind === "task" ? titleWithoutTrailingTags(title) : title;
}
