/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePuttingPullback } from './puttingSystem';

test('puttingSystem: accurately distinguishes short, sweet spot, and hot danger zones', () => {
  const distToCup = 10; // 10 meters

  // Light drag -> short
  const shortPutt = evaluatePuttingPullback(15, distToCup); // ~4.4m
  assert.equal(shortPutt.speedZone, 'short');
  assert.equal(shortPutt.captureProbability, 0);

  // Calibrated drag -> sweet spot (e.g. ~10.6m roll)
  const sweetPutt = evaluatePuttingPullback(36, distToCup); // ~10.6m
  assert.equal(sweetPutt.speedZone, 'sweet_spot');
  assert.ok(sweetPutt.captureProbability >= 0.7);

  // Maximum hammer drag -> hot danger
  const hotPutt = evaluatePuttingPullback(95, distToCup); // 28m
  assert.equal(hotPutt.speedZone, 'hot_danger');
  assert.ok(hotPutt.captureProbability < 0.5);
});
