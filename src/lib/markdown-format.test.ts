import { describe, expect, it } from "vitest";
import { applyFormat, continueList, toggleTaskLine } from "./markdown-format";

describe("toggleTaskLine", () => {
  it("checks and unchecks the given line", () => {
    expect(toggleTaskLine("a\n- [ ] one\n- [ ] two", 3)).toBe("a\n- [ ] one\n- [x] two");
    expect(toggleTaskLine("- [x] one", 1)).toBe("- [ ] one");
    expect(toggleTaskLine("- [X] one", 1)).toBe("- [ ] one");
  });

  it("handles indentation and other markers", () => {
    expect(toggleTaskLine("  * [ ] nested", 1)).toBe("  * [x] nested");
    expect(toggleTaskLine("1. [ ] first", 1)).toBe("1. [x] first");
  });

  it("returns null for non-task or missing lines", () => {
    expect(toggleTaskLine("- plain", 1)).toBeNull();
    expect(toggleTaskLine("- [ ] one", 2)).toBeNull();
  });
});

describe("continueList", () => {
  const at = (text: string) => continueList(text, text.length, text.length);

  it("continues bullets, quotes and indentation", () => {
    expect(at("- one")?.value).toBe("- one\n- ");
    expect(at("> quote")?.value).toBe("> quote\n> ");
    expect(at("  * nested")?.value).toBe("  * nested\n  * ");
  });

  it("increments numbered lists and resets checklist state", () => {
    expect(at("1. a\n2. b")?.value).toBe("1. a\n2. b\n3. ");
    expect(at("- [x] done")?.value).toBe("- [x] done\n- [ ] ");
  });

  it("splits the line at the cursor", () => {
    const result = continueList("- ab", 3, 3);
    expect(result?.value).toBe("- a\n- b");
    expect(result?.selectionStart).toBe(6);
  });

  it("removes an empty marker to end the list", () => {
    const result = at("- one\n- ");
    expect(result?.value).toBe("- one\n");
    expect(result?.selectionStart).toBe(6);
  });

  it("falls back to default behaviour otherwise", () => {
    expect(at("plain text")).toBeNull();
    expect(continueList("- one", 0, 5)).toBeNull();
    expect(continueList("- one", 1, 1)).toBeNull();
  });
});

describe("applyFormat", () => {
  it("wraps a selection and unwraps it again", () => {
    const wrapped = applyFormat("say hello now", 4, 9, "bold");
    expect(wrapped.value).toBe("say **hello** now");
    expect(wrapped.value.slice(wrapped.selectionStart, wrapped.selectionEnd)).toBe("hello");

    const unwrapped = applyFormat(wrapped.value, 4, 13, "bold");
    expect(unwrapped.value).toBe("say hello now");
  });

  it("inserts a placeholder when nothing is selected", () => {
    const result = applyFormat("", 0, 0, "italic");
    expect(result.value).toBe("_italic text_");
    expect(result.value.slice(result.selectionStart, result.selectionEnd)).toBe("italic text");
  });

  it("prefixes every selected line and toggles it off", () => {
    const on = applyFormat("one\ntwo", 0, 7, "ol");
    expect(on.value).toBe("1. one\n2. two");
    expect(applyFormat(on.value, 0, on.value.length, "ol").value).toBe("one\ntwo");
  });

  it("replaces a different list or heading prefix", () => {
    expect(applyFormat("# Title", 0, 0, "ul").value).toBe("- Title");
    expect(applyFormat("- item", 0, 0, "checklist").value).toBe("- [ ] item");
  });

  it("only touches the current line", () => {
    expect(applyFormat("a\nb\nc", 2, 2, "quote").value).toBe("a\n> b\nc");
  });

  it("creates links with the URL selected", () => {
    const result = applyFormat("docs", 0, 4, "link");
    expect(result.value).toBe("[docs](https://)");
    expect(result.value.slice(result.selectionStart, result.selectionEnd)).toBe("https://");
  });
});
