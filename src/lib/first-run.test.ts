import { describe, expect, it } from "vitest";
import { EXAMPLE_TASKS, shouldSeedExamples } from "./first-run";

const empty = { items: [], listCount: 0, signedIn: false, alreadySeeded: false };

describe("shouldSeedExamples", () => {
  it("seeds an empty, signed-out, never-seeded workspace", () => {
    expect(shouldSeedExamples(empty)).toBe(true);
  });

  it("does not seed twice", () => {
    expect(shouldSeedExamples({ ...empty, alreadySeeded: true })).toBe(false);
  });

  it("leaves existing data and signed-in accounts alone", () => {
    expect(shouldSeedExamples({ ...empty, items: [{ id: "a" }] })).toBe(false);
    expect(shouldSeedExamples({ ...empty, listCount: 1 })).toBe(false);
    expect(shouldSeedExamples({ ...empty, signedIn: true })).toBe(false);
  });
});

describe("EXAMPLE_TASKS", () => {
  it("has titled tasks", () => {
    expect(EXAMPLE_TASKS.length).toBeGreaterThan(2);
    expect(EXAMPLE_TASKS.every((t) => t.title.length > 0)).toBe(true);
  });
});
