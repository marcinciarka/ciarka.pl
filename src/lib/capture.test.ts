import { describe, expect, it } from "vitest";
import { dataUrlBytes, isWebpDataUrl, supportsWebpCapture } from "./capture";

describe("isWebpDataUrl", () => {
  it("accepts webp data urls", () => {
    expect(isWebpDataUrl("data:image/webp;base64,aGkh")).toBe(true);
  });
  it("rejects png data urls (Safari fallback)", () => {
    expect(isWebpDataUrl("data:image/png;base64,aGkh")).toBe(false);
  });
  it("rejects non-data strings", () => {
    expect(isWebpDataUrl("https://example.com/a.webp")).toBe(false);
  });
});

describe("dataUrlBytes", () => {
  it("returns the decoded payload size, not the base64 length", () => {
    // "hi!" -> aGkh (4 chars, 3 bytes, no padding)
    expect(dataUrlBytes("data:image/webp;base64,aGkh")).toBe(3);
  });

  it("discounts padding", () => {
    expect(dataUrlBytes("data:image/webp;base64,aGk=")).toBe(2); // "hi"
    expect(dataUrlBytes("data:image/webp;base64,aA==")).toBe(1); // "h"
  });

  it("matches a round-trip through btoa for a larger payload", () => {
    const raw = Array.from({ length: 1234 }, (_, i) =>
      String.fromCharCode(i % 256),
    ).join("");
    expect(dataUrlBytes(`data:image/webp;base64,${btoa(raw)}`)).toBe(1234);
  });
});

describe("supportsWebpCapture", () => {
  it("is false without a DOM (node env)", () => {
    expect(supportsWebpCapture()).toBe(false);
  });
});
