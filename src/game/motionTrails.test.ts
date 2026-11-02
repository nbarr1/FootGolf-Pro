/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_MOTION_TRAIL_CONFIGS,
  getMotionTrailPreset,
  hexToRgb,
  calculateDynamicTrailColor,
} from './motionTrails';

test('DEFAULT_MOTION_TRAIL_CONFIGS provides valid trail configurations', () => {
  assert.ok(DEFAULT_MOTION_TRAIL_CONFIGS.length >= 6);

  for (const trail of DEFAULT_MOTION_TRAIL_CONFIGS) {
    assert.ok(trail.id);
    assert.ok(trail.name);
    assert.match(trail.baseColor, /^#[0-9a-fA-F]{6}$/);
    assert.match(trail.highPowerColor, /^#[0-9a-fA-F]{6}$/);
    assert.match(trail.spinLeftColor, /^#[0-9a-fA-F]{6}$/);
    assert.match(trail.spinRightColor, /^#[0-9a-fA-F]{6}$/);
    assert.ok(trail.ribbonWidth > 0.05);
  }
});

test('getMotionTrailPreset retrieves presets and falls back cleanly on unknown id', () => {
  const gold = getMotionTrailPreset('championship_gold');
  assert.equal(gold.name, 'Championship Gold');

  const emerald = getMotionTrailPreset('neon_emerald');
  assert.equal(emerald.name, 'Cyber Emerald');

  const fallback = getMotionTrailPreset('unknown_preset_abc');
  assert.equal(fallback.id, 'championship_gold');
});

test('hexToRgb converts hex color string to normalized RGB components', () => {
  const red = hexToRgb('#ff0000');
  assert.ok(Math.abs(red.r - 1.0) < 0.01);
  assert.ok(Math.abs(red.g - 0.0) < 0.01);
  assert.ok(Math.abs(red.b - 0.0) < 0.01);

  const green = hexToRgb('#00ff00');
  assert.ok(Math.abs(green.r - 0.0) < 0.01);
  assert.ok(Math.abs(green.g - 1.0) < 0.01);
  assert.ok(Math.abs(green.b - 0.0) < 0.01);

  const blue = hexToRgb('#0000ff');
  assert.ok(Math.abs(blue.r - 0.0) < 0.01);
  assert.ok(Math.abs(blue.g - 0.0) < 0.01);
  assert.ok(Math.abs(blue.b - 1.0) < 0.01);
});

test('calculateDynamicTrailColor modulates toward highPowerColor under high power / pure strike', () => {
  const preset = getMotionTrailPreset('championship_gold');
  const baseRgb = hexToRgb(preset.baseColor);
  const powerRgb = hexToRgb(preset.highPowerColor);

  // Baseline calm shot (0 power, 0 spin)
  const calmColor = calculateDynamicTrailColor(preset, 0, 0, 0, false);
  assert.ok(Math.abs(calmColor.r - baseRgb.r) < 0.05);
  assert.ok(Math.abs(calmColor.g - baseRgb.g) < 0.05);
  assert.ok(Math.abs(calmColor.b - baseRgb.b) < 0.05);

  // High power shot (1.0 power, pure strike)
  const maxPowerColor = calculateDynamicTrailColor(preset, 1.0, 0, 0, true);

  const distToPowerCalm = Math.hypot(
    calmColor.r - powerRgb.r,
    calmColor.g - powerRgb.g,
    calmColor.b - powerRgb.b
  );
  const distToPowerMax = Math.hypot(
    maxPowerColor.r - powerRgb.r,
    maxPowerColor.g - powerRgb.g,
    maxPowerColor.b - powerRgb.b
  );

  assert.ok(distToPowerMax < distToPowerCalm);
});

test('calculateDynamicTrailColor modulates toward spinLeftColor and spinRightColor under side spin', () => {
  const preset = getMotionTrailPreset('ice_comet');
  const hookRgb = hexToRgb(preset.spinLeftColor);
  const sliceRgb = hexToRgb(preset.spinRightColor);

  // Left spin (negative angular velocity or hook)
  const hookColor = calculateDynamicTrailColor(preset, 0.4, -0.9, 0, false);
  const distToHook = Math.hypot(
    hookColor.r - hookRgb.r,
    hookColor.g - hookRgb.g,
    hookColor.b - hookRgb.b
  );

  // Right spin (positive angular velocity or slice)
  const sliceColor = calculateDynamicTrailColor(preset, 0.4, 0.9, 0, false);
  const distToSlice = Math.hypot(
    sliceColor.r - sliceRgb.r,
    sliceColor.g - sliceRgb.g,
    sliceColor.b - sliceRgb.b
  );

  assert.notDeepEqual(hookColor, sliceColor);
  assert.ok(distToHook < 1.0);
  assert.ok(distToSlice < 1.0);
});
