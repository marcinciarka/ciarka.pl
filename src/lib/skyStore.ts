import type { AuroraSnapshot } from "./capture";
import {
  loadSeed,
  randomSeed,
  saveSeed,
  seedFromSearch,
  type AuroraSeed,
} from "./seed";

type Listener = (seed: AuroraSeed) => void;
type WebglFailedListener = () => void;

let seed: AuroraSeed | null = null;
const listeners = new Set<Listener>();

let webglFailed = false;
const webglFailedListeners = new Set<WebglFailedListener>();

// C1 belt-and-braces: while a mint flow is past "idle" (preview/minting),
// "new sky" must not be able to reseed out from under it — that's exactly
// the seed/image mismatch this flag exists to prevent. MintButton is the
// only writer; SkyControls reads it to disable the "new sky" button.
type MintActiveListener = () => void;
let mintActive = false;
const mintActiveListeners = new Set<MintActiveListener>();

export function setMintActive(active: boolean): void {
  if (mintActive === active) return;
  mintActive = active;
  for (const listener of mintActiveListeners) listener();
}

export function isMintActive(): boolean {
  return mintActive;
}

export function subscribeMintActive(listener: MintActiveListener): () => void {
  mintActiveListeners.add(listener);
  return () => mintActiveListeners.delete(listener);
}

export function getSeed(): AuroraSeed {
  if (seed === null) {
    // `?seed=N` wins over storage for this page load only, and deliberately
    // does NOT call loadSeed() - so following a shared link neither reads
    // nor writes the visitor's own persisted sky, which is still there when
    // they next arrive without the parameter. A later "new sky" reseeds and
    // persists normally, at which point the shared sky is done with.
    const shared =
      typeof location === "undefined" ? null : seedFromSearch(location.search);
    seed = shared ?? loadSeed();
  }
  return seed;
}

// A visitor who arrived on `?seed=N` and then asks for a new sky is looking
// at a sky the URL no longer describes — and that URL is the one they'd copy
// or bookmark. Drop the parameter (keeping any others, and the hash) so the
// address bar never contradicts the canvas. replaceState, not pushState:
// this isn't a navigation, and Back should still leave the page.
function dropSeedParam(): void {
  if (typeof location === "undefined" || typeof history === "undefined") return;
  try {
    const url = new URL(location.href);
    if (!url.searchParams.has("seed")) return;
    url.searchParams.delete("seed");
    history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  } catch {
    // Opaque-origin / sandboxed document — the sky is still correct, only
    // the address bar is stale. Not worth failing a reseed over.
  }
}

export function reseed(): AuroraSeed {
  let next = randomSeed();
  // Astronomically unlikely, but "new sky" must always look new.
  while (next === seed) next = randomSeed();
  seed = next;
  saveSeed(next);
  dropSeedParam();
  for (const listener of listeners) listener(next);
  return next;
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// The live hero owns the only canvas worth capturing, but the mint UI lives
// elsewhere in the tree. Rather than thread a ref through, AuroraHero
// registers its captureFrame here on init and clears it on destroy, so
// capture is unavailable exactly when there is no live canvas (reduced
// motion, WebGL failure, hero unmounted).
type CaptureFn = () => AuroraSnapshot | null;
let capture: CaptureFn | null = null;

export function registerCapture(fn: CaptureFn | null): void {
  capture = fn;
}

export function captureNow(): AuroraSnapshot | null {
  return capture?.() ?? null;
}

// Shared "WebGL init failed" flag so any UI that depends on the live
// canvas (not just the reduced-motion fallback) can hide itself too.
export function setWebglFailed(): void {
  if (webglFailed) return;
  webglFailed = true;
  for (const listener of webglFailedListeners) listener();
}

export function isWebglFailed(): boolean {
  return webglFailed;
}

export function subscribeWebglFailed(listener: WebglFailedListener): () => void {
  webglFailedListeners.add(listener);
  return () => webglFailedListeners.delete(listener);
}
