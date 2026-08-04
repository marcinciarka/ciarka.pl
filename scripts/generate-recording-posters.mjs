// Extracts a still poster frame from each showcase recording into
// public/recordings/<id>_poster.webp.
//
// Why these exist at all: a bare <video preload="metadata"> is not enough to
// show a thumbnail. WebKit stops at readyState 1 (HAVE_METADATA) with zero
// bytes buffered - it has the dimensions and duration but no decoded frame, so
// it paints nothing and the card renders empty in Safari. Blink happens to
// buffer on past metadata and paint frame 0, which is why this only ever looked
// broken in one browser. Nothing in the spec promises a frame at
// HAVE_METADATA, so the fix is a real poster image rather than a workaround
// that leans on Blink's behaviour.
//
// The frame also has to be chosen per recording: both clips animate in, so
// t=0 is a half-empty stage. The timestamps below are picked by eye for the
// moment each demo is actually showing something.
//
// Usage:
//   node scripts/generate-recording-posters.mjs
import { execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const RECORDINGS = join(HERE, "..", "public", "recordings");

// The card is aspect-4/3 with object-cover. At max-w-6xl the media column is
// ~550 CSS px; 800 covers 1.5x DPR without shipping a 1200px frame that PageSpeed
// flags as oversized on mobile. Quality 74 keeps both posters near ~15–20 kB.
const WIDTH = 800;
const QUALITY = 74;

const POSTERS = [
  // The hero is fully typeset by the first frame - no need to wait.
  { video: "chainvibe_web.mp4", seconds: 0.1 },
  // Deposit/withdraw bubbles drift in over the first few seconds; by 6s the
  // orb has its surrounding chain callouts, which is the point of the demo.
  { video: "resonance_web.mp4", seconds: 6 },
];

for (const { video, seconds } of POSTERS) {
  const input = join(RECORDINGS, video);
  if (!existsSync(input)) {
    throw new Error(`missing recording: ${input}`);
  }
  const output = input.replace(/_web\.mp4$/, "_poster.webp");

  // -ss before -i seeks by keyframe (fast, and accurate enough here).
  execFileSync(
    "ffmpeg",
    [
      "-v",
      "error",
      "-y",
      "-ss",
      String(seconds),
      "-i",
      input,
      "-frames:v",
      "1",
      "-vf",
      `scale=${WIDTH}:-2`,
      "-c:v",
      "libwebp",
      "-quality",
      String(QUALITY),
      output,
    ],
    { stdio: ["ignore", "inherit", "inherit"] },
  );

  const kb = (statSync(output).size / 1024).toFixed(1);
  console.log(`${video} @${seconds}s -> ${output.split("/").pop()} (${kb} kB)`);
}
