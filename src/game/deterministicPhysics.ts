/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BallPhysicsState,
  HoleData,
  KickType,
  PlayerAttributes,
  SpinControl,
  SurfaceType,
  Vector3D,
} from '../types';
import {
  BALL_RADIUS,
  CUP_RADIUS,
  GRAVITY,
  AIR_DENSITY,
  BALL_MASS,
  BALL_AREA,
  DRAG_COEFFICIENT,
  MAGNUS_FACTOR,
  SURFACE_PROPERTIES,
  getTerrainHeight,
  getTerrainNormal,
  getSurfaceLie,
  stepBallPhysics,
} from './physics';
import { resolveArcadeShot } from './arcadeControls';

export interface BallAttributesConfig {
  powerRating?: number;        // Multiplier on initial speed (e.g. 1.0 - 1.15)
  windResistance?: number;     // 0.0 to 0.5 (reduces aerodynamic wind drift)
  bounceCoefficient?: number;  // 0.8 to 1.1 (modifies ground restitution)
}

export interface HeadlessShotInput {
  startPos: Vector3D;
  kickType: KickType;
  powerNormalized: number;     // 0.1 to 1.25
  timingDeviation: number;     // -1.0 to 1.0 (needle position)
  aimAngleRad: number;
  spin: SpinControl;
  currentLie: SurfaceType;
  wind: { speed: number; angleRad: number };
  ballStats?: BallAttributesConfig;
  playerAttributes?: PlayerAttributes;
}

export interface HeadlessSimulationResult {
  initialVelocity: Vector3D;
  initialSpin: Vector3D;
  landingSpot: Vector3D;
  finalRestSpot: Vector3D;
  inHole: boolean;
  bounces: number;
  flightDurationSec: number;
  totalRollDurationSec: number;
  carryDistanceMeters: number;
  totalDistanceMeters: number;
  trajectoryPoints: Vector3D[];
  validationChecksum: string;
}

/**
 * Creates a lightweight deterministic hash / checksum string from the resulting coordinates
 * for tamper-proof server-side validation.
 */
function computeCoordinateChecksum(restPos: Vector3D, carry: number, totalDist: number): string {
  const raw = `${restPos.x.toFixed(3)}_${restPos.y.toFixed(3)}_${restPos.z.toFixed(3)}_${carry.toFixed(2)}_${totalDist.toFixed(2)}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash << 5) - hash + raw.charCodeAt(i);
    hash |= 0;
  }
  return `chk_${Math.abs(hash).toString(16)}`;
}

/**
 * Pure deterministic headless simulation of a shot.
 * Executes synchronously without any DOM, canvas, or WebGL renderer dependencies.
 * Perfect for server validation or instant client predictions.
 */
export function simulateHeadlessShot(
  input: HeadlessShotInput,
  hole: HoleData,
  maxSteps: number = 720, // 12 seconds max at 60Hz
  fixedDt: number = 1 / 60
): HeadlessSimulationResult {
  // 1. Resolve arcade shot parameters
  const arcadeShot = resolveArcadeShot(
    input.powerNormalized,
    input.timingDeviation,
    0, // zero centering error for pure base
    input.aimAngleRad,
    input.spin,
    input.kickType,
    input.currentLie,
    input.playerAttributes
  );

  let initialVel = arcadeShot.velocity;
  let initialSpin = arcadeShot.spin;

  // Apply ball attributes if configured
  if (input.ballStats) {
    if (input.ballStats.powerRating && input.ballStats.powerRating !== 1.0) {
      initialVel = {
        x: initialVel.x * input.ballStats.powerRating,
        y: initialVel.y * input.ballStats.powerRating,
        z: initialVel.z * input.ballStats.powerRating,
      };
    }
  }

  // Calculate effective wind (modified by ball wind resistance)
  const windResistanceFactor = Math.max(0, Math.min(0.6, input.ballStats?.windResistance || 0));
  const effectiveWind = {
    speed: input.wind.speed * (1.0 - windResistanceFactor),
    angleRad: input.wind.angleRad,
  };

  // 2. Initialize ball state
  let state: BallPhysicsState = {
    position: { ...input.startPos },
    velocity: { ...initialVel },
    spin: { ...initialSpin },
    isGrounded: input.kickType === 'putt',
    isRolling: input.kickType === 'putt',
    isSleeping: false,
    inWater: false,
    inHole: false,
    lie: input.currentLie,
    lastValidPosition: { ...input.startPos },
    distanceTraveledInShot: 0,
    airTime: 0,
  };

  const trajectoryPoints: Vector3D[] = [{ ...state.position }];
  let landingSpot: Vector3D = { ...state.position };
  let hasLanded = input.kickType === 'putt';
  let bounces = 0;
  let flightDurationSec = 0;
  let totalRollDurationSec = 0;

  // 3. Step physics until sleep, hole, or max steps
  for (let step = 0; step < maxSteps; step++) {
    if (state.isSleeping || state.inHole) {
      break;
    }

    const prevGrounded = state.isGrounded;
    const result = stepBallPhysics(
      state,
      hole,
      effectiveWind,
      fixedDt,
      input.playerAttributes?.finesse || 1
    );

    state = result.state;

    // Track landing spot on first bounce or grounding after takeoff
    if (!hasLanded && step > 6 && (result.events.bounced || (!prevGrounded && state.isGrounded))) {
      hasLanded = true;
      landingSpot = { ...state.position };
      flightDurationSec = step * fixedDt;
    }

    if (result.events.bounced) {
      bounces++;
    }

    if (hasLanded && state.isRolling) {
      totalRollDurationSec += fixedDt;
    }

    // Record trajectory sample every 2 steps
    if (step % 2 === 0) {
      trajectoryPoints.push({ ...state.position });
    }
  }

  // Ensure last point is included
  trajectoryPoints.push({ ...state.position });

  const carryDistanceMeters = Math.hypot(
    landingSpot.x - input.startPos.x,
    landingSpot.z - input.startPos.z
  );

  const totalDistanceMeters = Math.hypot(
    state.position.x - input.startPos.x,
    state.position.z - input.startPos.z
  );

  const validationChecksum = computeCoordinateChecksum(
    state.position,
    carryDistanceMeters,
    totalDistanceMeters
  );

  return {
    initialVelocity: initialVel,
    initialSpin: initialSpin,
    landingSpot,
    finalRestSpot: { ...state.position },
    inHole: state.inHole,
    bounces,
    flightDurationSec,
    totalRollDurationSec,
    carryDistanceMeters: Math.round(carryDistanceMeters * 10) / 10,
    totalDistanceMeters: Math.round(totalDistanceMeters * 10) / 10,
    trajectoryPoints,
    validationChecksum,
  };
}
