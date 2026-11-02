/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CourseData } from '../types';

/**
 * Per-course lighting and sky settings. The physically based sky (three's Sky shader)
 * is baked once per course into a prefiltered environment map that also lights the scene.
 */
export interface AtmosphereSettings {
  sunElevationDeg: number;
  sunAzimuthDeg: number;
  turbidity: number;
  rayleigh: number;
  mieCoefficient: number;
  mieDirectionalG: number;
  sunColor: string;
  sunIntensity: number;
  hemiIntensity: number;
  fogDensity: number;
  exposure: number;
  /** Scales image-based light from the sky (the sky is HDR, roughly 3-5x white). */
  envIntensity: number;
  /** Scales the visible sky background. */
  backgroundIntensity: number;
}

const DEFAULTS: AtmosphereSettings = {
  sunElevationDeg: 42,
  sunAzimuthDeg: 135,
  turbidity: 4,
  rayleigh: 1.4,
  mieCoefficient: 0.004,
  mieDirectionalG: 0.8,
  sunColor: '#fff4e0',
  sunIntensity: 2.2,
  hemiIntensity: 0.35,
  fogDensity: 0.0026,
  exposure: 0.85,
  envIntensity: 0.18,
  backgroundIntensity: 0.55,
};

const BY_THEME: Record<string, Partial<AtmosphereSettings>> = {
  parkland: {},
  desert: {
    // Low, warm late-afternoon sun
    sunElevationDeg: 11,
    sunAzimuthDeg: 210,
    turbidity: 9,
    rayleigh: 2.6,
    mieCoefficient: 0.008,
    sunColor: '#ffc58a',
    sunIntensity: 2.0,
    fogDensity: 0.0032,
    exposure: 0.95,
  },
  alpine: {
    // High, crisp mountain light
    sunElevationDeg: 55,
    sunAzimuthDeg: 160,
    turbidity: 2.2,
    rayleigh: 1.0,
    sunColor: '#ffffff',
    sunIntensity: 2.0,
    fogDensity: 0.0018,
    exposure: 0.6,
    envIntensity: 0.14,
    backgroundIntensity: 0.45,
  },
  japanese_garden: {
    // Soft, slightly hazy spring light
    sunElevationDeg: 30,
    sunAzimuthDeg: 120,
    turbidity: 6,
    rayleigh: 1.8,
    sunColor: '#ffe9d6',
    sunIntensity: 1.9,
    fogDensity: 0.003,
    exposure: 0.9,
  },
};

export function getAtmosphere(course: Pick<CourseData, 'theme'>): AtmosphereSettings {
  return { ...DEFAULTS, ...(BY_THEME[course.theme] ?? {}) };
}

/** Unit vector pointing toward the sun (y up), from elevation and azimuth in degrees. */
export function sunDirection(settings: Pick<AtmosphereSettings, 'sunElevationDeg' | 'sunAzimuthDeg'>): {
  x: number;
  y: number;
  z: number;
} {
  const phi = ((90 - settings.sunElevationDeg) * Math.PI) / 180;
  const theta = (settings.sunAzimuthDeg * Math.PI) / 180;
  return {
    x: Math.sin(phi) * Math.sin(theta),
    y: Math.cos(phi),
    z: Math.sin(phi) * Math.cos(theta),
  };
}
