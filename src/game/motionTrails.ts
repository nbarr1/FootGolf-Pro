/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MotionTrailConfig, MotionTrailStyleId } from '../types';

export const DEFAULT_MOTION_TRAIL_CONFIGS: MotionTrailConfig[] = [
  {
    id: 'championship_gold',
    name: 'Championship Gold',
    description: 'Broadcast-grade tournament tracer flaring to fiery crimson on max power and cyan/magenta on spin.',
    baseColor: '#f59e0b',
    highPowerColor: '#ef4444',
    spinLeftColor: '#06b6d4',
    spinRightColor: '#ec4899',
    particleColor: '#fef08a',
    ribbonWidth: 0.16,
    unlocked: true,
  },
  {
    id: 'neon_emerald',
    name: 'Cyber Emerald',
    description: 'High-voltage laser green trail shifting to solar yellow on pure power and cobalt/amethyst on spin.',
    baseColor: '#10b981',
    highPowerColor: '#facc15',
    spinLeftColor: '#3b82f6',
    spinRightColor: '#a855f7',
    particleColor: '#6ee7b7',
    ribbonWidth: 0.18,
    unlocked: true,
  },
  {
    id: 'fire_vortex',
    name: 'Inferno Blaze',
    description: 'Molten magma ribbon superheating to white-hot plasma on max kick power with rose and solar curls.',
    baseColor: '#ea580c',
    highPowerColor: '#ffffff',
    spinLeftColor: '#f43f5e',
    spinRightColor: '#eab308',
    particleColor: '#fed7aa',
    ribbonWidth: 0.20,
    unlocked: true,
  },
  {
    id: 'ice_comet',
    name: 'Glacial Frost',
    description: 'Sub-zero crystalline tracer bursting into hyper-indigo on power and aurora teal/violet on curve.',
    baseColor: '#38bdf8',
    highPowerColor: '#818cf8',
    spinLeftColor: '#2dd4bf',
    spinRightColor: '#c084fc',
    particleColor: '#bae6fd',
    ribbonWidth: 0.16,
    unlocked: true,
  },
  {
    id: 'cosmic_violet',
    name: 'Cosmic Nebula',
    description: 'Deep galactic nebula ribbon radiating supernova pink on power and quantum turquoise on curve.',
    baseColor: '#8b5cf6',
    highPowerColor: '#f43f5e',
    spinLeftColor: '#06b6d4',
    spinRightColor: '#f59e0b',
    particleColor: '#ddd6fe',
    ribbonWidth: 0.18,
    unlocked: true,
  },
  {
    id: 'solar_flare',
    name: 'Hyper Sonic',
    description: 'Electrified supersonic stream with reactive chromatic Doppler shift from turbo red to warp indigo.',
    baseColor: '#eab308',
    highPowerColor: '#dc2626',
    spinLeftColor: '#10b981',
    spinRightColor: '#6366f1',
    particleColor: '#fef9c3',
    ribbonWidth: 0.22,
    unlocked: true,
  },
];

export function getMotionTrailPreset(id?: string): MotionTrailConfig {
  const found = DEFAULT_MOTION_TRAIL_CONFIGS.find((t) => t.id === id);
  return found ? { ...found } : { ...DEFAULT_MOTION_TRAIL_CONFIGS[0] };
}

/**
 * Converts hex color string to normalized RGB components [0, 1]
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleaned = hex.replace('#', '');
  const num = parseInt(cleaned, 16);
  if (isNaN(num)) return { r: 1, g: 0.8, b: 0.2 };
  return {
    r: ((num >> 16) & 255) / 255,
    g: ((num >> 8) & 255) / 255,
    b: (num & 255) / 255,
  };
}

/**
 * Calculates dynamic RGB color response based on applied power and spin
 * - Power: smoothly blends base color toward highPowerColor (with extra luminance on sweet-spot strikes)
 * - Spin: blends toward spinLeftColor (hook) or spinRightColor (slice)
 */
export function calculateDynamicTrailColor(
  config: MotionTrailConfig,
  power: number,
  sideSpin: number,
  topSpin: number = 0,
  isPureStrike: boolean = false
): { r: number; g: number; b: number } {
  const base = hexToRgb(config.baseColor);
  const powerCol = hexToRgb(config.highPowerColor);
  const spinL = hexToRgb(config.spinLeftColor);
  const spinR = hexToRgb(config.spinRightColor);

  let r = base.r;
  let g = base.g;
  let b = base.b;

  // 1. Power Modulation (kicks above ~0.5 begin heating up, 0.85+ and pure strikes blaze intensely)
  const powerClamped = Math.max(0, Math.min(1, power));
  const powerFactor = Math.max(0, (powerClamped - 0.45) / 0.55);
  const powerWeight = isPureStrike ? 0.95 : powerFactor * 0.85;

  r = r * (1 - powerWeight) + powerCol.r * powerWeight;
  g = g * (1 - powerWeight) + powerCol.g * powerWeight;
  b = b * (1 - powerWeight) + powerCol.b * powerWeight;

  // 2. Spin Modulation (sideSpin > 0 = hook/left, sideSpin < 0 = slice/right)
  const absSide = Math.min(1.0, Math.abs(sideSpin));
  if (absSide > 0.05) {
    const targetSpinCol = sideSpin > 0 ? spinL : spinR;
    const spinWeight = absSide * 0.75;
    r = r * (1 - spinWeight) + targetSpinCol.r * spinWeight;
    g = g * (1 - spinWeight) + targetSpinCol.g * spinWeight;
    b = b * (1 - spinWeight) + targetSpinCol.b * spinWeight;
  }

  // 3. Top / Backspin variance (subtle chromatic saturation lift)
  const absTop = Math.min(1.0, Math.abs(topSpin));
  if (absTop > 0.1) {
    if (topSpin > 0) {
      // Forward roll topspin: warm brightness punch
      r = Math.min(1, r + absTop * 0.12);
      g = Math.min(1, g + absTop * 0.08);
    } else {
      // Backspin check-up: cool crisp contrast
      b = Math.min(1, b + absTop * 0.15);
      g = Math.min(1, g + absTop * 0.05);
    }
  }

  // Pure strike incandescent halo
  if (isPureStrike) {
    r = Math.min(1, r * 1.15);
    g = Math.min(1, g * 1.15);
    b = Math.min(1, b * 1.15);
  }

  return { r, g, b };
}
