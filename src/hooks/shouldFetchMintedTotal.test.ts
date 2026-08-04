import { describe, expect, it } from "vitest";
import { shouldFetchMintedTotal } from "./shouldFetchMintedTotal";

describe("shouldFetchMintedTotal", () => {
  it("fetches only when the modal is open, the contract is live, and the total is unknown", () => {
    expect(
      shouldFetchMintedTotal({
        enabled: true,
        deployed: true,
        total: null,
      }),
    ).toBe(true);
  });

  it("does not fetch while the modal is closed", () => {
    expect(
      shouldFetchMintedTotal({
        enabled: false,
        deployed: true,
        total: null,
      }),
    ).toBe(false);
  });

  it("does not fetch when the contract is not deployed", () => {
    expect(
      shouldFetchMintedTotal({
        enabled: true,
        deployed: false,
        total: null,
      }),
    ).toBe(false);
  });

  it("does not refetch when a total is already known", () => {
    expect(
      shouldFetchMintedTotal({
        enabled: true,
        deployed: true,
        total: 12,
      }),
    ).toBe(false);
  });
});
