// SkyControls (the hero's top-right pills) owns the "new sky" reseed and the
// gallery modal, but a showcase card lower on the page needs to trigger the
// same two actions without duplicating either. This module is the intent bus
// between them: a request fires straight through to whichever listener is
// currently mounted, rather than being stored for a future one to pick up.
// Retaining the last intent would re-open the modal or re-trigger a reseed
// the next time something subscribes (e.g. a remount), which is exactly the
// stale-replay bug this design avoids - so intents are events, not state.
//
// `busy` is genuine state (mirrors the reseed lockout), so it gets the usual
// module-store treatment - see skyStore.ts / mintedTotal.ts for the idiom.

export type SkyIntent =
  | { type: "new-aurora" }
  | { type: "gallery"; trigger: HTMLElement | null };

type IntentListener = (intent: SkyIntent) => void;
type BusyListener = (busy: boolean) => void;

const intentListeners = new Set<IntentListener>();

export function requestNewAurora(): void {
  const intent: SkyIntent = { type: "new-aurora" };
  for (const listener of intentListeners) listener(intent);
}

export function requestGallery(trigger: HTMLElement | null = null): void {
  const intent: SkyIntent = { type: "gallery", trigger };
  for (const listener of intentListeners) listener(intent);
}

export function subscribeIntent(listener: IntentListener): () => void {
  intentListeners.add(listener);
  return () => intentListeners.delete(listener);
}

let busy = false;
const busyListeners = new Set<BusyListener>();

export function setBusy(next: boolean): void {
  // useSyncExternalStore re-renders on every notification, so a same-value
  // set (e.g. both the pill and the showcase card marking "busy" for the
  // same in-flight reseed) must stay silent.
  if (busy === next) return;
  busy = next;
  for (const listener of busyListeners) listener(busy);
}

export function isBusy(): boolean {
  return busy;
}

export function subscribeBusy(listener: BusyListener): () => void {
  busyListeners.add(listener);
  return () => busyListeners.delete(listener);
}
