import { describe, expect, it } from "vitest";
import { rowLimit } from "./paging";

const group = Array.from({ length: 10 }, (_, i) => ({ id: `i${i}` }));

describe("row paging", () => {
  it("shows one more page each time", () => {
    expect(rowLimit(group, 0, null, 3)).toBe(3);
    expect(rowLimit(group, 2, null, 3)).toBe(9);
  });

  it("always includes the selected item", () => {
    expect(rowLimit(group, 0, "i7", 3)).toBe(8);
    expect(rowLimit(group, 0, "i1", 3)).toBe(3);
    expect(rowLimit(group, 0, "elsewhere", 3)).toBe(3);
  });
});
