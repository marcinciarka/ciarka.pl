import { describe, expect, it } from "vitest";
import { injectStatsMeta } from "./injectStats";

const STATS = { commits: 5323, pullRequests: 1188 };

describe("injectStatsMeta", () => {
  it("substitutes both tokens with thousands-separated numbers", () => {
    const html = `<meta content="__COMMITS__ commits, __PRS__ pull requests." />`;
    expect(injectStatsMeta(html, STATS)).toBe(
      `<meta content="5,323 commits, 1,188 pull requests." />`,
    );
  });

  it("substitutes every occurrence, not just the first", () => {
    const html = `<a>__COMMITS__</a><b>__COMMITS__</b><c>__PRS__</c><d>__PRS__</d>`;
    expect(injectStatsMeta(html, STATS)).toBe(
      `<a>5,323</a><b>5,323</b><c>1,188</c><d>1,188</d>`,
    );
  });

  it("throws when the commits token is missing, so a future HTML edit cannot silently drop it", () => {
    expect(() => injectStatsMeta(`<meta content="__PRS__" />`, STATS)).toThrow(
      /__COMMITS__/,
    );
  });

  it("throws when the pull-request token is missing", () => {
    expect(() =>
      injectStatsMeta(`<meta content="__COMMITS__" />`, STATS),
    ).toThrow(/__PRS__/);
  });
});
