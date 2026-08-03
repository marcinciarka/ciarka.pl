import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getMintedTotal,
  invalidateMintedTotal,
  setMintedTotal,
  subscribeMintedTotal,
} from "./mintedTotal";

describe("mintedTotal store", () => {
  beforeEach(() => {
    invalidateMintedTotal();
  });

  it("starts unknown", () => {
    expect(getMintedTotal()).toBeNull();
  });

  it("stores a total and notifies subscribers", () => {
    const listener = vi.fn();
    subscribeMintedTotal(listener);
    setMintedTotal(24);
    expect(getMintedTotal()).toBe(24);
    expect(listener).toHaveBeenCalledWith(24);
  });

  it("does not notify when the value is unchanged", () => {
    setMintedTotal(24);
    const listener = vi.fn();
    subscribeMintedTotal(listener);
    setMintedTotal(24);
    expect(listener).not.toHaveBeenCalled();
  });

  it("invalidate resets to unknown and notifies", () => {
    setMintedTotal(24);
    const listener = vi.fn();
    subscribeMintedTotal(listener);
    invalidateMintedTotal();
    expect(getMintedTotal()).toBeNull();
    expect(listener).toHaveBeenCalledWith(null);
  });

  it("unsubscribe stops delivery", () => {
    const listener = vi.fn();
    const off = subscribeMintedTotal(listener);
    off();
    setMintedTotal(7);
    expect(listener).not.toHaveBeenCalled();
  });
});
