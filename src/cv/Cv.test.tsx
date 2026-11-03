// The PDFs are binary and nobody diffs them in review, so this checks the
// HTML they're printed from: every piece of copy in content.ts reaches the
// page.
import { describe, expect, it } from "vitest";
import { variants } from "./content.ts";
import { renderCv } from "./Cv.tsx";

const strings = (v: unknown): string[] =>
  typeof v === "string"
    ? [v]
    : Object.values(v ?? {}).flatMap((x: unknown) => strings(x));

// Undo React's text escaping so copy can be compared verbatim.
const decode = (html: string) =>
  html
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#x27;", "'")
    .replaceAll("&amp;", "&");

describe.each(variants.map((v) => [v.file, v] as const))("%s", (_, cv) => {
  const html = decode(renderCv(cv, "file:///cv/"));
  // `file` names the output PDF; it's not page copy.
  const { file: _file, ...copy } = cv;

  it("renders every string from content.ts", () => {
    const missing = strings(copy)
      .flatMap((s) => s.split("\n"))
      .filter((s) => !html.includes(s));
    expect(missing).toEqual([]);
  });
});
