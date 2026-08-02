import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

function stubSearch(search: string) {
  globalThis.location = { search } as Location;
}

describe("skyStore", () => {
  beforeEach(() => {
    stubLocalStorage();
    // @ts-expect-error - most tests run as if there were no location global
    delete globalThis.location;
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

  describe("?seed= URL parameter", () => {
    it("wins over the stored seed", async () => {
      localStorage.setItem("aurora-seed", "111");
      stubSearch("?seed=4195785527");
      const { getSeed } = await import("./skyStore");
      expect(getSeed()).toBe(4195785527);
    });

    // The whole point: a visitor following a shared link still has their
    // own sky waiting the next time they come without the parameter.
    it("does not overwrite the stored seed", async () => {
      localStorage.setItem("aurora-seed", "111");
      stubSearch("?seed=4195785527");
      const { getSeed } = await import("./skyStore");
      getSeed();
      expect(localStorage.getItem("aurora-seed")).toBe("111");
    });

    it("does not persist anything when there was no stored seed", async () => {
      stubSearch("?seed=42");
      const { getSeed } = await import("./skyStore");
      expect(getSeed()).toBe(42);
      expect(localStorage.getItem("aurora-seed")).toBeNull();
    });

    it("falls back to the stored seed when the param is invalid", async () => {
      localStorage.setItem("aurora-seed", "111");
      stubSearch("?seed=nope");
      const { getSeed } = await import("./skyStore");
      expect(getSeed()).toBe(111);
    });

    it("falls back to the stored seed when there is no param", async () => {
      localStorage.setItem("aurora-seed", "111");
      stubSearch("");
      const { getSeed } = await import("./skyStore");
      expect(getSeed()).toBe(111);
    });

    it("reseed still persists normally over a shared seed", async () => {
      localStorage.setItem("aurora-seed", "111");
      stubSearch("?seed=4195785527");
      const { getSeed, reseed } = await import("./skyStore");
      expect(getSeed()).toBe(4195785527);
      const next = reseed();
      expect(next).not.toBe(4195785527);
      expect(getSeed()).toBe(next);
      expect(localStorage.getItem("aurora-seed")).toBe(String(next));
    });

    it("does not throw when there is no location global (node/SSR)", async () => {
      localStorage.setItem("aurora-seed", "111");
      const { getSeed } = await import("./skyStore");
      expect(getSeed()).toBe(111);
    });
  });

  describe("capture registration", () => {
    it("captureNow returns null when nothing is registered", async () => {
      const { captureNow } = await import("./skyStore");
      expect(captureNow()).toBeNull();
    });

    it("captureNow delegates to the registered function", async () => {
      const { captureNow, registerCapture } = await import("./skyStore");
      const snapshot = {
        dataUrl: "data:image/webp;base64,aGkh",
        mime: "image/webp",
        bytes: 3,
      };
      const fn = vi.fn(() => snapshot);
      registerCapture(fn);
      expect(captureNow()).toBe(snapshot);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("captureNow returns null after unregistering", async () => {
      const { captureNow, registerCapture } = await import("./skyStore");
      registerCapture(() => ({
        dataUrl: "data:image/webp;base64,aGkh",
        mime: "image/webp",
        bytes: 3,
      }));
      registerCapture(null);
      expect(captureNow()).toBeNull();
    });

    // The registered capture can legitimately fail (lost context, PNG
    // fallback); that must reach the caller as null, not as undefined.
    it("passes a null capture result through", async () => {
      const { captureNow, registerCapture } = await import("./skyStore");
      registerCapture(() => null);
      expect(captureNow()).toBeNull();
    });
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

  describe("mint-active flag (C1 belt-and-braces)", () => {
    it("starts false", async () => {
      const { isMintActive } = await import("./skyStore");
      expect(isMintActive()).toBe(false);
    });

    it("setMintActive flips the flag and notifies subscribers", async () => {
      const { isMintActive, setMintActive, subscribeMintActive } =
        await import("./skyStore");
      const listener = vi.fn();
      subscribeMintActive(listener);
      setMintActive(true);
      expect(isMintActive()).toBe(true);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("does not notify when set to the value it already has", async () => {
      const { setMintActive, subscribeMintActive } = await import(
        "./skyStore"
      );
      const listener = vi.fn();
      subscribeMintActive(listener);
      setMintActive(false); // already false
      expect(listener).not.toHaveBeenCalled();
      setMintActive(true);
      setMintActive(true); // already true
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("stops notifying after unsubscribe", async () => {
      const { setMintActive, subscribeMintActive } = await import(
        "./skyStore"
      );
      const listener = vi.fn();
      const unsubscribe = subscribeMintActive(listener);
      unsubscribe();
      setMintActive(true);
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("reseed drops ?seed= from the address bar (M2)", () => {
    function stubUrl(href: string) {
      const replaceState = vi.fn();
      globalThis.location = { href, search: new URL(href).search } as Location;
      globalThis.history = { replaceState } as unknown as History;
      return replaceState;
    }

    afterEach(() => {
      // @ts-expect-error - restore the node-like default for other tests
      delete globalThis.history;
    });

    it("replaces the URL without ?seed= when the visitor arrived on a shared link", async () => {
      const replaceState = stubUrl("https://ciarka.pl/?seed=12345");
      const { getSeed, reseed } = await import("./skyStore");
      expect(getSeed()).toBe(12345);
      reseed();
      expect(replaceState).toHaveBeenCalledTimes(1);
      expect(replaceState.mock.calls[0][2]).toBe("/");
    });

    it("keeps other query params and the hash", async () => {
      const replaceState = stubUrl("https://ciarka.pl/x?a=1&seed=7&b=2#work");
      const { reseed } = await import("./skyStore");
      reseed();
      expect(replaceState.mock.calls[0][2]).toBe("/x?a=1&b=2#work");
    });

    it("does nothing when there is no seed param", async () => {
      const replaceState = stubUrl("https://ciarka.pl/?a=1");
      const { reseed } = await import("./skyStore");
      reseed();
      expect(replaceState).not.toHaveBeenCalled();
    });

    it("does not throw in a node-like env with no location/history", async () => {
      const { reseed } = await import("./skyStore");
      expect(() => reseed()).not.toThrow();
    });
  });
});
