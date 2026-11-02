/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CourseData, HoleData, TerrainFeature, TreeInstance } from '../types';
import { createRng, Rng } from './rng';

/**
 * Seeded generator for extra holes. Each hole follows a tee-to-pin path that can bend
 * (a dogleg), with fairway ellipses along the path, a green at the pin, and bunkers,
 * water, trees, rocks, and hills placed relative to the path.
 *
 * Generated holes are deterministic for a seed. Seeds used in courses.ts were picked by
 * running the physics bots over candidates and keeping holes that play close to par
 * (see holeGenerator.test.ts).
 */

export interface HoleSpec {
  number: number;
  par: 3 | 4 | 5;
  seed: number;
}

const LENGTH_RANGE: Record<3 | 4 | 5, [number, number]> = {
  3: [95, 125],
  4: [160, 195],
  5: [225, 255],
};

const TREE_TYPE: Record<CourseData['theme'], TreeInstance['type']> = {
  parkland: 'pine',
  desert: 'palm',
  alpine: 'pine',
  japanese_garden: 'sakura',
};

function range(rng: Rng, min: number, max: number) {
  return min + rng.next() * (max - min);
}

function round1(v: number) {
  return Math.round(v * 10) / 10;
}

/** Point on a quadratic Bezier path from the tee (0,0) through a bend control point to the pin. */
function pathPoint(t: number, bendX: number, pinX: number, length: number) {
  const u = 1 - t;
  return {
    x: 2 * u * t * bendX + t * t * pinX,
    z: t * length,
  };
}

/** Unit normal (pointing right of travel) of the path at t. */
function pathNormal(t: number, bendX: number, pinX: number, length: number) {
  const dx = 2 * (1 - t) * bendX + 2 * t * (pinX - bendX);
  const dz = length;
  const len = Math.hypot(dx, dz);
  return { x: dz / len, z: -dx / len };
}

export function generateHole(theme: CourseData['theme'], spec: HoleSpec): HoleData {
  const rng = createRng(spec.seed);
  const [minLen, maxLen] = LENGTH_RANGE[spec.par];
  const length = Math.round(range(rng, minLen, maxLen));
  const bendX = spec.par === 3 ? range(rng, -8, 8) : range(rng, -30, 30);
  const pinX = round1(bendX * range(rng, 0.2, 0.9) + range(rng, -10, 10));
  const P = (t: number) => pathPoint(t, bendX, pinX, length);
  const N = (t: number) => pathNormal(t, bendX, pinX, length);

  const pin = P(1);
  const greenRadius = round1(range(rng, 10, 13));

  // Fairways: overlapping ellipses along the path, leaving the green approach open
  const fairways: TerrainFeature[] = [];
  const fairwayStops = spec.par === 3 ? [0.45] : spec.par === 4 ? [0.25, 0.55, 0.82] : [0.2, 0.42, 0.64, 0.85];
  for (const t of fairwayStops) {
    const p = P(t);
    fairways.push({
      x: round1(p.x),
      z: round1(p.z),
      rx: round1(range(rng, 14, 19)),
      rz: round1(spec.par === 3 ? range(rng, 30, 40) : range(rng, 32, 44)),
    });
  }

  // Bunkers: one guarding the green, plus fairway bunkers near landing zones
  const bunkers: TerrainFeature[] = [];
  const greenSide = rng.next() < 0.5 ? -1 : 1;
  const gn = N(0.97);
  bunkers.push({
    x: round1(pin.x + gn.x * (greenRadius + 5) * greenSide),
    z: round1(pin.z + gn.z * (greenRadius + 5) * greenSide - 2),
    rx: round1(range(rng, 4, 6)),
    rz: round1(range(rng, 6, 8)),
  });
  const fairwayBunkers = spec.par === 3 ? 0 : spec.par === 4 ? 1 : 2;
  for (let i = 0; i < fairwayBunkers; i++) {
    const t = spec.par === 4 ? 0.62 : i === 0 ? 0.45 : 0.72;
    const p = P(t);
    const n = N(t);
    const side = rng.next() < 0.5 ? -1 : 1;
    const off = range(rng, 15, 20) * side;
    bunkers.push({ x: round1(p.x + n.x * off), z: round1(p.z + n.z * off), rx: round1(range(rng, 5, 7)), rz: round1(range(rng, 8, 11)) });
  }

  // Water: lateral hazard beside the fairway, kept clear of the green and tee
  const waters: TerrainFeature[] = [];
  if (rng.next() < 0.55) {
    const t = range(rng, 0.35, 0.7);
    const p = P(t);
    const n = N(t);
    const side = rng.next() < 0.5 ? -1 : 1;
    const off = range(rng, 28, 34) * side;
    waters.push({ x: round1(p.x + n.x * off), z: round1(p.z + n.z * off), rx: round1(range(rng, 9, 13)), rz: round1(range(rng, 18, 28)) });
  }

  // Trees line both sides of the corridor
  const trees: TreeInstance[] = [];
  const treeType = TREE_TYPE[theme];
  const treeCount = spec.par === 3 ? 6 : spec.par === 4 ? 8 : 10;
  for (let i = 0; i < treeCount; i++) {
    const t = Math.min(1.05, (i + 0.5) / treeCount + range(rng, -0.04, 0.04));
    const p = P(t);
    const n = N(Math.min(1, t));
    const side = i % 2 === 0 ? -1 : 1;
    const off = range(rng, 25, 34) * side;
    trees.push({ x: round1(p.x + n.x * off), z: round1(p.z + n.z * off), scale: round1(range(rng, 1.1, 1.5)), type: treeType });
  }

  const rocks = [0.3, 0.75].map((t) => {
    const p = P(t);
    const n = N(t);
    const off = range(rng, 19, 24) * (rng.next() < 0.5 ? -1 : 1);
    return { x: round1(p.x + n.x * off), z: round1(p.z + n.z * off), scale: round1(range(rng, 0.9, 1.4)) };
  });

  // Gentle hills off the line of play, plus a raised green
  const hills = [0.35, 0.7].map((t) => {
    const p = P(t);
    const n = N(t);
    const off = range(rng, 12, 22) * (rng.next() < 0.5 ? -1 : 1);
    return { x: round1(p.x + n.x * off), z: round1(p.z + n.z * off), radius: Math.round(range(rng, 20, 28)), height: round1(range(rng, 1.2, 2.4)) };
  });
  hills.push({ x: round1(pin.x), z: round1(pin.z), radius: 18, height: round1(range(rng, 0.6, 1.4)) });

  const firstTarget = P(spec.par === 3 ? 1 : 0.5);
  return {
    id: spec.number,
    number: spec.number,
    par: spec.par,
    lengthMeters: length,
    teePosition: { x: 0, y: 0.5, z: 0 },
    pinPosition: { x: round1(pin.x), y: 1.2, z: round1(pin.z) },
    fairways,
    greens: [{ x: round1(pin.x), z: round1(pin.z), radius: greenRadius }],
    bunkers,
    waters,
    trees,
    rocks,
    hills,
    defaultAimAngle: Math.round(Math.atan2(firstTarget.x, firstTarget.z) * 1000) / 1000,
  };
}

export function generateHoles(theme: CourseData['theme'], specs: HoleSpec[]): HoleData[] {
  return specs.map((spec) => generateHole(theme, spec));
}
