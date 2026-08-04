// The showcase poster frames are generated out-of-band by `npm run posters`,
// not by the normal build - same exposure as public/aurora-still.webp, so the
// same guard. These posters carry extra weight though: they are the only thing
// that renders in the showcase card until the reader opens the player, and a
// missing one means Safari shows an empty frame (WebKit decodes no frame from a
// <video preload="metadata">, which is the bug that put them here).
import { describe, expect, it } from "vitest";
import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(HERE, "..", "public");
const MAX_BYTES = 50_000;

const POSTERS = [
  "/recordings/chainvibe_poster.webp",
  "/recordings/resonance_poster.webp",
];

describe.each(POSTERS)("public%s", (poster) => {
  const asset = join(PUBLIC, poster);

  it("exists", () => {
    expect(() => statSync(asset)).not.toThrow();
  });

  it("is a real WebP file", () => {
    const bytes = readFileSync(asset);
    expect(bytes.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(bytes.subarray(8, 12).toString("ascii")).toBe("WEBP");
  });

  it("is under the size budget for a preview image", () => {
    expect(statSync(asset).size).toBeLessThan(MAX_BYTES);
  });
});
