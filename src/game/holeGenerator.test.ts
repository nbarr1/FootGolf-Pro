import test from 'node:test';
import assert from 'node:assert/strict';
import { COURSES, GENERATED_HOLE_SEEDS } from './courses';
import { generateHole } from './holeGenerator';
import { getSurfaceLie } from './physics';
import { simulateBotHole } from './core/botPlayer';
import { createRng, deriveSeed } from './rng';

test('every course has nine holes with a par-36 card', () => {
  for (const course of COURSES) {
    assert.equal(course.holes.length, 9, course.id);
    assert.deepEqual(course.holes.map((h) => h.number), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    assert.equal(course.holes.reduce((sum, h) => sum + h.par, 0), 36, course.id);
  }
});

test('generation is deterministic', () => {
  const a = generateHole('parkland', { number: 4, par: 4, seed: 123 });
  const b = generateHole('parkland', { number: 4, par: 4, seed: 123 });
  assert.deepEqual(a, b);
});

test('generated holes have a dry tee and a pin on the green', () => {
  for (const course of COURSES) {
    for (const hole of course.holes.slice(3)) {
      assert.notEqual(getSurfaceLie(hole, hole.teePosition.x, hole.teePosition.z), 'water');
      assert.equal(getSurfaceLie(hole, hole.pinPosition.x, hole.pinPosition.z), 'green');
    }
  }
});

test('generated holes play near par for strong bots', () => {
  const wind = { speed: 3.5, angleRad: 0.6 };
  for (const course of COURSES) {
    assert.equal(GENERATED_HOLE_SEEDS[course.id].length, 6);
    for (const hole of course.holes.slice(3)) {
      let total = 0;
      for (let t = 0; t < 4; t++) {
        const r = simulateBotHole(hole, wind, 0.92, createRng(deriveSeed(hole.number, course.id, t)));
        assert.equal(r.pickedUp, false, `${course.id} hole ${hole.number} should be finishable`);
        total += r.strokes - hole.par;
      }
      const avg = total / 4;
      assert.ok(avg > -1.5 && avg < 1.5, `${course.id} hole ${hole.number} averaged ${avg} vs par`);
    }
  }
});
