import test from 'node:test';
import assert from 'node:assert/strict';
import { computePixelRatio, FrameTimeMonitor, QUALITY_PRESETS, resolveInitialTier } from './quality';

function feed(m: FrameTimeMonitor, frameMs: number, seconds: number) {
  const decisions = [];
  const frames = Math.round((seconds * 1000) / frameMs);
  for (let i = 0; i < frames; i++) {
    const d = m.sample(frameMs);
    if (d) decisions.push(d);
  }
  return decisions;
}

test('initial tier respects preference and software GL', () => {
  assert.equal(resolveInitialTier('auto', false), 'medium');
  assert.equal(resolveInitialTier('high', false), 'high');
  assert.equal(resolveInitialTier('high', true), 'low');
});

test('pixel ratio is capped by tier and scaled dynamically', () => {
  assert.equal(computePixelRatio(QUALITY_PRESETS.medium, 3, 1), 1.5);
  assert.equal(computePixelRatio(QUALITY_PRESETS.high, 3, 0.5), 1);
  assert.equal(computePixelRatio(QUALITY_PRESETS.low, 1, 0.1), 0.5);
});

test('fast frames cause no changes', () => {
  const m = new FrameTimeMonitor(QUALITY_PRESETS.medium, true);
  assert.deepEqual(feed(m, 10, 10), []);
  assert.equal(m.scale, 1);
});

test('slow frames lower resolution first, then the tier', () => {
  const m = new FrameTimeMonitor(QUALITY_PRESETS.high, true);
  const decisions = feed(m, 30, 20);
  const scales = decisions.filter((d) => d.scale !== undefined).map((d) => d.scale);
  assert.deepEqual(scales, [0.9, 0.8, 0.7, 0.6]);
  const downgrade = decisions.find((d) => d.downgradeTo);
  assert.equal(downgrade?.downgradeTo, 'medium');
});

test('resolution recovers after sustained fast frames', () => {
  const m = new FrameTimeMonitor(QUALITY_PRESETS.medium, true);
  feed(m, 30, 4.5); // two slow windows -> scale 0.8
  assert.equal(m.scale, 0.8);
  feed(m, 8, 14);
  assert.equal(m.scale, 1);
});

test('non-adaptive monitor never decides', () => {
  const m = new FrameTimeMonitor(QUALITY_PRESETS.high, false);
  assert.deepEqual(feed(m, 50, 10), []);
});
