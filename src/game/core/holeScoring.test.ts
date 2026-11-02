import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreHoleOut, strokesTakenFromCounter } from './holeScoring';

test('stroke counter is one ahead of strokes taken', () => {
  // Counter starts at 1, becomes 2 after the first kick.
  assert.equal(strokesTakenFromCounter(2), 1);
  assert.equal(strokesTakenFromCounter(5), 4);
  assert.equal(strokesTakenFromCounter(1), 1);
});

test('hole-in-one is only awarded for a single stroke', () => {
  assert.equal(scoreHoleOut(1, 3, 120).title, 'HOLE-IN-ONE!');
  assert.notEqual(scoreHoleOut(4, 4, 2).title, 'HOLE-IN-ONE!');
  assert.equal(scoreHoleOut(4, 4, 2).title, 'PAR!');
});

test('score terms and rewards follow the delta to par', () => {
  const birdie = scoreHoleOut(3, 4, 3);
  assert.equal(birdie.title, 'BIRDIE!');
  assert.equal(birdie.scoreLabel, '-1');
  assert.equal(birdie.coins, 80);
  assert.equal(birdie.crowd, 'cheer');

  const bogey = scoreHoleOut(5, 4, 1);
  assert.equal(bogey.title, 'BOGEY');
  assert.equal(bogey.scoreLabel, '+1');
  assert.equal(bogey.coins, 15);

  assert.equal(scoreHoleOut(7, 4, 1).title, 'DOUBLE BOGEY (+3)');
  assert.equal(scoreHoleOut(2, 5, 1).title, 'ALBATROSS!');
});

test('long sinks at par or better earn a bonus', () => {
  const r = scoreHoleOut(3, 4, 15);
  assert.equal(r.isLongSink, true);
  assert.equal(r.title, 'CLUTCH SNIPE! (15m)');
  assert.equal(r.coins, 130);
  assert.equal(scoreHoleOut(5, 4, 15).isLongSink, false);
});
