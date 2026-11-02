/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FootGolfBallCustomization, HoleData, PlayerProfile, TournamentCompetitor, TournamentState } from '../types';

export const INITIAL_BALLS: FootGolfBallCustomization[] = [
  {
    id: 'classic_telstar',
    name: 'Classic Telstar',
    pattern: 'classic_telstar',
    primaryColor: '#ffffff',
    secondaryColor: '#1e293b',
    bonusLoft: 0,
    bonusRoll: 0,
    unlocked: true,
    cost: 0,
  },
  {
    id: 'golden_champion',
    name: 'Golden Champion',
    pattern: 'golden_champion',
    primaryColor: '#f59e0b',
    secondaryColor: '#78350f',
    bonusLoft: 0.05,
    bonusRoll: 0.08,
    unlocked: false,
    cost: 450,
  },
  {
    id: 'neon_striker',
    name: 'Neon Striker',
    pattern: 'neon_striker',
    primaryColor: '#10b981',
    secondaryColor: '#064e3b',
    bonusLoft: 0.08,
    bonusRoll: 0.04,
    unlocked: false,
    cost: 850,
  },
  {
    id: 'fire_vortex',
    name: 'Fire Vortex',
    pattern: 'fire_vortex',
    primaryColor: '#ef4444',
    secondaryColor: '#7f1d1d',
    bonusLoft: 0.10,
    bonusRoll: 0.10,
    unlocked: false,
    cost: 1500,
  },
  {
    id: 'sakura_bloom',
    name: 'Sakura Bloom',
    pattern: 'sakura_bloom',
    primaryColor: '#fbcfe8',
    secondaryColor: '#9d174d',
    bonusLoft: 0.08,
    bonusRoll: 0.08,
    unlocked: false,
    cost: 1200,
  },
  {
    id: 'galaxy_comet',
    name: 'Galaxy Comet',
    pattern: 'galaxy_comet',
    primaryColor: '#1e1b4b',
    secondaryColor: '#06b6d4',
    bonusLoft: 0.12,
    bonusRoll: 0.14,
    unlocked: false,
    cost: 2200,
  },
];

export const INITIAL_PLAYER_PROFILE: PlayerProfile = {
  name: 'Striker #10',
  rankTitle: 'Pro Tour Contender',
  trophies: 2,
  coins: 350,
  tournamentsWon: 0,
  equippedBallId: 'classic_telstar',
  unlockedBalls: ['classic_telstar'],
  equippedTrailId: 'championship_gold',
  attributes: {
    power: 2,
    accuracy: 2,
    spinControl: 2,
    finesse: 2,
  },
  skillPoints: 2,
  playerLevel: 1,
  currentXp: 80,
  xpToNextLevel: 250,
  stats: {
    holesPlayed: 6,
    eagles: 1,
    birdies: 4,
    pars: 8,
    bogeys: 2,
    holesInOne: 0,
    longestKickMeters: 68,
  },
};

const BOT_ROSTER: { name: string; country: string; flag: string; skill: number; handicap: number }[] = [
  { name: 'Mateo Silva', country: 'Argentina', flag: '🇦🇷', skill: 0.94, handicap: 1 },
  { name: 'Lucas Müller', country: 'Germany', flag: '🇩🇪', skill: 0.92, handicap: 2 },
  { name: 'Kenji Sato', country: 'Japan', flag: '🇯🇵', skill: 0.91, handicap: 2 },
  { name: 'Emma Watson', country: 'United Kingdom', flag: '🇬🇧', skill: 0.89, handicap: 3 },
  { name: 'Sofia Rossi', country: 'Italy', flag: '🇮🇹', skill: 0.88, handicap: 3 },
  { name: 'Carlos Mendez', country: 'Spain', flag: '🇪🇸', skill: 0.87, handicap: 4 },
  { name: 'Liam O’Connor', country: 'Ireland', flag: '🇮🇪', skill: 0.86, handicap: 4 },
  { name: 'Antoine Dubois', country: 'France', flag: '🇫🇷', skill: 0.85, handicap: 5 },
  { name: 'Johan Lindberg', country: 'Sweden', flag: '🇸🇪', skill: 0.84, handicap: 5 },
  { name: 'Diego Alvarez', country: 'Mexico', flag: '🇲🇽', skill: 0.83, handicap: 6 },
  { name: 'Tyler Brooks', country: 'United States', flag: '🇺🇸', skill: 0.82, handicap: 6 },
];

/**
 * Creates a fresh multi-player online tournament with simulated international competitors
 */
export function createTournament(
  playerName: string,
  courseId: string,
  totalHoles: number,
  tier: 'Regional Open' | 'Continental Cup' | 'World Championship' = 'Continental Cup'
): TournamentState {
  const purse = tier === 'World Championship' ? 2500 : (tier === 'Continental Cup' ? 1200 : 600);
  const trophy = tier === 'World Championship' ? 'World Cup Gold' : (tier === 'Continental Cup' ? 'Silver Shield' : 'Bronze Boot');

  const competitors: TournamentCompetitor[] = [
    {
      id: 'player-1',
      name: playerName || 'Player',
      country: 'Your Pro',
      countryCode: '⭐',
      avatarSeed: 'player',
      handicap: 2,
      skillRating: 0.92,
      strokesPerHole: [],
      totalStrokes: 0,
      scoreRelativeToPar: 0,
      currentHoleIndex: 0,
      isPlayer: true,
      status: 'playing',
      rank: 1,
    },
  ];

  // Pick 7 bots for an 8-player leaderboard bracket
  const shuffledBots = [...BOT_ROSTER].sort(() => 0.5 - Math.random()).slice(0, 7);
  shuffledBots.forEach((bot, idx) => {
    competitors.push({
      id: `bot-${idx + 1}`,
      name: bot.name,
      country: bot.country,
      countryCode: bot.flag,
      avatarSeed: `bot-${bot.name}`,
      handicap: bot.handicap,
      skillRating: bot.skill,
      strokesPerHole: [],
      totalStrokes: 0,
      scoreRelativeToPar: 0,
      currentHoleIndex: 0,
      isPlayer: false,
      status: 'playing',
      rank: idx + 2,
    });
  });

  return {
    id: `tourney-${Date.now()}`,
    name: tier === 'World Championship' ? 'FIFG World FootGolf Cup' : `${tier} Invitational`,
    tier,
    purseCoins: purse,
    trophyReward: trophy,
    courseId,
    currentHoleIndex: 0,
    totalHoles,
    leaderboard: competitors,
    roundState: 'playing_hole',
  };
}

/**
 * Simulates AI bots completing a hole with realistic probabilistic score distribution
 */
export function advanceTournamentHole(
  tournament: TournamentState,
  playerStrokes: number,
  currentHole: HoleData
): TournamentState {
  const updatedLeaderboard = tournament.leaderboard.map((competitor) => {
    if (competitor.isPlayer) {
      const strokes = [...competitor.strokesPerHole, playerStrokes];
      const total = strokes.reduce((a, b) => a + b, 0);
      const scoreRel = playerStrokes - currentHole.par;
      const lastResult = getScoreTerm(scoreRel);

      return {
        ...competitor,
        strokesPerHole: strokes,
        totalStrokes: total,
        scoreRelativeToPar: competitor.scoreRelativeToPar + scoreRel,
        currentHoleIndex: competitor.currentHoleIndex + 1,
        status: (tournament.currentHoleIndex + 1 >= tournament.totalHoles ? 'round_completed' : 'hole_finished') as TournamentCompetitor['status'],
        lastHoleResult: lastResult,
      };
    } else {
      // Simulate Bot result based on hole par and bot skill rating
      const par = currentHole.par;
      const roll = Math.random();
      let botScore = par;

      // Skill-weighted distribution
      if (competitor.skillRating >= 0.92) {
        if (roll < 0.28) botScore = par - 1; // Birdie
        else if (roll < 0.32) botScore = par - 2; // Eagle (on par 4/5)
        else if (roll < 0.85) botScore = par; // Par
        else botScore = par + 1; // Bogey
      } else if (competitor.skillRating >= 0.87) {
        if (roll < 0.20) botScore = par - 1;
        else if (roll < 0.78) botScore = par;
        else if (roll < 0.95) botScore = par + 1;
        else botScore = par + 2;
      } else {
        if (roll < 0.12) botScore = par - 1;
        else if (roll < 0.65) botScore = par;
        else if (roll < 0.90) botScore = par + 1;
        else botScore = par + 2;
      }

      // Ensure at least 1 stroke
      botScore = Math.max(1, botScore);

      const strokes = [...competitor.strokesPerHole, botScore];
      const total = strokes.reduce((a, b) => a + b, 0);
      const scoreRel = botScore - currentHole.par;

      return {
        ...competitor,
        strokesPerHole: strokes,
        totalStrokes: total,
        scoreRelativeToPar: competitor.scoreRelativeToPar + scoreRel,
        currentHoleIndex: competitor.currentHoleIndex + 1,
        status: (tournament.currentHoleIndex + 1 >= tournament.totalHoles ? 'round_completed' : 'hole_finished') as TournamentCompetitor['status'],
        lastHoleResult: getScoreTerm(scoreRel),
      };
    }
  });

  // Sort leaderboard by score relative to par ascending (lowest total strokes is best)
  updatedLeaderboard.sort((a, b) => {
    if (a.scoreRelativeToPar !== b.scoreRelativeToPar) {
      return a.scoreRelativeToPar - b.scoreRelativeToPar;
    }
    return a.totalStrokes - b.totalStrokes;
  });

  // Assign ranks
  updatedLeaderboard.forEach((c, idx) => {
    c.rank = idx + 1;
  });

  const nextHoleIndex = tournament.currentHoleIndex + 1;
  const isFinished = nextHoleIndex >= tournament.totalHoles;

  return {
    ...tournament,
    currentHoleIndex: nextHoleIndex,
    leaderboard: updatedLeaderboard,
    roundState: isFinished ? 'podium' : 'hole_recap',
  };
}

export function getScoreTerm(scoreRelativeToPar: number): string {
  if (scoreRelativeToPar <= -3) return 'Albatross';
  if (scoreRelativeToPar === -2) return 'Eagle';
  if (scoreRelativeToPar === -1) return 'Birdie';
  if (scoreRelativeToPar === 0) return 'Par';
  if (scoreRelativeToPar === 1) return 'Bogey';
  if (scoreRelativeToPar === 2) return 'Double Bogey';
  return `+${scoreRelativeToPar}`;
}
