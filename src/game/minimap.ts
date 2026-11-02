/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { HoleData, KickType, SurfaceType, Vector3D } from '../types';
import { getEstimatedKickDistance } from './physics';

export interface HoleBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  width: number;
  length: number;
}

/**
 * Computes world bounding box for a hole encompassing tee, pin, and all terrain features with comfortable margins.
 */
export function calculateHoleBounds(hole: HoleData, margin = 18): HoleBounds {
  let minX = Math.min(hole.teePosition.x, hole.pinPosition.x);
  let maxX = Math.max(hole.teePosition.x, hole.pinPosition.x);
  let minZ = Math.min(hole.teePosition.z, hole.pinPosition.z);
  let maxZ = Math.max(hole.teePosition.z, hole.pinPosition.z);

  // Expand with fairways
  if (hole.fairways && hole.fairways.length > 0) {
    for (const fw of hole.fairways) {
      minX = Math.min(minX, fw.x - fw.rx);
      maxX = Math.max(maxX, fw.x + fw.rx);
      minZ = Math.min(minZ, fw.z - fw.rz);
      maxZ = Math.max(maxZ, fw.z + fw.rz);
    }
  }

  // Expand with greens
  if (hole.greens && hole.greens.length > 0) {
    for (const gr of hole.greens) {
      minX = Math.min(minX, gr.x - gr.radius);
      maxX = Math.max(maxX, gr.x + gr.radius);
      minZ = Math.min(minZ, gr.z - gr.radius);
      maxZ = Math.max(maxZ, gr.z + gr.radius);
    }
  }

  // Expand with waters
  if (hole.waters && hole.waters.length > 0) {
    for (const wt of hole.waters) {
      minX = Math.min(minX, wt.x - wt.rx);
      maxX = Math.max(maxX, wt.x + wt.rx);
      minZ = Math.min(minZ, wt.z - wt.rz);
      maxZ = Math.max(maxZ, wt.z + wt.rz);
    }
  }

  // Expand with bunkers
  if (hole.bunkers && hole.bunkers.length > 0) {
    for (const bk of hole.bunkers) {
      minX = Math.min(minX, bk.x - bk.rx);
      maxX = Math.max(maxX, bk.x + bk.rx);
      minZ = Math.min(minZ, bk.z - bk.rz);
      maxZ = Math.max(maxZ, bk.z + bk.rz);
    }
  }

  minX -= margin;
  maxX += margin;
  minZ -= margin;
  maxZ += margin;

  // Enforce minimum width so narrow holes still have a clear corridor
  const width = Math.max(40, maxX - minX);
  const length = Math.max(50, maxZ - minZ);

  return {
    minX,
    maxX: minX + width,
    minZ,
    maxZ: minZ + length,
    width,
    length,
  };
}

/**
 * Projects 3D world coordinate (x, z) to 2D mini-map viewport coordinates.
 * Mini-map is oriented with Pin (highest Z) at the top and Tee (lowest Z) at the bottom.
 */
export function worldToMapCoordinates(
  pos: { x: number; z: number },
  bounds: HoleBounds,
  viewWidth: number,
  viewHeight: number,
  padding = 16
): { mapX: number; mapY: number } {
  const innerW = viewWidth - 2 * padding;
  const innerH = viewHeight - 2 * padding;

  // In 3D looking down +Z (from tee at bottom to pin at top),
  // -X is to the player's right, and +X is to the player's left.
  // Mapping bounds.maxX (left in 3D) -> 0 and bounds.minX (right in 3D) -> 1 ensures
  // the mini-map orientation matches the player's 3D perspective.
  const normX = (bounds.maxX - pos.x) / (bounds.width || 1);
  const normZ = (pos.z - bounds.minZ) / (bounds.length || 1);

  // mapX increases left to right
  const mapX = padding + normX * innerW;
  // mapY increases top to bottom; highest Z (pin) is at the top (low mapY), lowest Z (tee) at bottom (high mapY)
  const mapY = viewHeight - padding - normZ * innerH;

  return { mapX, mapY };
}

/**
 * Converts mini-map click/touch coordinate back to 3D world coordinate (worldX, worldZ)
 */
export function mapToWorldCoordinates(
  mapPos: { mapX: number; mapY: number },
  bounds: HoleBounds,
  viewWidth: number,
  viewHeight: number,
  padding = 16
): { worldX: number; worldZ: number } {
  const innerW = viewWidth - 2 * padding;
  const innerH = viewHeight - 2 * padding;

  const clampedX = Math.max(padding, Math.min(viewWidth - padding, mapPos.mapX));
  const clampedY = Math.max(padding, Math.min(viewHeight - padding, mapPos.mapY));

  const normX = (clampedX - padding) / (innerW || 1);
  const normZ = (viewHeight - padding - clampedY) / (innerH || 1);

  const worldX = bounds.maxX - normX * bounds.width;
  const worldZ = bounds.minZ + normZ * bounds.length;

  return { worldX, worldZ };
}

/**
 * Estimates projected ball landing position based on kick type, power, and lie

 */
export function calculateAimTargetPoint(
  ballPos: Vector3D,
  aimAngleRad: number,
  power: number,
  kickType: KickType,
  currentLie: SurfaceType = 'fairway'
): { x: number; z: number; estimatedDistanceMeters: number } {
  const estimate = getEstimatedKickDistance(kickType, power, currentLie);
  const estimatedDist = Math.max(3, estimate.totalMeters);

  const targetX = ballPos.x + Math.sin(aimAngleRad) * estimatedDist;
  const targetZ = ballPos.z + Math.cos(aimAngleRad) * estimatedDist;

  return {
    x: targetX,
    z: targetZ,
    estimatedDistanceMeters: Math.round(estimatedDist),
  };
}

