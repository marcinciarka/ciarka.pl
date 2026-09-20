// Umami event tracking. The tracker is loaded from cloud.umami.is in
// index.html and is absent often enough - ad blockers, privacy extensions,
// the seconds before a deferred script lands - that every call site would
// otherwise need its own guard.
//
// globalThis rather than window so this runs unchanged in vitest's node
// environment; in a browser they are the same object.
export function track(
  event: string,
  props?: Record<string, string | number | boolean>,
) {
  globalThis.umami?.track(event, props);
}
