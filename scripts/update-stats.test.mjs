import { describe, it, expect } from "vitest";
import { applyFloor, statsChanged } from "./update-stats.mjs";

const base = { commits: 100, pullRequests: 50, defiYears: 4 };

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
  it("detects a range change even when the counts are identical", () => {
    expect(statsChanged(base, { ...base, sinceYear: 2022 })).toBe(true);
  });
});

describe("applyFloor", () => {
  it("floors a lower fetched count within the same range, so an API outage cannot regress the numbers", () => {
    const prev = { ...base, sinceYear: 2022 };
    const fetched = { commits: 40, pullRequests: 20, defiYears: 4, sinceYear: 2022 };
    expect(applyFloor(prev, fetched)).toEqual({
      commits: 100,
      pullRequests: 50,
      defiYears: 4,
      sinceYear: 2022,
    });
  });

  it("lets a lower count through when prev predates sinceYear, which is the first run after a range change", () => {
    // `base` has no sinceYear at all - exactly the state of the committed
    // stats.json when this change ships.
    const fetched = { commits: 40, pullRequests: 20, defiYears: 4, sinceYear: 2022 };
    expect(applyFloor(base, fetched)).toEqual({
      commits: 40,
      pullRequests: 20,
      defiYears: 4,
      sinceYear: 2022,
    });
  });

  it("lets a lower count through when the range moves again later", () => {
    const prev = { ...base, sinceYear: 2022 };
    const fetched = { commits: 40, pullRequests: 20, defiYears: 4, sinceYear: 2023 };
    expect(applyFloor(prev, fetched).commits).toBe(40);
  });

  it("still takes a higher fetched count within the same range", () => {
    const prev = { ...base, sinceYear: 2022 };
    const fetched = { commits: 140, pullRequests: 70, defiYears: 4, sinceYear: 2022 };
    expect(applyFloor(prev, fetched)).toEqual({
      commits: 140,
      pullRequests: 70,
      defiYears: 4,
      sinceYear: 2022,
    });
  });
});
