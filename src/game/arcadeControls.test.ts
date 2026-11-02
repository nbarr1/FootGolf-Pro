/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePullbackState, resolveArcadeShot } from './arcadeControls';

test('arcadeControls: calculatePullbackState clamps standard drag and extends overpower', () => {
  // Zero drag
  const zero = calculatePullbackState(0, 0);
  assert.equal(zero.powerNormalized, 0);
  assert.equal(zero.isOverpower, false);

  // 50% drag
  const half = calculatePullbackState(70, 0, 140, 175);
  assert.ok(Math.abs(half.powerNormalized - 0.5) < 0.01);
  assert.equal(half.isOverpower, false);

  // 100% drag
  const full = calculatePullbackState(140, 0, 140, 175);
  assert.ok(Math.abs(full.powerNormalized - 1.0) < 0.01);
  assert.equal(full.isOverpower, false);

  // Overpower drag (125%)
  const over = calculatePullbackState(175, 0, 140, 175);
  assert.ok(Math.abs(over.powerNormalized - 1.25) < 0.01);
  assert.equal(over.isOverpower, true);
  assert.equal(over.overpowerRatio, 1.0);
});

test('arcadeControls: resolveArcadeShot creates valid kick velocities with timing ratings', () => {
  // Perfect timing shot
  const perfectShot = resolveArcadeShot(
    1.0,
    0.0, // center needle
    0.0,
    0.0,
    { top: 0, side: 0 },
    'drive',
    'fairway'
  );

  assert.equal(perfectShot.timing.rating, 'perfect');
  assert.equal(perfectShot.power, 1.0);
  assert.ok(perfectShot.speedKmh > 50);
  assert.ok(perfectShot.velocity.z > 0); // forward velocity along aim

  // Slice timing shot
  const sliceShot = resolveArcadeShot(
    1.25,
    0.95, // far right slice needle
    0.0,
    0.0,
    { top: 0, side: 0 },
    'drive',
    'fairway'
  );

  assert.equal(sliceShot.timing.rating, 'hook_slice');
  assert.equal(sliceShot.isOverpower, true);
  // Velocity in x should have lateral slice drift
  assert.ok(sliceShot.effectiveAimAngleRad > 0);
  assert.ok(sliceShot.effectiveSpin.side > 0.5);
  // Overpower speed should exceed standard speed
  assert.ok(sliceShot.speedKmh > perfectShot.speedKmh);
});
