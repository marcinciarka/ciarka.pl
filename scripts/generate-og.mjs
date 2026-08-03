// Renders scripts/og-card.html to public/og.png at exactly 1200x630 - the
// size declared by og:image:width/height in index.html.
//
// Usage: npm run og   (after editing identity in src/content.ts + og-card.html)
//
// Shells out to an installed Chrome/Chromium rather than taking a Playwright
// dependency: this runs by hand a few times a year, and the card deliberately
// holds nothing that changes on a schedule, so there is nothing here for CI
// to automate. Set CHROME_PATH to override the search.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const CARD = join(HERE, "og-card.html");
const OUT = join(HERE, "..", "public", "og.png");

const WIDTH = 1200;
const HEIGHT = 630;

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

function findBrowser() {
  const found = CANDIDATES.find((p) => p && existsSync(p));
  if (found) return found;
  throw new Error(
    "No Chrome/Chromium found. Install one, or set CHROME_PATH to its binary.",
  );
}

function main() {
  const browser = findBrowser();
  // Chrome refuses to reuse a profile that's already open, so give the
  // headless run a throwaway one.
  const profile = mkdtempSync(join(tmpdir(), "og-chrome-"));
  try {
    execFileSync(
      browser,
      [
        "--headless=new",
        `--screenshot=${OUT}`,
        `--window-size=${WIDTH},${HEIGHT}`,
        `--user-data-dir=${profile}`,
        // The card loads its woff2 files over file://; without this Chrome
        // treats each as a cross-origin request and silently falls back to
        // the default sans, which is the one failure mode that produces a
        // plausible-looking but wrong card.
        "--allow-file-access-from-files",
        "--hide-scrollbars",
        "--force-device-scale-factor=1",
        // Fonts and gradients are done well before this; it just guarantees
        // the shot isn't taken on the first, unstyled frame.
        "--virtual-time-budget=3000",
        // Real Chrome only: keep it from phoning home or restoring session
        // state on the throwaway profile.
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-component-update",
        "--disable-background-networking",
        `file://${CARD}`,
      ],
      // stderr ignored, not inherited: Chrome's updater logs pages of noise
      // that says nothing about whether the render worked - the existsSync
      // check below is what decides that. Killed at 60s so a browser that
      // does hold the pipe open can't stall the script indefinitely; by then
      // the PNG is long written.
      { stdio: "ignore", timeout: 60_000, killSignal: "SIGKILL" },
    );
  } catch (err) {
    // A timeout kill is only fatal if nothing landed on disk.
    if (!existsSync(OUT)) throw err;
  } finally {
    rmSync(profile, { recursive: true, force: true });
  }

  if (!existsSync(OUT)) throw new Error(`Chrome wrote no file to ${OUT}`);
  console.log(`wrote public/og.png (${WIDTH}x${HEIGHT}) via ${browser}`);
}

main();
