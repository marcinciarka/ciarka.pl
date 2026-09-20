/// <reference types="vite/client" />

// Injected by the Umami tracker script in index.html. Optional: it is missing
// whenever the script is blocked or has not loaded yet (see src/lib/track.ts).
declare var umami:
  | {
      track: (
        event: string,
        props?: Record<string, string | number | boolean>,
      ) => void;
    }
  | undefined;
