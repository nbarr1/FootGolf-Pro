/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { HoleData, KickType, SurfaceType, Vector3D } from '../../types';
import { getEstimatedKickDistance, getSurfaceLie, getTerrainHeight, BALL_RADIUS } from '../physics';
import { simulateHeadlessShot } from '../deterministicPhysics';
import type { Rng } from '../rng';

export interface BotShot {
  kickType: KickType;
  from: Vector3D;
  to: Vector3D;
  holed: boolean;
  penalty: boolean;
}

export interface BotHoleResult {
  strokes: number;
  shots: BotShot[];
  pickedUp: boolean;
}

export interface Wind {
  speed: number;
  angleRad: number;
}

/**
 * Suggested club for a lie and distance. Shared by the player's auto-suggestion and bots.
 * Putts only from the green or from short range on closely mown grass, because a putt's
 * roll distance drops sharply on slower surfaces.
 */
export function chooseKickType(lie: SurfaceType, distToPin: number): KickType {
  if (lie === 'green') return 'putt';
  if ((lie === 'fairway' || lie === 'tee') && distToPin < 10) return 'putt';
  if (lie === 'sand' || distToPin < 65) return 'chip';
  return 'drive';
}

/** Inverts the distance estimate (by bisection) to find the power that should travel `distance` meters. */
export function estimatePowerForDistance(kickType: KickType, distance: number, lie: SurfaceType): number {
  let lo = 0.1;
  let hi = 1.0;
  if (getEstimatedKickDistance(kickType, hi, lie).totalMeters <= distance) return hi;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (getEstimatedKickDistance(kickType, mid, lie).totalMeters < distance) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function horizontalDist(a: Vector3D, b: Vector3D) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/**
 * Plays a hole with the real headless physics. Skill (0-1) scales how far
 * timing, power, and aim stray from the intended shot. Putts are "read" by
 * trying a few power candidates and picking the one that finishes closest.
 */
const LIE_PENALTY_METERS: Partial<Record<SurfaceType, number>> = { rough: 8, sand: 14 };

interface PlannedShot {
  kickType: KickType;
  power: number;
  aim: number;
}

/**
 * Picks a shot by simulating a handful of candidates without execution error and scoring
 * where each one finishes: distance to the pin, plus penalties for bad lies and hazards.
 */
export function planBotShot(hole: HoleData, pos: Vector3D, lie: SurfaceType, wind: Wind): PlannedShot {
  const pin = hole.pinPosition;
  const dist = horizontalDist(pos, pin);
  const aim = Math.atan2(pin.x - pos.x, pin.z - pos.z);
  const preferred = chooseKickType(lie, dist);
  const base = estimatePowerForDistance(preferred, dist, lie);

  const candidates: PlannedShot[] = [];
  if (preferred === 'putt') {
    for (const scale of [0.85, 0.95, 1, 1.08, 1.18, 1.3]) candidates.push({ kickType: 'putt', power: Math.min(1, base * scale), aim });
  } else {
    const kicks: KickType[] = preferred === 'drive' ? ['drive', 'chip'] : ['chip', 'drive'];
    for (const kickType of kicks) {
      const p = estimatePowerForDistance(kickType, dist, lie);
      for (const scale of [0.6, 0.8, 0.95, 1.05, 1.15]) candidates.push({ kickType, power: Math.min(1.25, p * scale), aim });
      if (p >= 0.99) candidates.push({ kickType, power: 1.2, aim }); // overpower to carry hazards
    }
  }

  let best = candidates[0];
  let bestScore = Infinity;
  for (const c of candidates) {
    const r = simulateHeadlessShot(
      { startPos: pos, kickType: c.kickType, powerNormalized: c.power, timingDeviation: 0, aimAngleRad: c.aim, spin: { top: 0, side: 0 }, currentLie: lie, wind },
      hole
    );
    let score: number;
    if (r.inHole) {
      score = -1000;
    } else {
      const restLie = getSurfaceLie(hole, r.finalRestSpot.x, r.finalRestSpot.z);
      score = horizontalDist(r.finalRestSpot, pin);
      if (restLie === 'water' || restLie === 'boundary') score += 1000;
      score += LIE_PENALTY_METERS[restLie] ?? 0;
    }
    if (score < bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}

export function simulateBotHole(hole: HoleData, wind: Wind, skill: number, rng: Rng, maxStrokes = hole.par + 4): BotHoleResult {
  const error = Math.max(0.02, 1 - Math.max(0, Math.min(1, skill)));
  let pos: Vector3D = { ...hole.teePosition, y: hole.teePosition.y + BALL_RADIUS };
  let lie: SurfaceType = 'tee';
  let strokes = 0;
  const shots: BotShot[] = [];

  while (strokes < maxStrokes) {
    const pin = hole.pinPosition;
    const plan = planBotShot(hole, pos, lie, wind);
    const { kickType, aim } = plan;
    const power = plan.power;

    const executedPower = Math.max(0.1, Math.min(1.25, power * (1 + rng.gaussian() * error * 0.18)));
    const timing = Math.max(-1, Math.min(1, rng.gaussian() * error * 1.6));
    const aimError = rng.gaussian() * error * (kickType === 'putt' ? 0.02 : 0.06);

    const result = simulateHeadlessShot(
      {
        startPos: pos,
        kickType,
        powerNormalized: executedPower,
        timingDeviation: timing,
        aimAngleRad: aim + aimError,
        spin: { top: 0, side: 0 },
        currentLie: lie,
        wind,
      },
      hole
    );
    strokes++;

    const restLie = getSurfaceLie(hole, result.finalRestSpot.x, result.finalRestSpot.z);
    if (result.inHole) {
      shots.push({ kickType, from: pos, to: { ...pin }, holed: true, penalty: false });
      return { strokes: Math.min(strokes, maxStrokes), shots, pickedUp: strokes > maxStrokes };
    }

    if (restLie === 'water' || restLie === 'boundary') {
      // Penalty stroke and replay from the previous spot
      shots.push({ kickType, from: pos, to: result.finalRestSpot, holed: false, penalty: true });
      strokes++;
      continue;
    }

    shots.push({ kickType, from: pos, to: result.finalRestSpot, holed: false, penalty: false });
    pos = {
      x: result.finalRestSpot.x,
      y: getTerrainHeight(hole, result.finalRestSpot.x, result.finalRestSpot.z) + BALL_RADIUS,
      z: result.finalRestSpot.z,
    };
    lie = restLie;

    // A tap-in from very close is conceded to keep simulation short
    if (horizontalDist(pos, pin) < 0.6) {
      strokes++;
      shots.push({ kickType: 'putt', from: pos, to: { ...pin }, holed: true, penalty: false });
      return { strokes: Math.min(strokes, maxStrokes), shots, pickedUp: strokes > maxStrokes };
    }
  }

  return { strokes: maxStrokes, shots, pickedUp: true };
}
