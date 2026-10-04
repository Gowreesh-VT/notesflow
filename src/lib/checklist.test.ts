import { describe, expect, it } from "vitest";
import { takeChecklist } from "./checklist";

describe("takeChecklist", () => {
  it("takes unchecked lines in every list style and checks them off", () => {
    const body = [
      "# Trip",
      "- [ ] Book flights ",
      "* [ ] Pack #travel",
      "  + [ ] Nested item",
      "1. [ ] Numbered",
      "2) [ ] Also numbered",
      "- [x] Already done",
      "- [X] Done too",
      "- plain bullet",
    ].join("\n");
    const result = takeChecklist(body);
    expect(result.titles).toEqual([
      "Book flights",
      "Pack #travel",
      "Nested item",
      "Numbered",
      "Also numbered",
    ]);
    expect(result.body).toBe(
      [
        "# Trip",
        "- [x] Book flights ",
        "* [x] Pack #travel",
        "  + [x] Nested item",
        "1. [x] Numbered",
        "2) [x] Also numbered",
        "- [x] Already done",
        "- [X] Done too",
        "- plain bullet",
      ].join("\n"),
    );
  });

  it("skips empty items and code blocks", () => {
    const body = "- [ ]\n- [ ]   \n```\n- [ ] code\n```\n~~~md\n- [ ] also code\n~~~\n- [ ] real";
    const result = takeChecklist(body);
    expect(result.titles).toEqual(["real"]);
    expect(result.body).toBe(body.replace("- [ ] real", "- [x] real"));
  });

  it("keeps Windows line endings and returns the body unchanged when there is nothing to take", () => {
    expect(takeChecklist("- [ ] a\r\n- [ ] b\r\n")).toEqual({
      titles: ["a", "b"],
      body: "- [x] a\r\n- [x] b\r\n",
    });
    expect(takeChecklist("no tasks")).toEqual({ titles: [], body: "no tasks" });
    expect(takeChecklist("- [] nope\n-[ ] nope")).toEqual({
      titles: [],
      body: "- [] nope\n-[ ] nope",
    });
  });
});
