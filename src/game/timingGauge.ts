/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { KickType, PlayerAttributes, SurfaceType } from '../types';

export type TimingRating = 'perfect' | 'great' | 'good' | 'hook_slice';

export interface TimingRatingResult {
  rating: TimingRating;
  needleValue: number;         // -1.0 (far left) to +1.0 (far right)
  accuracyMultiplier: number;  // 1.0 = perfect, lower = reduced accuracy
  lateralAngleOffsetRad: number; // Physics deviation angle (radians)
  sideSpinDeviation: number;   // -1.0 to 1.0 added spin for hooks/slices
  label: string;
  colorHex: string;
}

export interface TimingConfig {
  baseFrequencyHz: number;
  perfectThreshold: number;   // e.g. 0.12 (±12% center)
  greatThreshold: number;     // e.g. 0.38 (±38% center)
  goodThreshold: number;      // e.g. 0.70 (±70% center)
}

export const DEFAULT_TIMING_CONFIG: TimingConfig = {
  baseFrequencyHz: 0.95,
  perfectThreshold: 0.12,
  greatThreshold: 0.38,
  goodThreshold: 0.70,
};

/**
 * Calculates needle oscillation frequency based on kick type, lie surface, overpower, and attributes.
 */
export function calculateNeedleFrequency(
  kickType: KickType,
  currentLie: SurfaceType,
  powerNormalized: number,
  attributes?: PlayerAttributes
): number {
  let freq = DEFAULT_TIMING_CONFIG.baseFrequencyHz;

  // Kick type tuning: drives require faster timing, chips are balanced, putts are measured
  if (kickType === 'drive') {
    freq *= 1.15;
  } else if (kickType === 'chip') {
    freq *= 1.0;
  } else if (kickType === 'putt') {
    freq *= 0.85;
  }

  // Lie penalty on timing: rough and sand make needle faster and twitchier
  if (currentLie === 'rough') {
    freq *= 1.25;
  } else if (currentLie === 'sand') {
    freq *= 1.35;
  }

  // Player accuracy attribute softens needle speed (-2% speed per level above 1, up to -18%)
  if (attributes && attributes.accuracy > 1) {
    const accuracyDampening = 1.0 - (attributes.accuracy - 1) * 0.02;
    freq *= Math.max(0.75, accuracyDampening);
  }

  // Overpower mechanic (from 1.0 up to 1.25):
  // Pulling beyond 100% accelerates needle swing by up to +40%
  if (powerNormalized > 1.0) {
    const overpowerFactor = Math.min(0.25, powerNormalized - 1.0) / 0.25; // 0.0 to 1.0
    freq *= (1.0 + overpowerFactor * 0.40);
  }

  return freq;
}

/**
 * Returns current needle position [-1.0, 1.0] using harmonic oscillation.
 * Starts at center (0) and oscillates left/right smoothly.
 */
export function getNeedlePosition(elapsedSeconds: number, frequencyHz: number): number {
  // Harmonic oscillation: sin(2 * pi * f * t)
  return Math.sin(2 * Math.PI * frequencyHz * elapsedSeconds);
}

/**
 * Evaluates the timing needle position at release and computes precision rating,
 * accuracy multiplier, and deterministic lateral physics deviations.
 */
export function evaluateTimingRelease(
  needleValue: number, // -1.0 to +1.0
  config: TimingConfig = DEFAULT_TIMING_CONFIG
): TimingRatingResult {
  const clampedNeedle = Math.max(-1.0, Math.min(1.0, needleValue));
  const absVal = Math.abs(clampedNeedle);
  const sign = clampedNeedle >= 0 ? 1 : -1;

  if (absVal <= config.perfectThreshold) {
    // PERFECT: 1.0x accuracy, zero lateral deviation
    return {
      rating: 'perfect',
      needleValue: clampedNeedle,
      accuracyMultiplier: 1.0,
      lateralAngleOffsetRad: 0.0,
      sideSpinDeviation: 0.0,
      label: 'PERFECT!',
      colorHex: '#facc15', // Vibrant Gold
    };
  }

  if (absVal <= config.greatThreshold) {
    // GREAT: minor lateral drift (±2.5 degrees)
    const factor = (absVal - config.perfectThreshold) / (config.greatThreshold - config.perfectThreshold);
    const degOffset = sign * (1.2 + factor * 1.5);
    const radOffset = (degOffset * Math.PI) / 180;

    return {
      rating: 'great',
      needleValue: clampedNeedle,
      accuracyMultiplier: 0.95,
      lateralAngleOffsetRad: radOffset,
      sideSpinDeviation: sign * 0.2,
      label: sign > 0 ? 'GREAT (RIGHT)' : 'GREAT (LEFT)',
      colorHex: '#38bdf8', // Light Cyan Blue
    };
  }

  if (absVal <= config.goodThreshold) {
    // GOOD: noticeable drift (±6 degrees)
    const factor = (absVal - config.greatThreshold) / (config.goodThreshold - config.greatThreshold);
    const degOffset = sign * (3.5 + factor * 3.5);
    const radOffset = (degOffset * Math.PI) / 180;

    return {
      rating: 'good',
      needleValue: clampedNeedle,
      accuracyMultiplier: 0.85,
      lateralAngleOffsetRad: radOffset,
      sideSpinDeviation: sign * 0.5,
      label: sign > 0 ? 'GOOD (PUSH)' : 'GOOD (PULL)',
      colorHex: '#fb923c', // Warm Orange
    };
  }

  // HOOK / SLICE: heavy directional deviation (up to ±14 degrees) and intense sidespin curl
  const factor = (absVal - config.goodThreshold) / (1.0 - config.goodThreshold);
  const degOffset = sign * (8.0 + factor * 6.5);
  const radOffset = (degOffset * Math.PI) / 180;

  return {
    rating: 'hook_slice',
    needleValue: clampedNeedle,
    accuracyMultiplier: 0.65,
    lateralAngleOffsetRad: radOffset,
    sideSpinDeviation: sign * 0.95,
    label: sign > 0 ? 'SLICE!' : 'HOOK!',
    colorHex: '#ef4444', // Red Alert
  };
}
