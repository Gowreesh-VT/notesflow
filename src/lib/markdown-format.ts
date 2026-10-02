export type FormatKind =
  | "bold"
  | "italic"
  | "strike"
  | "code"
  | "codeblock"
  | "link"
  | "h1"
  | "h2"
  | "h3"
  | "ul"
  | "ol"
  | "checklist"
  | "quote";

export type FormatResult = { value: string; selectionStart: number; selectionEnd: number };

const WRAPPERS: Partial<Record<FormatKind, [string, string, string]>> = {
  bold: ["**", "**", "bold text"],
  italic: ["_", "_", "italic text"],
  strike: ["~~", "~~", "strikethrough"],
  code: ["`", "`", "code"],
  codeblock: ["```\n", "\n```", "code"],
};

const LINE_PREFIXES: Partial<Record<FormatKind, (index: number) => string>> = {
  h1: () => "# ",
  h2: () => "## ",
  h3: () => "### ",
  ul: () => "- ",
  ol: (i) => `${i + 1}. `,
  checklist: () => "- [ ] ",
  quote: () => "> ",
};

const PREFIX_PATTERN = /^(#{1,6} |- \[[ xX]\] |[-*+] |\d+\. |> )/;

export function applyFormat(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  kind: FormatKind,
): FormatResult {
  const wrapper = WRAPPERS[kind];
  if (wrapper) {
    const [open, close, placeholder] = wrapper;
    const selected = value.slice(selectionStart, selectionEnd);
    const before = value.slice(0, selectionStart);
    const after = value.slice(selectionEnd);

    if (
      selected.startsWith(open) &&
      selected.endsWith(close) &&
      selected.length >= open.length + close.length
    ) {
      const inner = selected.slice(open.length, selected.length - close.length);
      return {
        value: before + inner + after,
        selectionStart,
        selectionEnd: selectionStart + inner.length,
      };
    }

    const content = selected || placeholder;
    return {
      value: before + open + content + close + after,
      selectionStart: selectionStart + open.length,
      selectionEnd: selectionStart + open.length + content.length,
    };
  }

  if (kind === "link") {
    const selected = value.slice(selectionStart, selectionEnd) || "link text";
    const url = "https://";
    const text = `[${selected}](${url})`;
    const urlStart = selectionStart + selected.length + 3;
    return {
      value: value.slice(0, selectionStart) + text + value.slice(selectionEnd),
      selectionStart: urlStart,
      selectionEnd: urlStart + url.length,
    };
  }

  const prefix = LINE_PREFIXES[kind];
  if (!prefix) return { value, selectionStart, selectionEnd };

  const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
  const nextBreak = value.indexOf("\n", selectionEnd);
  const lineEnd = nextBreak === -1 ? value.length : nextBreak;
  const lines = value.slice(lineStart, lineEnd).split("\n");

  const allPrefixed = lines.every((line, i) => line.startsWith(prefix(i)));
  const next = lines.map((line, i) =>
    allPrefixed ? line.slice(prefix(i).length) : prefix(i) + line.replace(PREFIX_PATTERN, ""),
  );
  const replaced = next.join("\n");

  return {
    value: value.slice(0, lineStart) + replaced + value.slice(lineEnd),
    selectionStart: lineStart,
    selectionEnd: lineStart + replaced.length,
  };
}

const LIST_LINE = /^(\s*)(- \[[ xX]\] |[-*+] |(\d+)\. |> )(.*)$/;

/**
 * Handles Enter inside a list or quote: continues the marker on the next line,
 * or removes an empty marker to end the list. Returns null when the default
 * Enter behaviour should apply.
 */
export function continueList(
  value: string,
  selectionStart: number,
  selectionEnd: number,
): FormatResult | null {
  if (selectionStart !== selectionEnd) return null;

  const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
  const match = LIST_LINE.exec(value.slice(lineStart, selectionStart));
  if (!match) return null;

  const [, indent, marker, number, content] = match;
  const markerEnd = lineStart + indent.length + marker.length;

  if (content === "") {
    const nextBreak = value.indexOf("\n", selectionStart);
    const lineEnd = nextBreak === -1 ? value.length : nextBreak;
    if (value.slice(selectionStart, lineEnd).trim() !== "") return null;
    return {
      value: value.slice(0, lineStart) + value.slice(lineEnd),
      selectionStart: lineStart,
      selectionEnd: lineStart,
    };
  }

  if (selectionStart < markerEnd) return null;

  const nextMarker =
    number !== undefined ? `${Number(number) + 1}. ` : marker.replace(/\[[xX]\]/, "[ ]");
  const insert = `\n${indent}${nextMarker}`;
  const caret = selectionStart + insert.length;
  return {
    value: value.slice(0, selectionStart) + insert + value.slice(selectionEnd),
    selectionStart: caret,
    selectionEnd: caret,
  };
}

const TASK_LINE = /^(\s*(?:[-*+]|\d+\.) \[)([ xX])\]/;

/**
 * Flips the checkbox on a 1-based source line. Returns null when the line is
 * not a task-list item.
 */
export function toggleTaskLine(value: string, line: number): string | null {
  const lines = value.split("\n");
  const text = lines[line - 1];
  if (text === undefined) return null;
  const match = TASK_LINE.exec(text);
  if (!match) return null;
  lines[line - 1] = match[1] + (match[2] === " " ? "x" : " ") + text.slice(match[0].length - 1);
  return lines.join("\n");
}
