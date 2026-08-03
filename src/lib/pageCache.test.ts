import { describe, expect, it } from "vitest";
import { createPageCache } from "./pageCache";

describe("createPageCache", () => {
  it("returns undefined for an unseen page", () => {
    const cache = createPageCache<string>();
    expect(cache.get(0)).toBeUndefined();
  });

  it("round-trips a value by page index", () => {
    const cache = createPageCache<string>();
    cache.set(2, "page two");
    expect(cache.get(2)).toBe("page two");
    expect(cache.get(1)).toBeUndefined();
  });

  it("overwrites an existing page", () => {
    const cache = createPageCache<string>();
    cache.set(0, "old");
    cache.set(0, "new");
    expect(cache.get(0)).toBe("new");
    expect(cache.size()).toBe(1);
  });

  it("clear drops every page", () => {
    const cache = createPageCache<string>();
    cache.set(0, "a");
    cache.set(1, "b");
    cache.clear();
    expect(cache.size()).toBe(0);
    expect(cache.get(0)).toBeUndefined();
  });

  it("keeps two caches independent", () => {
    const a = createPageCache<number>();
    const b = createPageCache<number>();
    a.set(0, 1);
    expect(b.get(0)).toBeUndefined();
  });
});
