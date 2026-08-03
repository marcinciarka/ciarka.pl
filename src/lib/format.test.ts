import { describe, expect, it } from "vitest";
import { formatBytes, truncateAddress } from "./format";

describe("truncateAddress", () => {
  it("keeps the 0x prefix, two leading bytes and the last three chars", () => {
    expect(truncateAddress("0x4f2e1d9a0000000000000000000000000000a9c1")).toBe(
      "0x4f2…9c1",
    );
  });

  it("leaves a short string alone rather than mangling it", () => {
    expect(truncateAddress("0x4f2")).toBe("0x4f2");
  });

  it("is case-preserving", () => {
    expect(truncateAddress("0xABCDEF0000000000000000000000000000001234")).toBe(
      "0xABC…234",
    );
  });
});

describe("formatBytes", () => {
  it("formats a typical on-chain aurora in kB to one decimal", () => {
    expect(formatBytes(8400)).toBe("8.4 kB");
  });

  it("uses whole bytes below 1000", () => {
    expect(formatBytes(940)).toBe("940 B");
  });

  // Rounds to one decimal, so a legal size one byte under the 16_000-byte cap
  // displays AS the cap. Accepted: the number is a size readout, not the
  // pass/fail signal — MAX_IMAGE_BYTES is enforced on the exact byte count in
  // both contractAddress.ts's consumers and mintSky itself.
  it("rounds to one decimal, so just-under-cap reads as the cap", () => {
    expect(formatBytes(15999)).toBe("16.0 kB");
  });

  it("handles zero", () => {
    expect(formatBytes(0)).toBe("0 B");
  });
});
