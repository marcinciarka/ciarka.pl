// public/aurora-still.webp is generated out-of-band by `npm run
// aurora:still`, not by this repo's normal build - CI runs the test suite
// before build and has no other reason to notice if the asset went missing,
// silently reverted to some placeholder, or ballooned in size. These checks
// are what stand between that happening and it shipping unnoticed.
import { describe, expect, it } from "vitest";
import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ASSET = join(HERE, "..", "public", "aurora-still.webp");
const MAX_BYTES = 200_000;

describe("public/aurora-still.webp", () => {
  it("exists", () => {
    expect(() => statSync(ASSET)).not.toThrow();
  });

  it("is a real WebP file", () => {
    const bytes = readFileSync(ASSET);
    expect(bytes.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(bytes.subarray(8, 12).toString("ascii")).toBe("WEBP");
  });

  it("is under the size budget for a preview image", () => {
    const { size } = statSync(ASSET);
    expect(size).toBeLessThan(MAX_BYTES);
  });
});
