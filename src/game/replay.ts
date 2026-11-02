/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { KickType, Vector3D } from '../types';

export interface ReplayKeyframe {
  time: number; // in seconds
  position: Vector3D;
  velocity: Vector3D;
  spin?: Vector3D;
}

export interface ReplayShotInfo {
  holeNumber: number;
  strokeNumber: number;
  kickType: KickType;
  distanceMeters: number;
  isHoleOut: boolean;
  scoreDelta?: number;
}

export interface ReplayTrack {
  keyframes: ReplayKeyframe[];
  duration: number;
  shotInfo: ReplayShotInfo;
}

export class ReplayRecorder {
  private keyframes: ReplayKeyframe[] = [];
  private lastSampleTime = -1;
  private minInterval = 0.033; // ~30 fps sampling max for efficient storage
  private shotInfo: ReplayShotInfo;

  constructor(shotInfo: ReplayShotInfo) {
    this.shotInfo = shotInfo;
  }

  public recordFrame(time: number, position: Vector3D, velocity: Vector3D, spin?: Vector3D) {
    if (this.lastSampleTime >= 0 && time - this.lastSampleTime < this.minInterval) {
      return;
    }

    this.keyframes.push({
      time,
      position: { x: position.x, y: position.y, z: position.z },
      velocity: { x: velocity.x, y: velocity.y, z: velocity.z },
      spin: spin ? { x: spin.x, y: spin.y, z: spin.z } : undefined,
    });
    this.lastSampleTime = time;
  }

  public finalize(totalDuration: number, finalDistance?: number, isHoleOut?: boolean): ReplayTrack | null {
    if (this.keyframes.length < 2) return null;

    const duration = Math.max(totalDuration, this.keyframes[this.keyframes.length - 1].time);
    return {
      keyframes: [...this.keyframes],
      duration,
      shotInfo: {
        ...this.shotInfo,
        distanceMeters: finalDistance !== undefined ? finalDistance : this.shotInfo.distanceMeters,
        isHoleOut: isHoleOut !== undefined ? isHoleOut : this.shotInfo.isHoleOut,
      },
    };
  }
}

/**
 * Pure interpolation function to sample a replay track at any elapsed timestamp
 */
export function sampleReplayAt(
  track: ReplayTrack,
  time: number
): { position: Vector3D; velocity: Vector3D; finished: boolean } {
  const { keyframes, duration } = track;
  if (!keyframes || keyframes.length === 0) {
    return {
      position: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      finished: true,
    };
  }

  if (time <= keyframes[0].time) {
    return {
      position: { ...keyframes[0].position },
      velocity: { ...keyframes[0].velocity },
      finished: false,
    };
  }

  const last = keyframes[keyframes.length - 1];
  if (time >= last.time || time >= duration) {
    return {
      position: { ...last.position },
      velocity: { x: 0, y: 0, z: 0 },
      finished: true,
    };
  }

  // Find surrounding keyframe bracket
  let i = 0;
  while (i < keyframes.length - 1 && keyframes[i + 1].time < time) {
    i++;
  }

  const k0 = keyframes[i];
  const k1 = keyframes[i + 1];
  const dt = k1.time - k0.time;
  const t = dt > 0.0001 ? Math.min(1, Math.max(0, (time - k0.time) / dt)) : 0;

  // Smooth Hermite / linear blend
  return {
    position: {
      x: k0.position.x + (k1.position.x - k0.position.x) * t,
      y: k0.position.y + (k1.position.y - k0.position.y) * t,
      z: k0.position.z + (k1.position.z - k0.position.z) * t,
    },
    velocity: {
      x: k0.velocity.x + (k1.velocity.x - k0.velocity.x) * t,
      y: k0.velocity.y + (k1.velocity.y - k0.velocity.y) * t,
      z: k0.velocity.z + (k1.velocity.z - k0.velocity.z) * t,
    },
    finished: false,
  };
}

/**
 * Computes broadcast camera positioning for instant replays
 */
export function getReplayCameraPose(
  ballPos: Vector3D,
  ballVel: Vector3D,
  pinPos: Vector3D,
  cameraAngle: 'broadcast' | 'follow' | 'reverse_pin'
): { camPos: Vector3D; lookAt: Vector3D } {
  const speed = Math.hypot(ballVel.x, ballVel.z);

  if (cameraAngle === 'reverse_pin') {
    // Reverse broadcast angle from near the pin looking back at the incoming ball
    const toPinX = pinPos.x - ballPos.x;
    const toPinZ = pinPos.z - ballPos.z;
    const distToPin = Math.hypot(toPinX, toPinZ);
    const offset = Math.min(6, Math.max(2.5, distToPin * 0.25));

    return {
      camPos: {
        x: pinPos.x + 1.2,
        y: pinPos.y + 1.8,
        z: pinPos.z - offset,
      },
      lookAt: {
        x: ballPos.x,
        y: ballPos.y + 0.3,
        z: ballPos.z,
      },
    };
  }

  if (cameraAngle === 'broadcast') {
    // Low sideline broadcast television camera with forward tracking pan
    const sideOffset = 8.5;
    return {
      camPos: {
        x: ballPos.x + sideOffset,
        y: ballPos.y + 2.8,
        z: ballPos.z - 4.5,
      },
      lookAt: {
        x: ballPos.x + (speed > 1 ? (ballVel.x / speed) * 3 : 0),
        y: ballPos.y + 0.2,
        z: ballPos.z + (speed > 1 ? (ballVel.z / speed) * 3 : 0),
      },
    };
  }

  // Follow tracking camera
  const followDist = 5.8;
  const heading = Math.atan2(ballVel.x, ballVel.z);
  return {
    camPos: {
      x: ballPos.x - Math.sin(heading) * followDist,
      y: ballPos.y + 2.4,
      z: ballPos.z - Math.cos(heading) * followDist,
    },
    lookAt: {
      x: ballPos.x + (ballVel.x / Math.max(speed, 0.1)) * 4,
      y: ballPos.y + 0.3,
      z: ballPos.z + (ballVel.z / Math.max(speed, 0.1)) * 4,
    },
  };
}
