// A gallery page is ~15 tokens × ~9 kB of on-chain image bytes, fetched over
// two multicalls. Paging back and forth must not refetch that. Deliberately
// unbounded: the whole collection is small, and the cache is dropped after a
// successful mint (which shifts every page by one token) and on modal close.

export type PageCache<T> = {
  get(page: number): T | undefined;
  set(page: number, value: T): void;
  clear(): void;
  size(): number;
};

export function createPageCache<T>(): PageCache<T> {
  const pages = new Map<number, T>();
  return {
    get: (page) => pages.get(page),
    set: (page, value) => void pages.set(page, value),
    clear: () => pages.clear(),
    size: () => pages.size,
  };
}
