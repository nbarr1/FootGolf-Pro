/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateNeedleFrequency,
  getNeedlePosition,
  evaluateTimingRelease,
  DEFAULT_TIMING_CONFIG,
} from './timingGauge';

test('timingGauge: getNeedlePosition oscillates sinusoidally between -1.0 and 1.0', () => {
  const f = 1.0; // 1 Hz = 1 cycle per second
  assert.equal(getNeedlePosition(0, f), 0);
  assert.ok(Math.abs(getNeedlePosition(0.25, f) - 1.0) < 0.0001); // peak right
  assert.ok(Math.abs(getNeedlePosition(0.5, f)) < 0.0001); // zero center
  assert.ok(Math.abs(getNeedlePosition(0.75, f) - (-1.0)) < 0.0001); // peak left
});

test('timingGauge: evaluateTimingRelease assigns correct ratings and lateral offsets', () => {
  // Center release -> PERFECT
  const perfectResult = evaluateTimingRelease(0.04);
  assert.equal(perfectResult.rating, 'perfect');
  assert.equal(perfectResult.accuracyMultiplier, 1.0);
  assert.equal(perfectResult.lateralAngleOffsetRad, 0);

  // Slight right -> GREAT
  const greatResult = evaluateTimingRelease(0.25);
  assert.equal(greatResult.rating, 'great');
  assert.equal(greatResult.accuracyMultiplier, 0.95);
  assert.ok(greatResult.lateralAngleOffsetRad > 0);

  // Medium left -> GOOD
  const goodResult = evaluateTimingRelease(-0.55);
  assert.equal(goodResult.rating, 'good');
  assert.equal(goodResult.accuracyMultiplier, 0.85);
  assert.ok(goodResult.lateralAngleOffsetRad < 0);

  // Far right edge -> HOOK_SLICE (Slice)
  const sliceResult = evaluateTimingRelease(0.88);
  assert.equal(sliceResult.rating, 'hook_slice');
  assert.equal(sliceResult.accuracyMultiplier, 0.65);
  assert.ok(sliceResult.lateralAngleOffsetRad > 0.1); // > 5.7 degrees
  assert.ok(sliceResult.sideSpinDeviation > 0.8);
});

test('timingGauge: calculateNeedleFrequency scales with overpower', () => {
  const baseFreq = calculateNeedleFrequency('drive', 'fairway', 1.0);
  const overpowerFreq = calculateNeedleFrequency('drive', 'fairway', 1.25);

  // At 125% overpower, frequency should be 40% faster
  assert.ok(overpowerFreq > baseFreq * 1.35);
});

test('timingGauge: accuracy attributes dampen needle speed', () => {
  const noviceFreq = calculateNeedleFrequency('drive', 'fairway', 1.0, { power: 1, accuracy: 1, spinControl: 1, finesse: 1 });
  const proFreq = calculateNeedleFrequency('drive', 'fairway', 1.0, { power: 1, accuracy: 10, spinControl: 1, finesse: 1 });

  assert.ok(proFreq < noviceFreq);
});
