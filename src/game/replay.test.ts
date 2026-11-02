/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { test } from 'node:test';
import assert from 'node:assert';
import {
  ReplayRecorder,
  sampleReplayAt,
  getReplayCameraPose,
} from './replay';

test('ReplayRecorder properly collects keyframes and throttles close timestamps', () => {
  const recorder = new ReplayRecorder({
    holeNumber: 1,
    strokeNumber: 1,
    kickType: 'drive',
    distanceMeters: 0,
    isHoleOut: false,
  });

  recorder.recordFrame(0.0, { x: 0, y: 0.1, z: 0 }, { x: 0, y: 15, z: 25 });
  // Throttled frame (< 33ms)
  recorder.recordFrame(0.015, { x: 0, y: 0.2, z: 0.3 }, { x: 0, y: 14.8, z: 25 });
  // Accepted frame (> 33ms)
  recorder.recordFrame(0.045, { x: 0, y: 0.5, z: 1.0 }, { x: 0, y: 14.5, z: 25 });
  recorder.recordFrame(0.090, { x: 0, y: 1.1, z: 2.2 }, { x: 0, y: 14.0, z: 25 });

  const track = recorder.finalize(1.5, 45, false);
  assert.ok(track !== null);
  assert.strictEqual(track.keyframes.length, 3);
  assert.strictEqual(track.shotInfo.distanceMeters, 45);
  assert.strictEqual(track.shotInfo.isHoleOut, false);
  assert.strictEqual(track.duration, 1.5);
});

test('sampleReplayAt interpolates accurately between keyframes', () => {
  const track = {
    keyframes: [
      { time: 0.0, position: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 10, z: 20 } },
      { time: 1.0, position: { x: 10, y: 20, z: 30 }, velocity: { x: 0, y: 5, z: 20 } },
      { time: 2.0, position: { x: 20, y: 10, z: 60 }, velocity: { x: 0, y: 0, z: 20 } },
    ],
    duration: 2.0,
    shotInfo: {
      holeNumber: 1,
      strokeNumber: 1,
      kickType: 'drive' as const,
      distanceMeters: 60,
      isHoleOut: false,
    },
  };

  // Sample at boundary t = 0
  const sampleStart = sampleReplayAt(track, 0.0);
  assert.strictEqual(sampleStart.position.x, 0);
  assert.strictEqual(sampleStart.position.y, 0);
  assert.strictEqual(sampleStart.position.z, 0);
  assert.strictEqual(sampleStart.finished, false);

  // Sample midpoint t = 0.5 (between 0.0 and 1.0)
  const sampleMid = sampleReplayAt(track, 0.5);
  assert.strictEqual(sampleMid.position.x, 5);
  assert.strictEqual(sampleMid.position.y, 10);
  assert.strictEqual(sampleMid.position.z, 15);
  assert.strictEqual(sampleMid.finished, false);

  // Sample past end t = 2.5
  const sampleEnd = sampleReplayAt(track, 2.5);
  assert.strictEqual(sampleEnd.position.x, 20);
  assert.strictEqual(sampleEnd.position.y, 10);
  assert.strictEqual(sampleEnd.position.z, 60);
  assert.strictEqual(sampleEnd.finished, true);
});

test('getReplayCameraPose produces valid non-NaN camera positions for all angles', () => {
  const ballPos = { x: 5, y: 0.1, z: 40 };
  const ballVel = { x: 1, y: 2, z: 12 };
  const pinPos = { x: 0, y: 0.5, z: 80 };

  ['broadcast', 'follow', 'reverse_pin'].forEach((mode) => {
    const pose = getReplayCameraPose(
      ballPos,
      ballVel,
      pinPos,
      mode as 'broadcast' | 'follow' | 'reverse_pin'
    );
    assert.ok(!isNaN(pose.camPos.x));
    assert.ok(!isNaN(pose.camPos.y));
    assert.ok(!isNaN(pose.camPos.z));
    assert.ok(!isNaN(pose.lookAt.x));
    assert.ok(!isNaN(pose.lookAt.y));
    assert.ok(!isNaN(pose.lookAt.z));
  });
});
