import { describe, expect, it } from "vitest";
import { isSideways, SWIPE_THRESHOLD, swipeAction, swipeOffset } from "./gestures";

describe("isSideways", () => {
  it("accepts clear horizontal moves only", () => {
    expect(isSideways(30, 4)).toBe(true);
    expect(isSideways(-30, 10)).toBe(true);
    expect(isSideways(8, 0)).toBe(false);
    expect(isSideways(30, 25)).toBe(false);
    expect(isSideways(2, 40)).toBe(false);
  });
});

describe("swipeAction", () => {
  it("completes to the right and opens actions to the left past the threshold", () => {
    expect(swipeAction(SWIPE_THRESHOLD)).toBe("complete");
    expect(swipeAction(-SWIPE_THRESHOLD - 5)).toBe("actions");
    expect(swipeAction(SWIPE_THRESHOLD - 1)).toBeNull();
    expect(swipeAction(-20)).toBeNull();
  });
});

describe("swipeOffset", () => {
  it("follows the finger, then resists and stops", () => {
    expect(swipeOffset(40)).toBe(40);
    expect(swipeOffset(-SWIPE_THRESHOLD)).toBe(-SWIPE_THRESHOLD);
    expect(swipeOffset(SWIPE_THRESHOLD + 10)).toBeCloseTo(SWIPE_THRESHOLD + 3);
    expect(swipeOffset(1000)).toBe(SWIPE_THRESHOLD * 1.5);
    expect(swipeOffset(-1000)).toBe(-SWIPE_THRESHOLD * 1.5);
  });
});
