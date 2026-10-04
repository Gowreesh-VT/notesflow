import { describe, expect, it } from "vitest";
import { cleanOutcomeLabels, DEFAULT_OUTCOME_LABELS, makeOutcome, parseOutcome } from "./outcomes";

describe("outcomes", () => {
  it("builds clean outcomes and rejects empty labels", () => {
    expect(makeOutcome("  Went well ", "  great \n call ", 5)).toEqual({
      label: "Went well",
      note: "great call",
      at: 5,
    });
    expect(makeOutcome("  ", "x", 5)).toBeNull();
    expect(makeOutcome("x".repeat(99), "", 1)!.label).toHaveLength(40);
  });

  it("parses stored outcomes", () => {
    expect(parseOutcome({ label: "Learned something", at: 3 }, 9)).toEqual({
      label: "Learned something",
      note: "",
      at: 3,
    });
    expect(parseOutcome({ note: "no label" }, 9)).toBeNull();
    expect(parseOutcome("junk", 9)).toBeNull();
  });

  it("cleans the editable choices", () => {
    expect(cleanOutcomeLabels([" A ", "a", "", "B"])).toEqual(["A", "B"]);
    expect(cleanOutcomeLabels(["", " "])).toEqual(DEFAULT_OUTCOME_LABELS);
    expect(cleanOutcomeLabels(Array.from({ length: 12 }, (_, i) => `L${i}`))).toHaveLength(8);
  });
});
