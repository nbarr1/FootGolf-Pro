import test from 'node:test';
import assert from 'node:assert/strict';
import { COURSES } from '../courses';
import { createRng, deriveSeed } from '../rng';
import { chooseKickType, estimatePowerForDistance, simulateBotHole } from './botPlayer';
import { getEstimatedKickDistance } from '../physics';

const wind = { speed: 3.5, angleRad: 0.6 };

test('club choice mirrors the player auto-suggestion', () => {
  assert.equal(chooseKickType('green', 30), 'putt');
  assert.equal(chooseKickType('fairway', 8), 'putt');
  assert.equal(chooseKickType('fairway', 15), 'chip');
  assert.equal(chooseKickType('rough', 8), 'chip');
  assert.equal(chooseKickType('fairway', 40), 'chip');
  assert.equal(chooseKickType('sand', 120), 'chip');
  assert.equal(chooseKickType('tee', 150), 'drive');
});

test('power estimate inverts the distance estimate', () => {
  const p = estimatePowerForDistance('drive', 100, 'fairway');
  const est = getEstimatedKickDistance('drive', p, 'fairway').totalMeters;
  assert.ok(Math.abs(est - 100) <= 2, `estimated ${est}m`);
});

test('bot play is reproducible for the same seed', () => {
  const hole = COURSES[0].holes[0];
  const a = simulateBotHole(hole, wind, 0.9, createRng(deriveSeed(42, 'bot-1', 0)));
  const b = simulateBotHole(hole, wind, 0.9, createRng(deriveSeed(42, 'bot-1', 0)));
  assert.deepEqual(a, b);
});

test('bots finish every hole within the stroke cap and skilled bots score better', () => {
  let strongTotal = 0;
  let weakTotal = 0;
  const started = Date.now();
  for (const course of COURSES) {
    for (const [i, hole] of course.holes.entries()) {
      for (let trial = 0; trial < 3; trial++) {
        const strong = simulateBotHole(hole, wind, 0.95, createRng(deriveSeed(7, course.id, i, trial)));
        const weak = simulateBotHole(hole, wind, 0.6, createRng(deriveSeed(8, course.id, i, trial)));
        assert.ok(strong.strokes >= 1 && strong.strokes <= hole.par + 4);
        assert.ok(weak.strokes >= 1 && weak.strokes <= hole.par + 4);
        strongTotal += strong.strokes;
        weakTotal += weak.strokes;
      }
    }
  }
  assert.ok(strongTotal <= weakTotal, `strong ${strongTotal} vs weak ${weakTotal}`);
  // Keep tournament advancement responsive on phones
  assert.ok(Date.now() - started < 15000, 'simulation should stay fast');
});
