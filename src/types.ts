/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type SurfaceType = 'tee' | 'fairway' | 'green' | 'rough' | 'sand' | 'water' | 'boundary';

export type KickType = 'drive' | 'chip' | 'putt';

export interface SpinControl {
  top: number; // -1 (heavy backspin) to +1 (heavy topspin)
  side: number; // -1 (curve left / hook) to +1 (curve right / slice)
}

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface BallPhysicsState {
  position: Vector3D;
  velocity: Vector3D;
  spin: Vector3D; // Angular velocity (rad/s)
  isGrounded: boolean;
  isRolling: boolean;
  isSleeping: boolean;
  inWater: boolean;
  inHole: boolean;
  lie: SurfaceType;
  lastValidPosition: Vector3D;
  distanceTraveledInShot: number;
  airTime: number;
}

export interface TerrainFeature {
  x: number;
  z: number;
  rx: number; // radius x
  rz: number; // radius z
  rotation?: number;
}

export interface CircularFeature {
  x: number;
  z: number;
  radius: number;
}

export interface TreeInstance {
  x: number;
  z: number;
  scale?: number;
  rotation?: number;
  type?: 'pine' | 'palm' | 'oak' | 'sakura';
}

export interface RockInstance {
  x: number;
  z: number;
  scale?: number;
  rotation?: number;
}

export interface HoleElevationHill {
  x: number;
  z: number;
  radius: number;
  height: number;
}

export interface HoleData {
  id: number;
  number: number;
  par: number;
  lengthMeters: number;
  teePosition: Vector3D;
  pinPosition: Vector3D;
  fairways: TerrainFeature[];
  greens: CircularFeature[];
  bunkers: TerrainFeature[];
  waters: TerrainFeature[];
  trees: TreeInstance[];
  rocks: RockInstance[];
  hills: HoleElevationHill[];
  defaultAimAngle: number; // in radians
}

export interface CourseData {
  id: string;
  name: string;
  location: string;
  description: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Pro Tour' | 'Championship';
  theme: 'parkland' | 'desert' | 'alpine' | 'japanese_garden';
  skyColor: string;
  fogColor: string;
  grassColor: string;
  roughColor: string;
  fairwayColor: string;
  greenColor: string;
  sandColor: string;
  waterColor: string;
  holes: HoleData[];
}

export interface TournamentCompetitor {
  id: string;
  name: string;
  country: string;
  countryCode: string;
  avatarSeed: string;
  handicap: number;
  skillRating: number; // 0.7 - 0.98
  strokesPerHole: number[];
  totalStrokes: number;
  scoreRelativeToPar: number;
  currentHoleIndex: number;
  isPlayer?: boolean;
  status: 'playing' | 'hole_finished' | 'round_completed';
  rank: number;
  lastHoleResult?: string; // 'Birdie', 'Eagle', 'Par', etc.
}

export interface TournamentState {
  id: string;
  name: string;
  tier: 'Regional Open' | 'Continental Cup' | 'World Championship';
  purseCoins: number;
  trophyReward: string;
  courseId: string;
  currentHoleIndex: number;
  totalHoles: number;
  leaderboard: TournamentCompetitor[];
  roundState: 'ready' | 'playing_hole' | 'hole_recap' | 'podium';
  /** Seed for reproducible bot selection and bot play. */
  seed: number;
}

export interface FootGolfBallCustomization {
  id: string;
  name: string;
  pattern: 'classic_telstar' | 'neon_striker' | 'golden_champion' | 'fire_vortex' | 'sakura_bloom' | 'galaxy_comet';
  primaryColor: string;
  secondaryColor: string;
  bonusLoft: number;
  bonusRoll: number;
  unlocked: boolean;
  cost: number;
}

export type MotionTrailStyleId =
  | 'championship_gold'
  | 'neon_emerald'
  | 'fire_vortex'
  | 'ice_comet'
  | 'cosmic_violet'
  | 'solar_flare';

export interface MotionTrailConfig {
  id: MotionTrailStyleId;
  name: string;
  description: string;
  baseColor: string;       // Default tracer color, e.g. '#f59e0b'
  highPowerColor: string;  // Color when high power / sweet spot strike is executed, e.g. '#ef4444'
  spinLeftColor: string;   // Color shift on hook / left spin, e.g. '#06b6d4'
  spinRightColor: string;  // Color shift on slice / right spin, e.g. '#ec4899'
  particleColor?: string;  // Vapor wake spark tint
  ribbonWidth: number;     // Width multiplier
  unlocked?: boolean;
}

export interface PlayerAttributes {
  power: number;       // Level 1-10 (+2.5% max carry distance per level above 1)
  accuracy: number;    // Level 1-10 (tightens sweet spot and reduces off-center error)
  spinControl: number; // Level 1-10 (amplifies aerodynamic Magnus curl and green bite)
  finesse: number;     // Level 1-10 (widens putting cup capture speed threshold)
}

export interface PlayerProfile {
  name: string;
  rankTitle: string;
  trophies: number;
  coins: number;
  tournamentsWon: number;
  equippedBallId: string;
  unlockedBalls: string[];
  equippedTrailId?: MotionTrailStyleId;
  customTrailConfig?: Partial<MotionTrailConfig>;
  attributes: PlayerAttributes;
  skillPoints: number;
  playerLevel: number;
  currentXp: number;
  xpToNextLevel: number;
  stats: {
    holesPlayed: number;
    eagles: number;
    birdies: number;
    pars: number;
    bogeys: number;
    holesInOne: number;
    longestKickMeters: number;
  };
}

export type MissionCategory = 'putt' | 'score' | 'distance' | 'bunker' | 'tournament' | 'curve' | 'clean' | 'par';

export interface DailyMission {
  id: string;
  title: string;
  description: string;
  category: MissionCategory;
  progress: number;
  target: number;
  unit?: string;
  rewardCoins: number;
  completed: boolean;
  claimed: boolean;
  icon: string;
}

export interface DailyMissionsState {
  dateKey: string;
  missions: DailyMission[];
  lastRefreshed: number;
}

export type GameScreen = 'title' | 'course_select' | 'tournament_hub' | 'playing' | 'paused' | 'hole_complete' | 'tournament_podium' | 'locker_room' | 'daily_missions';

export interface FlickGestureData {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  durationMs: number;
}

export interface FlickCalculationResult {
  power: number; // 0.1 to 1.0
  aimAngleOffset: number; // in radians
  effectiveAimAngleRad: number;
  flickSlice: number; // -1 to 1 (left to right slice)
  effectiveSpin: SpinControl;
  speedKmh: number;
  kickVelocity: { velocity: Vector3D; spin: Vector3D };
  isSweetSpot?: boolean;
  strikeRating?: 'pure' | 'great' | 'solid' | 'push' | 'pull' | 'standard';
  strikeLabel?: string;
}

