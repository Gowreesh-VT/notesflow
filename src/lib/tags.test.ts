import { describe, expect, it } from "vitest";
import { cleanTagName, renameTagInText } from "./tags";
import { extractTags } from "./utils";

describe("cleanTagName", () => {
  it("accepts tag names with or without the hash", () => {
    expect(cleanTagName(" #Work ")).toBe("Work");
    expect(cleanTagName("deep-focus_2")).toBe("deep-focus_2");
  });

  it("rejects names that are not tags", () => {
    expect(cleanTagName("")).toBeNull();
    expect(cleanTagName("#")).toBeNull();
    expect(cleanTagName("2day")).toBeNull();
    expect(cleanTagName("two words")).toBeNull();
  });
});

describe("renameTagInText", () => {
  it("renames whole tags in any case", () => {
    expect(renameTagInText("Call #work and #Work (#WORK)", "work", "job")).toBe(
      "Call #job and #job (#job)",
    );
    expect(renameTagInText("#work\n#work-later #working #work_x #work.", "work", "job")).toBe(
      "#job\n#work-later #working #work_x #job.",
    );
  });

  it("leaves hashes inside words and code alone", () => {
    const text = "issue#work `#work` ```\n#work\n``` #work";
    expect(renameTagInText(text, "work", "job")).toBe("issue#work `#work` ```\n#work\n``` #job");
  });

  it("removes the hash but keeps the word when the new name is null", () => {
    expect(renameTagInText("Buy #Milk today", "milk", null)).toBe("Buy Milk today");
  });

  it("merges into an existing tag", () => {
    const text = renameTagInText("#home and #house", "house", "home");
    expect(extractTags(text)).toEqual(["home"]);
  });

  it("treats the old name literally", () => {
    expect(renameTagInText("#a-b #axb", "a-b", "c")).toBe("#c #axb");
    expect(renameTagInText("no tags here", "a", "b")).toBe("no tags here");
  });
});
