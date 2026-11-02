/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Vector3D } from '../types';

export const MIN_CAPTURE_SPEED_MPS = 0.15;
export const BASE_MAX_CAPTURE_SPEED_MPS = 2.85;

export type PuttingSpeedZone = 'short' | 'sweet_spot' | 'hot_danger';

export interface PuttingEvaluation {
  pullbackDistancePx: number;
  powerNormalized: number;      // 0.0 to 1.0
  projectedRollMeters: number;
  distanceToCupMeters: number;
  rollDeltaMeters: number;       // projectedRoll - distanceToCup
  speedZone: PuttingSpeedZone;
  captureProbability: number;   // 0.0 to 1.0
  label: string;
  colorHex: string;
}

/**
 * Evaluates putting pullback against cup distance and returns speed window feedback.
 */
export function evaluatePuttingPullback(
  pullbackDy: number,
  distanceToCupMeters: number,
  maxRollMeters: number = 28, // max roll on green
  finesseLevel: number = 1
): PuttingEvaluation {
  // 95px drag represents full 28m roll
  const MAX_PUTT_DRAG_PX = 95;
  const clampedDy = Math.max(0, Math.min(MAX_PUTT_DRAG_PX, pullbackDy));
  const powerNormalized = clampedDy / MAX_PUTT_DRAG_PX;

  const projectedRollMeters = powerNormalized * maxRollMeters;
  const rollDeltaMeters = projectedRollMeters - distanceToCupMeters;

  // Finesse expands capture window (+5% tolerance per level above 1)
  const finesseBonus = 1.0 + (Math.max(1, finesseLevel) - 1) * 0.05;
  const optimalOvershootMax = 1.6 * finesseBonus;

  let speedZone: PuttingSpeedZone = 'short';
  let captureProbability = 0;
  let label = 'STOPS SHORT';
  let colorHex = '#64748b'; // Slate gray

  if (rollDeltaMeters < -0.3) {
    speedZone = 'short';
    captureProbability = 0;
    label = `${Math.abs(rollDeltaMeters).toFixed(1)}m SHORT`;
    colorHex = '#94a3b8';
  } else if (rollDeltaMeters <= optimalOvershootMax) {
    speedZone = 'sweet_spot';
    // Peak probability around +0.4m to +0.8m past the cup (firm center hit)
    const sweetness = 1.0 - Math.abs(rollDeltaMeters - 0.6) / optimalOvershootMax;
    captureProbability = Math.max(0.7, Math.min(1.0, 0.7 + sweetness * 0.3));
    label = 'CUP CAPTURE SPEED';
    colorHex = '#10b981'; // Emerald Green
  } else {
    speedZone = 'hot_danger';
    const overshoot = rollDeltaMeters - optimalOvershootMax;
    captureProbability = Math.max(0.05, 0.45 - overshoot * 0.12);
    label = 'TOO FAST (RISK LIP-OUT)';
    colorHex = '#ef4444'; // Red alert
  }

  return {
    pullbackDistancePx: clampedDy,
    powerNormalized,
    projectedRollMeters: Math.round(projectedRollMeters * 10) / 10,
    distanceToCupMeters: Math.round(distanceToCupMeters * 10) / 10,
    rollDeltaMeters: Math.round(rollDeltaMeters * 10) / 10,
    speedZone,
    captureProbability: Math.round(captureProbability * 100) / 100,
    label,
    colorHex,
  };
}
