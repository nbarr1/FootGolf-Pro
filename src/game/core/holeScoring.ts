/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Pure hole-out scoring rules, extracted from App.tsx so they can be tested.
 */

export type CrowdReaction = 'roar' | 'cheer' | 'applause';

export interface HoleOutResult {
  strokes: number;
  scoreDelta: number;
  title: string;
  scoreLabel: string;
  coins: number;
  xp: number;
  isLongSink: boolean;
  crowd: CrowdReaction;
}

/**
 * The HUD stroke counter holds the number of the stroke about to be taken:
 * it starts at 1 and increments when a kick is made (and on water penalties).
 * Strokes actually taken on a hole are therefore one less than the counter.
 */
export function strokesTakenFromCounter(strokeCounter: number): number {
  return Math.max(1, strokeCounter - 1);
}

export function getHoleOutTitle(strokes: number, scoreDelta: number, isLongSink: boolean, finalShotDist: number): string {
  if (strokes === 1) return 'HOLE-IN-ONE!';
  if (isLongSink && scoreDelta <= -1) return `CLUTCH SNIPE! (${finalShotDist}m)`;
  if (scoreDelta <= -3) return 'ALBATROSS!';
  if (scoreDelta === -2) return 'EAGLE!';
  if (scoreDelta === -1) return 'BIRDIE!';
  if (scoreDelta === 0) return 'PAR!';
  if (scoreDelta === 1) return 'BOGEY';
  return `DOUBLE BOGEY (+${scoreDelta})`;
}

export function scoreHoleOut(strokes: number, par: number, finalShotDistMeters: number): HoleOutResult {
  const scoreDelta = strokes - par;
  const isLongSink = finalShotDistMeters >= 12 && scoreDelta <= 0;
  const baseCoins = scoreDelta <= -2 ? 150 : scoreDelta === -1 ? 80 : scoreDelta === 0 ? 40 : 15;
  const coins = baseCoins + (isLongSink ? 50 : 0);
  const xp = scoreDelta <= -2 ? 250 : scoreDelta === -1 ? 150 : scoreDelta === 0 ? 80 : 35;
  const crowd: CrowdReaction =
    strokes === 1 || scoreDelta <= -2 ? 'roar' : scoreDelta === -1 ? 'cheer' : 'applause';

  return {
    strokes,
    scoreDelta,
    title: getHoleOutTitle(strokes, scoreDelta, isLongSink, finalShotDistMeters),
    scoreLabel: scoreDelta === 0 ? 'Even Par' : scoreDelta > 0 ? `+${scoreDelta}` : `${scoreDelta}`,
    coins,
    xp,
    isLongSink,
    crowd,
  };
}
