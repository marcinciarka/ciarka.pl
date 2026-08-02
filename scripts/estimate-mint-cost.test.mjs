import { describe, expect, it } from "vitest";
import { estimateMintGas, weiCost } from "./estimate-mint-cost.mjs";

describe("estimateMintGas", () => {
  it("charges the fixed mint overhead for a tiny image", () => {
    // 32 bytes = 1 storage slot
    expect(estimateMintGas(32)).toBe(100_000 + 22_100);
  });

  it("rounds partial slots up", () => {
    expect(estimateMintGas(33)).toBe(100_000 + 2 * 22_100);
  });

  it("scales linearly with slots", () => {
    // 8 KiB image = 256 slots
    expect(estimateMintGas(8192)).toBe(100_000 + 256 * 22_100);
  });
});

describe("weiCost", () => {
  it("multiplies gas by gas price", () => {
    expect(weiCost(1_000_000, 10_000_000n)).toBe(10_000_000_000_000n);
  });
});
