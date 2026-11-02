/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { HoleData, Vector3D } from '../types';
import { getTerrainHeight, getTerrainNormal } from './physics';

export interface GreenGridNode {
  x: number;
  y: number;
  z: number;
  slopeGradePct: number; // e.g. 1.5% - 4.5%
  fallVector: { x: number; z: number }; // normalized downhill fall line
  inGreenRadius: boolean;
}

export interface GreenGridSpec {
  nodes: GreenGridNode[];
  contourLines: Vector3D[][];
  minY: number;
  maxY: number;
  avgGradePct: number;
}

/**
 * Generates an undulating topography grid across the putting green
 */
export function generateGreenGrid(
  hole: HoleData,
  gridStep = 1.0,
  paddingMeters = 2.0
): GreenGridSpec {
  const primaryGreen = (hole.greens && hole.greens.length > 0)
    ? hole.greens[0]
    : { x: hole.pinPosition.x, z: hole.pinPosition.z, radius: 12 };

  const greenCenterX = primaryGreen.x;
  const greenCenterZ = primaryGreen.z;
  const greenRadius = primaryGreen.radius || 12;
  const extent = greenRadius + paddingMeters;

  const nodes: GreenGridNode[] = [];
  const contourLines: Vector3D[][] = [];
  let minY = Infinity;
  let maxY = -Infinity;
  let totalGrade = 0;

  const minX = greenCenterX - extent;
  const maxX = greenCenterX + extent;
  const minZ = greenCenterZ - extent;
  const maxZ = greenCenterZ + extent;

  for (let z = minZ; z <= maxZ; z += gridStep) {
    const rowPoints: Vector3D[] = [];
    for (let x = minX; x <= maxX; x += gridStep) {
      const distFromCenter = Math.hypot(x - greenCenterX, z - greenCenterZ);
      if (distFromCenter <= extent) {
        const y = getTerrainHeight(hole, x, z);
        const norm = getTerrainNormal(hole, x, z);

        // Grade percentage: lateral slope magnitude vs vertical
        const lateralSlope = Math.hypot(norm.x, norm.z);
        const gradePct = Math.round(lateralSlope * 1000) / 10; // e.g. 2.4%

        // Downhill direction vector (opposite of normal lateral vector)
        const fallX = lateralSlope > 0.001 ? -norm.x / lateralSlope : 0;
        const fallZ = lateralSlope > 0.001 ? -norm.z / lateralSlope : 0;

        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        totalGrade += gradePct;

        nodes.push({
          x,
          y,
          z,
          slopeGradePct: gradePct,
          fallVector: { x: fallX, z: fallZ },
          inGreenRadius: distFromCenter <= greenRadius,
        });

        rowPoints.push({ x, y: y + 0.03, z });
      }
    }
    if (rowPoints.length >= 2) {
      contourLines.push(rowPoints);
    }
  }

  // Also build column lines for cross grid
  for (let x = minX; x <= maxX; x += gridStep) {
    const colPoints: Vector3D[] = [];
    for (let z = minZ; z <= maxZ; z += gridStep) {
      const distFromCenter = Math.hypot(x - greenCenterX, z - greenCenterZ);
      if (distFromCenter <= extent) {
        const y = getTerrainHeight(hole, x, z);
        colPoints.push({ x, y: y + 0.03, z });
      }
    }
    if (colPoints.length >= 2) {
      contourLines.push(colPoints);
    }
  }

  const avgGradePct = nodes.length > 0 ? Math.round((totalGrade / nodes.length) * 10) / 10 : 0;

  return {
    nodes,
    contourLines,
    minY: minY === Infinity ? 0 : minY,
    maxY: maxY === -Infinity ? 0 : maxY,
    avgGradePct,
  };
}
