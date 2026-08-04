// How many auroras exist on-chain. First read is deferred until the aurora
// modal opens (so the viem/mint chunk stays off the critical path), then
// refreshed by every gallery page fetch and invalidated after a successful
// mint. Same module-store idiom as skyStore: a plain module variable plus a
// listener set, consumed through useSyncExternalStore.
//
// Replaces MintButton's per-open `mintedTotal` state, which had to be reset
// on close (a successful mint made the remembered count stale) and therefore
// could never feed anything outside the modal.

type Listener = (total: number | null) => void;

// null = not known yet (never read, or invalidated after a mint).
let total: number | null = null;
const listeners = new Set<Listener>();

function notify(): void {
  for (const listener of listeners) listener(total);
}

export function getMintedTotal(): number | null {
  return total;
}

export function setMintedTotal(next: number): void {
  // useSyncExternalStore re-renders on every notification, so skip the no-op.
  if (total === next) return;
  total = next;
  notify();
}

export function invalidateMintedTotal(): void {
  total = null;
  notify();
}

export function subscribeMintedTotal(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
