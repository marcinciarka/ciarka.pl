// Renders scripts/aurora-still.html to public/aurora-still.webp: a single,
// deterministic frame of the real aurora shader (src/lib/aurora.ts,
// src/lib/seed.ts - no copy of the GLSL) for use as a static preview image
// in a showcase card.
//
// The still page imports bare .ts modules, which only resolve through Vite's
// dev server - so this script spawns one on a fixed port, points headless
// Chrome at it, pulls the rendered frame back out of the dumped DOM as a
// data:image/webp URL, and writes the decoded bytes to disk.
//
// Usage:
//   node scripts/generate-aurora-still.mjs                  (writes the real asset)
//   node scripts/generate-aurora-still.mjs 12345             (seed override)
//   node scripts/generate-aurora-still.mjs 12345 /tmp/x.webp (seed + output path)
import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = process.argv[3]
  ? resolve(process.cwd(), process.argv[3])
  : join(HERE, "..", "public", "aurora-still.webp");
const SEED = process.argv[2] !== undefined ? Number(process.argv[2]) : undefined;

const PORT = 5199;
const PAGE_PATH = SEED === undefined
  ? "/scripts/aurora-still.html"
  : `/scripts/aurora-still.html?seed=${encodeURIComponent(SEED)}`;
const URL = `http://localhost:${PORT}${PAGE_PATH}`;

// --- Browser discovery, copied verbatim in approach from generate-og.mjs ---
// (kept in this file rather than shared so each generator stays a single,
// standalone script - see that file's comments for why each piece exists.)

// Playwright's cached headless shell first, when one happens to be on the
// machine: it takes the screenshot and exits. Real Chrome also works, but it
// wakes GoogleUpdater on launch, and those children inherit stderr and hold
// the pipe open long after output is written - which looks exactly like a
// hang. Hence the timeout below as well.
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

// --- Vite dev server lifecycle ---

function startVite() {
  const child = spawn(
    "npx",
    ["vite", "--port", String(PORT), "--strictPort"],
    {
      cwd: join(HERE, ".."),
      // Detached from our stdio: nothing here needs vite's own logs, and
      // inheriting them would interleave with this script's output.
      stdio: "ignore",
    },
  );
  return child;
}

async function waitForServer(url, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 404) return;
    } catch {
      // Not up yet - keep polling.
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(
    `Vite dev server on port ${PORT} never came up within ${timeoutMs}ms`,
  );
}

function killVite(child) {
  if (!child || child.killed || child.exitCode !== null) return;
  try {
    child.kill("SIGTERM");
  } catch {
    // Already gone.
  }
}

// --- Headless Chrome capture ---

function dumpDom(browser) {
  const profile = mkdtempSync(join(tmpdir(), "aurora-still-chrome-"));
  try {
    const stdout = execFileSync(
      browser,
      [
        "--headless=new",
        "--dump-dom",
        `--user-data-dir=${profile}`,
        "--hide-scrollbars",
        "--force-device-scale-factor=1",
        // Headless Chrome/headless_shell has no real GPU context to bind to
        // (fails with "Failed to create context" otherwise, and getContext
        // silently returns null) - force ANGLE's SwiftShader software
        // rasterizer so WebGL actually works under --headless=new.
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
        // The shader needs to compile and draw a frame; generous budget so a
        // slow CI runner isn't the difference between success and failure.
        "--virtual-time-budget=8000",
        // Real Chrome only: keep it from phoning home or restoring session
        // state on the throwaway profile.
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-component-update",
        "--disable-background-networking",
        URL,
      ],
      // stderr ignored, not inherited: Chrome's updater logs pages of noise
      // that says nothing about whether the render worked. Killed at 60s so
      // a browser that holds the pipe open can't stall the script forever.
      { stdio: ["ignore", "pipe", "ignore"], timeout: 60_000, killSignal: "SIGKILL", maxBuffer: 64 * 1024 * 1024 },
    );
    return stdout.toString("utf8");
  } finally {
    rmSync(profile, { recursive: true, force: true });
  }
}

function extractDataUrl(dom) {
  const match = dom.match(/data:image\/[a-z]+;base64,[A-Za-z0-9+/=]+/);
  if (!match) {
    throw new Error(
      "No data: image URL found in the dumped DOM - the still page failed to render (check aurora-still.html and the shader).",
    );
  }
  const dataUrl = match[0];
  if (!dataUrl.startsWith("data:image/webp;")) {
    throw new Error(
      `Expected a WebP data URL but got "${dataUrl.slice(0, 32)}..." - the browser's WebP encoder is unavailable and toDataURL silently fell back to PNG (the same failure mode documented in src/lib/capture.ts).`,
    );
  }
  return dataUrl;
}

// Module-level so the SIGINT handler can reach the same child the main
// try/finally is managing - a Ctrl-C mid-run must not leave vite on the port
// any more than a thrown error should.
let viteChild = null;

async function main() {
  const browser = findBrowser();
  viteChild = startVite();
  try {
    await waitForServer(`http://localhost:${PORT}/`);
    const dom = dumpDom(browser);
    const dataUrl = extractDataUrl(dom);
    const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
    const bytes = Buffer.from(base64, "base64");
    writeFileSync(OUT, bytes);
    console.log(`wrote ${OUT} (${bytes.length} bytes) via ${browser}`);
  } finally {
    killVite(viteChild);
  }
}

process.on("SIGINT", () => {
  killVite(viteChild);
  process.exit(130);
});

main().catch((err) => {
  console.error(err.message ?? err);
  process.exitCode = 1;
});
