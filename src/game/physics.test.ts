/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateKickVelocity,
  calculateFlickShot,
  generatePuttingReadLine,
  getEstimatedKickDistance,
  stepBallPhysics,
  getSurfaceLie,
  predictTrajectory,
  CUP_RADIUS,
  BALL_RADIUS,
  getTerrainHeight,
} from './physics';

import { HoleData, BallPhysicsState, KickType, SurfaceType } from '../types';
import { simulateHeadlessShot } from './deterministicPhysics';

const mockHole: HoleData = {
  id: 1,
  number: 1,
  par: 4,
  lengthMeters: 180,
  teePosition: { x: 0, y: 0, z: 0 },
  pinPosition: { x: 0, y: 0, z: 150 },
  fairways: [
    { x: 0, z: 70, rx: 18, rz: 75 },
  ],
  greens: [
    { x: 0, z: 150, radius: 12 },
  ],
  bunkers: [
    { x: 12, z: 140, rx: 6, rz: 8 },
  ],
  waters: [
    { x: -25, z: 80, rx: 10, rz: 20 },
  ],
  trees: [],
  rocks: [],
  hills: [],
  defaultAimAngle: 0,
};

test('calculateKickVelocity generates realistic forward trajectory for Drive', () => {
  const result = calculateKickVelocity('drive', 1.0, 0, { top: 0, side: 0 }, 'fairway');
  assert.ok(result.velocity.z > 25, 'Drive forward velocity should be > 25 m/s');
  assert.ok(result.velocity.y > 5, 'Drive launch angle should provide positive vertical velocity');
  assert.equal(Math.abs(result.velocity.x) < 0.001, true, 'Zero aim angle should produce minimal lateral velocity');
});

test('calculateKickVelocity applies spin curl components for side spin', () => {
  const resultSlice = calculateKickVelocity('drive', 0.8, 0, { top: 0, side: 1.0 }, 'fairway');
  assert.ok(resultSlice.spin.y > 0, 'Side spin should produce positive angular velocity around vertical axis');

  const resultHook = calculateKickVelocity('drive', 0.8, 0, { top: 0, side: -1.0 }, 'fairway');
  assert.ok(resultHook.spin.y < 0, 'Hook spin should produce negative angular velocity');
});

test('getSurfaceLie accurately identifies Green, Fairway, Bunker, and Water', () => {
  assert.equal(getSurfaceLie(mockHole, 0, 150), 'green', 'Center of green should be detected as green');
  assert.equal(getSurfaceLie(mockHole, 0, 70), 'fairway', 'Center of fairway should be detected as fairway');
  assert.equal(getSurfaceLie(mockHole, 12, 140), 'sand', 'Bunker coordinates should be detected as sand');
  assert.equal(getSurfaceLie(mockHole, -25, 80), 'water', 'Water coordinates should be detected as water');
  assert.equal(getSurfaceLie(mockHole, 60, 50), 'rough', 'Off-course coordinates should be detected as rough');
});

test('stepBallPhysics detects ball sinking into cup when speed is manageable', () => {
  const stateNearHole: BallPhysicsState = {
    position: { x: 0.05, y: 0.12, z: 150.05 },
    velocity: { x: 0, y: 0, z: 0.8 }, // slow roll towards hole
    spin: { x: 0, y: 0, z: 0 },
    isGrounded: true,
    isRolling: true,
    isSleeping: false,
    inWater: false,
    inHole: false,
    lie: 'green',
    lastValidPosition: { x: 0, y: 0, z: 145 },
    distanceTraveledInShot: 0,
    airTime: 0,
  };

  const result = stepBallPhysics(stateNearHole, mockHole, { speed: 0, angleRad: 0 }, 0.03);
  assert.equal(result.events.holed, true, 'Slow rolling ball into cup should register holed event');
  assert.equal(result.state.inHole, true, 'Ball state should transition to inHole = true');
});

test('stepBallPhysics detects high-speed lip-out when ball exceeds capture speed threshold', () => {
  const fastRollAtCup: BallPhysicsState = {
    position: { x: 0.20, y: 0.12, z: 149.95 },
    velocity: { x: 0, y: 0, z: 5.5 }, // 5.5 m/s > 4.2 m/s limit
    spin: { x: 0, y: 0, z: 0 },
    isGrounded: true,
    isRolling: true,
    isSleeping: false,
    inWater: false,
    inHole: false,
    lie: 'green',
    lastValidPosition: { x: 0, y: 0, z: 140 },
    distanceTraveledInShot: 0,
    airTime: 0,
  };

  const result = stepBallPhysics(fastRollAtCup, mockHole, { speed: 0, angleRad: 0 }, 0.03);
  assert.equal(result.events.lippedOut, true, 'High speed ball at cup should register lippedOut event');
  assert.equal(result.state.inHole, false, 'Lipped out ball should NOT be in hole');
  assert.ok(result.events.hitObstacle, 'Lip-out should count as obstacle interaction');
});

test('predictTrajectory produces continuous arc points until landing', () => {
  const trajectory = predictTrajectory(
    { x: 0, y: 0.12, z: 0 },
    'chip',
    0.8,
    0,
    { top: 0, side: 0 },
    'fairway',
    mockHole,
    { speed: 2, angleRad: Math.PI / 4 }
  );

  assert.ok(trajectory.length > 5, 'Trajectory should generate multiple simulation points');
  assert.ok(trajectory[trajectory.length - 1].z > 0, 'Ball should travel forward down the hole');
});

test('calculateFlickShot scales power with swipe speed and extracts slice', () => {
  // Fast upward flick with slight right drift
  const fastFlick = calculateFlickShot(
    { startX: 200, startY: 600, endX: 260, endY: 200, durationMs: 120 },
    0,
    { top: 0, side: 0 },
    'drive'
  );
  assert.ok(fastFlick.power > 0.8, 'Fast flick should generate high power (> 80%)');
  assert.ok(fastFlick.flickSlice > 0, 'Rightward swipe drift should create right slice');
  assert.ok(fastFlick.speedKmh > 90, 'Fast drive flick should register high km/h');
  assert.ok(fastFlick.strikeLabel, 'strikeLabel should be defined');
  assert.ok(['pure', 'great', 'solid', 'push', 'pull', 'standard'].includes(fastFlick.strikeRating || ''), 'Valid strike rating');

  // Slow gentle putt flick
  const slowPuttFlick = calculateFlickShot(
    { startX: 200, startY: 500, endX: 200, endY: 420, durationMs: 400 },
    0,
    { top: 0, side: 0 },
    'putt'
  );
  assert.ok(slowPuttFlick.power < 0.4, 'Slow swipe should yield low power (< 40%)');
  assert.equal(Math.abs(slowPuttFlick.flickSlice) < 0.1, true, 'Straight swipe should have minimal slice');
});

test('calculateFlickShot combines user English spin with flick slice', () => {
  const hookWithEnglish = calculateFlickShot(
    { startX: 250, startY: 600, endX: 180, endY: 250, durationMs: 150 }, // leftwards hook
    0,
    { top: 0.3, side: -0.5 }, // manual hook english + topspin
    'drive'
  );
  assert.ok(hookWithEnglish.effectiveSpin.side < -0.6, 'Hook swipe plus hook english should produce strong negative side spin');
  assert.equal(hookWithEnglish.effectiveSpin.top, 0.3, 'Topspin english should be preserved');
});

test('generatePuttingReadLine computes slope break angles and beaded path', () => {
  const puttingRead = generatePuttingReadLine(
    { x: 0, y: 0.12, z: 140 },
    { x: 0, y: 0.12, z: 150 },
    0,
    0.6,
    mockHole
  );
  assert.ok(puttingRead.points.length > 5, 'Putting read line should generate multiple track points');
  assert.ok(['left', 'right', 'straight'].includes(puttingRead.breakDirection), 'Break direction should be classified');
  assert.ok(puttingRead.suggestedPower > 0, 'Suggested power should be computed');
  // 10m putt on flat ground requires v0 = sqrt(2 * g * mu * 10.35) = sqrt(2 * 9.81 * 0.052 * 10.35) = ~3.25 m/s.
  // Power = 3.25 / PUTT_MAX_SPEED_MPS (5.5) = ~0.59 (59%)
  assert.ok(
    puttingRead.suggestedPower >= 0.5 && puttingRead.suggestedPower <= 0.68,
    `Suggested power for 10m putt should be ~59%, got ${(puttingRead.suggestedPower * 100).toFixed(1)}%`
  );
  assert.ok(typeof puttingRead.reachesCup === 'boolean', 'reachesCup boolean should be defined');
  assert.ok(typeof puttingRead.elevationDeltaMeters === 'number', 'elevationDeltaMeters should be numeric');
});

test('stepBallPhysics detects direct flagstick collision and pin capture', () => {
  // Ball aimed straight at pin pole (x=0, z=150)
  const stateHittingPin: BallPhysicsState = {
    position: { x: 0, y: 0.12, z: 149.88 }, // 0.12m away from center of pin
    velocity: { x: 0, y: 0, z: 2.2 }, // forward speed
    spin: { x: 0, y: 0, z: 0 },
    isGrounded: true,
    isRolling: true,
    isSleeping: false,
    inWater: false,
    inHole: false,
    lie: 'green',
    lastValidPosition: { x: 0, y: 0, z: 145 },
    distanceTraveledInShot: 0,
    airTime: 0,
  };

  const result = stepBallPhysics(stateHittingPin, mockHole, { speed: 0, angleRad: 0 }, 0.03);
  assert.equal(result.events.hitPin, true, 'Ball hitting pin pole should set hitPin event');
  assert.equal(result.events.holed, true, 'Moderate speed pin strike inside cup should result in holed');
});

test('getEstimatedKickDistance calculates strategic distance projections and lie penalties', () => {
  const fullDrive = getEstimatedKickDistance('drive', 1.0, 'tee');
  assert.ok(fullDrive.totalMeters >= 120, 'Full power drive on tee should reach >= 120m');
  assert.equal(fullDrive.liePenaltyPercent, 0, 'No lie penalty on tee');

  const halfDrive = getEstimatedKickDistance('drive', 0.5, 'tee');
  assert.ok(halfDrive.totalMeters < fullDrive.totalMeters * 0.5, 'Half power drive should non-linearly scale distance');

  const roughDrive = getEstimatedKickDistance('drive', 1.0, 'rough');
  assert.ok(roughDrive.totalMeters < fullDrive.totalMeters, 'Rough should reduce drive distance');
  assert.ok(roughDrive.liePenaltyPercent > 15, 'Rough should show >= 15% lie penalty');

  const chip = getEstimatedKickDistance('chip', 1.0, 'fairway');
  assert.ok(chip.totalMeters >= 40 && chip.totalMeters <= 55, 'Full chip should reach 40-55m');

  const puttOnGreen = getEstimatedKickDistance('putt', 1.0, 'green');
  assert.ok(puttOnGreen.totalMeters >= 25 && puttOnGreen.totalMeters <= 35, 'Full putt on green should reach 25-35m');
  assert.equal(puttOnGreen.carryMeters, 0, 'Putts should have zero aerial carry');
});



test('HUD distance estimates match simulated kicks on flat ground', () => {
  const flat = {
    ...mockHole,
    hills: [],
    trees: [],
    bunkers: [],
    waterHazards: [],
    fairways: [{ x: 0, z: 200, rx: 400, rz: 400 }],
    greens: [{ x: 0, z: 0, radius: 60 }],
    pinPosition: { x: 0, y: 0, z: 3000 },
  } as HoleData;
  const cases: { kick: KickType; lie: SurfaceType; powers: number[] }[] = [
    { kick: 'drive', lie: 'tee', powers: [0.5, 0.75, 1.0] },
    { kick: 'chip', lie: 'fairway', powers: [0.5, 0.75, 1.0] },
    { kick: 'putt', lie: 'green', powers: [0.4, 0.7, 1.0] },
  ];
  for (const c of cases) {
    for (const power of c.powers) {
      // Greens override fairways near the origin, so putt from the green and kick from the fairway
      const start = c.lie === 'green' ? { x: 0, z: 0 } : { x: 0, z: 100 };
      const sim = simulateHeadlessShot(
        {
          startPos: { x: start.x, y: getTerrainHeight(flat, start.x, start.z) + BALL_RADIUS, z: start.z },
          kickType: c.kick,
          powerNormalized: power,
          timingDeviation: 0,
          aimAngleRad: 0,
          spin: { top: 0, side: 0 },
          currentLie: c.lie,
          wind: { speed: 0, angleRad: 0 },
        },
        flat,
        3000
      );
      const est = getEstimatedKickDistance(c.kick, power, c.lie).totalMeters;
      const err = Math.abs(est - sim.totalDistanceMeters) / sim.totalDistanceMeters;
      assert.ok(
        err < 0.2,
        `${c.kick} from ${c.lie} at ${power}: estimate ${est}m vs simulated ${sim.totalDistanceMeters.toFixed(1)}m`
      );
    }
  }
});
