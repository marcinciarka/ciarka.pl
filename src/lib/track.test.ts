import { afterEach, describe, expect, it, vi } from "vitest";
import { track } from "./track";

afterEach(() => {
  delete globalThis.umami;
});

describe("track", () => {
  it("forwards the event name and props to the tracker", () => {
    const spy = vi.fn();
    globalThis.umami = { track: spy };

    track("contact-click", { channel: "telegram" });

    expect(spy).toHaveBeenCalledWith("contact-click", { channel: "telegram" });
  });

  it("stays silent when the tracker never loaded", () => {
    expect(() => track("hero-cta")).not.toThrow();
  });
});
