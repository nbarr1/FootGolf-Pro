/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BallPhysicsState,
  FlickCalculationResult,
  FlickGestureData,
  HoleData,
  KickType,
  PlayerAttributes,
  SpinControl,
  SurfaceType,
  Vector3D,
} from '../types';

export const BALL_RADIUS = 0.12; // 12cm radius (24cm diameter soccer ball)
export const CUP_RADIUS = 0.27; // 27cm radius (54cm / 21-inch regulation FootGolf cup)
export const GRAVITY = -9.81;
export const AIR_DENSITY = 1.225;
export const BALL_MASS = 0.43; // 430g
export const BALL_AREA = Math.PI * BALL_RADIUS * BALL_RADIUS;
export const DRAG_COEFFICIENT = 0.26;
/** Drag coefficient after the drag crisis (turbulent boundary layer at high speed). */
export const DRAG_COEFFICIENT_SUPERCRITICAL = 0.12;
const DRAG_CRISIS_LOW_MPS = 12;
const DRAG_CRISIS_HIGH_MPS = 20;

/**
 * Speed-dependent drag coefficient. Soccer balls show a "drag crisis": above roughly
 * 15 m/s the boundary layer turns turbulent and drag drops sharply. This is blended
 * smoothly between the subcritical and supercritical values.
 */
export function getDragCoefficient(airSpeed: number): number {
  if (airSpeed <= DRAG_CRISIS_LOW_MPS) return DRAG_COEFFICIENT;
  if (airSpeed >= DRAG_CRISIS_HIGH_MPS) return DRAG_COEFFICIENT_SUPERCRITICAL;
  const t = (airSpeed - DRAG_CRISIS_LOW_MPS) / (DRAG_CRISIS_HIGH_MPS - DRAG_CRISIS_LOW_MPS);
  const smooth = t * t * (3 - 2 * t);
  return DRAG_COEFFICIENT + (DRAG_COEFFICIENT_SUPERCRITICAL - DRAG_COEFFICIENT) * smooth;
}
export const MAGNUS_FACTOR = 0.0035; // Lift force coefficient from spin

// Full-power launch speeds per kick type (m/s). Tuned so simulated distances match the
// distances shown in the HUD (see the calibration test in physics.test.ts).
export const DRIVE_MAX_SPEED_MPS = 40.0;
export const CHIP_MAX_SPEED_MPS = 20.0;
export const PUTT_MAX_SPEED_MPS = 5.5;

// Surface physical properties
export interface SurfaceProperty {
  rollingFriction: number; // Deceleration rate during roll
  restitution: number; // Bounce bounciness (0 = dead, 1 = elastic)
  roughnessDrag: number; // Air/surface drag multiplier
  kickPowerModifier: number; // Power handicap when kicking from this lie
}

export const SURFACE_PROPERTIES: Record<SurfaceType, SurfaceProperty> = {
  tee: { rollingFriction: 0.08, restitution: 0.52, roughnessDrag: 1.0, kickPowerModifier: 1.0 },
  fairway: { rollingFriction: 0.09, restitution: 0.50, roughnessDrag: 1.0, kickPowerModifier: 0.98 },
  green: { rollingFriction: 0.052, restitution: 0.56, roughnessDrag: 0.9, kickPowerModifier: 1.0 },
  rough: { rollingFriction: 0.28, restitution: 0.28, roughnessDrag: 1.3, kickPowerModifier: 0.78 },
  sand: { rollingFriction: 0.55, restitution: 0.12, roughnessDrag: 1.6, kickPowerModifier: 0.62 },
  water: { rollingFriction: 1.0, restitution: 0.05, roughnessDrag: 2.5, kickPowerModifier: 0.0 },
  boundary: { rollingFriction: 0.4, restitution: 0.25, roughnessDrag: 1.5, kickPowerModifier: 0.5 },
};

/**
 * Calculates terrain elevation at any (x, z) coordinate for a given hole.
 */
export function getTerrainHeight(hole: HoleData, x: number, z: number): number {
  let elevation = 0;

  // Evaluate hills and contour slopes
  if (hole.hills && hole.hills.length > 0) {
    for (const hill of hole.hills) {
      const dx = x - hill.x;
      const dz = z - hill.z;
      const distSq = dx * dx + dz * dz;
      const rSq = hill.radius * hill.radius;
      if (distSq < rSq) {
        // Gaussian bell curve elevation
        const factor = 1 - distSq / rSq;
        elevation += hill.height * factor * factor;
      }
    }
  }

  // Base gentle undulating landscape
  const wave = Math.sin(x * 0.04) * Math.cos(z * 0.04) * 0.35 +
               Math.sin(x * 0.08 + 1.2) * 0.18;
  elevation += wave;

  // Smooth ramp near pin to ensure green is playable
  const toPinX = x - hole.pinPosition.x;
  const toPinZ = z - hole.pinPosition.z;
  const distToPin = Math.sqrt(toPinX * toPinX + toPinZ * toPinZ);
  if (distToPin < 18) {
    const greenBlend = Math.max(0, 1 - distToPin / 18);
    elevation = elevation * (1 - greenBlend) + hole.pinPosition.y * greenBlend;
  }

  return elevation;
}

/**
 * Calculates the surface normal vector at (x, z) using finite difference gradient.
 */
export function getTerrainNormal(hole: HoleData, x: number, z: number): Vector3D {
  const eps = 0.15;
  const hL = getTerrainHeight(hole, x - eps, z);
  const hR = getTerrainHeight(hole, x + eps, z);
  const hD = getTerrainHeight(hole, x, z - eps);
  const hU = getTerrainHeight(hole, x, z + eps);

  const nx = -(hR - hL) / (2 * eps);
  const nz = -(hU - hD) / (2 * eps);
  const ny = 1.0;

  const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
  return { x: nx / len, y: ny / len, z: nz / len };
}

/**
 * Determines what surface the ball is currently resting or flying over.
 */
export function getSurfaceLie(hole: HoleData, x: number, z: number): SurfaceType {
  // Check Water
  for (const water of hole.waters) {
    const dx = (x - water.x) / water.rx;
    const dz = (z - water.z) / water.rz;
    if (dx * dx + dz * dz <= 1.0) {
      return 'water';
    }
  }

  // Check Sand Bunkers
  for (const bunker of hole.bunkers) {
    const dx = (x - bunker.x) / bunker.rx;
    const dz = (z - bunker.z) / bunker.rz;
    if (dx * dx + dz * dz <= 1.0) {
      return 'sand';
    }
  }

  // Check Greens
  for (const green of hole.greens) {
    const dx = x - green.x;
    const dz = z - green.z;
    if (dx * dx + dz * dz <= green.radius * green.radius) {
      return 'green';
    }
  }

  // Check Tee Box
  const toTeeX = x - hole.teePosition.x;
  const toTeeZ = z - hole.teePosition.z;
  if (toTeeX * toTeeX + toTeeZ * toTeeZ <= 9) {
    return 'tee';
  }

  // Check Fairways
  for (const fairway of hole.fairways) {
    const dx = (x - fairway.x) / fairway.rx;
    const dz = (z - fairway.z) / fairway.rz;
    if (dx * dx + dz * dz <= 1.0) {
      return 'fairway';
    }
  }

  // Default outside fairway is rough
  return 'rough';
}

/**
 * Creates initial ball kick velocity based on power, kick type, aim angle, and spin.
 */
export function calculateKickVelocity(
  kickType: KickType,
  power: number, // 0.1 to 1.0
  aimAngleRad: number,
  spin: SpinControl,
  currentLie: SurfaceType,
  attributes?: PlayerAttributes
): { velocity: Vector3D; spin: Vector3D } {
  const lieProp = SURFACE_PROPERTIES[currentLie] || SURFACE_PROPERTIES.fairway;
  const effectivePower = Math.max(0.1, power * lieProp.kickPowerModifier);

  let launchAngleDeg = 16;
  let maxSpeedMps = 30;

  // Power attribute bonus (+2.5% max speed per level above 1, up to +22.5% at level 10)
  const powerBonus = attributes ? 1 + (attributes.power - 1) * 0.025 : 1.0;

  if (kickType === 'drive') {
    // Low, powerful piercing shot
    launchAngleDeg = 15 + (1 - spin.top) * 3; // backspin increases loft
    maxSpeedMps = DRIVE_MAX_SPEED_MPS * powerBonus;
  } else if (kickType === 'chip') {
    // High arching lob over obstacles
    launchAngleDeg = 36 + (1 - spin.top) * 5;
    maxSpeedMps = CHIP_MAX_SPEED_MPS * powerBonus;
  } else if (kickType === 'putt') {
    // Pure ground roll
    launchAngleDeg = 0.5;
    maxSpeedMps = PUTT_MAX_SPEED_MPS;
  }

  const speed = effectivePower * maxSpeedMps;
  const launchAngleRad = (launchAngleDeg * Math.PI) / 180;

  // Horizontal speed & Vertical speed
  const horizontalSpeed = speed * Math.cos(launchAngleRad);
  const vy = speed * Math.sin(launchAngleRad);

  const vx = horizontalSpeed * Math.sin(aimAngleRad);
  const vz = horizontalSpeed * Math.cos(aimAngleRad);

  // Angular velocities (rad/sec)
  // Spin control attribute amplifies curve and bite (+4% per level above 1)
  const spinBonus = attributes ? 1 + (attributes.spinControl - 1) * 0.04 : 1.0;
  const spinMagnitude = speed * 1.8 * spinBonus;
  const spinY = spin.side * spinMagnitude * 1.2; // vertical axis spin creates horizontal curve
  // Perpendicular horizontal axis for topspin/backspin
  const perpX = Math.cos(aimAngleRad);
  const perpZ = -Math.sin(aimAngleRad);
  const topBackRate = spin.top * spinMagnitude * 1.5;

  return {
    velocity: { x: vx, y: vy, z: vz },
    spin: {
      x: perpX * topBackRate,
      y: spinY,
      z: perpZ * topBackRate,
    },
  };
}

export interface DistanceEstimate {
  carryMeters: number;
  totalMeters: number;
  maxFullDistance: number;
  liePenaltyPercent: number;
}

/**
 * Calculates strategic estimated carry & rollout distance based on kick type, power, and lie.
 */
export function getEstimatedKickDistance(
  kickType: KickType,
  power: number,
  currentLie: SurfaceType
): DistanceEstimate {
  const lieProp = SURFACE_PROPERTIES[currentLie] || SURFACE_PROPERTIES.fairway;
  const modifier = lieProp.kickPowerModifier;
  const liePenaltyPercent = Math.round((1 - modifier) * 100);

  // Calibrated against simulateHeadlessShot on flat ground with no wind
  // (see the "HUD distance estimates match simulated kicks" test).
  let fullCarry = 0;
  let fullTotal = 0;
  let exponent = 1.25;

  if (kickType === 'drive') {
    fullCarry = 64;
    fullTotal = 121;
    exponent = 1.25;
  } else if (kickType === 'chip') {
    fullCarry = 29;
    fullTotal = 47;
    exponent = 1.45;
  } else {
    // Putt (pure ground roll): distance = v^2 / (2 * mu * g)
    const mu = lieProp.rollingFriction;
    fullCarry = 0;
    fullTotal = (PUTT_MAX_SPEED_MPS * PUTT_MAX_SPEED_MPS) / (2 * mu * Math.abs(GRAVITY));
    exponent = 2;
  }

  // The lie modifier scales launch speed, and putts already account for surface friction
  const effectivePwr = Math.max(0.05, power * (kickType === 'putt' ? 1 : modifier));
  const powerFactor = Math.pow(effectivePwr, exponent);

  const carry = Math.round(fullCarry * powerFactor);
  const total = Math.max(1, Math.round(fullTotal * powerFactor));

  return {
    carryMeters: carry,
    totalMeters: total,
    maxFullDistance: fullTotal,
    liePenaltyPercent,
  };
}

export interface StepPhysicsResult {
  state: BallPhysicsState;
  events: {
    bounced: boolean;
    holed: boolean;
    splashed: boolean;
    hitObstacle: boolean;
    hitPin?: boolean;
    lippedOut?: boolean;
    stopped: boolean;
    impactSpeed: number;
    surface: SurfaceType;
  };
}

/**
 * Advance ball physics simulation by dt seconds (clamped to 0.033s).
 */
export function stepBallPhysics(
  state: BallPhysicsState,
  hole: HoleData,
  wind: { speed: number; angleRad: number },
  dt: number,
  finesseLevel: number = 1
): StepPhysicsResult {
  const events = {
    bounced: false,
    holed: false,
    splashed: false,
    hitObstacle: false,
    hitPin: false,
    lippedOut: false,
    stopped: false,
    impactSpeed: 0,
    surface: state.lie,
  };

  if (state.isSleeping || state.inHole || state.inWater) {
    return { state, events };
  }

  const nextPos = { ...state.position };
  const nextVel = { ...state.velocity };
  const nextSpin = { ...state.spin };

  // Wind vector in m/s
  const windVx = wind.speed * Math.sin(wind.angleRad);
  const windVz = wind.speed * Math.cos(wind.angleRad);

  // Apparent air velocity
  const relVx = nextVel.x - windVx;
  const relVy = nextVel.y;
  const relVz = nextVel.z - windVz;
  const airSpeed = Math.sqrt(relVx * relVx + relVy * relVy + relVz * relVz);

  // 1. Aerodynamic drag in flight
  if (!state.isGrounded && airSpeed > 0.01) {
    const dragForce = 0.5 * AIR_DENSITY * airSpeed * airSpeed * BALL_AREA * getDragCoefficient(airSpeed);
    const dragAcc = dragForce / BALL_MASS;
    nextVel.x -= (relVx / airSpeed) * dragAcc * dt;
    nextVel.y -= (relVy / airSpeed) * dragAcc * dt;
    nextVel.z -= (relVz / airSpeed) * dragAcc * dt;

    // 2. Magnus effect curve force: F_magnus = S * (spin x v)
    // Cross product: (spin.y * vz - spin.z * vy, spin.z * vx - spin.x * vz, spin.x * vy - spin.y * vx)
    const curveFx = (nextSpin.y * nextVel.z - nextSpin.z * nextVel.y) * MAGNUS_FACTOR;
    const curveFy = (nextSpin.z * nextVel.x - nextSpin.x * nextVel.z) * MAGNUS_FACTOR;
    const curveFz = (nextSpin.x * nextVel.y - nextSpin.y * nextVel.x) * MAGNUS_FACTOR;

    nextVel.x += (curveFx / BALL_MASS) * dt;
    nextVel.y += (curveFy / BALL_MASS) * dt;
    nextVel.z += (curveFz / BALL_MASS) * dt;

    // Spin decays slowly in air
    nextSpin.x *= Math.max(0, 1 - 0.25 * dt);
    nextSpin.y *= Math.max(0, 1 - 0.3 * dt);
    nextSpin.z *= Math.max(0, 1 - 0.25 * dt);
  }

  // 3. Gravity
  nextVel.y += GRAVITY * dt;

  // Integrate position
  nextPos.x += nextVel.x * dt;
  nextPos.y += nextVel.y * dt;
  nextPos.z += nextVel.z * dt;

  // Check obstacle collisions (Trees & Rocks)
  for (const tree of hole.trees) {
    const tScale = tree.scale || 1.0;
    const trunkRadius = 0.55 * tScale;
    const dx = nextPos.x - tree.x;
    const dz = nextPos.z - tree.z;
    const distSq = dx * dx + dz * dz;
    if (distSq < (trunkRadius + BALL_RADIUS) * (trunkRadius + BALL_RADIUS)) {
      // Elastic trunk bounce
      const dist = Math.sqrt(distSq) || 0.01;
      const nx = dx / dist;
      const nz = dz / dist;
      const dot = nextVel.x * nx + nextVel.z * nz;
      if (dot < 0) {
        nextVel.x -= 1.6 * dot * nx;
        nextVel.z -= 1.6 * dot * nz;
        nextPos.x = tree.x + nx * (trunkRadius + BALL_RADIUS + 0.05);
        nextPos.z = tree.z + nz * (trunkRadius + BALL_RADIUS + 0.05);
        events.hitObstacle = true;
        events.impactSpeed = Math.sqrt(nextVel.x * nextVel.x + nextVel.z * nextVel.z);
      }
    }
  }

  for (const rock of hole.rocks) {
    const rScale = rock.scale || 1.0;
    const rockRadius = 0.8 * rScale;
    const dx = nextPos.x - rock.x;
    const dz = nextPos.z - rock.z;
    const distSq = dx * dx + dz * dz;
    if (distSq < (rockRadius + BALL_RADIUS) * (rockRadius + BALL_RADIUS)) {
      const dist = Math.sqrt(distSq) || 0.01;
      const nx = dx / dist;
      const nz = dz / dist;
      const dot = nextVel.x * nx + nextVel.z * nz;
      if (dot < 0) {
        nextVel.x -= 1.5 * dot * nx;
        nextVel.z -= 1.5 * dot * nz;
        nextPos.x = rock.x + nx * (rockRadius + BALL_RADIUS + 0.05);
        nextPos.z = rock.z + nz * (rockRadius + BALL_RADIUS + 0.05);
        events.hitObstacle = true;
        events.impactSpeed = Math.sqrt(nextVel.x * nextVel.x + nextVel.z * nextVel.z);
      }
    }
  }

  // 4. Ground collision and terrain interaction
  const terrainH = getTerrainHeight(hole, nextPos.x, nextPos.z);
  const currentSurface = getSurfaceLie(hole, nextPos.x, nextPos.z);
  events.surface = currentSurface;

  // Flagstick pin pole constant
  const PIN_RADIUS = 0.025; // 2.5cm radius flagstick pole

  // FootGolf Cup & Flagstick interaction
  const cupX = hole.pinPosition.x;
  const cupZ = hole.pinPosition.z;
  const cupDx = nextPos.x - cupX;
  const cupDz = nextPos.z - cupZ;
  const distToCup = Math.sqrt(cupDx * cupDx + cupDz * cupDz);

  if (distToCup <= CUP_RADIUS + BALL_RADIUS) {
    const groundSpeed = Math.sqrt(nextVel.x * nextVel.x + nextVel.z * nextVel.z);

    // Direct Flagstick Pin collision: ball hits the pole directly
    if (distToCup <= PIN_RADIUS + BALL_RADIUS && nextPos.y <= hole.pinPosition.y + 2.45) {
      events.hitPin = true;
      events.hitObstacle = true;
      events.impactSpeed = groundSpeed;

      const pinDist = distToCup || 0.001;
      const nx = cupDx / pinDist;
      const nz = cupDz / pinDist;
      const normalDot = nextVel.x * nx + nextVel.z * nz;

      if (normalDot < 0) {
        nextVel.x -= 1.65 * normalDot * nx;
        nextVel.z -= 1.65 * normalDot * nz;
      }

      // Flagstick absorbs forward velocity and drops vertical momentum downward
      nextVel.x *= 0.42;
      nextVel.z *= 0.42;
      nextVel.y = Math.min(nextVel.y, 0.25);

      const postHitSpeed = Math.sqrt(nextVel.x * nextVel.x + nextVel.z * nextVel.z);

      // Flagstick capture: if moderate or slow kick strikes pin within cup rim, drops straight into hole!
      if (postHitSpeed < 3.8 && distToCup < CUP_RADIUS) {
        nextPos.x = cupX;
        nextPos.z = cupZ;
        nextPos.y = hole.pinPosition.y - 0.22;
        nextVel.x = 0;
        nextVel.y = 0;
        nextVel.z = 0;
        events.holed = true;
        return {
          state: {
            ...state,
            position: nextPos,
            velocity: nextVel,
            isGrounded: true,
            isRolling: false,
            isSleeping: true,
            inHole: true,
            lie: 'green',
          },
          events,
        };
      } else {
        // Deflect slightly outside the pole
        nextPos.x = cupX + nx * (PIN_RADIUS + BALL_RADIUS + 0.02);
        nextPos.z = cupZ + nz * (PIN_RADIUS + BALL_RADIUS + 0.02);
      }
    } else if (distToCup < CUP_RADIUS) {
      // Inside cup rim (without direct pin strike)
      // Finesse expands the cup capture speed threshold (4.2 m/s up to 4.74 m/s at level 10)
      const captureThreshold = 4.2 + (finesseLevel - 1) * 0.06;
      if (groundSpeed < captureThreshold) {
        // Drop smoothly into cup!
        nextPos.x = cupX;
        nextPos.z = cupZ;
        nextPos.y = hole.pinPosition.y - 0.22;
        nextVel.x = 0;
        nextVel.y = 0;
        nextVel.z = 0;
        events.holed = true;
        return {
          state: {
            ...state,
            position: nextPos,
            velocity: nextVel,
            isGrounded: true,
            isRolling: false,
            isSleeping: true,
            inHole: true,
            lie: 'green',
          },
          events,
        };
      } else {
        // High speed or edge glance: ball catches cup rim and lips out!
        events.hitObstacle = true;
        events.lippedOut = true;
        events.impactSpeed = groundSpeed;

        const pinDist = distToCup || 0.001;
        const nx = cupDx / pinDist;
        const nz = cupDz / pinDist;
        // Tangent unit vector around rim
        const tx = -nz;
        const tz = nx;
        const dotT = nextVel.x * tx + nextVel.z * tz;
        const signT = dotT >= 0 ? 1 : -1;

        // Lip friction burns ~38% of kinetic energy while spinning around rim
        const deflectedSpeed = groundSpeed * 0.62;
        nextVel.x = tx * signT * deflectedSpeed + nx * 0.55;
        nextVel.z = tz * signT * deflectedSpeed + nz * 0.55;

        // Displace ball to outside lip edge
        nextPos.x = cupX + nx * (CUP_RADIUS + 0.03);
        nextPos.z = cupZ + nz * (CUP_RADIUS + 0.03);
      }
    } else {
      // Cup gravity lip pull: gently curves rolling ball into hole
      const pullForce = 3.2 * (1 - distToCup / (CUP_RADIUS + BALL_RADIUS));
      nextVel.x -= (cupDx / distToCup) * pullForce * dt;
      nextVel.z -= (cupDz / distToCup) * pullForce * dt;
    }
  }

  // Water hazard detection
  if (currentSurface === 'water' && nextPos.y <= terrainH + BALL_RADIUS) {
    events.splashed = true;
    nextVel.x = 0;
    nextVel.y = -0.5;
    nextVel.z = 0;
    return {
      state: {
        ...state,
        position: nextPos,
        velocity: nextVel,
        isGrounded: true,
        isRolling: false,
        isSleeping: true,
        inWater: true,
        lie: 'water',
      },
      events,
    };
  }

  const surfaceProp = SURFACE_PROPERTIES[currentSurface] || SURFACE_PROPERTIES.rough;

  // Ball hits or rests on ground
  if (nextPos.y <= terrainH + BALL_RADIUS) {
    nextPos.y = terrainH + BALL_RADIUS;
    const normal = getTerrainNormal(hole, nextPos.x, nextPos.z);

    // Velocity relative to normal
    const normalVelocity = nextVel.x * normal.x + nextVel.y * normal.y + nextVel.z * normal.z;

    if (normalVelocity < -0.35) {
      // Bounce!
      events.bounced = true;
      events.impactSpeed = Math.abs(normalVelocity);

      const restitution = surfaceProp.restitution;
      nextVel.x -= (1 + restitution) * normalVelocity * normal.x;
      nextVel.y -= (1 + restitution) * normalVelocity * normal.y;
      nextVel.z -= (1 + restitution) * normalVelocity * normal.z;

      // Friction on bounce reduces lateral slide
      nextVel.x *= 0.85;
      nextVel.z *= 0.85;

      // Topspin conversion to forward boost on first bounce
      if (Math.abs(nextSpin.x) > 0.1 || Math.abs(nextSpin.z) > 0.1) {
        nextVel.x += nextSpin.z * 0.05;
        nextVel.z -= nextSpin.x * 0.05;
      }
    } else {
      // Rolling state
      state.isGrounded = true;
      nextVel.y = 0;

      // Slope gravity: ball accelerates down hill
      // Normal slope vector projection
      const slopeForceX = normal.x * 9.81 * 0.45;
      const slopeForceZ = normal.z * 9.81 * 0.45;
      nextVel.x += slopeForceX * dt;
      nextVel.z += slopeForceZ * dt;

      // Rolling friction
      const hSpeed = Math.sqrt(nextVel.x * nextVel.x + nextVel.z * nextVel.z);
      if (hSpeed > 0.01) {
        const frictionDecel = surfaceProp.rollingFriction * 9.81 * dt;
        const newSpeed = Math.max(0, hSpeed - frictionDecel);
        const ratio = newSpeed / hSpeed;
        nextVel.x *= ratio;
        nextVel.z *= ratio;

        // Ball comes to rest
        if (newSpeed < 0.04 && Math.abs(slopeForceX) < 0.05 && Math.abs(slopeForceZ) < 0.05) {
          nextVel.x = 0;
          nextVel.y = 0;
          nextVel.z = 0;
          events.stopped = true;
          return {
            state: {
              ...state,
              position: nextPos,
              velocity: { x: 0, y: 0, z: 0 },
              isGrounded: true,
              isRolling: false,
              isSleeping: true,
              lie: currentSurface,
              lastValidPosition: currentSurface === 'water' ? state.lastValidPosition : nextPos,
            },
            events,
          };
        }
      } else {
        nextVel.x = 0;
        nextVel.y = 0;
        nextVel.z = 0;
        events.stopped = true;
        return {
          state: {
            ...state,
            position: nextPos,
            velocity: { x: 0, y: 0, z: 0 },
            spin: { x: 0, y: 0, z: 0 },
            isGrounded: true,
            isRolling: false,
            isSleeping: true,
            lie: currentSurface,
            lastValidPosition: currentSurface === 'water' ? state.lastValidPosition : nextPos,
          },
          events,
        };
      }
    }
  } else {
    state.isGrounded = false;
  }

  const isStillRolling = Math.sqrt(nextVel.x * nextVel.x + nextVel.z * nextVel.z) > 0.05 && state.isGrounded;

  return {
    state: {
      ...state,
      position: nextPos,
      velocity: nextVel,
      spin: nextSpin,
      isGrounded: state.isGrounded,
      isRolling: isStillRolling,
      isSleeping: false,
      lie: currentSurface,
      lastValidPosition: currentSurface === 'water' ? state.lastValidPosition : nextPos,
    },
    events,
  };
}

/**
 * Predicts trajectory flight points for aim line HUD visualization.
 */
export function predictTrajectory(
  startPos: Vector3D,
  kickType: KickType,
  power: number,
  aimAngleRad: number,
  spin: SpinControl,
  currentLie: SurfaceType,
  hole: HoleData,
  wind: { speed: number; angleRad: number }
): Vector3D[] {
  const sim = calculateKickVelocity(kickType, power, aimAngleRad, spin, currentLie);
  let pos = { ...startPos };
  let vel = { ...sim.velocity };
  let spinVec = { ...sim.spin };
  const points: Vector3D[] = [{ ...pos }];

  const dt = 0.05;
  const windVx = wind.speed * Math.sin(wind.angleRad);
  const windVz = wind.speed * Math.cos(wind.angleRad);

  for (let i = 0; i < 45; i++) {
    // Air resistance & Magnus
    const relVx = vel.x - windVx;
    const relVy = vel.y;
    const relVz = vel.z - windVz;
    const speed = Math.sqrt(relVx * relVx + relVy * relVy + relVz * relVz);

    if (speed > 0.05) {
      const drag = 0.5 * AIR_DENSITY * speed * speed * BALL_AREA * DRAG_COEFFICIENT;
      const acc = drag / BALL_MASS;
      vel.x -= (relVx / speed) * acc * dt;
      vel.y -= (relVy / speed) * acc * dt;
      vel.z -= (relVz / speed) * acc * dt;

      const curveFx = (spinVec.y * vel.z - spinVec.z * vel.y) * MAGNUS_FACTOR;
      const curveFz = (spinVec.x * vel.y - spinVec.y * vel.x) * MAGNUS_FACTOR;
      vel.x += (curveFx / BALL_MASS) * dt;
      vel.z += (curveFz / BALL_MASS) * dt;
    }

    vel.y += GRAVITY * dt;
    pos.x += vel.x * dt;
    pos.y += vel.y * dt;
    pos.z += vel.z * dt;

    const terrainY = getTerrainHeight(hole, pos.x, pos.z);
    if (pos.y <= terrainY + BALL_RADIUS) {
      pos.y = terrainY + BALL_RADIUS;
      points.push({ ...pos });
      break;
    }

    points.push({ ...pos });
  }

  return points;
}

export type { FlickGestureData, FlickCalculationResult };

/**
 * Translates touch/mouse flick gesture into shot speed, aim deviation, and slice curl
 */
export function calculateFlickShot(
  gesture: FlickGestureData,
  baseAimAngleRad: number,
  englishSpin: SpinControl,
  kickType: KickType,
  currentLie: SurfaceType = 'fairway',
  attributes?: PlayerAttributes
): FlickCalculationResult {
  const dx = gesture.endX - gesture.startX;
  const dy = gesture.startY - gesture.endY; // screen Y inverted: upward swipe is positive
  const dt = Math.max(30, Math.min(650, gesture.durationMs));

  const dist = Math.sqrt(dx * dx + dy * dy);
  const pxPerMs = dist / dt;

  // Power mapping based on speed and kick type
  // A fast flick yields maximum power; a gentle swipe yields a touch shot
  const speedNormalized = Math.pow(pxPerMs / 2.1, 0.92);
  const power = Math.max(0.15, Math.min(1.0, speedNormalized));

  const maxKmh = kickType === 'drive' ? 122 : kickType === 'chip' ? 78 : 46;
  const speedKmh = Math.round(power * maxKmh);

  // Swipe angle deviation relative to straight upward swipe
  const swipeAngleRad = Math.atan2(dx, Math.max(15, dy));
  const aimAngleOffset = Math.max(-0.35, Math.min(0.35, swipeAngleRad * 0.7));
  const effectiveAimAngleRad = baseAimAngleRad + aimAngleOffset;

  // Slice / Hook from lateral motion:
  // Swiping towards the right introduces a slice curl (positive spin.side)
  // Swiping towards the left introduces a hook curl (negative spin.side)
  const rawSlice = (dx / Math.max(45, dy)) * 1.2;
  const flickSlice = Math.max(-1.0, Math.min(1.0, rawSlice));

  // Combine natural flick curl with player-selected English!
  // Player-selected English (topspin / backspin / sidespin) is preserved and blended
  const combinedSide = Math.max(-1.0, Math.min(1.0, englishSpin.side + flickSlice * 0.65));
  const combinedTop = englishSpin.top;
  const effectiveSpin: SpinControl = { side: combinedSide, top: combinedTop };

  // Accuracy attribute expands the sweet spot window and dampens accidental lateral error
  const accuracyLevel = attributes ? attributes.accuracy : 1;
  const straightThreshold = 0.12 + (accuracyLevel - 1) * 0.015;
  const powerPureThreshold = Math.max(0.60, 0.72 - (accuracyLevel - 1) * 0.012);

  // Pure strike detection: swift, confident upward flick with clean rhythm
  const isStraight = Math.abs(flickSlice) <= straightThreshold;
  const isPure = power >= powerPureThreshold && isStraight;
  const isGreat = (power >= 0.55 && Math.abs(flickSlice) <= straightThreshold + 0.10) || isPure;
  const isPush = !isPure && !isGreat && flickSlice > 0.35;
  const isPull = !isPure && !isGreat && flickSlice < -0.35;

  const strikeRating: 'pure' | 'great' | 'solid' | 'push' | 'pull' = isPure
    ? 'pure'
    : isGreat
    ? 'great'
    : isPush
    ? 'push'
    : isPull
    ? 'pull'
    : 'solid';

  const strikeLabel =
    strikeRating === 'pure'
      ? '⚡ PURE SWEET STRIKE!'
      : strikeRating === 'great'
      ? '🎯 CRISP CONTACT'
      : strikeRating === 'push'
      ? '↷ PUSH SLICE'
      : strikeRating === 'pull'
      ? '↶ PULL HOOK'
      : '⚽ SOLID STRIKE';

  const finalPower = isPure ? Math.min(1.0, power * 1.04) : power;

  const kickVel = calculateKickVelocity(
    kickType,
    finalPower,
    effectiveAimAngleRad,
    effectiveSpin,
    currentLie,
    attributes
  );

  return {
    power: finalPower,
    aimAngleOffset,
    effectiveAimAngleRad,
    flickSlice,
    effectiveSpin,
    speedKmh,
    kickVelocity: kickVel,
    isSweetSpot: isPure,
    strikeRating,
    strikeLabel,
  };
}

export interface PuttingReadPoint {
  position: Vector3D;
  slopeVector: Vector3D;
  breakSide: 'left' | 'right' | 'straight';
  breakDegrees: number;
}

export interface PuttingReadResult {
  points: PuttingReadPoint[];
  totalBreakDeg: number;
  elevationDeltaMeters: number;
  breakDirection: 'left' | 'right' | 'straight';
  suggestedPower: number;
  stopsShortDistance: number;
  reachesCup: boolean;
  rollDistanceMeters: number;
}

/**
 * Calculates contour-aware putting read line with slope break angles and beaded roll path
 */
export function generatePuttingReadLine(
  startPos: Vector3D,
  targetPos: Vector3D,
  aimAngleRad: number,
  power: number,
  hole: HoleData
): PuttingReadResult {
  const points: PuttingReadPoint[] = [];
  let pos = { ...startPos };
  const dx = targetPos.x - startPos.x;
  const dz = targetPos.z - startPos.z;
  const distToPin = Math.sqrt(dx * dx + dz * dz);
  const elevationDelta = targetPos.y - startPos.y;

  // 1. Calculate physics-grounded suggested power to reach cup (+0.35m past the pin)
  // Work-energy theorem: 1/2 m v0^2 = m g (mu * s + h)
  // v0^2 = 2 * 9.81 * (0.052 * (distToPin + 0.35) + elevationDelta)
  // For putt: v0 = power * PUTT_MAX_SPEED_MPS => PUTT_MAX_SPEED_MPS^2 * power^2 = 1.02024 * (distToPin + 0.35) + 19.62 * elevationDelta
  const targetDist = distToPin + 0.35;
  const workReq = 1.02024 * targetDist + 19.62 * elevationDelta;
  const suggestedPower = Math.max(
    0.08,
    Math.min(1.0, Math.sqrt(Math.max(0.01, workReq) / (PUTT_MAX_SPEED_MPS * PUTT_MAX_SPEED_MPS)))
  );

  // 2. Simulate projected ball roll based on user's selected power
  const sim = calculateKickVelocity('putt', power, aimAngleRad, { side: 0, top: 0 }, 'green');
  let vx = sim.velocity.x;
  let vz = sim.velocity.z;

  const dt = 0.04;
  let cumSlopeAngle = 0;
  let pointCount = 0;
  let reachedCup = false;
  let totalRollDist = 0;
  let prevPos = { ...startPos };

  points.push({
    position: { ...startPos },
    slopeVector: { x: 0, y: 0, z: 0 },
    breakSide: 'straight',
    breakDegrees: 0,
  });

  for (let i = 0; i < 140; i++) {
    const terrainH = getTerrainHeight(hole, pos.x, pos.z);
    pos.y = terrainH + BALL_RADIUS + 0.02;

    const normal = getTerrainNormal(hole, pos.x, pos.z);
    const slopeForceX = normal.x * 9.81 * 0.45;
    const slopeForceZ = normal.z * 9.81 * 0.45;

    vx += slopeForceX * dt;
    vz += slopeForceZ * dt;

    const curSpeed = Math.sqrt(vx * vx + vz * vz);
    if (curSpeed < 0.04) break;

    const friction = 0.052 * 9.81 * dt;
    const newSpeed = Math.max(0, curSpeed - friction);
    vx = (vx / curSpeed) * newSpeed;
    vz = (vz / curSpeed) * newSpeed;

    pos.x += vx * dt;
    pos.z += vz * dt;

    totalRollDist += Math.hypot(pos.x - prevPos.x, pos.z - prevPos.z);
    prevPos = { ...pos };

    const aimDirX = Math.sin(aimAngleRad);
    const aimDirZ = Math.cos(aimAngleRad);
    const perpX = -aimDirZ;
    const perpZ = aimDirX;
    const lateralSlope = normal.x * perpX + normal.z * perpZ;

    const slopeAngleDeg = (Math.asin(Math.max(-1, Math.min(1, lateralSlope))) * 180) / Math.PI;
    cumSlopeAngle += slopeAngleDeg;
    pointCount++;

    const breakSide: 'left' | 'right' | 'straight' =
      slopeAngleDeg > 0.25 ? 'right' : slopeAngleDeg < -0.25 ? 'left' : 'straight';

    points.push({
      position: { ...pos },
      slopeVector: { x: slopeForceX, y: 0, z: slopeForceZ },
      breakSide,
      breakDegrees: Math.round(slopeAngleDeg * 10) / 10,
    });

    const toCup = Math.hypot(pos.x - targetPos.x, pos.z - targetPos.z);
    if (toCup <= CUP_RADIUS * 1.15) {
      reachedCup = true;
      break;
    }
  }

  const avgBreak = pointCount > 0 ? cumSlopeAngle / pointCount : 0;
  const breakDirection: 'left' | 'right' | 'straight' =
    avgBreak > 0.3 ? 'right' : avgBreak < -0.3 ? 'left' : 'straight';

  const finalPos = points[points.length - 1].position;
  const finalDistToCup = Math.hypot(finalPos.x - targetPos.x, finalPos.z - targetPos.z);
  const stopsShortDistance = reachedCup ? 0 : Math.round(finalDistToCup * 10) / 10;

  return {
    points,
    totalBreakDeg: Math.round(avgBreak * 10) / 10,
    elevationDeltaMeters: Math.round(elevationDelta * 10) / 10,
    breakDirection,
    suggestedPower: Math.round(suggestedPower * 100) / 100,
    stopsShortDistance,
    reachesCup: reachedCup,
    rollDistanceMeters: Math.round(totalRollDist * 10) / 10,
  };
}
