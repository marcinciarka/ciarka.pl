import { setupAuroraProgram } from "./aurora";
import { seedToUniforms, type AuroraSeed } from "./seed";

export type AuroraSnapshot = {
  dataUrl: string;
  mime: string;
  bytes: number; // decoded binary size — what on-chain storage would hold
};

// Renders one deterministic frame of the aurora offscreen at size × size.
// Side-effect free so Phase 2 (minting) can import it directly.
export function captureAurora(
  seed: AuroraSeed,
  size: number,
): AuroraSnapshot | null {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  // preserveDrawingBuffer so toDataURL reads the frame we just drew.
  const gl = canvas.getContext("webgl", {
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
  });
  if (!gl) return null;

  const setup = setupAuroraProgram(gl);
  if (!setup) return null;

  const u = seedToUniforms(seed);
  gl.viewport(0, 0, size, size);
  gl.uniform2f(setup.uSeed, u.x, u.y);
  gl.uniform2f(setup.uResolution, size, size);
  // Freeze the sky at its seed-derived phase; no scroll warp.
  gl.uniform1f(setup.uTime, u.t);
  gl.uniform1f(setup.uScrollWarp, 0);
  // No crossfade in a snapshot: slot B is never evaluated, so its seed and
  // time are irrelevant - pinned anyway to keep the frame fully determined.
  gl.uniform1f(setup.uBlend, 0);
  gl.uniform2f(setup.uSeedB, 0, 0);
  gl.uniform1f(setup.uTimeB, 0);
  gl.drawArrays(gl.TRIANGLES, 0, 6);

  // Safari's toDataURL ignores image/webp and returns PNG — detect from
  // the result, don't assume.
  const dataUrl = canvas.toDataURL("image/webp", 0.85);
  const mime = dataUrl.slice(5, dataUrl.indexOf(";"));
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const bytes = base64Bytes(base64);

  gl.deleteProgram(setup.program);
  gl.deleteBuffer(setup.positionBuffer);
  gl.getExtension("WEBGL_lose_context")?.loseContext();

  return { dataUrl, mime, bytes };
}

// Decoded length of a base64 payload: 3 bytes per 4 chars, minus padding.
function base64Bytes(base64: string): number {
  let padding = 0;
  if (base64.endsWith("==")) padding = 2;
  else if (base64.endsWith("=")) padding = 1;
  return (base64.length * 3) / 4 - padding;
}
