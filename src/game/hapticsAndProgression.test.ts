/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { triggerHaptic } from './haptics';
import { calculateKickVelocity, stepBallPhysics } from './physics';
import { PlayerAttributes, BallPhysicsState, HoleData } from '../types';

const mockHole: HoleData = {
  id: 999,
  number: 1,
  par: 3,
  lengthMeters: 100,
  teePosition: { x: 0, y: 0, z: 0 },
  pinPosition: { x: 0, y: 0, z: 100 },
  fairways: [{ x: 0, z: 50, rx: 15, rz: 50 }],
  greens: [{ x: 0, z: 100, radius: 10 }],
  bunkers: [],
  waters: [],
  trees: [],
  rocks: [],
  hills: [],
  defaultAimAngle: 0,
};

test('triggerHaptic delivers differentiated patterns with pure sweet-spot sequence', () => {
  let lastPattern: number | number[] | null = null;
  // Mock navigator.vibrate
  if (typeof globalThis.navigator === 'undefined') {
    (globalThis as any).navigator = {};
  }
  Object.defineProperty(globalThis.navigator, 'vibrate', {
    value: (pattern: number | number[]) => {
      lastPattern = pattern;
      return true;
    },
    writable: true,
    configurable: true,
  });

  // Light pulse
  triggerHaptic('light');
  assert.equal(lastPattern, 18);

  // Heavy pulse
  triggerHaptic('heavy');
  assert.deepEqual(lastPattern, [45, 30, 45]);

  // Pure strike: rhythmic escalating multi-pulse sequence providing substantial tactile weight
  triggerHaptic('pure');
  assert.deepEqual(lastPattern, [30, 35, 60, 40, 100]);
});

test('calculateKickVelocity scales max velocity and curl with PlayerAttributes', () => {
  const baseAttrs: PlayerAttributes = {
    power: 1,
    accuracy: 1,
    spinControl: 1,
    finesse: 1,
  };

  const boostedAttrs: PlayerAttributes = {
    power: 5,
    accuracy: 5,
    spinControl: 5,
    finesse: 5,
  };

  const baseResult = calculateKickVelocity('drive', 1.0, 0, { top: 0.5, side: 0.5 }, 'fairway', baseAttrs);
  const boostedResult = calculateKickVelocity('drive', 1.0, 0, { top: 0.5, side: 0.5 }, 'fairway', boostedAttrs);

  // Boosted power increases launch velocity
  assert.ok(boostedResult.velocity.z > baseResult.velocity.z, 'Boosted power should increase forward velocity');

  // Boosted spinControl increases Magnus spin magnitude
  assert.ok(Math.abs(boostedResult.spin.y) > Math.abs(baseResult.spin.y), 'Boosted spinControl should increase side spin');
});

test('stepBallPhysics incorporates finesse attribute to expand cup capture threshold', () => {
  const baseBallState: BallPhysicsState = {
    position: { x: 0.18, y: 0.12, z: 99.95 },
    velocity: { x: 0, y: 0, z: 4.35 }, // 4.35 m/s is above base threshold 4.2 m/s, but below finesse 6 threshold 4.50 m/s
    spin: { x: 0, y: 0, z: 0 },
    isGrounded: true,
    isRolling: true,
    isSleeping: false,
    inWater: false,
    inHole: false,
    lie: 'green',
    lastValidPosition: { x: 0, y: 0, z: 95 },
    distanceTraveledInShot: 0,
    airTime: 0,
  };

  // Base finesse = 1 -> speed exceeds 4.2 m/s threshold -> lips out
  const baseResult = stepBallPhysics({ ...baseBallState }, mockHole, { speed: 0, angleRad: 0 }, 0.03, 1);
  assert.equal(baseResult.state.inHole, false, 'Base ball at 4.35 m/s should lip out and not be captured');

  // Boosted finesse = 6 -> threshold raised to 4.50 m/s -> ball sinks into cup!
  const boostedResult = stepBallPhysics({ ...baseBallState }, mockHole, { speed: 0, angleRad: 0 }, 0.03, 6);
  assert.equal(boostedResult.state.inHole, true, 'Boosted finesse should capture ball at 4.35 m/s into cup');
});

test('PlayerCharacter remains stationary at kick origin during ball flight and snaps to new lie when stopped', async () => {
  const { PlayerCharacter } = await import('./playerCharacter');
  const character = new PlayerCharacter();

  const teePos = { x: 0, y: 0, z: 0 };
  const initialAim = 0; // along +Z

  // 1. Initial idle stance at tee
  character.update(0.016, initialAim, teePos, 0);
  const initialPos = { ...character.group.position };
  assert.ok(Math.abs(initialPos.x) < 0.5, 'Character should be near tee X');
  assert.ok(Math.abs(initialPos.z) < 0.5, 'Character should be near tee Z');

  // 2. Start a drive kick at tee
  let contactFired = false;
  let completeFired = false;
  character.startKick('drive', teePos, initialAim, 0, () => {
    contactFired = true;
  }, () => {
    completeFired = true;
  });

  // Advance through run-up to contact point (0.35s)
  character.update(0.35, initialAim, teePos, 0);
  assert.equal(contactFired, true, 'Contact callback should trigger during runup');

  // Advance past animation completion (total > 0.44s)
  character.update(0.2, initialAim, teePos, 0);
  assert.equal(completeFired, true, 'Complete callback should trigger');

  // 3. Now simulate ball flying 120m downfield!
  // During flight, ballPos is moving rapidly down the course
  const ballInFlightPos = { x: 5, y: 24, z: 120 };
  for (let i = 0; i < 60; i++) {
    character.update(0.016, initialAim, ballInFlightPos, 0);
  }

  // The character's position MUST NOT have followed the ball downfield!
  const posDuringFlight = character.group.position;
  assert.ok(
    posDuringFlight.z < 2.0,
    `Player character should stay near kick origin (z < 2), but was at z = ${posDuringFlight.z}`
  );
  assert.ok(
    Math.abs(posDuringFlight.x) < 2.0,
    `Player character X should stay near kick origin, but was at x = ${posDuringFlight.x}`
  );

  // 4. Ball comes to rest at final lie (x: 8, y: 0.1, z: 185)
  const restBallPos = { x: 8, y: 0.1, z: 185 };
  character.onBallStopped(restBallPos, 0.2, 0);

  // Character should now instantly be positioned adjacent to the new ball lie
  const newStancePos = character.group.position;
  assert.ok(
    Math.abs(newStancePos.z - restBallPos.z) < 1.0,
    `Character should have transitioned to new ball lie near z = 185, got ${newStancePos.z}`
  );
  assert.ok(
    Math.abs(newStancePos.x - restBallPos.x) < 1.0,
    `Character should have transitioned to new ball lie near x = 8, got ${newStancePos.x}`
  );
});
