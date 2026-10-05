import { describe, expect, it } from "vitest";
import {
  cleanOutcomeLabels,
  DEFAULT_OUTCOME_LABELS,
  filterByOutcome,
  makeOutcome,
  NO_OUTCOME,
  outcomeBreakdown,
  parseOutcome,
} from "./outcomes";

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

describe("outcome insights", () => {
  const items = [
    { outcome: { label: "Went well" } },
    { outcome: { label: "Learned something" } },
    { outcome: { label: "Went well" } },
    { outcome: null },
    {},
  ];

  it("breaks finished tasks down by outcome", () => {
    expect(outcomeBreakdown(items)).toEqual([
      { label: "Went well", count: 2 },
      { label: "Learned something", count: 1 },
      { label: NO_OUTCOME, count: 2 },
    ]);
    expect(outcomeBreakdown([])).toEqual([]);
  });

  it("filters by outcome", () => {
    expect(filterByOutcome(items, "Went well")).toHaveLength(2);
    expect(filterByOutcome(items, NO_OUTCOME)).toHaveLength(2);
    expect(filterByOutcome(items, null)).toBe(items);
  });
});
