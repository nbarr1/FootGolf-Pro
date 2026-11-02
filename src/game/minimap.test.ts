/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateHoleBounds,
  worldToMapCoordinates,
  mapToWorldCoordinates,
  calculateAimTargetPoint,
} from './minimap';
import { HoleData } from '../types';

const testHole: HoleData = {
  id: 1,
  number: 1,
  par: 4,
  lengthMeters: 175,
  teePosition: { x: 0, y: 0, z: 0 },
  pinPosition: { x: 10, y: 0, z: 160 },
  fairways: [{ x: 0, z: 80, rx: 16, rz: 70 }],
  greens: [{ x: 10, z: 160, radius: 12 }],
  bunkers: [{ x: -14, z: 90, rx: 6, rz: 8 }],
  waters: [{ x: 22, z: 60, rx: 10, rz: 18 }],
  trees: [],
  rocks: [],
  hills: [],
  defaultAimAngle: 0,
};

test('calculateHoleBounds encompasses all terrain features and adds margin', () => {
  const bounds = calculateHoleBounds(testHole, 15);
  // Tee is at z=0, so minZ should be <= -15
  assert.ok(bounds.minZ <= -15, 'minZ should encompass tee minus margin');
  // Pin is at z=160 with green radius 12, so maxZ should be >= 187
  assert.ok(bounds.maxZ >= 187, 'maxZ should encompass green plus margin');
  // Water is at x=22 with rx=10, so maxX should be >= 47
  assert.ok(bounds.maxX >= 47, 'maxX should encompass water hazard');
  // Bunker is at x=-14 with rx=6, so minX should be <= -35
  assert.ok(bounds.minX <= -35, 'minX should encompass bunker');
  assert.ok(bounds.width > 50, 'Width should be positive and substantial');
  assert.ok(bounds.length > 150, 'Length should cover the full hole length');
});

test('worldToMapCoordinates places pin at top and tee at bottom of viewport', () => {
  const bounds = calculateHoleBounds(testHole, 15);
  const viewW = 200;
  const viewH = 300;
  const pad = 10;

  const teeMap = worldToMapCoordinates(testHole.teePosition, bounds, viewW, viewH, pad);
  const pinMap = worldToMapCoordinates(testHole.pinPosition, bounds, viewW, viewH, pad);

  assert.ok(pinMap.mapY < teeMap.mapY, 'Pin should be rendered near top (lower Y) than Tee');
  assert.ok(teeMap.mapY <= viewH - pad, 'Tee should be within bottom padding');
  assert.ok(pinMap.mapY >= pad, 'Pin should be within top padding');
});

test('mapToWorldCoordinates accurately inverts worldToMapCoordinates', () => {
  const bounds = calculateHoleBounds(testHole, 15);
  const viewW = 240;
  const viewH = 320;
  const pad = 12;

  const originalWorld = { x: 8, z: 95 };
  const mapped = worldToMapCoordinates(originalWorld, bounds, viewW, viewH, pad);
  const inverted = mapToWorldCoordinates(mapped, bounds, viewW, viewH, pad);

  assert.ok(Math.abs(inverted.worldX - originalWorld.x) < 0.1, 'Inverted X should match original');
  assert.ok(Math.abs(inverted.worldZ - originalWorld.z) < 0.1, 'Inverted Z should match original');
});

test('calculateAimTargetPoint projects forward landing point based on power and kick type', () => {
  const ballPos = { x: 0, y: 0.12, z: 20 };
  const targetDrive = calculateAimTargetPoint(ballPos, 0, 1.0, 'drive');
  assert.ok(targetDrive.z > 80, 'Full power drive should project target forward > 60m');
  assert.ok(targetDrive.estimatedDistanceMeters >= 70, 'Drive estimated distance should be >= 70m');

  const targetPutt = calculateAimTargetPoint(ballPos, 0, 0.5, 'putt');
  assert.ok(targetPutt.estimatedDistanceMeters < 20, 'Putt should project shorter distance');
});
