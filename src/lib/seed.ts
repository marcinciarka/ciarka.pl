export type AuroraSeed = number;

const STORAGE_KEY = "aurora-seed";

export function randomSeed(): AuroraSeed {
  return Math.floor(Math.random() * 2 ** 32);
}

// mulberry32: tiny deterministic PRNG so one uint32 fans out into all
// the randomness the shader needs (noise offset + animation phase).
function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type AuroraColor = [number, number, number];

// Aurora-plausible hues against the ink background. The first two are the
// colors the sky shipped with, so they stay in rotation.
export const AURORA_PALETTE: AuroraColor[] = [
  [0.208, 0.878, 0.761], // teal
  [0.486, 0.424, 0.965], // violet
  [0.322, 0.914, 0.467], // emerald
  [0.937, 0.412, 0.714], // rose
  [0.416, 0.76, 0.984], // ice blue
];

export function seedToUniforms(seed: AuroraSeed): {
  x: number;
  y: number;
  t: number;
  colorA: AuroraColor;
  colorB: AuroraColor;
} {
  const rng = mulberry32(seed);
  // Order matters: x/y/t are drawn first so existing seeds keep the exact
  // noise offset and animation phase they had before colors existed.
  const x = rng() * 100;
  const y = rng() * 100;
  const t = rng() * 200;
  const n = AURORA_PALETTE.length;
  const ia = Math.floor(rng() * n);
  // One extra draw, guaranteed distinct: pick an offset of 1..n-1.
  const ib = (ia + 1 + Math.floor(rng() * (n - 1))) % n;
  return { x, y, t, colorA: AURORA_PALETTE[ia], colorB: AURORA_PALETTE[ib] };
}

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null; // e.g. blocked third-party storage
  }
}

export function saveSeed(seed: AuroraSeed): void {
  try {
    storage()?.setItem(STORAGE_KEY, String(seed));
  } catch {
    // Storage present but unusable (quota exceeded, hardened profile, etc.)
    // - degrade to "random seed, not persisted" rather than throwing.
  }
}

function readStoredSeed(): string | null | undefined {
  try {
    return storage()?.getItem(STORAGE_KEY);
  } catch {
    return undefined;
  }
}

// The one validity rule for a seed, shared by the storage and URL paths.
function isValidSeed(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value < 2 ** 32;
}

export function loadSeed(): AuroraSeed {
  const raw = readStoredSeed();
  const parsed = raw === null || raw === undefined ? NaN : Number(raw);
  if (isValidSeed(parsed)) return parsed;
  const seed = randomSeed();
  saveSeed(seed);
  return seed;
}

// Shareable skies: `?seed=N` pins this page load to someone else's sky.
// Pure on purpose - the caller supplies location.search, so this is testable
// in node and the "is there a location at all?" guard lives in one place.
// Deliberately NOT persisted by the caller: a visitor following a shared
// link still finds their own sky waiting on the next visit.
export function seedFromSearch(search: string): AuroraSeed | null {
  let raw: string | null;
  try {
    raw = new URLSearchParams(search).get("seed");
  } catch {
    return null;
  }
  // Number("") and Number(" ") are both 0, which would silently pass the
  // uint32 check - reject empty/blank explicitly.
  if (raw === null || raw.trim() === "") return null;
  const parsed = Number(raw);
  return isValidSeed(parsed) ? parsed : null;
}
