import { describe, expect, it } from "vitest";
import MAIN from "./main.tsx?raw";

describe("critical font imports", () => {
  it("keeps Instrument Sans 400/500 on the critical path", () => {
    expect(MAIN).toContain("@fontsource/instrument-sans/latin-400.css");
    expect(MAIN).toContain("@fontsource/instrument-sans/latin-500.css");
  });

  it("does not statically import Instrument Sans 600 (unused by body text)", () => {
    expect(MAIN).not.toContain("latin-600");
  });

  it("defers JetBrains Mono via a dynamic import", () => {
    expect(MAIN).not.toMatch(/@fontsource\/jetbrains-mono/);
    expect(MAIN).toContain('import("./fontsMono")');
  });
});
