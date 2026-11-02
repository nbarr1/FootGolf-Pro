/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { generateGreenGrid } from './greenGrid';
import { COURSES } from './courses';

test('generateGreenGrid produces valid topography nodes and contour lines', () => {
  const hole = COURSES[0].holes[0];
  const grid = generateGreenGrid(hole, 1.5, 1.0);

  assert.ok(grid.nodes.length > 20, 'Should generate sufficient nodes for green');
  assert.ok(grid.contourLines.length > 10, 'Should generate horizontal and vertical grid lines');
  assert.ok(grid.maxY >= grid.minY, 'Max elevation should be >= min elevation');
  assert.ok(grid.avgGradePct >= 0, 'Average grade percentage should be non-negative');

  // Verify all node fallVectors are normalized or zero
  grid.nodes.forEach((node) => {
    const len = Math.hypot(node.fallVector.x, node.fallVector.z);
    assert.ok(len < 1.001, `Fall vector length ${len} should be <= 1.0`);
  });
});
