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
