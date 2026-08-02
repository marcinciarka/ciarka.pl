import { loadSeed, randomSeed, saveSeed, type AuroraSeed } from "./seed";

type Listener = (seed: AuroraSeed) => void;
type WebglFailedListener = () => void;

let seed: AuroraSeed | null = null;
const listeners = new Set<Listener>();

let webglFailed = false;
const webglFailedListeners = new Set<WebglFailedListener>();

export function getSeed(): AuroraSeed {
  if (seed === null) seed = loadSeed();
  return seed;
}

export function reseed(): AuroraSeed {
  let next = randomSeed();
  // Astronomically unlikely, but "new sky" must always look new.
  while (next === seed) next = randomSeed();
  seed = next;
  saveSeed(next);
  for (const listener of listeners) listener(next);
  return next;
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
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
