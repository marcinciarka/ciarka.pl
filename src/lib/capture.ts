// Capture *policy* only. The pixels come from the live hero canvas
// (`AuroraHandle.captureFrame` in ./aurora) so a snapshot is exactly the sky
// the visitor is looking at - WYSIWYG. This module is deliberately
// DOM-light and dependency-free so mint.ts can import the type and the
// checks without pulling the renderer in.

export type AuroraSnapshot = {
  dataUrl: string;
  mime: string;
  bytes: number; // decoded binary size — what on-chain storage would hold
};

export function isWebpDataUrl(dataUrl: string): boolean {
  return dataUrl.startsWith("data:image/webp;");
}

let webpProbe: boolean | null = null;

// Policy: an aurora NFT is a WebP or nothing. Safari's toDataURL
// silently falls back to PNG, so probe the actual encoder output once.
export function supportsWebpCapture(): boolean {
  if (webpProbe !== null) return webpProbe;
  if (typeof document === "undefined") return (webpProbe = false);
  try {
    const probe = document.createElement("canvas");
    probe.width = 1;
    probe.height = 1;
    webpProbe = isWebpDataUrl(probe.toDataURL("image/webp"));
  } catch {
    webpProbe = false;
  }
  return webpProbe;
}

// Decoded byte size of a data URL's payload - what on-chain storage holds,
// which is what the 16kB cap is actually about (the base64 text is ~4/3 of
// it and never leaves the browser).
export function dataUrlBytes(dataUrl: string): number {
  return base64Bytes(dataUrl.slice(dataUrl.indexOf(",") + 1));
}

// Decoded length of a base64 payload: 3 bytes per 4 chars, minus padding.
function base64Bytes(base64: string): number {
  let padding = 0;
  if (base64.endsWith("==")) padding = 2;
  else if (base64.endsWith("=")) padding = 1;
  return (base64.length * 3) / 4 - padding;
}
