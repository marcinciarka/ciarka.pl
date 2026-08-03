// Display-only string helpers for the aurora modal. Dependency-free so
// components can import them statically without pulling viem in.

// 0x4f2e1d9a…a9c1 -> 0x4f2…9c1. Short enough to sit in a two-column detail
// list at 360px, long enough to compare against a wallet at a glance.
export function truncateAddress(address: string): string {
  if (address.length <= 9) return address;
  return `${address.slice(0, 5)}…${address.slice(-3)}`;
}

// Decoded on-chain byte size, human-readable. kB not KiB: the 16_000-byte cap
// in contractAddress.ts is decimal, so the displayed number should divide by
// the same 1000 the cap is expressed in.
export function formatBytes(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`;
  return `${(bytes / 1000).toFixed(1)} kB`;
}
