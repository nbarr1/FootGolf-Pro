import test from 'node:test';
import assert from 'node:assert/strict';
import { COURSES } from './courses';
import { advanceTournamentHole, createTournament, simulateBotStrokes } from './tournament';

const wind = { speed: 3.5, angleRad: 0.6 };
const course = COURSES[0];

test('the same seed picks the same opponents', () => {
  const a = createTournament('Me', course.id, course.holes.length, 'Continental Cup', 99);
  const b = createTournament('Me', course.id, course.holes.length, 'Continental Cup', 99);
  assert.deepEqual(
    a.leaderboard.map((c) => c.name),
    b.leaderboard.map((c) => c.name)
  );
  assert.equal(a.leaderboard.length, 8);
});

test('advancing a hole is reproducible and records player strokes', () => {
  const t = createTournament('Me', course.id, course.holes.length, 'Continental Cup', 7);
  const a = advanceTournamentHole(t, 4, course.holes[0], wind);
  const b = advanceTournamentHole(t, 4, course.holes[0], wind);
  assert.deepEqual(a.leaderboard, b.leaderboard);
  const me = a.leaderboard.find((c) => c.isPlayer)!;
  assert.deepEqual(me.strokesPerHole, [4]);
  assert.equal(me.scoreRelativeToPar, 4 - course.holes[0].par);
  assert.equal(a.currentHoleIndex, 1);
});

test('precomputed bot scores are used when provided', () => {
  const t = createTournament('Me', course.id, course.holes.length, 'Continental Cup', 3);
  const scores: Record<string, number> = {};
  for (const c of t.leaderboard) if (!c.isPlayer) scores[c.id] = 9;
  const next = advanceTournamentHole(t, 4, course.holes[0], wind, scores);
  for (const c of next.leaderboard) if (!c.isPlayer) assert.deepEqual(c.strokesPerHole, [9]);
});

test('precomputed and on-demand bot strokes agree', () => {
  const t = createTournament('Me', course.id, course.holes.length, 'Continental Cup', 11);
  const bot = t.leaderboard.find((c) => !c.isPlayer)!;
  const pre = simulateBotStrokes(t, bot.id, bot.skillRating, course.holes[0], wind);
  const next = advanceTournamentHole(t, 4, course.holes[0], wind);
  assert.deepEqual(next.leaderboard.find((c) => c.id === bot.id)!.strokesPerHole, [pre]);
});
