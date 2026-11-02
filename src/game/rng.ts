/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Small seeded pseudo-random number generator (mulberry32) for reproducible
 * tournaments, bot play, and replays. Not for cryptographic use.
 */
export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Standard normal sample (mean 0, standard deviation 1). */
  gaussian(): number;
  /** Uniform integer in [min, max]. */
  int(min: number, max: number): number;
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    gaussian() {
      // Box-Muller transform; guard against log(0)
      const u = Math.max(1e-12, next());
      const v = next();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
    int(min: number, max: number) {
      return min + Math.floor(next() * (max - min + 1));
    },
  };
}

/** Combines a base seed with any number of string or number parts into a new 32-bit seed. */
export function deriveSeed(base: number, ...parts: (string | number)[]): number {
  let h = (base ^ 0x9e3779b9) >>> 0;
  for (const part of parts) {
    const str = String(part);
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 0x01000193) >>> 0;
    }
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  }
  return h >>> 0;
}

/** A fresh, non-deterministic seed for new tournaments. */
export function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}

/** Deterministic Fisher-Yates shuffle (returns a new array). */
export function shuffled<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
