import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  isMintActive,
  isWebglFailed,
  reseed,
  subscribeMintActive,
  subscribeWebglFailed,
} from "../lib/skyStore";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { MintButton } from "./MintButton";

export function SkyControls() {
  const reducedMotion = useReducedMotion();
  const webglFailed = useSyncExternalStore(subscribeWebglFailed, isWebglFailed);
  // C1 belt-and-braces: a mint flow past "idle" has frozen a snapshot to a
  // specific seed (see MintButton's MintState comment) — reseeding here
  // while that's in flight would let a mint go through against the wrong
  // seed. Disable "new sky" for the duration.
  const mintActive = useSyncExternalStore(subscribeMintActive, isMintActive);
  // Matches the shader crossfade length in src/lib/aurora.ts.
  const FADE_MS = 1000;
  const [spinning, setSpinning] = useState(false);
  const timeoutRef = useRef(0);

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  // The static reduced-motion / no-WebGL fallback ignores the seed, so the
  // button would do nothing - hide it in both cases.
  if (reducedMotion || webglFailed) return null;

  return (
    // Top-right, clear of the nav (fixed top-0 z-50) at every width; z-40
    // keeps it under the nav so a scrolled-in nav bar wins any overlap.
    <div className="fixed top-4 right-4 z-40 flex items-center gap-2">
      <button
        type="button"
        // Locked out for the length of the crossfade (a second click mid-fade
        // would cut the transition short) and for the duration of a mint
        // flow past idle (see C1 above).
        disabled={spinning || mintActive}
        onClick={() => {
          reseed();
          setSpinning(true);
          clearTimeout(timeoutRef.current);
          timeoutRef.current = window.setTimeout(
            () => setSpinning(false),
            FADE_MS,
          );
        }}
        className="flex items-center gap-2 rounded-full border border-glass-border bg-glass px-4 py-2 font-mono text-xs text-muted backdrop-blur-xl transition-colors hover:border-ember/60 hover:text-text disabled:cursor-default disabled:opacity-45 disabled:hover:border-glass-border disabled:hover:text-muted cursor-pointer"
      >
        <span
          aria-hidden="true"
          className={spinning ? "inline-block animate-spin" : "inline-block"}
        >
          ✦
        </span>
        new aurora
      </button>
      {/* Minting mid-crossfade would capture a blend of two skies against a
          single seed, so the mint control shares "new aurora"'s lockout. */}
      <MintButton disabled={spinning} />
    </div>
  );
}
