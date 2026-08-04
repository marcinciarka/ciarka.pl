import { useEffect, useSyncExternalStore } from "react";
import {
  getMintedTotal,
  setMintedTotal,
  subscribeMintedTotal,
} from "../lib/mintedTotal";
import { CONTRACT_DEPLOYED } from "../lib/contractAddress";
import { shouldFetchMintedTotal } from "./shouldFetchMintedTotal";

// One totalMinted read, triggered only while the aurora modal is open so the
// viem/mint chunk stays off the critical path. Subsequent refreshes come free
// from gallery page fetches (setMintedTotal) and from a successful mint
// (invalidateMintedTotal → effect re-runs while the modal is still open).
export function useMintedTotal(enabled: boolean): number | null {
  const total = useSyncExternalStore(subscribeMintedTotal, getMintedTotal);

  useEffect(() => {
    if (
      !shouldFetchMintedTotal({
        enabled,
        deployed: CONTRACT_DEPLOYED,
        total,
      })
    ) {
      return;
    }
    let cancelled = false;
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
    return () => {
      cancelled = true;
    };
  }, [enabled, total]);

  return total;
}
