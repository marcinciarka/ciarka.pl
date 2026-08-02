import { describe, it, expect } from "vitest";
import { statsChanged } from "./update-stats.mjs";

const base = { commits: 100, pullRequests: 50, defiYears: 4, protocols: 10 };

describe("statsChanged", () => {
  it("returns false for identical stats", () => {
    expect(statsChanged(base, { ...base })).toBe(false);
  });
  it("detects a commit count change", () => {
    expect(statsChanged(base, { ...base, commits: 101 })).toBe(true);
  });
  it("ignores updatedAt-only differences", () => {
    expect(
      statsChanged({ ...base, updatedAt: "a" }, { ...base, updatedAt: "b" }),
    ).toBe(false);
  });
});
