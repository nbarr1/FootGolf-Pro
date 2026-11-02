/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { soundEngine } from './audio';

test('soundEngine safely invokes crowd cheer and gasp without audio context in headless mode', () => {
  // Should not throw even when running in Node.js headless environment without window.AudioContext
  assert.doesNotThrow(() => {
    soundEngine.playCrowdCheer('applause');
    soundEngine.playCrowdCheer('cheer');
    soundEngine.playCrowdCheer('roar');
    soundEngine.playCrowdGasp();
    soundEngine.playHeartbeat();
  });
});

test('soundEngine respects mute toggles', () => {
  assert.equal(soundEngine.getMuted(), false);
  soundEngine.setMuted(true);
  assert.equal(soundEngine.getMuted(), true);

  assert.doesNotThrow(() => {
    soundEngine.playCrowdCheer('roar');
    soundEngine.playCrowdGasp();
  });

  soundEngine.setMuted(false);
  assert.equal(soundEngine.getMuted(), false);
});
