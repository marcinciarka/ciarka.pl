import { beforeEach, describe, expect, it } from "vitest";
import { loadSeed, randomSeed, saveSeed, seedToUniforms } from "./seed";

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
  return store;
}

describe("randomSeed", () => {
  it("returns a uint32", () => {
    for (let i = 0; i < 50; i++) {
      const s = randomSeed();
      expect(Number.isInteger(s)).toBe(true);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThan(2 ** 32);
    }
  });
});

describe("seedToUniforms", () => {
  it("is deterministic for the same seed", () => {
    expect(seedToUniforms(12345)).toEqual(seedToUniforms(12345));
  });

  it("differs across seeds", () => {
    expect(seedToUniforms(1)).not.toEqual(seedToUniforms(2));
  });

  it("stays in shader-expected ranges", () => {
    for (const seed of [0, 1, 999, 2 ** 32 - 1]) {
      const u = seedToUniforms(seed);
      expect(u.x).toBeGreaterThanOrEqual(0);
      expect(u.x).toBeLessThan(100);
      expect(u.y).toBeGreaterThanOrEqual(0);
      expect(u.y).toBeLessThan(100);
      expect(u.t).toBeGreaterThanOrEqual(0);
      expect(u.t).toBeLessThan(200);
    }
  });
});

describe("loadSeed / saveSeed", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
  });

  it("persists a fresh seed on first load", () => {
    const seed = loadSeed();
    expect(localStorage.getItem("aurora-seed")).toBe(String(seed));
  });

  it("returns the stored seed on later loads", () => {
    saveSeed(777);
    expect(loadSeed()).toBe(777);
  });

  it("replaces garbage values with a fresh seed", () => {
    localStorage.setItem("aurora-seed", "not-a-number");
    const seed = loadSeed();
    expect(Number.isInteger(seed)).toBe(true);
    expect(localStorage.getItem("aurora-seed")).toBe(String(seed));
  });
});

describe("loadSeed / saveSeed without usable storage", () => {
  it("loadSeed returns a valid uint32 without throwing when localStorage is undefined", () => {
    // @ts-expect-error - simulating an environment with no localStorage global
    delete globalThis.localStorage;
    let seed: number | undefined;
    expect(() => {
      seed = loadSeed();
    }).not.toThrow();
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThan(2 ** 32);
  });

  it("loadSeed and saveSeed don't throw when setItem throws (e.g. QuotaExceededError)", () => {
    globalThis.localStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    } as Storage;

    expect(() => saveSeed(123)).not.toThrow();

    let seed: number | undefined;
    expect(() => {
      seed = loadSeed();
    }).not.toThrow();
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThan(2 ** 32);
  });

  it("loadSeed doesn't throw when getItem throws", () => {
    globalThis.localStorage = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    } as Storage;

    let seed: number | undefined;
    expect(() => {
      seed = loadSeed();
    }).not.toThrow();
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThan(2 ** 32);
  });
});
