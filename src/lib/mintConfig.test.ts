import { describe, expect, it } from "vitest";
import {
  CONTRACT_ADDRESS,
  CONTRACT_DEPLOYED,
  GALLERY_PAGE_SIZE,
  MAX_IMAGE_BYTES,
  basescanTokenUrl,
  computeTotalUsd,
  dataUrlToBytes,
  explorerContractUrl,
  formatScaledUsd,
  hexBytesToDataUrl,
  hexToBase64,
  openSeaUrl,
  pageTokenIds,
} from "./mintConfig";

describe("dataUrlToBytes", () => {
  it("decodes mime and payload from a data URL", () => {
    // "hi!" base64 → aGkh
    const { hex, mime } = dataUrlToBytes("data:image/webp;base64,aGkh");
    expect(mime).toBe("image/webp");
    expect(hex).toBe("0x686921");
  });

  it("throws on non-base64 data urls", () => {
    expect(() => dataUrlToBytes("data:text/plain,hello")).toThrow();
  });
});

describe("openSeaUrl", () => {
  it("builds a token page url", () => {
    expect(openSeaUrl(7n)).toMatch(/opensea\.io\/.+\/7$/);
  });
});

describe("CONTRACT_DEPLOYED", () => {
  // I2: deploy-state-independent — this must hold whether CONTRACT_ADDRESS
  // is still the zero-address placeholder (pre-Task-7) or a real deployed
  // address (post-Task-7/10), so the test doesn't go stale the moment the
  // address is pasted in. It asserts the derivation logic itself: deployed
  // iff the address isn't the zero-address placeholder, and the address is
  // always a well-formed 20-byte hex address.
  it("is derived from whether CONTRACT_ADDRESS is the zero-address placeholder", () => {
    expect(CONTRACT_ADDRESS).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(CONTRACT_DEPLOYED).toBe(
      (CONTRACT_ADDRESS as string) !==
        "0x0000000000000000000000000000000000000000"
    );
  });
});

describe("MAX_IMAGE_BYTES", () => {
  it("is a positive byte cap", () => {
    expect(MAX_IMAGE_BYTES).toBeGreaterThan(0);
    expect(MAX_IMAGE_BYTES).toBe(16_000);
  });
});

describe("explorerContractUrl", () => {
  it("points at the contract's Basescan address page", () => {
    expect(explorerContractUrl()).toBe(
      `https://basescan.org/address/${CONTRACT_ADDRESS}`,
    );
  });
});

describe("basescanTokenUrl", () => {
  it("points at the token's page on the contract, by id", () => {
    expect(basescanTokenUrl(17n)).toBe(
      `https://basescan.org/token/${CONTRACT_ADDRESS}?a=17`,
    );
  });

  // The gallery detail panel builds this for whatever token is selected, so
  // it has to survive ids past Number.MAX_SAFE_INTEGER without exponent
  // notation creeping into the query string.
  it("renders a large bigint id as plain digits", () => {
    expect(basescanTokenUrl(9007199254740993n)).toBe(
      `https://basescan.org/token/${CONTRACT_ADDRESS}?a=9007199254740993`,
    );
  });

  it("is pure string building — no chain read, so it works with any id", () => {
    expect(basescanTokenUrl(1n)).toContain("?a=1");
  });
});

describe("formatScaledUsd", () => {
  it("formats a 1e4-scaled integer to exactly 4 decimals", () => {
    expect(formatScaledUsd(30_000n)).toBe("3.0000");
    expect(formatScaledUsd(0n)).toBe("0.0000");
    expect(formatScaledUsd(5n)).toBe("0.0005");
    expect(formatScaledUsd(123_456_789n)).toBe("12345.6789");
  });

  it("keeps the sign and pads the fraction for negative values", () => {
    expect(formatScaledUsd(-5n)).toBe("-0.0005");
  });
});

describe("computeTotalUsd", () => {
  it("converts wei spent + an 8-decimal ETH/USD answer to a 4-decimal string", () => {
    // 0.001 ETH at $3000/ETH = $3 exactly.
    const weiSpent = 1_000_000_000_000_000n; // 0.001 ETH
    const answer = 300_000_000_000n; // $3000.00000000 (8 decimals)
    expect(computeTotalUsd(weiSpent, answer, 8)).toBe("3.0000");
  });

  it("floors instead of rounding, keeping exactly 4 decimals", () => {
    // 1 wei is far below a cent's worth of precision — must floor to 0, not
    // throw or produce a longer string.
    expect(computeTotalUsd(1n, 300_000_000_000n, 8)).toBe("0.0000");
  });

  it("handles a realistic Base gas-mint total", () => {
    // ~0.0000005 ETH gas cost at $3200/ETH.
    const weiSpent = 500_000_000_000n; // 5e11 wei
    const answer = 320_000_000_000n; // $3200 at 8 decimals
    // 5e11 * 3.2e11 * 1e4 / 1e26 = 1.6e27 / 1e26 = 16 -> 0.0016
    expect(computeTotalUsd(weiSpent, answer, 8)).toBe("0.0016");
  });
});

describe("pageTokenIds", () => {
  it("returns the newest pageSize ids for page 0", () => {
    expect(pageTokenIds(25, 0, 12)).toEqual(
      Array.from({ length: 12 }, (_, i) => BigInt(25 - i)),
    );
  });

  it("returns the next older page on page 1", () => {
    expect(pageTokenIds(25, 1, 12)).toEqual(
      Array.from({ length: 12 }, (_, i) => BigInt(13 - i)),
    );
  });

  it("clamps the final partial page at token id 1", () => {
    expect(pageTokenIds(25, 2, 12)).toEqual([1n]);
  });

  it("returns an empty page once past the end", () => {
    expect(pageTokenIds(25, 3, 12)).toEqual([]);
  });

  it("returns an empty array when nothing has been minted", () => {
    expect(pageTokenIds(0, 0, 12)).toEqual([]);
  });

  it("returns every id when total is smaller than one page", () => {
    expect(pageTokenIds(5, 0, 12)).toEqual([5n, 4n, 3n, 2n, 1n]);
  });

  it("rejects a negative page or non-positive pageSize defensively", () => {
    expect(pageTokenIds(25, -1, 12)).toEqual([]);
    expect(pageTokenIds(25, 0, 0)).toEqual([]);
  });

  it("defaults to GALLERY_PAGE_SIZE when no page size is given", () => {
    expect(pageTokenIds(40, 0)).toHaveLength(GALLERY_PAGE_SIZE);
    expect(pageTokenIds(40, 0)[0]).toBe(40n);
    expect(pageTokenIds(40, 0).at(-1)).toBe(40n - BigInt(GALLERY_PAGE_SIZE) + 1n);
  });
});

describe("hexToBase64 / hexBytesToDataUrl", () => {
  it("matches a direct btoa for small input", () => {
    // "hi!" -> 0x686921 -> base64 "aGkh"
    expect(hexToBase64("0x686921")).toBe("aGkh");
  });

  it("round-trips through atob back to the original bytes", () => {
    const bytes = Uint8Array.from({ length: 50 }, (_, i) => i % 256);
    const hex = "0x" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    const b64 = hexToBase64(hex);
    const decoded = atob(b64);
    const decodedBytes = Uint8Array.from(decoded, (c) => c.charCodeAt(0));
    expect(Array.from(decodedBytes)).toEqual(Array.from(bytes));
  });

  it("produces identical output regardless of chunk size (chunk-boundary correctness)", () => {
    // A byte length that isn't a clean multiple of small chunk sizes, so a
    // chunking bug at a boundary would show up as a mismatch here.
    const bytes = Uint8Array.from({ length: 137 }, (_, i) => (i * 7) % 256);
    const hex = "0x" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    const wholeAtOnce = hexToBase64(hex, 1_000_000);
    const tinyChunks = hexToBase64(hex, 3);
    const defaultChunk = hexToBase64(hex);
    expect(tinyChunks).toBe(wholeAtOnce);
    expect(defaultChunk).toBe(wholeAtOnce);
  });

  it("builds a data URL with the given mime type", () => {
    expect(hexBytesToDataUrl("0x686921")).toBe("data:image/webp;base64,aGkh");
    expect(hexBytesToDataUrl("0x686921", "image/png")).toBe(
      "data:image/png;base64,aGkh",
    );
  });
});
