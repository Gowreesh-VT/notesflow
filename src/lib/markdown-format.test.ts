import { describe, expect, it } from "vitest";
import { applyFormat } from "./markdown-format";

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
