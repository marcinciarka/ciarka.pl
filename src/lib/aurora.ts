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
// Per-load random offset into the noise field / animation phase.
uniform vec2 uSeed;

vec3 aurora1 = vec3(0.208, 0.878, 0.761);
vec3 aurora2 = vec3(0.486, 0.424, 0.965);
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
  float pSize = size * (0.35 + 0.65 * hash(cell + 11.9));
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

void main() {
  float aspect = uResolution.x / uResolution.y;
  vec2 uv = gl_FragCoord.xy / uResolution.xy;
  uv.x *= aspect;

  float t = uTime * 0.06;
  vec2 so = uSeed;

  // Double domain warp (warp of a warp): the second field is sampled
  // through the first, folding the curtains into marbled, nebula-like
  // structures. Scroll only scales that existing displacement — no
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
  float dust = particles(uv + so * 0.15, uTime, 22.0, 0.045, 0.045) * 0.6;
  dust += particles(uv * 1.3 + 13.7 + so.yx, uTime, 38.0, 0.085, 0.035) * 0.4;
  dust += particles(uv * 1.9 + 41.2 - so, uTime, 60.0, 0.13, 0.028) * 0.25;
  color += dust * mix(vec3(0.75, 0.85, 0.9), aurora1, 0.4) * (0.25 + glow * 0.45);


  float horizon = smoothstep(0.0, 0.35, 1.0 - uv.y * 1.4);
  horizon *= smoothstep(0.0, 0.6, uv.y);
  color = mix(color, ember, horizon * 0.14);

  float vignette = smoothstep(1.1, 0.2, length((gl_FragCoord.xy / uResolution.xy - 0.5) * vec2(1.4, 1.0)));
  color *= mix(0.75, 1.0, vignette);

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

export type AuroraHandle = {
  destroy: () => void;
  setPaused: (paused: boolean) => void;
};

export function initAurora(canvas: HTMLCanvasElement): AuroraHandle | null {
  const gl = canvas.getContext("webgl", { antialias: true, alpha: false });
  if (!gl) return null;

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
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  );

  const aPosition = gl.getAttribLocation(program, "aPosition");
  const uResolution = gl.getUniformLocation(program, "uResolution");
  const uTime = gl.getUniformLocation(program, "uTime");
  const uScrollWarp = gl.getUniformLocation(program, "uScrollWarp");
  const uSeed = gl.getUniformLocation(program, "uSeed");

  gl.useProgram(program);
  gl.enableVertexAttribArray(aPosition);
  gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

  // Fresh noise-space / phase offset each load so the sky isn't identical.
  gl.uniform2f(uSeed, Math.random() * 100, Math.random() * 100);

  let rafId = 0;
  let paused = false;
  const startTime = performance.now();
  const timeOffset = Math.random() * 200;
  let pauseOffset = 0;
  let pausedAt = 0;

  // Scroll scales domain-warp strength over the first 1000px. Ease-out
  // quart: biggest change early, then tapering — holds at max past that.
  let scrollWarpTarget = 0;
  let scrollWarp = 0;
  const onScroll = () => {
    const t = Math.min(1, window.scrollY / 3000);
    const u = 1 - t;
    scrollWarpTarget = 1 - u * u * u * u;
  };
  window.addEventListener("scroll", onScroll, { passive: true });

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.floor(canvas.clientWidth * dpr);
    const height = Math.floor(canvas.clientHeight * dpr);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    }
  };

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  resize();

  const render = () => {
    if (paused) return;

    scrollWarp += (scrollWarpTarget - scrollWarp) * 0.08;

    const elapsed =
      (performance.now() - startTime - pauseOffset) / 1000 + timeOffset;
    gl.uniform2f(uResolution, canvas.width, canvas.height);
    gl.uniform1f(uTime, elapsed);
    gl.uniform1f(uScrollWarp, scrollWarp);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    rafId = requestAnimationFrame(render);
  };

  rafId = requestAnimationFrame(render);

  return {
    destroy: () => {
      cancelAnimationFrame(rafId);
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
  };
}
