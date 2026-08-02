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

export function seedToUniforms(seed: AuroraSeed): {
  x: number;
  y: number;
  t: number;
} {
  const rng = mulberry32(seed);
  return { x: rng() * 100, y: rng() * 100, t: rng() * 200 };
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

export function loadSeed(): AuroraSeed {
  const raw = readStoredSeed();
  const parsed = raw === null || raw === undefined ? NaN : Number(raw);
  if (Number.isInteger(parsed) && parsed >= 0 && parsed < 2 ** 32) {
    return parsed;
  }
  const seed = randomSeed();
  saveSeed(seed);
  return seed;
}
