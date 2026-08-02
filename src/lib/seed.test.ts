import { beforeEach, describe, expect, it } from "vitest";
import {
  AURORA_PALETTE,
  loadSeed,
  randomSeed,
  saveSeed,
  seedFromSearch,
  seedToUniforms,
} from "./seed";

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

  // Regression pin: the color draws were appended after x/y/t, so every
  // pre-existing seed must keep the exact sky motion it had before.
  // Values computed with the pre-palette implementation.
  it("keeps x/y/t byte-identical to the pre-palette implementation", () => {
    expect(seedToUniforms(12345)).toMatchObject({
      x: 97.97282677609473,
      y: 30.67522644996643,
      t: 96.841084305197,
    });
    expect(seedToUniforms(0)).toMatchObject({
      x: 26.642920868471265,
      y: 0.03297457005828619,
      t: 44.65440548956394,
    });
    expect(seedToUniforms(4242424242)).toMatchObject({
      x: 59.50073469430208,
      y: 43.35181007627398,
      t: 33.13690214417875,
    });
  });

  it("picks two distinct palette colors for every seed", () => {
    const pairs = new Set<string>();
    for (let seed = 0; seed < 500; seed++) {
      const { colorA, colorB } = seedToUniforms(seed);
      expect(AURORA_PALETTE).toContain(colorA);
      expect(AURORA_PALETTE).toContain(colorB);
      expect(colorA).not.toEqual(colorB);
      pairs.add(`${AURORA_PALETTE.indexOf(colorA)}-${AURORA_PALETTE.indexOf(colorB)}`);
    }
    // All 5 * 4 ordered distinct pairs should be reachable.
    expect(pairs.size).toBe(20);
  });

  it("picks colors deterministically", () => {
    const a = seedToUniforms(98765);
    const b = seedToUniforms(98765);
    expect(a.colorA).toEqual(b.colorA);
    expect(a.colorB).toEqual(b.colorB);
  });
});

describe("AURORA_PALETTE", () => {
  it("has five distinct rgb triples in 0..1", () => {
    expect(AURORA_PALETTE).toHaveLength(5);
    expect(new Set(AURORA_PALETTE.map((c) => c.join(",")))).toHaveProperty(
      "size",
      5,
    );
    for (const color of AURORA_PALETTE) {
      expect(color).toHaveLength(3);
      for (const channel of color) {
        expect(channel).toBeGreaterThanOrEqual(0);
        expect(channel).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("seedFromSearch", () => {
  it("reads a valid uint32 seed", () => {
    expect(seedFromSearch("?seed=4195785527")).toBe(4195785527);
    expect(seedFromSearch("seed=0")).toBe(0);
    expect(seedFromSearch(`?seed=${2 ** 32 - 1}`)).toBe(2 ** 32 - 1);
  });

  it("finds the seed among other params", () => {
    expect(seedFromSearch("?utm=x&seed=42&ref=y")).toBe(42);
  });

  it("returns null when the param is absent", () => {
    expect(seedFromSearch("")).toBeNull();
    expect(seedFromSearch("?other=1")).toBeNull();
  });

  // Number("") and Number(" ") are 0, which would otherwise pass the
  // uint32 range check and silently pin the sky to seed 0.
  it("returns null for empty or blank values", () => {
    expect(seedFromSearch("?seed=")).toBeNull();
    expect(seedFromSearch("?seed=%20")).toBeNull();
  });

  it("rejects values outside the uint32 range or not integers", () => {
    expect(seedFromSearch("?seed=-1")).toBeNull();
    expect(seedFromSearch(`?seed=${2 ** 32}`)).toBeNull();
    expect(seedFromSearch("?seed=1.5")).toBeNull();
    expect(seedFromSearch("?seed=abc")).toBeNull();
    expect(seedFromSearch("?seed=NaN")).toBeNull();
    expect(seedFromSearch("?seed=Infinity")).toBeNull();
  });

  it("uses the first occurrence when repeated", () => {
    expect(seedFromSearch("?seed=1&seed=2")).toBe(1);
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
