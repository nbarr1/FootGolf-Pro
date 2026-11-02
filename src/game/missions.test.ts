/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateDailyMissions,
  getOrRefreshDailyMissions,
  checkKickMissions,
  checkHoleFinishedMissions,
  checkTournamentMissions,
  claimDailyMission,
} from './missions';
import { DailyMission } from '../types';

test('generateDailyMissions produces exactly 3 unique missions for a dateKey', () => {
  const missions = generateDailyMissions('2026-10-22');
  assert.equal(missions.length, 3, 'Should generate exactly 3 daily missions');
  const ids = new Set(missions.map((m) => m.id));
  assert.equal(ids.size, 3, 'All 3 missions must have distinct IDs');

  // Verify deterministic repeatability
  const missionsAgain = generateDailyMissions('2026-10-22');
  assert.deepEqual(missions.map((m) => m.id), missionsAgain.map((m) => m.id), 'Missions should be deterministic per date');
});

test('checkKickMissions correctly tracks monster drive and curve spin', () => {
  const missions: DailyMission[] = [
    {
      id: 'monster_drive',
      title: 'Monster Kick',
      description: 'Kick 50m+',
      category: 'distance',
      progress: 0,
      target: 1,
      rewardCoins: 200,
      completed: false,
      claimed: false,
      icon: '🚀',
    },
    {
      id: 'curve_wonder',
      title: 'Banana Kick',
      description: 'Curve kick',
      category: 'curve',
      progress: 0,
      target: 2,
      rewardCoins: 220,
      completed: false,
      claimed: false,
      icon: '🌀',
    },
  ];

  // 1. Kick under 50m - should not complete monster_drive
  const { missions: m1 } = checkKickMissions(missions, {
    kickType: 'drive',
    distanceMeters: 42,
    spin: { top: 0, side: 0 },
    startLie: 'tee',
    endLie: 'fairway',
  });
  assert.equal(m1[0].completed, false);

  // 2. Kick 58m drive - should complete monster_drive!
  const { missions: m2, newlyCompleted } = checkKickMissions(m1, {
    kickType: 'drive',
    distanceMeters: 58,
    spin: { top: 0, side: 0.4 },
    startLie: 'fairway',
    endLie: 'fairway',
  });
  assert.equal(m2[0].completed, true, 'Monster drive should complete upon reaching 50m+');
  assert.equal(newlyCompleted.some((c) => c.id === 'monster_drive'), true);
  // Curve kick should have incremented progress
  assert.equal(m2[1].progress, 1);
});

test('checkHoleFinishedMissions tracks long putt and under par', () => {
  const missions: DailyMission[] = [
    {
      id: 'sink_long_putt',
      title: 'Precision Putter',
      description: 'Sink 15m+ putt',
      category: 'putt',
      progress: 0,
      target: 1,
      rewardCoins: 250,
      completed: false,
      claimed: false,
      icon: '🎯',
    },
    {
      id: 'under_par_hole',
      title: 'Birdie Hunter',
      description: 'Birdie or Eagle',
      category: 'score',
      progress: 0,
      target: 2,
      rewardCoins: 300,
      completed: false,
      claimed: false,
      icon: '🦅',
    },
  ];

  // Sinking a 18m putt for a Birdie (par 4, 3 strokes)
  const { missions: updated, newlyCompleted } = checkHoleFinishedMissions(missions, {
    par: 4,
    strokes: 3,
    finalShotDistanceMeters: 18,
    finalShotKickType: 'putt',
    hitBunker: false,
    hitWater: false,
  });

  assert.equal(updated[0].completed, true, 'Long putt of 18m should complete mission');
  assert.equal(updated[1].progress, 1, 'Birdie should increment under par mission progress');
});

test('checkTournamentMissions tracks podium finish', () => {
  const missions: DailyMission[] = [
    {
      id: 'podium_finish',
      title: 'Podium Glory',
      description: 'Top 3',
      category: 'tournament',
      progress: 0,
      target: 1,
      rewardCoins: 450,
      completed: false,
      claimed: false,
      icon: '🏆',
    },
  ];

  const { missions: updated } = checkTournamentMissions(missions, {
    rank: 2, // 2nd place
    totalStrokes: 11,
    scoreRelativeToPar: -1,
  });

  assert.equal(updated[0].completed, true, '2nd place finish should complete podium mission');
});

test('claimDailyMission properly marks claimed and returns exact coins', () => {
  const missions: DailyMission[] = [
    {
      id: 'monster_drive',
      title: 'Monster Kick',
      description: 'Kick 50m+',
      category: 'distance',
      progress: 1,
      target: 1,
      rewardCoins: 200,
      completed: true,
      claimed: false,
      icon: '🚀',
    },
  ];

  const { updatedMissions, rewardCoins } = claimDailyMission(missions, 'monster_drive');
  assert.equal(rewardCoins, 200, 'Should award 200 coins');
  assert.equal(updatedMissions[0].claimed, true, 'Mission should now be marked as claimed');

  // Attempting to claim again should yield 0 coins
  const { rewardCoins: secondClaim } = claimDailyMission(updatedMissions, 'monster_drive');
  assert.equal(secondClaim, 0, 'Already claimed mission must yield 0 coins');
});
