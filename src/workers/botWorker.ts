/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/// <reference lib="webworker" />
import { simulateBotStrokes } from '../game/tournament';
import type { HoleData, TournamentState } from '../types';

export interface BotWorkerRequest {
  key: string;
  tournament: TournamentState;
  hole: HoleData;
  wind: { speed: number; angleRad: number };
}

export interface BotWorkerResult {
  key: string;
  competitorId: string;
  strokes: number;
}

// Simulates each bot's hole off the main thread and posts results one bot at a time.
self.onmessage = (event: MessageEvent<BotWorkerRequest>) => {
  const { key, tournament, hole, wind } = event.data;
  for (const bot of tournament.leaderboard) {
    if (bot.isPlayer) continue;
    const strokes = simulateBotStrokes(tournament, bot.id, bot.skillRating, hole, wind);
    (self as unknown as Worker).postMessage({ key, competitorId: bot.id, strokes } satisfies BotWorkerResult);
  }
};
