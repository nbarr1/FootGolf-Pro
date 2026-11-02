/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DailyMission, DailyMissionsState, KickType, SpinControl, SurfaceType } from '../types';

export interface MissionTemplate {
  id: string;
  title: string;
  description: string;
  category: DailyMission['category'];
  target: number;
  unit?: string;
  rewardCoins: number;
  icon: string;
}

export const MISSION_POOL: MissionTemplate[] = [
  {
    id: 'sink_long_putt',
    title: 'Precision Putter',
    description: 'Sink a putt or final kick from 15m or further out',
    category: 'putt',
    target: 1,
    unit: 'putt',
    rewardCoins: 250,
    icon: '🎯',
  },
  {
    id: 'under_par_hole',
    title: 'Birdie Hunter',
    description: 'Finish 2 holes under par (Birdie or Eagle)',
    category: 'score',
    target: 2,
    unit: 'holes',
    rewardCoins: 300,
    icon: '🦅',
  },
  {
    id: 'monster_drive',
    title: 'Monster Kick',
    description: 'Execute a drive kick traveling over 50 meters',
    category: 'distance',
    target: 1,
    unit: 'kick',
    rewardCoins: 200,
    icon: '🚀',
  },
  {
    id: 'sand_save',
    title: 'Bunker Escape',
    description: 'Chip out of a sand bunker directly onto the green or cup',
    category: 'bunker',
    target: 1,
    unit: 'escape',
    rewardCoins: 240,
    icon: '🏖️',
  },
  {
    id: 'curve_wonder',
    title: 'Banana Kick',
    description: 'Land 2 kicks with active curve spin onto fairway or green',
    category: 'curve',
    target: 2,
    unit: 'kicks',
    rewardCoins: 220,
    icon: '🌀',
  },
  {
    id: 'clean_sheet',
    title: 'Hazard Avoidance',
    description: 'Complete 2 holes without landing in any water hazard',
    category: 'clean',
    target: 2,
    unit: 'holes',
    rewardCoins: 180,
    icon: '✨',
  },
  {
    id: 'podium_finish',
    title: 'Podium Glory',
    description: 'Finish a tournament in the top 3 on the podium',
    category: 'tournament',
    target: 1,
    unit: 'podium',
    rewardCoins: 450,
    icon: '🏆',
  },
  {
    id: 'par_machine',
    title: 'Solid Striker',
    description: 'Score Par or better on 3 consecutive holes',
    category: 'par',
    target: 3,
    unit: 'holes',
    rewardCoins: 260,
    icon: '⛳',
  },
];

/**
 * Returns formatted date key like "2026-10-22"
 */
export function getTodayDateKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Deterministic pseudo-random number generator for date string
 */
function seededRandom(seed: string): () => number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return () => {
    hash = (hash * 9301 + 49297) % 233280;
    return Math.abs(hash / 233280);
  };
}

/**
 * Generates 3 unique daily missions for the given dateKey
 */
export function generateDailyMissions(dateKey = getTodayDateKey()): DailyMission[] {
  const rand = seededRandom(`footgolf-daily-${dateKey}`);
  const poolCopy = [...MISSION_POOL];

  // Shuffle using date seed
  for (let i = poolCopy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [poolCopy[i], poolCopy[j]] = [poolCopy[j], poolCopy[i]];
  }

  // Pick top 3 unique templates
  const selected = poolCopy.slice(0, 3);

  return selected.map((tpl) => ({
    id: tpl.id,
    title: tpl.title,
    description: tpl.description,
    category: tpl.category,
    progress: 0,
    target: tpl.target,
    unit: tpl.unit,
    rewardCoins: tpl.rewardCoins,
    completed: false,
    claimed: false,
    icon: tpl.icon,
  }));
}

/**
 * Checks or initializes daily missions state from localStorage
 */
export function getOrRefreshDailyMissions(currentState?: DailyMissionsState): DailyMissionsState {
  const todayKey = getTodayDateKey();

  if (currentState && currentState.dateKey === todayKey && currentState.missions?.length === 3) {
    return currentState;
  }

  // Generate new missions for today
  return {
    dateKey: todayKey,
    missions: generateDailyMissions(todayKey),
    lastRefreshed: Date.now(),
  };
}

export interface KickEventParams {
  kickType: KickType;
  distanceMeters: number;
  spin: SpinControl;
  startLie: SurfaceType;
  endLie: SurfaceType;
}

/**
 * Updates mission progress on every kick
 */
export function checkKickMissions(
  missions: DailyMission[],
  event: KickEventParams
): { missions: DailyMission[]; newlyCompleted: DailyMission[] } {
  const newlyCompleted: DailyMission[] = [];

  const updated = missions.map((m) => {
    if (m.completed) return m;

    let newProgress = m.progress;

    // 1. Monster kick distance
    if (m.id === 'monster_drive' && event.kickType === 'drive' && event.distanceMeters >= 50) {
      newProgress = Math.min(m.target, newProgress + 1);
    }

    // 2. Sand bunker escape
    if (m.id === 'sand_save' && event.startLie === 'sand' && (event.endLie === 'green' || event.endLie === 'fairway')) {
      newProgress = Math.min(m.target, newProgress + 1);
    }

    // 3. Curve spin kick
    if (
      m.id === 'curve_wonder' &&
      Math.abs(event.spin.side) >= 0.25 &&
      (event.endLie === 'fairway' || event.endLie === 'green')
    ) {
      newProgress = Math.min(m.target, newProgress + 1);
    }

    const isNowCompleted = newProgress >= m.target;
    if (isNowCompleted && !m.completed) {
      newlyCompleted.push({ ...m, progress: newProgress, completed: true });
    }

    return {
      ...m,
      progress: newProgress,
      completed: isNowCompleted,
    };
  });

  return { missions: updated, newlyCompleted };
}

export interface HoleFinishedParams {
  par: number;
  strokes: number;
  finalShotDistanceMeters: number;
  finalShotKickType: KickType;
  hitBunker: boolean;
  hitWater: boolean;
}

/**
 * Updates mission progress when a hole is completed
 */
export function checkHoleFinishedMissions(
  missions: DailyMission[],
  event: HoleFinishedParams
): { missions: DailyMission[]; newlyCompleted: DailyMission[] } {
  const newlyCompleted: DailyMission[] = [];
  const delta = event.strokes - event.par;

  const updated = missions.map((m) => {
    if (m.completed) return m;

    let newProgress = m.progress;

    // 1. Long range putt/kick
    if (m.id === 'sink_long_putt' && event.finalShotDistanceMeters >= 15) {
      newProgress = Math.min(m.target, newProgress + 1);
    }

    // 2. Birdie or Eagle (under par)
    if (m.id === 'under_par_hole' && delta < 0) {
      newProgress = Math.min(m.target, newProgress + 1);
    }

    // 3. Par or better
    if (m.id === 'par_machine' && delta <= 0) {
      newProgress = Math.min(m.target, newProgress + 1);
    }

    // 4. Hazard avoidance (no water)
    if (m.id === 'clean_sheet' && !event.hitWater) {
      newProgress = Math.min(m.target, newProgress + 1);
    }

    const isNowCompleted = newProgress >= m.target;
    if (isNowCompleted && !m.completed) {
      newlyCompleted.push({ ...m, progress: newProgress, completed: true });
    }

    return {
      ...m,
      progress: newProgress,
      completed: isNowCompleted,
    };
  });

  return { missions: updated, newlyCompleted };
}

export interface TournamentFinishedParams {
  rank: number;
  totalStrokes: number;
  scoreRelativeToPar: number;
}

/**
 * Updates mission progress when a tournament is finished
 */
export function checkTournamentMissions(
  missions: DailyMission[],
  event: TournamentFinishedParams
): { missions: DailyMission[]; newlyCompleted: DailyMission[] } {
  const newlyCompleted: DailyMission[] = [];

  const updated = missions.map((m) => {
    if (m.completed) return m;

    let newProgress = m.progress;

    // 1. Podium finish (Top 3)
    if (m.id === 'podium_finish' && event.rank <= 3) {
      newProgress = Math.min(m.target, newProgress + 1);
    }

    const isNowCompleted = newProgress >= m.target;
    if (isNowCompleted && !m.completed) {
      newlyCompleted.push({ ...m, progress: newProgress, completed: true });
    }

    return {
      ...m,
      progress: newProgress,
      completed: isNowCompleted,
    };
  });

  return { missions: updated, newlyCompleted };
}

/**
 * Claim a completed mission and return coin payout
 */
export function claimDailyMission(
  missions: DailyMission[],
  missionId: string
): { updatedMissions: DailyMission[]; rewardCoins: number } {
  let rewardCoins = 0;
  const updated = missions.map((m) => {
    if (m.id === missionId && m.completed && !m.claimed) {
      rewardCoins = m.rewardCoins;
      return { ...m, claimed: true };
    }
    return m;
  });

  return { updatedMissions: updated, rewardCoins };
}

/**
 * Calculates remaining time until midnight in hours and minutes
 */
export function getTimeUntilDailyReset(): { hours: number; minutes: number } {
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const diffMs = tomorrow.getTime() - now.getTime();
  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return { hours, minutes };
}
