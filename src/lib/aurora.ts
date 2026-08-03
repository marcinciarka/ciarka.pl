import {
  dataUrlBytes,
  isWebpDataUrl,
  type AuroraSnapshot,
} from "./capture";
import { seedToUniforms, type AuroraSeed } from "./seed";

const VERTEX_SRC = `
attribute vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const FRAGMENT_SRC = `
precision highp float;

uniform vec2 uResolution;
uniform float uTime;
// 0..1: scales the existing domain-warp displacement on scroll.
uniform float uScrollWarp;
// Seed-derived offset into the noise field / animation phase.
uniform vec2 uSeed;
// Crossfade slot B: the incoming sky during a "new sky" transition.
uniform vec2 uSeedB;
uniform float uTimeB;
// 0 = only slot A is drawn (steady state), 1 = only slot B.
uniform float uBlend;
// Seed-picked aurora pair for slot A, and the incoming pair for slot B.
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorA2;
uniform vec3 uColorB2;
// Capture-only star boost. 1.0 on screen (the live sky is unchanged);
// captureFrame raises it for the single capture draw so the dust layer
// survives being scaled down to a 160px marketplace thumbnail. Applied to
// particle radius AND the dust contribution, so the stars get bigger and
// brighter together instead of turning into pale blobs.
uniform float uStarBoost;

vec3 nebula = vec3(0.83, 0.36, 0.72);
vec3 ember = vec3(1.0, 0.706, 0.329);
vec3 ink = vec3(0.027, 0.043, 0.078);

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 4; i++) {
    value += amplitude * noise(p);
    p *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}

// Sparse hash-based star/dust layer: one particle in ~25% of grid cells,
// drifting upward, each twinkling on its own phase. Per-particle random
// size and a bright core + faint halo give the field depth.
float particles(vec2 uv, float time, float density, float speed, float size) {
  vec2 p = uv * density + vec2(0.0, -time * speed);
  vec2 cell = floor(p);
  vec2 f = fract(p);
  float rnd = hash(cell);
  vec2 pos = vec2(hash(cell + 7.3), hash(cell + 3.1)) * 0.7 + 0.15;
  float d = length(f - pos);
  // uStarBoost scales the radius that drives both the core smoothstep and
  // the halo, so a boosted star is genuinely larger rather than just a
  // wider soft edge.
  float pSize = size * uStarBoost * (0.35 + 0.65 * hash(cell + 11.9));
  float twinkle = 0.55 + 0.45 * sin(time * (0.6 + rnd * 1.8) + rnd * 43.0);
  float core = smoothstep(pSize, 0.0, d);
  core *= core * core; // sharpen: tiny hot center instead of a flat disc
  float halo = smoothstep(pSize * 3.0, 0.0, d) * 0.15;
  return (core + halo) * twinkle * step(0.75, rnd);
}

float curtain(vec2 uv, float t, float freq, float speed, float yOffset) {
  float x = uv.x * freq + t * speed;
  float n = fbm(vec2(x, t * 0.15));
  float wave = sin(uv.x * 3.14159 * freq * 0.3 + t * speed * 1.3) * 0.12;
  float y = yOffset + wave + (n - 0.5) * 0.25;
  float dist = abs(uv.y - y);
  return smoothstep(0.32, 0.0, dist);
}

// One complete sky for a given animation time and seed offset. Factored
// out of main() so two seeds can be evaluated and crossfaded; the visuals
// are byte-for-byte the ones that used to live inline.
vec3 sky(float rawTime, vec2 seedOffset, vec3 aurora1, vec3 aurora2) {
  float aspect = uResolution.x / uResolution.y;
  vec2 uv = gl_FragCoord.xy / uResolution.xy;
  uv.x *= aspect;

  float t = rawTime * 0.06;
  vec2 so = seedOffset;

  // Double domain warp (warp of a warp): the second field is sampled
  // through the first, folding the curtains into marbled, nebula-like
  // structures. Scroll only scales that existing displacement - no
  // extra motion, just more of the same fold.
  float warpAmp = 1.0 + uScrollWarp * 0.85;
  float foldAmp = 1.8 + uScrollWarp * 0.55;
  vec2 q = vec2(
    fbm(uv * 1.8 + vec2(t * 0.6, 0.0) + so),
    fbm(uv * 1.8 - vec2(0.0, t * 0.5) + so.yx)
  );
  vec2 r = vec2(
    fbm(uv * 2.4 + q * foldAmp + vec2(4.7, 9.2) + t * 0.35 + so * 1.7),
    fbm(uv * 2.4 + q * foldAmp + vec2(8.3, 2.8) - t * 0.28 - so.yx * 1.3)
  );
  vec2 auroraUv = uv + (q - 0.5) * 0.3 * warpAmp + (r - 0.5) * 0.34 * warpAmp;

  float c1 = curtain(auroraUv, t + so.x, 1.1, 0.6, 0.62);
  float c2 = curtain(auroraUv, t + 12.0 + so.y, 0.7, 0.4, 0.48);
  float c3 = curtain(auroraUv, t + 31.0 + so.x + so.y, 1.6, 0.5, 0.7);

  vec3 color = ink;
  color = mix(color, aurora1, c2 * 0.55);
  color = mix(color, aurora2, c1 * 0.5);
  color = mix(color, aurora1 * 0.6 + aurora2 * 0.4, c3 * 0.35);

  // Nebula tint driven by the second warp field: the most folded regions
  // pick up a magenta glow, coloring the marbling itself.
  float fold = smoothstep(0.5, 0.9, r.x) * smoothstep(0.3, 0.8, q.y);
  color = mix(color, nebula, fold * (c1 + c2 + c3) * 0.6);

  // Drifting dust: three parallax layers, brighter where the aurora is.
  float glow = c1 + c2 + c3;
  float dust = particles(uv + so * 0.15, rawTime, 22.0, 0.045, 0.045) * 0.6;
  dust += particles(uv * 1.3 + 13.7 + so.yx, rawTime, 38.0, 0.085, 0.035) * 0.4;
  dust += particles(uv * 1.9 + 41.2 - so, rawTime, 60.0, 0.13, 0.028) * 0.25;
  // Intensity gets half the boost the radius gets: at uStarBoost 1.6 that's
  // 1.3x brightness, enough to survive downscaling without blowing the dust
  // out to white over the bright curtains.
  float dustGain = 1.0 + (uStarBoost - 1.0) * 0.5;
  color += dust * mix(vec3(0.75, 0.85, 0.9), aurora1, 0.4) * (0.25 + glow * 0.45) * dustGain;


  float horizon = smoothstep(0.0, 0.35, 1.0 - uv.y * 1.4);
  horizon *= smoothstep(0.0, 0.6, uv.y);
  color = mix(color, ember, horizon * 0.14);

  float vignette = smoothstep(1.1, 0.2, length((gl_FragCoord.xy / uResolution.xy - 0.5) * vec2(1.4, 1.0)));
  color *= mix(0.75, 1.0, vignette);

  return color;
}

void main() {
  vec3 color = sky(uTime, uSeed, uColorA, uColorB);
  // Uniform branch: in steady state (uBlend == 0) the incoming sky is never
  // evaluated, so the usual per-frame cost is exactly what it always was.
  if (uBlend > 0.0) {
    color = mix(color, sky(uTimeB, uSeedB, uColorA2, uColorB2), uBlend);
  }
  gl_FragColor = vec4(color, 1.0);
}
`;

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Failed to create shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile error: ${info}`);
  }
  return shader;
}

export type AuroraProgram = {
  program: WebGLProgram;
  positionBuffer: WebGLBuffer;
  uResolution: WebGLUniformLocation | null;
  uTime: WebGLUniformLocation | null;
  uScrollWarp: WebGLUniformLocation | null;
  uSeed: WebGLUniformLocation | null;
  uSeedB: WebGLUniformLocation | null;
  uTimeB: WebGLUniformLocation | null;
  uBlend: WebGLUniformLocation | null;
  uColorA: WebGLUniformLocation | null;
  uColorB: WebGLUniformLocation | null;
  uColorA2: WebGLUniformLocation | null;
  uColorB2: WebGLUniformLocation | null;
  uStarBoost: WebGLUniformLocation | null;
};

export function setupAuroraProgram(
  gl: WebGLRenderingContext,
): AuroraProgram | null {
  let program: WebGLProgram;
  try {
    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SRC);
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SRC);
    const prog = gl.createProgram();
    if (!prog) return null;
    gl.attachShader(prog, vertexShader);
    gl.attachShader(prog, fragmentShader);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(prog) ?? "Program link error");
    }
    program = prog;
  } catch (err) {
    console.warn("Aurora shader init failed", err);
    return null;
  }

  const positionBuffer = gl.createBuffer();
  if (!positionBuffer) return null;
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  );

  const aPosition = gl.getAttribLocation(program, "aPosition");
  gl.useProgram(program);
  gl.enableVertexAttribArray(aPosition);
  gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

  return {
    program,
    positionBuffer,
    uResolution: gl.getUniformLocation(program, "uResolution"),
    uTime: gl.getUniformLocation(program, "uTime"),
    uScrollWarp: gl.getUniformLocation(program, "uScrollWarp"),
    uSeed: gl.getUniformLocation(program, "uSeed"),
    uSeedB: gl.getUniformLocation(program, "uSeedB"),
    uTimeB: gl.getUniformLocation(program, "uTimeB"),
    uBlend: gl.getUniformLocation(program, "uBlend"),
    uColorA: gl.getUniformLocation(program, "uColorA"),
    uColorB: gl.getUniformLocation(program, "uColorB"),
    uColorA2: gl.getUniformLocation(program, "uColorA2"),
    uColorB2: gl.getUniformLocation(program, "uColorB2"),
    uStarBoost: gl.getUniformLocation(program, "uStarBoost"),
  };
}

export type AuroraHandle = {
  destroy: () => void;
  setPaused: (paused: boolean) => void;
  setSeed: (seed: AuroraSeed) => void;
  // WYSIWYG snapshot of the live canvas. Synchronous by contract - see
  // captureFrame's implementation note. Returns null mid-crossfade: a blend
  // of two skies is not any one seed's image.
  captureFrame: () => AuroraSnapshot | null;
  // Runs `cb` once the sky is settled on a single seed - immediately if it
  // already is. Returns an unsubscribe for the not-yet case.
  //
  // The UI cannot time this itself. The crossfade runs on the pause-adjusted
  // clock, which stops dead whenever the hero scrolls out of view or the tab
  // is hidden, so a wall-clock timer expires while the fade is still frozen
  // at its first frame. Anything that captures on that timer mints the OLD
  // sky against the NEW seed - permanent, unfixable on-chain corruption.
  onceSettled: (cb: () => void) => () => void;
};

// A snapshot is square and never larger than the render target (which is
// itself capped at MAX_RENDER_HEIGHT), so upscaling is never needed.
const MAX_SNAPSHOT_SIZE = 800;
// Step down until the encoded frame fits the on-chain cap. Three steps only:
// below ~0.65 the aurora's soft gradients start banding visibly.
const SNAPSHOT_QUALITIES = [0.85, 0.75, 0.65];
const SNAPSHOT_TARGET_BYTES = 16_000;
// Star boost applied to the capture draw only (see captureFrame). Tuned
// against a 160px downscale of the snapshot: below ~1.4 the dust still
// washes out at thumbnail size, above ~1.8 the stars read as cartoonish
// dots at full 800px. 1.6 is the middle of that window.
const CAPTURE_STAR_BOOST = 1.6;

export function initAurora(
  canvas: HTMLCanvasElement,
  seed: AuroraSeed,
): AuroraHandle | null {
  const gl = canvas.getContext("webgl", { antialias: true, alpha: false });
  if (!gl) return null;

  const setup = setupAuroraProgram(gl);
  if (!setup) return null;
  const {
    program,
    positionBuffer,
    uResolution,
    uTime,
    uScrollWarp,
    uSeed,
    uSeedB,
    uTimeB,
    uBlend,
    uColorA,
    uColorB,
    uColorA2,
    uColorB2,
    uStarBoost,
  } = setup;

  // Noise-space offset / animation phase / color pair derive from the
  // persisted seed, so a visitor's sky is reproducible across reloads.
  let uniforms = seedToUniforms(seed);
  gl.uniform2f(uSeed, uniforms.x, uniforms.y);
  gl.uniform3fv(uColorA, uniforms.colorA);
  gl.uniform3fv(uColorB, uniforms.colorB);
  gl.uniform1f(uBlend, 0);
  // The live sky is never boosted — captureFrame is the only writer, and it
  // restores 1.0 synchronously before returning.
  gl.uniform1f(uStarBoost, 1);

  // Crossfade state: while `incoming` is set the shader evaluates both skies
  // and mixes them. `blendStart` is on the same pause-adjusted clock as the
  // render loop, so a hidden tab freezes mid-fade instead of skipping it.
  let incoming: ReturnType<typeof seedToUniforms> | null = null;
  let blendStart = 0;
  const FADE_SECONDS = 1;

  let rafId = 0;
  let paused = false;
  const startTime = performance.now();
  let pauseOffset = 0;
  let pausedAt = 0;

  // Scroll scales domain-warp strength over the first 1000px. Ease-out
  // quart: biggest change early, then tapering - holds at max past that.
  let scrollWarpTarget = 0;
  let scrollWarp = 0;
  const onScroll = () => {
    const t = Math.min(1, window.scrollY / 3000);
    const u = 1 - t;
    scrollWarpTarget = 1 - u * u * u * u;
  };
  window.addEventListener("scroll", onScroll, { passive: true });

  // The sky is all low-frequency noise, so rendering above 800 device pixels
  // tall buys nothing visible while costing real fragment work. CSS still
  // stretches the canvas across the full viewport.
  const MAX_RENDER_HEIGHT = 800;

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const clientWidth = canvas.clientWidth;
    const clientHeight = canvas.clientHeight;
    if (clientWidth === 0 || clientHeight === 0) return;
    const height = Math.min(
      MAX_RENDER_HEIGHT,
      Math.floor(clientHeight * dpr),
    );
    // Scale width by the same factor so the aspect ratio is preserved.
    const width = Math.floor(clientWidth * (height / clientHeight));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    }
  };

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  resize();

  // Seconds of animation actually played, i.e. wall time minus paused time.
  const clockAt = (now: number) => (now - startTime - pauseOffset) / 1000;

  // One-shot waiters for "the sky is settled on a single seed again".
  // Drained on promotion, so a caller that needs a capturable frame waits on
  // the fade itself rather than on a wall clock that keeps running while the
  // fade is paused. See AuroraHandle.onceSettled.
  let settleWaiters: (() => void)[] = [];
  const notifySettled = () => {
    if (settleWaiters.length === 0) return;
    const waiters = settleWaiters;
    settleWaiters = [];
    for (const waiter of waiters) waiter();
  };

  // Slot B becomes the only sky; its phase carries over unchanged so the
  // promoted sky doesn't jump at the moment the fade ends.
  const promoteIncoming = () => {
    if (!incoming) return;
    uniforms = incoming;
    incoming = null;
    gl.uniform2f(uSeed, uniforms.x, uniforms.y);
    gl.uniform3fv(uColorA, uniforms.colorA);
    gl.uniform3fv(uColorB, uniforms.colorB);
    gl.uniform1f(uBlend, 0);
  };

  const draw = (clock: number) => {
    let blend = 0;
    if (incoming) {
      const progress = Math.min(1, (clock - blendStart) / FADE_SECONDS);
      if (progress >= 1) {
        promoteIncoming();
        notifySettled();
      } else {
        // smoothstep: no visible seam at either end of the fade.
        blend = progress * progress * (3 - 2 * progress);
        gl.uniform2f(uSeedB, incoming.x, incoming.y);
        gl.uniform3fv(uColorA2, incoming.colorA);
        gl.uniform3fv(uColorB2, incoming.colorB);
        gl.uniform1f(uTimeB, clock + incoming.t);
        gl.uniform1f(uBlend, blend);
      }
    }

    gl.uniform2f(uResolution, canvas.width, canvas.height);
    gl.uniform1f(uTime, clock + uniforms.t);
    gl.uniform1f(uScrollWarp, scrollWarp);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };

  // Cap the draw rate at 60fps: on 120Hz+ displays the extra frames are
  // invisible on a sky this slow but double the GPU cost. rAF keeps running
  // so the loop stays in sync with the compositor.
  const FRAME_MS = 1000 / 60;
  // Accumulate the ideal 16.667ms step instead of snapping lastDraw to `now`:
  // on a refresh rate that isn't a multiple of 60 (a 90Hz display ticks every
  // 11.1ms) resetting to `now` throws away the leftover time and quantizes
  // the output to whole rAF ticks — 45fps on 90Hz, 48fps on 144Hz. Carrying
  // the remainder lets the cadence average out to a true 60fps.
  const FRAME_EPSILON = 1;
  let lastDraw = -Infinity;

  const render = () => {
    if (paused) return;
    rafId = requestAnimationFrame(render);

    const now = performance.now();
    if (now - lastDraw < FRAME_MS - FRAME_EPSILON) return;
    // If we're more than a frame behind (tab throttled, long task, or the
    // very first frame off -Infinity), drop the accumulated debt rather than
    // burning catch-up frames the sky would never show anyway.
    lastDraw =
      now - lastDraw > FRAME_MS * 2 ? now : lastDraw + FRAME_MS;

    scrollWarp += (scrollWarpTarget - scrollWarp) * 0.08;
    draw(clockAt(now));
  };

  rafId = requestAnimationFrame(render);

  return {
    destroy: () => {
      cancelAnimationFrame(rafId);
      // Release anything waiting on a fade that will now never finish. The
      // waiter re-checks its own liveness; leaving it pending would hang the
      // UI it belongs to.
      notifySettled();
      resizeObserver.disconnect();
      window.removeEventListener("scroll", onScroll);
      gl.deleteProgram(program);
      gl.deleteBuffer(positionBuffer);
    },
    setPaused: (next: boolean) => {
      if (paused === next) return;
      paused = next;
      if (paused) {
        pausedAt = performance.now();
        cancelAnimationFrame(rafId);
      } else {
        pauseOffset += performance.now() - pausedAt;
        rafId = requestAnimationFrame(render);
      }
    },
    setSeed: (next: AuroraSeed) => {
      // Freeze at the moment of pausing - `performance.now()` keeps running
      // while paused and would jump the animation forward.
      const clock = clockAt(paused ? pausedAt : performance.now());
      // Reseeding mid-fade shouldn't be reachable from the UI (the button is
      // disabled for the duration), but if it happens, land the current fade
      // first so the new one starts from a single, settled sky.
      promoteIncoming();
      incoming = seedToUniforms(next);
      blendStart = clock;
      if (paused) {
        // Nothing is rendering, so there is no crossfade for anyone to see -
        // and the pause-adjusted clock will never advance far enough to end
        // one. Leaving it frozen at blend 0 would strand the sky showing the
        // old seed's image while getSeed() reports the new seed, which is
        // exactly what a capture must never observe. Land it now instead: the
        // new sky is simply already there when the visitor scrolls back.
        promoteIncoming();
        draw(clock);
        notifySettled();
      }
      // Unpaused, the render loop picks the transition up on its next frame
      // and draw() drains the waiters when it completes.
    },
    onceSettled: (cb: () => void) => {
      if (!incoming) {
        cb();
        return () => {};
      }
      settleWaiters.push(cb);
      return () => {
        settleWaiters = settleWaiters.filter((w) => w !== cb);
      };
    },
    captureFrame: () => {
      // Defense in depth for C1: mid-fade the canvas holds a blend of two
      // skies while getSeed() names only one of them, so an image captured
      // here could never be honest about its seed. Callers wait for
      // onceSettled; this makes it impossible to mint the blend if one
      // doesn't. Null is already the retryable "warming" state in the UI.
      if (incoming) return null;

      // The live context has no preserveDrawingBuffer (it would cost a full
      // extra buffer on every frame for a feature used once per mint), so
      // the drawing buffer is valid only until the browser composites. Draw
      // and copy therefore MUST stay in this one synchronous task - no
      // await, no rAF, nothing between the drawArrays and the drawImage.
      //
      // The minted image is looked at as a 160px thumbnail far more often
      // than at full size, and at that scale the dust layer all but
      // disappears. Boost the stars for this one draw only: set, draw, copy,
      // restore — all synchronous, so no on-screen frame can ever observe
      // the boosted value, and the next render() draws the sky unchanged.
      gl.uniform1f(uStarBoost, CAPTURE_STAR_BOOST);
      try {
        draw(clockAt(paused ? pausedAt : performance.now()));
      } finally {
        gl.uniform1f(uStarBoost, 1);
      }

      // Whatever is on screen right now, exactly as it is: current seed,
      // current colors, mid-crossfade if mid-crossfade, current scroll warp.
      const side = Math.min(MAX_SNAPSHOT_SIZE, canvas.width, canvas.height);
      if (side <= 0) return null;
      const out = document.createElement("canvas");
      out.width = side;
      out.height = side;
      const ctx = out.getContext("2d");
      if (!ctx) return null;
      try {
        // Right-anchored: the hero's text sits on the left, so the right of
        // the frame is the part that reads as pure sky. Vertically centered.
        ctx.drawImage(
          canvas,
          canvas.width - side,
          Math.floor((canvas.height - side) / 2),
          side,
          side,
          0,
          0,
          side,
          side,
        );
      } catch {
        return null; // tainted canvas / lost context
      }

      // Step the quality down until it fits; keep the smallest attempt so a
      // stubbornly-large frame still surfaces its real size to the caller
      // (which enforces the cap) instead of vanishing as a null.
      let best: AuroraSnapshot | null = null;
      for (const quality of SNAPSHOT_QUALITIES) {
        const dataUrl = out.toDataURL("image/webp", quality);
        // Safari ignores image/webp and silently returns PNG - detect it
        // from the output rather than trusting the request.
        if (!isWebpDataUrl(dataUrl)) return null;
        const bytes = dataUrlBytes(dataUrl);
        if (!best || bytes < best.bytes) {
          best = { dataUrl, mime: "image/webp", bytes };
        }
        if (bytes <= SNAPSHOT_TARGET_BYTES) break;
      }
      return best;
    },
  };
}
