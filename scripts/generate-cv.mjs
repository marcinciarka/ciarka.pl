// Builds both CV PDFs in public/ from src/cv/content.ts.
//
// Usage: npm run cv
//
// src/cv/Cv.tsx renders the page to static HTML; headless Chrome prints it,
// the same way generate-og.mjs takes its screenshot. Vite's runnerImport
// loads the TSX, so there is no separate build step. Set CHROME_PATH to
// override the browser search.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { findBrowser } from "./find-browser.mjs";
import { runnerImport } from "vite";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = join(ROOT, "public");
const CV_DIR = join(ROOT, "src", "cv");

function printPdf(browser, html, out) {
  const work = mkdtempSync(join(tmpdir(), "cv-chrome-"));
  const page = join(work, "cv.html");
  writeFileSync(page, html);
  const before = existsSync(out) ? statSync(out).mtimeMs : 0;
  try {
    execFileSync(
      browser,
      [
        "--headless=new",
        `--print-to-pdf=${out}`,
        "--no-pdf-header-footer",
        `--user-data-dir=${join(work, "profile")}`,
        // Fonts load from node_modules over file://; without this Chrome
        // silently falls back to the default sans.
        "--allow-file-access-from-files",
        "--virtual-time-budget=3000",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-component-update",
        "--disable-background-networking",
        pathToFileURL(page).href,
      ],
      // See generate-og.mjs: real Chrome can hold the pipe open after the
      // file is written, so a timeout kill only fails if no new file landed.
      { stdio: "ignore", timeout: 60_000, killSignal: "SIGKILL" },
    );
  } catch (err) {
    if (!existsSync(out) || statSync(out).mtimeMs === before) throw err;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
  if (!existsSync(out) || statSync(out).mtimeMs === before) {
    throw new Error(`Chrome wrote no file to ${out}`);
  }
}

const [{ module: content }, { module: page }] = await Promise.all([
  runnerImport(join(CV_DIR, "content.ts")),
  runnerImport(join(CV_DIR, "Cv.tsx")),
]);
// Trailing slash: <base> resolves relative URLs against the last "/".
const baseHref = pathToFileURL(CV_DIR).href + "/";
const browser = findBrowser();
for (const cv of content.variants) {
  printPdf(browser, page.renderCv(cv, baseHref), join(PUBLIC, cv.file));
  console.log(`wrote public/${cv.file}`);
}
