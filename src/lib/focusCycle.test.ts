import { describe, expect, it } from "vitest";
import { nextFocusIndex } from "./focusCycle";

describe("nextFocusIndex", () => {
  it("returns null when there is nothing focusable", () => {
    expect(nextFocusIndex(0, -1, false)).toBeNull();
  });

  it("pulls focus to the first element when it is outside the dialog", () => {
    expect(nextFocusIndex(4, -1, false)).toBe(0);
  });

  it("pulls focus to the last element when tabbing backwards from outside", () => {
    expect(nextFocusIndex(4, -1, true)).toBe(3);
  });

  it("wraps forwards from the last element to the first", () => {
    expect(nextFocusIndex(4, 3, false)).toBe(0);
  });

  it("wraps backwards from the first element to the last", () => {
    expect(nextFocusIndex(4, 0, true)).toBe(3);
  });

  it("lets the browser handle a move in the middle of the cycle", () => {
    expect(nextFocusIndex(4, 1, false)).toBeNull();
    expect(nextFocusIndex(4, 2, true)).toBeNull();
  });

  it("holds a single focusable element in place in both directions", () => {
    expect(nextFocusIndex(1, 0, false)).toBe(0);
    expect(nextFocusIndex(1, 0, true)).toBe(0);
  });
});
