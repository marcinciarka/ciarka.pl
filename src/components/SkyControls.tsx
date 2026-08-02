import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { getSeed, isWebglFailed, reseed, subscribeWebglFailed } from "../lib/skyStore";
import { captureAurora } from "../lib/capture";
import { useReducedMotion } from "../hooks/useReducedMotion";

export function SkyControls() {
  const reducedMotion = useReducedMotion();
  const webglFailed = useSyncExternalStore(subscribeWebglFailed, isWebglFailed);
  // Matches the shader crossfade length in src/lib/aurora.ts.
  const FADE_MS = 1000;
  const [spinning, setSpinning] = useState(false);
  const timeoutRef = useRef(0);

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  // The static reduced-motion / no-WebGL fallback ignores the seed, so the
  // button would do nothing - hide it in both cases.
  if (reducedMotion || webglFailed) return null;

  return (
    <div className="fixed right-4 bottom-4 z-20 flex items-center gap-2">
      <button
        type="button"
        // Locked out for the length of the crossfade: a second click mid-fade
        // would cut the transition short.
        disabled={spinning}
        onClick={() => {
          reseed();
          setSpinning(true);
          clearTimeout(timeoutRef.current);
          timeoutRef.current = window.setTimeout(
            () => setSpinning(false),
            FADE_MS,
          );
        }}
        className="flex items-center gap-2 rounded-full border border-glass-border bg-glass px-4 py-2 font-mono text-xs text-muted backdrop-blur-xl transition-colors hover:border-ember/60 hover:text-text disabled:cursor-default disabled:opacity-45 disabled:hover:border-glass-border disabled:hover:text-muted"
      >
        <span
          aria-hidden="true"
          className={spinning ? "inline-block animate-spin" : "inline-block"}
        >
          ✦
        </span>
        new sky
      </button>
      {import.meta.env.DEV && (
        <button
          type="button"
          title="DEV: log snapshot sizes for the current seed"
          className="rounded-full border border-glass-border bg-glass px-3 py-1.5 font-mono text-xs text-muted backdrop-blur-xl transition-colors hover:border-ember/60 hover:text-text"
          onClick={() => {
            const seed = getSeed();
            for (const size of [128, 256, 512]) {
              const snap = captureAurora(seed, size);
              if (!snap) {
                console.warn(`capture failed at ${size}`);
                continue;
              }
              console.log(
                `aurora ${size}px ${snap.mime}: ${snap.bytes} bytes (base64 ${snap.dataUrl.length} chars)`,
              );
              if (size === 256) window.open(snap.dataUrl, "_blank");
            }
          }}
        >
          capture
        </button>
      )}
    </div>
  );
}
