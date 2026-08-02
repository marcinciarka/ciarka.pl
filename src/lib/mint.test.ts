import { afterEach, describe, expect, it, vi } from "vitest";
import { BaseError } from "viem";
// Dynamic import: mint.ts is only ever loaded lazily in the app (to keep
// viem out of the entry chunk), but importing it directly in a test file
// doesn't affect that — vitest runs in Node where viem is just a normal
// installed dependency. We still `await import` it here rather than a
// static import, so the test doubles as a smoke check that the module
// loads cleanly this way.
const mintModule = () => import("./mint");

describe("isUserRejection", () => {
  it("detects 4001 on a plain top-level error (raw EIP-1193 rejection)", async () => {
    const { isUserRejection } = await mintModule();
    const err = Object.assign(new Error("User rejected"), { code: 4001 });
    expect(isUserRejection(err)).toBe(true);
  });

  it("detects 4001 buried in a manual .cause chain (non-viem wrapping)", async () => {
    const { isUserRejection } = await mintModule();
    const rejection = Object.assign(new Error("User rejected the request"), {
      code: 4001,
    });
    const wrapped = new Error("switchChain failed", { cause: rejection });
    const doubleWrapped = new Error("writeContract failed", { cause: wrapped });
    expect(isUserRejection(doubleWrapped)).toBe(true);
  });

  it("detects 4001 buried inside a viem BaseError chain via .walk", async () => {
    const { isUserRejection } = await mintModule();
    const rejection = Object.assign(new Error("User rejected the request"), {
      code: 4001,
    });
    const outer = new BaseError("Request failed", { cause: rejection });
    expect(isUserRejection(outer)).toBe(true);
  });

  it("returns false when no cause in the chain carries code 4001", async () => {
    const { isUserRejection } = await mintModule();
    const unrelated = new Error("network error", {
      cause: new Error("timeout"),
    });
    expect(isUserRejection(unrelated)).toBe(false);
  });

  it("returns false for non-object / nullish errors", async () => {
    const { isUserRejection } = await mintModule();
    expect(isUserRejection("boom")).toBe(false);
    expect(isUserRejection(null)).toBe(false);
    expect(isUserRejection(undefined)).toBe(false);
  });
});

describe("mintSky size guard (I3)", () => {
  // mintSky needs window.ethereum to get past the wallet check, which this
  // test environment doesn't stub. That's the point: the size guard is
  // ordered BEFORE the wallet check in mint.ts specifically so this is
  // testable without a wallet — if ImageTooLargeError ever migrated below
  // the wallet check, this test would start failing with NoWalletError
  // instead, catching the regression.
  it("throws ImageTooLargeError before the wallet check, for an oversized WebP snapshot", async () => {
    const { mintSky, ImageTooLargeError } = await mintModule();
    const oversized = {
      dataUrl: "data:image/webp;base64,aGkh",
      mime: "image/webp",
      bytes: 20_000, // over MAX_IMAGE_BYTES (16_000)
    };
    const account = "0x0000000000000000000000000000000000dEaD" as const;
    await expect(mintSky(account, 12345, oversized)).rejects.toBeInstanceOf(
      ImageTooLargeError,
    );
  });

  it("throws WebpRequiredError before the size guard, for a non-WebP snapshot", async () => {
    const { mintSky, WebpRequiredError } = await mintModule();
    const nonWebp = {
      dataUrl: "data:image/png;base64,aGkh",
      mime: "image/png",
      bytes: 20_000,
    };
    const account = "0x0000000000000000000000000000000000dEaD" as const;
    await expect(mintSky(account, 12345, nonWebp)).rejects.toBeInstanceOf(
      WebpRequiredError,
    );
  });
});

describe("estimateMint guard ordering", () => {
  // Same defense-in-depth guard as mintSky, run before any network access —
  // estimateContractGas is never reached for a rejected snapshot, so these
  // are testable without a public RPC connection.
  it("throws ImageTooLargeError before touching the network, for an oversized WebP snapshot", async () => {
    const { estimateMint, ImageTooLargeError } = await mintModule();
    const oversized = {
      dataUrl: "data:image/webp;base64,aGkh",
      mime: "image/webp",
      bytes: 20_000,
    };
    const account = "0x0000000000000000000000000000000000dEaD" as const;
    await expect(estimateMint(account, 12345, oversized)).rejects.toBeInstanceOf(
      ImageTooLargeError,
    );
  });

  it("throws WebpRequiredError for a non-WebP snapshot, before the size guard", async () => {
    const { estimateMint, WebpRequiredError } = await mintModule();
    const nonWebp = {
      dataUrl: "data:image/png;base64,aGkh",
      mime: "image/png",
      bytes: 20_000,
    };
    const account = "0x0000000000000000000000000000000000dEaD" as const;
    await expect(estimateMint(account, 12345, nonWebp)).rejects.toBeInstanceOf(
      WebpRequiredError,
    );
  });
});

describe("estimateMint totalEth formatting", () => {
  it("formats gas * gasPrice to 6 decimal places", async () => {
    // Exercises the same formatting helper estimateMint uses internally,
    // without needing a live RPC connection: 21000 gas * 1 gwei is a
    // round, easily-checked ether amount.
    const { formatEther } = await import("viem");
    const gas = 21_000n;
    const gasPriceWei = 1_000_000_000n; // 1 gwei
    const totalEth = Number(formatEther(gas * gasPriceWei)).toFixed(6);
    expect(totalEth).toBe("0.000021");
  });
});

describe("formatCostEth (M3)", () => {
  it("keeps tiny estimates visible instead of rounding them to 0.000000", async () => {
    const { formatCostEth } = await mintModule();
    // A realistic Base mint: ~5.7M gas at a sub-gwei gas price lands well
    // below 1e-6 ETH, which the old toFixed(6) flattened to "0.000000".
    expect(formatCostEth("0.00000023")).toBe("0.00000023");
    expect(formatCostEth("0.0000000456")).toBe("0.00000005");
  });

  it("trims the trailing zeros a fixed width would leave behind", async () => {
    const { formatCostEth } = await mintModule();
    expect(formatCostEth("0.0012")).toBe("0.0012");
    expect(formatCostEth("1.5")).toBe("1.5");
    expect(formatCostEth("2")).toBe("2");
  });

  it("floors anything below the last displayed digit into an explicit bound", async () => {
    const { formatCostEth } = await mintModule();
    // Never claim a mint is free.
    expect(formatCostEth("0.000000000001")).toBe("<0.00000001");
  });

  it("still shows a true zero as zero", async () => {
    const { formatCostEth } = await mintModule();
    expect(formatCostEth("0")).toBe("0");
  });
});

describe("checkMintable degradation (I1)", () => {
  // Each case stubs viem's createPublicClient so readContract can fail for
  // one guard and succeed for the other, which is the whole point of the
  // allSettled: a flaky RPC on one read must not erase the other's verdict.
  async function withReads(
    seedMinted: boolean | Error,
    hasMinted: boolean | Error,
  ) {
    vi.resetModules();
    const actual = await vi.importActual<typeof import("viem")>("viem");
    vi.doMock("viem", () => ({
      ...actual,
      createPublicClient: () => ({
        readContract: ({ functionName }: { functionName: string }) => {
          const value = functionName === "seedMinted" ? seedMinted : hasMinted;
          return value instanceof Error
            ? Promise.reject(value)
            : Promise.resolve(value);
        },
      }),
      http: () => undefined,
    }));
    const { checkMintable } = await import("./mint");
    return checkMintable("0x1111111111111111111111111111111111111111", 42);
  }

  afterEach(() => {
    vi.doUnmock("viem");
    vi.resetModules();
  });

  it("reports seed-taken even when the hasMinted read fails", async () => {
    expect(await withReads(true, new Error("rpc down"))).toBe("seed-taken");
  });

  it("reports wallet-minted even when the seedMinted read fails", async () => {
    expect(await withReads(new Error("rpc down"), true)).toBe("wallet-minted");
  });

  it("degrades to ok only when both reads fail", async () => {
    expect(await withReads(new Error("a"), new Error("b"))).toBe("ok");
  });

  it("still prefers seed-taken over wallet-minted when both are true", async () => {
    expect(await withReads(true, true)).toBe("seed-taken");
  });

  it("returns ok when both reads succeed and neither guard trips", async () => {
    expect(await withReads(false, false)).toBe("ok");
  });
});
