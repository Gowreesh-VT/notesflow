import { describe, expect, it } from "vitest";
import {
  addTagToTitle,
  normalizeTag,
  pruneSelection,
  removeTagFromText,
  removeTagFromTitle,
  selectRange,
  toggleId,
} from "./selection";

describe("selection", () => {
  it("toggles ids in and out", () => {
    expect(toggleId([], "a")).toEqual(["a"]);
    expect(toggleId(["a", "b"], "a")).toEqual(["b"]);
  });

  it("selects a range in visible order in either direction and keeps earlier picks", () => {
    const order = ["a", "b", "c", "d", "e"];
    expect(selectRange([], order, "b", "d")).toEqual(["b", "c", "d"]);
    expect(selectRange(["e"], order, "d", "b")).toEqual(["e", "b", "c", "d"]);
    expect(selectRange(["a"], order, "c", "c")).toEqual(["a", "c"]);
  });

  it("falls back to a single id without a usable anchor", () => {
    expect(selectRange([], ["a", "b"], null, "b")).toEqual(["b"]);
    expect(selectRange(["a"], ["a", "b"], "gone", "b")).toEqual(["a", "b"]);
    expect(selectRange([], ["a", "b"], "a", "hidden")).toEqual(["hidden"]);
  });

  it("prunes ids that are no longer present", () => {
    const selected = ["a", "b"];
    expect(pruneSelection(selected, ["a", "b", "c"])).toBe(selected);
    expect(pruneSelection(selected, new Set(["b"]))).toEqual(["b"]);
  });
});

describe("tag editing", () => {
  it("normalises tag input", () => {
    expect(normalizeTag(" #Work ")).toBe("work");
    expect(normalizeTag("deep-focus")).toBe("deep-focus");
    expect(normalizeTag("")).toBeNull();
    expect(normalizeTag("#")).toBeNull();
    expect(normalizeTag("1st")).toBeNull();
    expect(normalizeTag("two words")).toBeNull();
  });

  it("appends a tag to a title only once", () => {
    expect(addTagToTitle("Call Sam", "work")).toBe("Call Sam #work");
    expect(addTagToTitle("Call Sam  ", "work")).toBe("Call Sam #work");
    expect(addTagToTitle("", "work")).toBe("#work");
    expect(addTagToTitle("Call #Work Sam", "work")).toBe("Call #Work Sam");
    expect(addTagToTitle("Call #workshop", "work")).toBe("Call #workshop #work");
  });

  it("removes a tag from a title without touching longer tags", () => {
    expect(removeTagFromTitle("Call #work Sam", "work")).toBe("Call Sam");
    expect(removeTagFromTitle("#WORK call #work", "work")).toBe("call");
    expect(removeTagFromTitle("Plan (#work)", "work")).toBe("Plan ()");
    const untouched = "Plan #workshop";
    expect(removeTagFromTitle(untouched, "work")).toBe(untouched);
  });

  it("removes a tag from Markdown but not from code", () => {
    const body = "Notes #work here\n  - nested #work\n`#work` and\n```\n#work\n```\n#work";
    expect(removeTagFromText(body, "work")).toBe(
      "Notes here\n  - nested \n`#work` and\n```\n#work\n```\n",
    );
    expect(removeTagFromText("Keep  two  spaces", "work")).toBe("Keep  two  spaces");
  });
});
