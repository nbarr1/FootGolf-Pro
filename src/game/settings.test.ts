import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, parseSettings } from './settings';

test('missing or malformed settings fall back to defaults', () => {
  assert.deepEqual(parseSettings(null), DEFAULT_SETTINGS);
  assert.deepEqual(parseSettings('{not json'), DEFAULT_SETTINGS);
});

test('valid fields are kept and invalid ones replaced', () => {
  const s = parseSettings(JSON.stringify({ quality: 'high', reducedMotion: true, haptics: 'yes' }));
  assert.equal(s.quality, 'high');
  assert.equal(s.reducedMotion, true);
  assert.equal(s.haptics, true);
  assert.equal(parseSettings(JSON.stringify({ quality: 'ultra' })).quality, 'auto');
});
