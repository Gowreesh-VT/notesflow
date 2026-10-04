const UNCHECKED = /^(\s*(?:[-*+]|\d+[.)])\s+\[) \](\s+)([^\r]*)(\r?)$/;
const FENCE = /^\s*(```|~~~)/;

/**
 * Finds the unchecked Markdown task lines (`- [ ] text`, `* [ ]`, `1. [ ]`) outside code blocks. Returns their
 * trimmed texts and the body with those lines checked off. Lines with no text are left alone.
 */
export function takeChecklist(body: string): { titles: string[]; body: string } {
  const titles: string[] = [];
  let fence: string | null = null;
  const lines = body.split("\n").map((line) => {
    const marker = FENCE.exec(line)?.[1];
    if (marker) {
      if (!fence) fence = marker;
      else if (fence === marker) fence = null;
      return line;
    }
    const match = fence ? null : UNCHECKED.exec(line);
    const title = match?.[3].trim();
    if (!match || !title) return line;
    titles.push(title);
    return `${match[1]}x]${match[2]}${match[3]}${match[4]}`;
  });
  return { titles, body: titles.length ? lines.join("\n") : body };
}
