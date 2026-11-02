/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { KickType, PlayerAttributes, SpinControl, SurfaceType, Vector3D } from '../types';
import { calculateKickVelocity, getEstimatedKickDistance } from './physics';
import {
  calculateNeedleFrequency,
  evaluateTimingRelease,
  getNeedlePosition,
  TimingRatingResult,
} from './timingGauge';

export type ArcadeControlState = 'idle' | 'aiming' | 'pullback' | 'released';

export interface PullbackVector {
  dx: number; // Pixels dragged horizontally from origin
  dy: number; // Pixels dragged vertically from origin (positive is downwards/backwards)
  distance: number;
}

export interface ArcadePullbackEvaluation {
  powerNormalized: number;     // 0.0 to 1.25
  isOverpower: boolean;
  overpowerRatio: number;      // 0.0 to 1.0 (fraction beyond 1.0 up to 1.25)
  centeringOffset: number;     // -1.0 to 1.0 (horizontal pull drift off center line)
  needleValue: number;         // -1.0 to 1.0 at this instant
  needleFrequencyHz: number;
}

export interface ArcadeShotExecutionResult {
  power: number;               // 0.1 to 1.25
  isOverpower: boolean;
  timing: TimingRatingResult;
  centeringOffset: number;
  effectiveAimAngleRad: number;
  effectiveSpin: SpinControl;
  velocity: Vector3D;
  spin: Vector3D;
  speedKmh: number;
  estimatedCarryMeters: number;
  estimatedTotalMeters: number;
}

export const MAX_DRAG_STANDARD_PX = 95; // Pixels drag down for 100% power (ample room on mobile screen)
export const MAX_DRAG_OVERPOWER_PX = 125; // Pixels drag down for 125% overpower

/**
 * Calculates normalized power (0.0 to 1.25) and centering alignment from touch drag offset.
 * Dragging downward (positive dy) represents pulling back for a forward kick.
 */
export function calculatePullbackState(
  dy: number,
  dx: number,
  maxDragStandardPx: number = MAX_DRAG_STANDARD_PX,
  maxDragOverpowerPx: number = MAX_DRAG_OVERPOWER_PX
): { powerNormalized: number; isOverpower: boolean; overpowerRatio: number; centeringOffset: number } {
  // Only downward pulls count as pullback
  const effectiveDown = Math.max(0, dy);

  let powerNormalized = 0;
  if (effectiveDown <= maxDragStandardPx) {
    powerNormalized = effectiveDown / maxDragStandardPx;
  } else {
    // Overpower region: up to 1.25
    const overpowerPx = effectiveDown - maxDragStandardPx;
    const overpowerSpan = maxDragOverpowerPx - maxDragStandardPx;
    const ratio = Math.min(1.0, overpowerPx / overpowerSpan);
    powerNormalized = 1.0 + ratio * 0.25;
  }

  const isOverpower = powerNormalized > 1.0;
  const overpowerRatio = isOverpower ? (powerNormalized - 1.0) / 0.25 : 0;

  // Centering offset: horizontal deviation relative to standard drag radius
  const centeringOffset = Math.max(-1.0, Math.min(1.0, dx / (maxDragStandardPx * 0.75)));

  return {
    powerNormalized,
    isOverpower,
    overpowerRatio,
    centeringOffset,
  };
}

/**
 * Computes complete arcade shot outcome on touch/mouse release.
 */
export function resolveArcadeShot(
  powerNormalized: number,
  needlePosition: number,
  centeringOffset: number,
  baseAimAngleRad: number,
  baseSpin: SpinControl,
  kickType: KickType,
  currentLie: SurfaceType,
  attributes?: PlayerAttributes
): ArcadeShotExecutionResult {
  // Clamp power between 0.1 and 1.25
  const clampedPower = Math.max(0.1, Math.min(1.25, powerNormalized));
  const isOverpower = clampedPower > 1.0;

  // Evaluate timing needle
  const timing = evaluateTimingRelease(needlePosition);

  // Slight manual centering influence on aim (subtle intentional push/pull)
  const centeringAimOffset = centeringOffset * 0.035; // ~2 degrees max manual aim influence

  // Effective aim angle combines base aim, timing needle deviation, and centering
  const effectiveAimAngleRad = baseAimAngleRad + timing.lateralAngleOffsetRad + centeringAimOffset;

  // Effective spin adds hook/slice curve from timing deviation
  const effectiveSpin: SpinControl = {
    top: baseSpin.top,
    side: Math.max(-1.0, Math.min(1.0, baseSpin.side + timing.sideSpinDeviation * 0.65)),
  };

  // Kick velocity from deterministic physics base
  // For overpower > 1.0, calculate base at 1.0 and scale speed proportionally
  const basePowerForCalc = Math.min(1.0, clampedPower);
  const kick = calculateKickVelocity(
    kickType,
    basePowerForCalc,
    effectiveAimAngleRad,
    effectiveSpin,
    currentLie,
    attributes
  );

  let finalVelocity = kick.velocity;
  let finalSpin = kick.spin;

  if (isOverpower) {
    const overpowerMult = 1.0 + (clampedPower - 1.0) * 0.85; // up to ~1.21x velocity
    finalVelocity = {
      x: kick.velocity.x * overpowerMult,
      y: kick.velocity.y * overpowerMult,
      z: kick.velocity.z * overpowerMult,
    };
    finalSpin = {
      x: kick.spin.x * overpowerMult,
      y: kick.spin.y * overpowerMult,
      z: kick.spin.z * overpowerMult,
    };
  }

  // Speed in km/h
  const speedMps = Math.hypot(finalVelocity.x, finalVelocity.y, finalVelocity.z);
  const speedKmh = Math.round(speedMps * 3.6);

  // Distance estimates
  const est = getEstimatedKickDistance(kickType, Math.min(1.0, clampedPower), currentLie);
  const distScale = isOverpower ? 1.0 + (clampedPower - 1.0) * 0.9 : 1.0;

  return {
    power: clampedPower,
    isOverpower,
    timing,
    centeringOffset,
    effectiveAimAngleRad,
    effectiveSpin,
    velocity: finalVelocity,
    spin: finalSpin,
    speedKmh,
    estimatedCarryMeters: Math.round(est.carryMeters * distScale),
    estimatedTotalMeters: Math.round(est.totalMeters * distScale),
  };
}
