/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateHeadlessShot, HeadlessShotInput } from './deterministicPhysics';
import { HoleData } from '../types';

const mockHole: HoleData = {
  id: 1,
  number: 1,
  par: 4,
  lengthMeters: 220,
  teePosition: { x: 0, y: 0.12, z: 0 },
  pinPosition: { x: 0, y: 0.12, z: 120 },
  fairways: [{ x: 0, z: 60, rx: 18, rz: 65 }],
  greens: [{ x: 0, z: 120, radius: 8 }],
  bunkers: [],
  waters: [],
  trees: [],
  rocks: [],
  hills: [],
  defaultAimAngle: 0,
};

test('deterministicPhysics: simulateHeadlessShot is 100% deterministic with identical inputs', () => {
  const input: HeadlessShotInput = {
    startPos: { x: 0, y: 0.12, z: 0 },
    kickType: 'drive',
    powerNormalized: 0.85,
    timingDeviation: 0.0, // Perfect
    aimAngleRad: 0.0,
    spin: { top: 0, side: 0 },
    currentLie: 'tee',
    wind: { speed: 2.0, angleRad: 0.0 },
  };

  const sim1 = simulateHeadlessShot(input, mockHole);
  const sim2 = simulateHeadlessShot(input, mockHole);

  assert.equal(sim1.validationChecksum, sim2.validationChecksum);
  assert.equal(sim1.finalRestSpot.x, sim2.finalRestSpot.x);
  assert.equal(sim1.finalRestSpot.z, sim2.finalRestSpot.z);
  assert.equal(sim1.carryDistanceMeters, sim2.carryDistanceMeters);
  assert.equal(sim1.totalDistanceMeters, sim2.totalDistanceMeters);
  assert.ok(sim1.trajectoryPoints.length > 5);
});

test('deterministicPhysics: timing hook/slice causes deterministic lateral flight deviation', () => {
  const perfectInput: HeadlessShotInput = {
    startPos: { x: 0, y: 0.12, z: 0 },
    kickType: 'drive',
    powerNormalized: 0.9,
    timingDeviation: 0.0, // Perfect center
    aimAngleRad: 0.0,
    spin: { top: 0, side: 0 },
    currentLie: 'tee',
    wind: { speed: 0.0, angleRad: 0.0 },
  };

  const sliceInput: HeadlessShotInput = {
    ...perfectInput,
    timingDeviation: 0.85, // Heavy slice
  };

  const perfectSim = simulateHeadlessShot(perfectInput, mockHole);
  const sliceSim = simulateHeadlessShot(sliceInput, mockHole);

  // Sliced shot must land significantly to the right (positive x) compared to perfect shot
  assert.ok(sliceSim.landingSpot.x > perfectSim.landingSpot.x + 2.0);
  assert.ok(sliceSim.finalRestSpot.x > perfectSim.finalRestSpot.x + 3.0);
});
