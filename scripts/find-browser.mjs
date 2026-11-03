// Locates a Chrome/Chromium binary for the headless render scripts
// (generate-og, generate-cv). Set CHROME_PATH to override the search.
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// Playwright's cached headless shell first, when one happens to be on the
// machine: it takes the screenshot and exits. Real Chrome also works, but it
// wakes GoogleUpdater on launch, and those children inherit stderr and hold
// the pipe open long after the PNG is written - which looks exactly like a
// hang. Hence the timeout in main() as well.
function playwrightShells() {
  const cache = join(homedir(), "Library", "Caches", "ms-playwright");
  const linux = join(homedir(), ".cache", "ms-playwright");
  const root = existsSync(cache) ? cache : linux;
  if (!existsSync(root)) return [];
  return readdirSync(root)
    .filter((d) => d.startsWith("chromium_headless_shell-"))
    // Directory names end in a build number; highest is newest.
    .sort(
      (a, b) => Number(b.split("-").pop()) - Number(a.split("-").pop()),
    )
    .flatMap((d) => [
      join(root, d, "chrome-mac", "headless_shell"),
      join(root, d, "chrome-mac-arm64", "headless_shell"),
      join(root, d, "chrome-linux", "headless_shell"),
    ]);
}

const CANDIDATES = [
  process.env.CHROME_PATH,
  ...playwrightShells(),
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
];

export function findBrowser() {
  const found = CANDIDATES.find((p) => p && existsSync(p));
  if (found) return found;
  throw new Error(
    "No Chrome/Chromium found. Install one, or set CHROME_PATH to its binary.",
  );
}
