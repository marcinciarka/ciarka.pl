import { useEffect, useSyncExternalStore } from "react";
import {
  getMintedTotal,
  setMintedTotal,
  subscribeMintedTotal,
} from "../lib/mintedTotal";
import { CONTRACT_DEPLOYED } from "../lib/contractAddress";

// One totalMinted read, scheduled on idle after first paint so the corner
// pill can carry a count without anyone opening the modal — and without
// competing with the shader for the first frames. Subsequent refreshes come
// free from gallery page fetches (setMintedTotal) and from a successful mint
// (invalidateMintedTotal).
export function useMintedTotal(): number | null {
  const total = useSyncExternalStore(subscribeMintedTotal, getMintedTotal);

  useEffect(() => {
    if (!CONTRACT_DEPLOYED || total !== null) return;
    let cancelled = false;
    const run = () =>
      void (async () => {
        try {
          const { fetchMintedTotal } = await import("../lib/mint");
          const value = await fetchMintedTotal();
          if (!cancelled) setMintedTotal(value);
        } catch {
          // Leave the pill on its countless label — a failed count is not
          // worth an error state on the hero.
        }
      })();

    const idle = window.requestIdleCallback
      ? window.requestIdleCallback(run, { timeout: 3000 })
      : window.setTimeout(run, 1200);
    return () => {
      cancelled = true;
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle);
      else clearTimeout(idle);
    };
  }, [total]);

  return total;
}
