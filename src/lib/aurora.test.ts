import { describe, expect, it } from "vitest";
import { nextRenderSize } from "./aurora";

// Reallocating the drawing buffer is not free: it wipes the buffer to opaque
// black and changes uResolution, which feeds `aspect` into the noise field, so
// the sky both flashes and re-forms into a different shape. The regression
// these tests exist for: a phone's URL bar sliding in and out resized the
// canvas continuously while scrolling, so the hero flashed and restarted over
// and over. Every case below is about *not* reallocating unless it is worth it.
describe("nextRenderSize", () => {
  const DPR = 1;

  it("allocates on the first call, with nothing allocated yet", () => {
    expect(nextRenderSize(375, 844, DPR, 0, 0)).toEqual({
      width: 355,
      height: 800,
    });
  });

  it("clamps height to the 800px render cap", () => {
    expect(nextRenderSize(1440, 5000, DPR, 0, 0)?.height).toBe(800);
  });

  it("matches the buffer's aspect ratio to the box's", () => {
    const box = 1440 / 900;
    const size = nextRenderSize(1440, 900, DPR, 0, 0)!;
    expect(size.width / size.height).toBeCloseTo(box, 2);
  });

  it("caps dpr at 2 - a 3x phone would render 3x the fragments for nothing", () => {
    expect(nextRenderSize(375, 300, 3, 0, 0)).toEqual(
      nextRenderSize(375, 300, 2, 0, 0),
    );
  });

  it("treats dpr below 1 as 1 rather than shrinking the buffer", () => {
    expect(nextRenderSize(375, 300, 0.5, 0, 0)).toEqual(
      nextRenderSize(375, 300, 1, 0, 0),
    );
  });

  // The bug. A 60px toolbar shift on a 375x844 box moved the buffer
  // 355x800 -> 375x784 before this policy existed: the height cap means
  // `width` is derived from clientHeight, so a pure height change moves BOTH
  // dimensions.
  it("keeps the buffer when a phone's URL bar changes the viewport height", () => {
    const allocated = nextRenderSize(375, 844, DPR, 0, 0)!;
    expect(allocated).toEqual({ width: 355, height: 800 });
    expect(
      nextRenderSize(375, 784, DPR, allocated.width, allocated.height),
    ).toBeNull();
  });

  it("keeps the buffer across a full toolbar sweep, not just one step", () => {
    const allocated = nextRenderSize(375, 844, DPR, 0, 0)!;
    // Every intermediate height the toolbar animation passes through.
    for (let h = 844; h >= 784; h -= 4) {
      expect(
        nextRenderSize(375, h, DPR, allocated.width, allocated.height),
        `height ${h} should not reallocate`,
      ).toBeNull();
    }
  });

  it("ignores sub-pixel and single-pixel jitter", () => {
    const allocated = nextRenderSize(1440, 900, DPR, 0, 0)!;
    expect(
      nextRenderSize(1441, 900, DPR, allocated.width, allocated.height),
    ).toBeNull();
  });

  it("still reallocates for a real resize - a desktop window halved", () => {
    const allocated = nextRenderSize(1440, 900, DPR, 0, 0)!;
    const next = nextRenderSize(
      720,
      900,
      DPR,
      allocated.width,
      allocated.height,
    );
    expect(next).not.toBeNull();
    expect(next!.width).toBeLessThan(allocated.width);
  });

  it("still reallocates on an orientation change", () => {
    const portrait = nextRenderSize(375, 844, DPR, 0, 0)!;
    const landscape = nextRenderSize(
      844,
      375,
      DPR,
      portrait.width,
      portrait.height,
    );
    expect(landscape).not.toBeNull();
    expect(landscape!.width).toBeGreaterThan(landscape!.height);
  });

  it("returns null for a canvas that measures zero", () => {
    // display:none or not yet in the document. Dividing by clientHeight here
    // would otherwise hand NaN to canvas.width.
    expect(nextRenderSize(0, 0, DPR, 0, 0)).toBeNull();
    expect(nextRenderSize(375, 0, DPR, 355, 800)).toBeNull();
    expect(nextRenderSize(0, 844, DPR, 355, 800)).toBeNull();
  });

  it("never returns a zero dimension for a very flat box", () => {
    const size = nextRenderSize(1000, 1, DPR, 0, 0);
    if (size) {
      expect(size.width).toBeGreaterThan(0);
      expect(size.height).toBeGreaterThan(0);
    }
  });
});
