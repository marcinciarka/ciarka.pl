import { beforeEach, describe, expect, it, vi } from "vitest";

function stubLocalStorage() {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: () => null,
    get length() {
      return store.size;
    },
  } as Storage;
}

describe("skyStore", () => {
  beforeEach(() => {
    stubLocalStorage();
    vi.resetModules(); // fresh module-level state per test
  });

  it("getSeed returns a stable value", async () => {
    const { getSeed } = await import("./skyStore");
    expect(getSeed()).toBe(getSeed());
  });

  it("reseed changes the seed and persists it", async () => {
    const { getSeed, reseed } = await import("./skyStore");
    const before = getSeed();
    const after = reseed();
    expect(after).not.toBe(before);
    expect(getSeed()).toBe(after);
    expect(localStorage.getItem("aurora-seed")).toBe(String(after));
  });

  it("notifies subscribers on reseed, not after unsubscribe", async () => {
    const { reseed, subscribe } = await import("./skyStore");
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);
    const next = reseed();
    expect(listener).toHaveBeenCalledWith(next);
    unsubscribe();
    reseed();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  describe("webgl-failed flag", () => {
    it("starts false", async () => {
      const { isWebglFailed } = await import("./skyStore");
      expect(isWebglFailed()).toBe(false);
    });

    it("setWebglFailed flips the flag and notifies subscribers", async () => {
      const { isWebglFailed, setWebglFailed, subscribeWebglFailed } =
        await import("./skyStore");
      const listener = vi.fn();
      subscribeWebglFailed(listener);
      setWebglFailed();
      expect(isWebglFailed()).toBe(true);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("is idempotent - calling it again does not re-notify", async () => {
      const { setWebglFailed, subscribeWebglFailed } = await import(
        "./skyStore"
      );
      const listener = vi.fn();
      subscribeWebglFailed(listener);
      setWebglFailed();
      setWebglFailed();
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("stops notifying after unsubscribe", async () => {
      const { setWebglFailed, subscribeWebglFailed } = await import(
        "./skyStore"
      );
      const listener = vi.fn();
      const unsubscribe = subscribeWebglFailed(listener);
      unsubscribe();
      setWebglFailed();
      expect(listener).not.toHaveBeenCalled();
    });
  });
});
