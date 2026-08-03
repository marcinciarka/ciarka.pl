// Focus-trap arithmetic, kept out of the component so it can be tested in a
// node environment (the project has no jsdom — see vitest.config.ts).

export const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

// Where Tab should land, given how many focusable elements the dialog has and
// where focus currently sits.
//
// activeIndex -1 means focus is outside the dialog entirely — which happens
// whenever the focused control unmounts (the ✕ disappearing as a mint starts,
// a segment switching out) and focus falls to <body>.
//
// Returns null for a move the browser already gets right, so the caller can
// skip preventDefault and leave native tab order alone.
export function nextFocusIndex(
  count: number,
  activeIndex: number,
  shiftKey: boolean,
): number | null {
  if (count === 0) return null;
  if (activeIndex === -1) return shiftKey ? count - 1 : 0;
  if (shiftKey && activeIndex === 0) return count - 1;
  if (!shiftKey && activeIndex === count - 1) return 0;
  return null;
}
