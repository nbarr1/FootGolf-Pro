/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { FootGolfRenderer, CameraMode } from './game/renderer3d';
import {
  BALL_RADIUS,
  calculateFlickShot,
  calculateKickVelocity,
  generatePuttingReadLine,
  getEstimatedKickDistance,
  getSurfaceLie,
  getTerrainHeight,
  predictTrajectory,
  stepBallPhysics,
} from './game/physics';
import { COURSES } from './game/courses';
import { soundEngine } from './game/audio';
import {
  advanceTournamentHole,
  createTournament,
  simulateBotStrokes,
  INITIAL_BALLS,
  INITIAL_PLAYER_PROFILE,
} from './game/tournament';
import { triggerHaptic } from './game/haptics';
import { scoreHoleOut, strokesTakenFromCounter } from './game/core/holeScoring';
import { chooseKickType } from './game/core/botPlayer';
import { GameSettings, parseSettings, setActiveSettings, SETTINGS_STORAGE_KEY } from './game/settings';
import type { QualityTier } from './game/quality';
import {
  BallPhysicsState,
  CourseData,
  FlickGestureData,
  FootGolfBallCustomization,
  GameScreen,
  HoleData,
  KickType,
  MotionTrailConfig,
  MotionTrailStyleId,
  PlayerAttributes,
  PlayerProfile,
  SpinControl,
  TournamentState,
} from './types';

// Modals and UI
import { TitleScreen } from './components/TitleScreen';
import { GameHUD } from './components/GameHUD';
import { SpinModal } from './components/SpinModal';
import { CourseSelectModal } from './components/CourseSelectModal';
import { TournamentHubModal } from './components/TournamentHubModal';
import { LockerRoomModal } from './components/LockerRoomModal';
import { HoleCompleteModal } from './components/HoleCompleteModal';
import { TournamentPodiumModal } from './components/TournamentPodiumModal';
import { PauseModal } from './components/PauseModal';
import { DailyMissionsModal } from './components/DailyMissionsModal';
import { TournamentLeaderboardModal } from './components/TournamentLeaderboardModal';
import { ArcadeShotOverlay } from './components/ArcadeShotOverlay';
import { ArcadeShotExecutionResult } from './game/arcadeControls';
import { FlickShotOverlay } from './components/FlickShotOverlay';
import { VerticalPowerFeedbackBar, SwipeFeedbackData } from './components/VerticalPowerFeedbackBar';
import { ReplayOverlay } from './components/ReplayOverlay';
import {
  ReplayRecorder,
  ReplayTrack,
  sampleReplayAt,
  getReplayCameraPose,
} from './game/replay';
import {

  claimDailyMission,
  checkHoleFinishedMissions,
  checkKickMissions,
  checkTournamentMissions,
  getOrRefreshDailyMissions,
} from './game/missions';
import { DailyMissionsState, Vector3D, SurfaceType } from './types';

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<FootGolfRenderer | null>(null);

  // High-level App State
  const [screen, setScreen] = useState<GameScreen>('title');
  const [currentCourse, setCurrentCourse] = useState<CourseData>(COURSES[0]);
  const [currentHoleIndex, setCurrentHoleIndex] = useState<number>(0);
  const currentHole = currentCourse.holes[currentHoleIndex] || currentCourse.holes[0];

  // Tournament and Player Profile
  const [profile, setProfile] = useState<PlayerProfile>(() => {
    try {
      const saved = localStorage.getItem('footgolf_profile');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...INITIAL_PLAYER_PROFILE,
          ...parsed,
          attributes: {
            ...INITIAL_PLAYER_PROFILE.attributes,
            ...(parsed.attributes || {}),
          },
          stats: {
            ...INITIAL_PLAYER_PROFILE.stats,
            ...(parsed.stats || {}),
          },
        };
      }
    } catch {
      // Ignored fallback
    }
    return INITIAL_PLAYER_PROFILE;
  });
  const [tournament, setTournament] = useState<TournamentState>(() =>
    createTournament(profile.name, COURSES[0].id, COURSES[0].holes.length, 'Continental Cup')
  );

  // Gameplay State
  const [strokeCount, setStrokeCount] = useState<number>(1);
  const [scoreRelativeToPar, setScoreRelativeToPar] = useState<number>(0);
  const [kickType, setKickType] = useState<KickType>('drive');
  const [power, setPower] = useState<number>(0.75);
  const [aimAngleRad, setAimAngleRad] = useState<number>(currentHole.defaultAimAngle);
  const [spin, setSpin] = useState<SpinControl>({ top: 0, side: 0 });
  const [wind, setWind] = useState<{ speed: number; angleRad: number }>({
    speed: 3.5,
    angleRad: 0.6,
  });
  const [cameraMode, setCameraMode] = useState<CameraMode>('aim');
  const [isFlyover, setIsFlyover] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isBallInMotion, setIsBallInMotion] = useState<boolean>(false);
  const [isRunUpApproaching, setIsRunUpApproaching] = useState<boolean>(false);

  // Putting Read Line & In-Flight Telemetry
  const [puttingReadLineData, setPuttingReadLineData] = useState<{
    points: Vector3D[];
    totalBreakDeg: number;
    breakDirection: 'left' | 'right' | 'straight';
    suggestedPower: number;
    elevationDeltaMeters?: number;
    stopsShortDistance?: number;
    reachesCup?: boolean;
    rollDistanceMeters?: number;
  } | null>(null);
  const [inFlightTelemetry, setInFlightTelemetry] = useState<{
    altitudeMeters: number;
    speedKmh: number;
    carryMeters: number;
  } | null>(null);

  // Hole-Out Celebratory Broadcast Banner
  const [holeOutCelebration, setHoleOutCelebration] = useState<{
    title: string;
    scoreLabel: string;
    scoreDelta: number;
    strokes: number;
    par: number;
    coinsEarned: number;
    distanceMeters: number;
  } | null>(null);

  // Pure Strike / Impact Sweet-Spot Feedback
  const [strikeFeedback, setStrikeFeedback] = useState<string | null>(null);

  // Modals state
  const [showSpinModal, setShowSpinModal] = useState<boolean>(false);
  const [showCourseSelect, setShowCourseSelect] = useState<boolean>(false);
  const [showTournamentHub, setShowTournamentHub] = useState<boolean>(false);
  const [showTournamentLeaderboard, setShowTournamentLeaderboard] = useState<boolean>(false);
  const [isMiniMapOpen, setIsMiniMapOpen] = useState<boolean>(true);
  const [showLockerRoom, setShowLockerRoom] = useState<boolean>(false);
  const [showDailyMissions, setShowDailyMissions] = useState<boolean>(false);

  // Control Mode: Premium Arcade Pullback (Golf Clash style) vs Classic Flick
  const [controlMode, setControlMode] = useState<'arcade' | 'classic'>('arcade');

  // Practice Mode & Swipe Power Feedback
  const [isPracticeMode, setIsPracticeMode] = useState<boolean>(false);
  const [liveSwipePower, setLiveSwipePower] = useState<number>(0);
  const [isSwipingGesture, setIsSwipingGesture] = useState<boolean>(false);
  const [lastSwipeFeedback, setLastSwipeFeedback] = useState<SwipeFeedbackData | null>(null);
  const [isFastForward, setIsFastForward] = useState<boolean>(false);

  // Daily Missions System
  const [dailyMissionsState, setDailyMissionsState] = useState<DailyMissionsState>(() => {
    try {
      const saved = localStorage.getItem('footgolf_daily_missions');
      return getOrRefreshDailyMissions(saved ? JSON.parse(saved) : undefined);
    } catch {
      return getOrRefreshDailyMissions();
    }
  });
  const [missionToast, setMissionToast] = useState<{ title: string; reward: number; icon: string } | null>(null);

  // Current Hole Hazard Tracking (for missions)
  const currentHoleHitBunkerRef = useRef<boolean>(false);
  const currentHoleHitWaterRef = useRef<boolean>(false);
  const kickStartPosRef = useRef<Vector3D>({ ...currentHole.teePosition });
  const kickStartLieRef = useRef<SurfaceType>('tee');
  const lastHeartbeatTimeRef = useRef<number>(0);

  // Green Slope Contour Topography Grid
  const [showGreenGrid, setShowGreenGrid] = useState<boolean>(true);

  // Instant Replay System
  const [lastReplayTrack, setLastReplayTrack] = useState<ReplayTrack | null>(null);
  const [activeReplayTrack, setActiveReplayTrack] = useState<ReplayTrack | null>(null);
  const [replayTime, setReplayTime] = useState<number>(0);
  const [isReplayPlaying, setIsReplayPlaying] = useState<boolean>(true);
  const [replaySpeed, setReplaySpeed] = useState<number>(1.0);
  const [replayCameraAngle, setReplayCameraAngle] = useState<'broadcast' | 'follow' | 'reverse_pin'>('broadcast');

  const currentShotRecorderRef = useRef<ReplayRecorder | null>(null);
  const shotElapsedTimeRef = useRef<number>(0);


  // Player settings (quality, reduced motion, vibration)
  const [settings, setSettings] = useState<GameSettings>(() => {
    try {
      return parseSettings(localStorage.getItem(SETTINGS_STORAGE_KEY));
    } catch {
      return parseSettings(null);
    }
  });
  const [activeQualityTier, setActiveQualityTier] = useState<QualityTier>('medium');
  setActiveSettings(settings);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Storage unavailable (private mode); settings stay in memory
    }
  }, [settings]);

  useEffect(() => {
    rendererRef.current?.setQualityPreference(settings.quality);
  }, [settings.quality]);

  // Precompute bot scores for the current tournament hole one bot at a time, so the
  // physics simulation doesn't stall the frame when the player holes out.
  const botScoresRef = useRef<{ key: string; scores: Record<string, number> }>({ key: '', scores: {} });
  useEffect(() => {
    const key = `${tournament.id}:${tournament.currentHoleIndex}`;
    botScoresRef.current = { key, scores: {} };
    const bots = tournament.leaderboard.filter((c) => !c.isPlayer);
    let index = 0;
    let timer: ReturnType<typeof setTimeout>;
    const step = () => {
      if (botScoresRef.current.key !== key || index >= bots.length) return;
      const bot = bots[index++];
      botScoresRef.current.scores[bot.id] = simulateBotStrokes(tournament, bot.id, bot.skillRating, currentHole, wind);
      timer = setTimeout(step, 30);
    };
    timer = setTimeout(step, 500);
    return () => clearTimeout(timer);
  }, [tournament.id, tournament.currentHoleIndex, currentHole, wind]);

  // Save daily missions state
  useEffect(() => {
    localStorage.setItem('footgolf_daily_missions', JSON.stringify(dailyMissionsState));
  }, [dailyMissionsState]);

  // Live Physics Ball State (Mutable ref for 60Hz loop decoupled from React state)
  const initialBallState: BallPhysicsState = {
    position: { ...currentHole.teePosition, y: currentHole.teePosition.y + BALL_RADIUS },
    velocity: { x: 0, y: 0, z: 0 },
    spin: { x: 0, y: 0, z: 0 },
    isGrounded: true,
    isRolling: false,
    isSleeping: true,
    inWater: false,
    inHole: false,
    lie: 'tee',
    lastValidPosition: { ...currentHole.teePosition, y: currentHole.teePosition.y + BALL_RADIUS },
    distanceTraveledInShot: 0,
    airTime: 0,
  };

  const ballStateRef = useRef<BallPhysicsState>({ ...initialBallState });
  const [hudBallLie, setHudBallLie] = useState(initialBallState.lie);
  const [hudBallPos, setHudBallPos] = useState(initialBallState.position);

  // Sync state to body dataset per game shell guidelines
  useEffect(() => {
    document.body.dataset.state =
      screen === 'title' ? 'title' : screen === 'paused' ? 'paused' : screen === 'playing' ? 'playing' : 'gameover';
  }, [screen]);

  // Save profile changes
  useEffect(() => {
    localStorage.setItem('footgolf_profile', JSON.stringify(profile));
  }, [profile]);

  // Autostart query parameter support (?autostart=1)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      setScreen('playing');
    }
  }, []);

  // Update aim trajectory & slope-aware putting read line visualization
  const updateAimVisuals = useCallback(
    (angle: number, p: number, kType: KickType, sp: SpinControl, activeScreen?: GameScreen) => {
      if (!rendererRef.current) return;
      rendererRef.current.setAimAngle(angle);
      rendererRef.current.setKickType(kType);

      const isCurrentScreenPlaying = (activeScreen || screen) === 'playing';

      if (isCurrentScreenPlaying && ballStateRef.current.isSleeping && !ballStateRef.current.inHole) {
        const trajectory = predictTrajectory(
          ballStateRef.current.position,
          kType,
          p,
          angle,
          sp,
          ballStateRef.current.lie,
          currentHole,
          wind
        );
        rendererRef.current.updateTrajectoryLine(trajectory, true);

        // Putting Read Line when on green or putting
        if (kType === 'putt' || ballStateRef.current.lie === 'green') {
          const readLine = generatePuttingReadLine(
            ballStateRef.current.position,
            currentHole.pinPosition,
            angle,
            p,
            currentHole
          );
          const pointsOnly = readLine.points.map((pt) => pt.position);
          setPuttingReadLineData({
            points: pointsOnly,
            totalBreakDeg: readLine.totalBreakDeg,
            breakDirection: readLine.breakDirection,
            suggestedPower: readLine.suggestedPower,
            elevationDeltaMeters: readLine.elevationDeltaMeters,
            stopsShortDistance: readLine.stopsShortDistance,
            reachesCup: readLine.reachesCup,
            rollDistanceMeters: readLine.rollDistanceMeters,
          });
          rendererRef.current.updatePuttingReadLine(pointsOnly, true, readLine.reachesCup);
        } else {
          setPuttingReadLineData(null);
          rendererRef.current.updatePuttingReadLine([], false);
        }

        const toPinDist = Math.hypot(
          currentHole.pinPosition.x - ballStateRef.current.position.x,
          currentHole.pinPosition.z - ballStateRef.current.position.z
        );
        const shouldShowGrid = showGreenGrid && (kType === 'putt' || ballStateRef.current.lie === 'green' || toPinDist < 35);
        rendererRef.current.updateGreenGrid(currentHole, shouldShowGrid);
      } else {
        rendererRef.current.updateTrajectoryLine([], false);
        rendererRef.current.updatePuttingReadLine([], false);
        rendererRef.current.updateGreenGrid(currentHole, false);
        setPuttingReadLineData(null);
      }
    },
    [currentHole, wind, screen, showGreenGrid]
  );


  // 1. Initialize Three.js WebGL Scene Once
  useEffect(() => {
    if (!canvasMountRef.current) return;

    const renderer = new FootGolfRenderer(canvasMountRef.current, currentCourse, currentHole, settingsRef.current.quality);
    setActiveQualityTier(renderer.getQualityTier());
    renderer.onQualityChange(setActiveQualityTier);
    rendererRef.current = renderer;
    renderer.setActiveHole(currentHole);
    renderer.setActiveWind(wind);

    // Apply equipped ball colors
    const equippedBall = INITIAL_BALLS.find((b) => b.id === profile.equippedBallId) || INITIAL_BALLS[0];
    renderer.updateBallCustomization(equippedBall.primaryColor, equippedBall.secondaryColor);

    // Apply equipped motion trail customization
    if (profile.equippedTrailId) {
      renderer.setMotionTrailStyle(profile.equippedTrailId);
    }
    if (profile.customTrailConfig) {
      renderer.setMotionTrailConfig(profile.customTrailConfig);
    }

    updateAimVisuals(aimAngleRad, power, kickType, spin);

    // Physics runs inside the renderer's frame loop so there is a single requestAnimationFrame
    renderer.setFrameHook((rawDt) => physicsTickRef.current(rawDt));

    // Expose the renderer in development builds for automated browser checks
    if (import.meta.env.DEV) {
      (window as unknown as { __footgolf?: FootGolfRenderer }).__footgolf = renderer;
    }

    return () => {
      renderer.dispose();
      rendererRef.current = null;
    };
  }, []);

  // Synchronized state references for high-frequency physics RAF loop to prevent loop resets
  const strokeCountRef = useRef(strokeCount);
  strokeCountRef.current = strokeCount;
  const tournamentRef = useRef(tournament);
  tournamentRef.current = tournament;
  const missionsRef = useRef(dailyMissionsState.missions);
  missionsRef.current = dailyMissionsState.missions;
  const kickTypeRef = useRef(kickType);
  kickTypeRef.current = kickType;
  const powerRef = useRef(power);
  powerRef.current = power;
  const spinRef = useRef(spin);
  spinRef.current = spin;
  const isFastForwardRef = useRef(isFastForward);
  isFastForwardRef.current = isFastForward;
  // Gameplay time scaling (slow motion near the cup) and hit-stop on perfect strikes
  const timeScaleRef = useRef(1);
  const hitStopUntilRef = useRef(0);

  // 2. Deterministic fixed-timestep physics (60 Hz), driven by the renderer's single frame loop.
  // The tick function is re-created on every render so it always sees the latest state,
  // while the renderer holds a stable hook that calls whatever tick is current.
  const physicsAccumulatorRef = useRef(0);
  const prevBallPosRef = useRef<Vector3D | null>(null);
  const lastTelemetryTimeRef = useRef(0);
  const physicsTickRef = useRef<(rawDt: number) => void>(() => {});
  physicsTickRef.current = (rawDt: number) => {
    const FIXED_DT = 1 / 60; // 60Hz deterministic physics step
    let accumulator = physicsAccumulatorRef.current;

    {
      const state = ballStateRef.current;

      const inHitStop = performance.now() < hitStopUntilRef.current;
      if (inHitStop) {
        // Freeze the simulation briefly on contact so strikes feel weighty
      } else if (!state.isSleeping && !state.inHole) {
        const timeScale = (isFastForwardRef.current ? 2.4 : 1.0) * timeScaleRef.current;
        // Cap accumulator to 0.12s to prevent spiral of death during backgrounding or frame hitches
        accumulator += Math.min(rawDt * timeScale, 0.12);

        while (accumulator >= FIXED_DT && !ballStateRef.current.isSleeping && !ballStateRef.current.inHole) {
          prevBallPosRef.current = { ...ballStateRef.current.position };
          const result = stepBallPhysics(
            ballStateRef.current,
            currentHole,
            wind,
            FIXED_DT,
            profile.attributes?.finesse || 1
          );
          ballStateRef.current = result.state;
          accumulator -= FIXED_DT;

          // Record keyframe for Instant Replay system
          shotElapsedTimeRef.current += FIXED_DT;
          currentShotRecorderRef.current?.recordFrame(
            shotElapsedTimeRef.current,
            result.state.position,
            result.state.velocity,
            result.state.spin
          );

          // Update 3D ball in renderer with position, spin, and velocity
          if (rendererRef.current) {
            rendererRef.current.setBallPosition(
              result.state.position,
              result.state.spin,
              result.state.velocity
            );

            // Update live in-flight telemetry
            const groundH = getTerrainHeight(currentHole, result.state.position.x, result.state.position.z);
            const alt = Math.max(0, result.state.position.y - (groundH + BALL_RADIUS));
            const spd = Math.hypot(result.state.velocity.x, result.state.velocity.y, result.state.velocity.z) * 3.6;
            const carry = Math.hypot(
              result.state.position.x - kickStartPosRef.current.x,
              result.state.position.z - kickStartPosRef.current.z
            );
            // Throttle HUD telemetry to ~12 Hz so React doesn't re-render at the physics rate
            const telemetryNow = performance.now();
            if (telemetryNow - lastTelemetryTimeRef.current > 80) {
              lastTelemetryTimeRef.current = telemetryNow;
              setInFlightTelemetry({
                altitudeMeters: alt,
                speedKmh: spd,
                carryMeters: carry,
              });
            }

            // Audio, particle, camera impact, and haptic triggers
            if (result.events.hitPin) {
              soundEngine.playPinClink();
              soundEngine.playCrowdCheer('applause');
              rendererRef.current.emitPinSpark(result.state.position);
              rendererRef.current.triggerCameraImpact(0.35);
              triggerHaptic('heavy');
              setStrikeFeedback('🎯 PIN STRIKE! DIRECT HIT');
              setTimeout(() => setStrikeFeedback(null), 2400);
            }

            if (result.events.lippedOut) {
              soundEngine.playLipOut();
              soundEngine.playCrowdGasp();
              rendererRef.current.emitPinSpark(result.state.position);
              rendererRef.current.triggerCameraImpact(0.28);
              triggerHaptic('heavy');
              setStrikeFeedback('⚡ LIP-OUT! SHAVED THE CUP!');
              setTimeout(() => setStrikeFeedback(null), 2400);
            }

            // Dramatic Cup Proximity Heartbeat Tension Cue
            const distToPinCurrent = Math.hypot(
              result.state.position.x - currentHole.pinPosition.x,
              result.state.position.z - currentHole.pinPosition.z
            );
            const ballSpeedNow = Math.hypot(
              result.state.velocity.x,
              result.state.velocity.y,
              result.state.velocity.z
            );
            if (
              distToPinCurrent > 0.12 &&
              distToPinCurrent < 2.6 &&
              ballSpeedNow > 0.2 &&
              ballSpeedNow < 3.6 &&
              !result.state.isSleeping &&
              !result.state.inHole
            ) {
              const now = performance.now();
              if (now - lastHeartbeatTimeRef.current > 620) {
                lastHeartbeatTimeRef.current = now;
                soundEngine.playHeartbeat();
                triggerHaptic('light');
              }
            }

            if (result.events.bounced) {
              soundEngine.playBounce(result.events.surface, result.events.impactSpeed);
              if (result.events.impactSpeed > 4.2) {
                rendererRef.current.triggerCameraImpact(Math.min(0.42, result.events.impactSpeed * 0.04));
                triggerHaptic('heavy');
              }
              if (result.events.surface === 'sand') {
                currentHoleHitBunkerRef.current = true;
              }
              rendererRef.current.emitParticles(
                result.state.position,
                6,
                result.events.surface === 'sand' ? 0xe0c98b : 0x4caf50
              );
            }

          if (result.events.splashed) {
            soundEngine.playSplash();
            setIsFastForward(false);
            currentHoleHitWaterRef.current = true;
            rendererRef.current.setBallInFlight(false);
            setInFlightTelemetry(null);
            rendererRef.current.emitWaterSplash(result.state.position);
            // Penalty reset to last valid position after delay
            setTimeout(() => {
              const resetY = getTerrainHeight(currentHole, state.lastValidPosition.x, state.lastValidPosition.z) + BALL_RADIUS;
              ballStateRef.current = {
                ...ballStateRef.current,
                position: { ...state.lastValidPosition, y: resetY },
                velocity: { x: 0, y: 0, z: 0 },
                spin: { x: 0, y: 0, z: 0 },
                isGrounded: true,
                isRolling: false,
                isSleeping: true,
                inWater: false,
                lie: getSurfaceLie(currentHole, state.lastValidPosition.x, state.lastValidPosition.z),
              };
              setStrokeCount((s) => s + 1); // 1 penalty stroke
              setIsBallInMotion(false);
              rendererRef.current?.setCameraMode('aim');
              setCameraMode('aim');
              rendererRef.current?.setBallPosition(ballStateRef.current.position);
              setHudBallPos({ ...ballStateRef.current.position });
              setHudBallLie(ballStateRef.current.lie);
            }, 900);
          }

          if (result.events.holed) {
            soundEngine.playHoleIn();
            triggerHaptic('pure');
            rendererRef.current?.playCharacterCelebration();
            setIsFastForward(false);
            const holeStrokes = strokesTakenFromCounter(strokeCountRef.current);
            const finalShotDist = Math.round(
              Math.hypot(
                result.state.position.x - kickStartPosRef.current.x,
                result.state.position.z - kickStartPosRef.current.z
              )
            );
            const holeOut = scoreHoleOut(holeStrokes, currentHole.par, finalShotDist);
            const holeDelta = holeOut.scoreDelta;

            // Finalize shot recording for instant replay
            if (currentShotRecorderRef.current) {
              const track = currentShotRecorderRef.current.finalize(
                shotElapsedTimeRef.current,
                finalShotDist,
                true
              );
              if (track) setLastReplayTrack(track);
            }

            if (holeOut.isLongSink) {
              soundEngine.playLongHoleOut();
            } else {
              soundEngine.playFanfare(holeDelta);
            }
            soundEngine.playCrowdCheer(holeOut.crowd);

            rendererRef.current.emitConfetti(currentHole.pinPosition, holeOut.isLongSink ? 125 : 95);
            setIsBallInMotion(false);
            rendererRef.current.setBallInFlight(false);
            setInFlightTelemetry(null);
            rendererRef.current.setCameraMode('green');
            setCameraMode('green');

            setHoleOutCelebration({
              title: holeOut.title,
              scoreLabel: holeOut.scoreLabel,
              scoreDelta: holeDelta,
              strokes: holeStrokes,
              par: currentHole.par,
              coinsEarned: holeOut.coins,
              distanceMeters: finalShotDist,
            });

            // Evaluate Daily Missions for hole completion
            const { missions: updatedHoleMissions, newlyCompleted: holeNewlyCompleted } = checkHoleFinishedMissions(
              missionsRef.current,
              {
                par: currentHole.par,
                strokes: holeStrokes,
                finalShotDistanceMeters: finalShotDist,
                finalShotKickType: kickTypeRef.current,
                hitBunker: currentHoleHitBunkerRef.current,
                hitWater: currentHoleHitWaterRef.current,
              }
            );
            if (holeNewlyCompleted.length > 0) {
              const m = holeNewlyCompleted[0];
              setMissionToast({ title: m.title, reward: m.rewardCoins, icon: m.icon });
              setTimeout(() => setMissionToast(null), 4500);
            }
            setDailyMissionsState((prev) => ({ ...prev, missions: updatedHoleMissions }));

            // Record stats, XP, and Skill Points
            const holeXp = holeOut.xp;
            setProfile((prev) => {
              const stats = { ...prev.stats };
              stats.holesPlayed += 1;
              if (holeDelta <= -2) stats.eagles += 1;
              else if (holeDelta === -1) stats.birdies += 1;
              else if (holeDelta === 0) stats.pars += 1;
              else stats.bogeys += 1;

              let currentXp = (prev.currentXp || 0) + holeXp;
              let playerLevel = prev.playerLevel || 1;
              let skillPoints = prev.skillPoints || 0;
              let xpToNextLevel = prev.xpToNextLevel || 250;
              let didLevelUp = false;

              while (currentXp >= xpToNextLevel) {
                currentXp -= xpToNextLevel;
                playerLevel += 1;
                skillPoints += 1;
                xpToNextLevel = Math.round(xpToNextLevel * 1.35);
                didLevelUp = true;
              }

              if (didLevelUp) {
                triggerHaptic('pure');
                setStrikeFeedback(`🌟 LEVEL UP! LEVEL ${playerLevel} (+1 SKILL POINT)`);
                setTimeout(() => setStrikeFeedback(null), 3500);
              }

              return {
                ...prev,
                coins: prev.coins + holeOut.coins,
                currentXp,
                playerLevel,
                skillPoints,
                xpToNextLevel,
                stats,
              };
            });

            // Advance tournament
            const updatedTourney = advanceTournamentHole(
              tournamentRef.current,
              holeStrokes,
              currentHole,
              wind,
              botScoresRef.current.key === `${tournamentRef.current.id}:${tournamentRef.current.currentHoleIndex}`
                ? botScoresRef.current.scores
                : undefined
            );
            setTournament(updatedTourney);

            if (updatedTourney.roundState === 'podium') {
              // Evaluate Tournament Daily Missions
              const playerComp = updatedTourney.leaderboard.find((c) => c.isPlayer);
              const playerRank = playerComp?.rank || 8;
              const { missions: tourneyMissions, newlyCompleted: tourneyCompleted } = checkTournamentMissions(
                updatedHoleMissions,
                {
                  rank: playerRank,
                  totalStrokes: playerComp?.totalStrokes || 0,
                  scoreRelativeToPar: playerComp?.scoreRelativeToPar || 0,
                }
              );
              setDailyMissionsState((prev) => ({ ...prev, missions: tourneyMissions }));
              if (tourneyCompleted.length > 0) {
                const m = tourneyCompleted[0];
                setMissionToast({ title: m.title, reward: m.rewardCoins, icon: m.icon });
                setTimeout(() => setMissionToast(null), 4500);
              }
            }

            setTimeout(() => {
              setHoleOutCelebration(null);
              if (updatedTourney.roundState === 'podium') {
                setScreen('tournament_podium');
              } else {
                setScreen('hole_complete');
              }
            }, 2300);
          }

          if (result.events.stopped && !result.state.inHole) {
            setIsFastForward(false);
            setIsBallInMotion(false);
            setIsRunUpApproaching(false);
            ballStateRef.current = {
              ...result.state,
              isSleeping: true,
              velocity: { x: 0, y: 0, z: 0 },
              spin: { x: 0, y: 0, z: 0 },
            };
            rendererRef.current?.setBallInFlight(false);
            setInFlightTelemetry(null);
            rendererRef.current?.setCameraMode('aim');
            setCameraMode('aim');
            setHudBallPos({ ...result.state.position });
            setHudBallLie(result.state.lie);

            // Finalize shot recording for instant replay
            const shotDist = Math.hypot(
              result.state.position.x - kickStartPosRef.current.x,
              result.state.position.z - kickStartPosRef.current.z
            );
            if (currentShotRecorderRef.current) {
              const track = currentShotRecorderRef.current.finalize(
                shotElapsedTimeRef.current,
                shotDist,
                false
              );
              if (track) setLastReplayTrack(track);
            }

            // Track shot distance and check kick missions
            setProfile((prev) => {
              const longest = Math.max(prev.stats.longestKickMeters, Math.round(shotDist));
              return {
                ...prev,
                stats: { ...prev.stats, longestKickMeters: longest },
              };
            });

            const { missions: updatedKickMissions, newlyCompleted: kickCompleted } = checkKickMissions(
              missionsRef.current,
              {
                kickType: kickTypeRef.current,
                distanceMeters: shotDist,
                spin: spinRef.current,
                startLie: kickStartLieRef.current,
                endLie: result.state.lie,
              }
            );
            setDailyMissionsState((prev) => ({ ...prev, missions: updatedKickMissions }));
            if (kickCompleted.length > 0) {
              const m = kickCompleted[0];
              setMissionToast({ title: m.title, reward: m.rewardCoins, icon: m.icon });
              setTimeout(() => setMissionToast(null), 4500);
            }

            // Suggest kick type depending on distance/lie
            const toPinX = currentHole.pinPosition.x - result.state.position.x;
            const toPinZ = currentHole.pinPosition.z - result.state.position.z;
            const dist = Math.sqrt(toPinX * toPinX + toPinZ * toPinZ);
            const nextKType: KickType = chooseKickType(result.state.lie, dist);
            setKickType(nextKType);

            // Aim towards cup automatically on rest
            const autoAim = Math.atan2(toPinX, toPinZ);
            setAimAngleRad(autoAim);
            rendererRef.current?.onBallStopped(result.state.position, autoAim);
            updateAimVisuals(autoAim, powerRef.current, nextKType, spinRef.current);
          }
        }
      }
      } else {
        accumulator = 0;
        prevBallPosRef.current = null;
      }
    }

    physicsAccumulatorRef.current = accumulator;

    // Render interpolation: blend between the last two physics states so ball motion
    // stays smooth on displays faster than 60 Hz.
    const live = ballStateRef.current;
    const prev = prevBallPosRef.current;
    if (prev && !live.isSleeping && !live.inHole && rendererRef.current) {
      const alpha = Math.min(1, accumulator / FIXED_DT);
      rendererRef.current.setBallRenderPosition({
        x: prev.x + (live.position.x - prev.x) * alpha,
        y: prev.y + (live.position.y - prev.y) * alpha,
        z: prev.z + (live.position.z - prev.z) * alpha,
      });
    }
  };

  // Practice Swing Callback
  const handlePracticeSwing = useCallback(
    (result: {
      power: number;
      speedKmh: number;
      slicePercent: number;
      carryMeters: number;
      totalMeters: number;
      strikeRating: 'pure' | 'great' | 'solid' | 'push' | 'pull' | 'standard';
    }) => {
      soundEngine.playPracticeWhoosh(result.power);
      triggerHaptic('light');
      setPower(result.power);

      setLastSwipeFeedback({
        power: result.power,
        speedKmh: result.speedKmh,
        carryMeters: result.carryMeters,
        totalMeters: result.totalMeters,
        slicePercent: result.slicePercent,
        isPractice: true,
        timestamp: Date.now(),
        strikeRating: result.strikeRating,
      });

      const sliceDesc =
        Math.abs(result.slicePercent) >= 8
          ? result.slicePercent > 0
            ? ` · Slice ↷ +${result.slicePercent}%`
            : ` · Hook ↶ ${result.slicePercent}%`
          : ' · Straight';

      const ratingBadge =
        result.strikeRating === 'pure'
          ? '⚡ PURE TOUCH'
          : result.strikeRating === 'great'
          ? '🎯 CRISP CONTACT'
          : result.strikeRating === 'push'
          ? '↷ PUSH'
          : result.strikeRating === 'pull'
          ? '↶ PULL'
          : '⚽ SOLID';

      setStrikeFeedback(
        `🎯 PRACTICE: ${ratingBadge} · ${Math.round(result.power * 100)}% PWR (${result.speedKmh} km/h) · ~${result.totalMeters}m${sliceDesc}`
      );
      setTimeout(() => setStrikeFeedback(null), 2500);
    },
    []
  );

  // Flick Gesture Shot Action (speed dictates power, swipe curve dictates slice/hook + English)
  const handleFlickShot = useCallback(
    (gesture: FlickGestureData) => {
      if (isBallInMotion || ballStateRef.current.inHole || screen !== 'playing' || isRunUpApproaching) return;

      const flick = calculateFlickShot(
        gesture,
        aimAngleRad,
        spin,
        kickType,
        ballStateRef.current.lie,
        profile.attributes
      );

      // Update power & aim to reflect gesture
      setPower(flick.power);
      setAimAngleRad(flick.effectiveAimAngleRad);

      const est = getEstimatedKickDistance(kickType, flick.power, ballStateRef.current.lie);
      setLastSwipeFeedback({
        power: flick.power,
        speedKmh: flick.speedKmh,
        carryMeters: est.carryMeters,
        totalMeters: est.totalMeters,
        slicePercent: Math.round(flick.flickSlice * 100),
        isPractice: false,
        timestamp: Date.now(),
        strikeRating: flick.strikeRating,
      });

      // Character Run-Up approach or putting stroke execution
      setIsRunUpApproaching(true);

      const fireStrike = () => {
        // Haptic feedback: longer weighted rhythmic pattern on pure strikes!
        if (flick.strikeRating === 'pure') {
          triggerHaptic('pure');
          soundEngine.playSweetSpotKick(flick.power, kickType);
          rendererRef.current?.emitPureStrike(ballStateRef.current.position);
          setStrikeFeedback('⚡ PURE SWEET STRIKE! +4% BOOST');
          setTimeout(() => setStrikeFeedback(null), 1800);
        } else if (flick.strikeRating === 'great') {
          triggerHaptic('heavy');
          soundEngine.playKick(flick.power, kickType);
          setStrikeFeedback('🎯 CRISP CONTACT');
          setTimeout(() => setStrikeFeedback(null), 1400);
        } else if (flick.strikeRating === 'push') {
          triggerHaptic('heavy');
          soundEngine.playKick(flick.power, kickType);
          setStrikeFeedback('↷ PUSH SLICE');
          setTimeout(() => setStrikeFeedback(null), 1400);
        } else if (flick.strikeRating === 'pull') {
          triggerHaptic('heavy');
          soundEngine.playKick(flick.power, kickType);
          setStrikeFeedback('↶ PULL HOOK');
          setTimeout(() => setStrikeFeedback(null), 1400);
        } else {
          triggerHaptic('heavy');
          soundEngine.playKick(flick.power, kickType);
        }

        // Save kick starting position & lie for daily mission calculations
        kickStartPosRef.current = { ...ballStateRef.current.position };
        kickStartLieRef.current = ballStateRef.current.lie;

        // Divot grass / sand particles at kick spot
        rendererRef.current?.emitParticles(
          ballStateRef.current.position,
          14,
          ballStateRef.current.lie === 'sand' ? 0xe0c98b : 0x4caf50
        );

        ballStateRef.current = {
          ...ballStateRef.current,
          velocity: flick.kickVelocity.velocity,
          spin: flick.kickVelocity.spin,
          isGrounded: kickType === 'putt',
          isRolling: kickType === 'putt',
          isSleeping: false,
        };

        // Initialize Instant Replay recorder
        shotElapsedTimeRef.current = 0;
        currentShotRecorderRef.current = new ReplayRecorder({
          holeNumber: currentHole.number,
          strokeNumber: strokeCount,
          kickType,
          distanceMeters: 0,
          isHoleOut: false,
        });
        currentShotRecorderRef.current.recordFrame(
          0,
          ballStateRef.current.position,
          flick.kickVelocity.velocity,
          flick.kickVelocity.spin
        );

        setIsBallInMotion(true);
        setStrokeCount((s) => s + 1);

        // Switch camera to dynamic flight follow cam and enable motion trail
        rendererRef.current?.setShotDynamics(flick.power, flick.effectiveSpin, flick.strikeRating);
        rendererRef.current?.setBallInFlight(true);
        rendererRef.current?.setCameraMode('flight');
        setCameraMode('flight');
        rendererRef.current?.updateTrajectoryLine([], false);
      };

      if (rendererRef.current) {
        rendererRef.current.startCharacterKick(
          kickType,
          fireStrike,
          () => {
            setIsRunUpApproaching(false);
          }
        );
      } else {
        fireStrike();
        setIsRunUpApproaching(false);
      }
    },
    [aimAngleRad, currentHole.number, isBallInMotion, isRunUpApproaching, kickType, profile.attributes, screen, spin, strokeCount]
  );

  // Arcade Drag-and-Release Pullback Shot Action (Golf Clash / Ultimate Golf)
  const handleArcadeShot = useCallback(
    (arcade: ArcadeShotExecutionResult) => {
      if (isBallInMotion || ballStateRef.current.inHole || screen !== 'playing' || isRunUpApproaching) return;

      setPower(arcade.power);
      setAimAngleRad(arcade.effectiveAimAngleRad);

      setLastSwipeFeedback({
        power: arcade.power,
        speedKmh: arcade.speedKmh,
        carryMeters: arcade.estimatedCarryMeters,
        totalMeters: arcade.estimatedTotalMeters,
        slicePercent: Math.round(arcade.timing.sideSpinDeviation * 100),
        isPractice: false,
        timestamp: Date.now(),
        strikeRating: arcade.timing.rating === 'perfect' ? 'pure' : arcade.timing.rating === 'great' ? 'great' : arcade.timing.rating === 'good' ? 'solid' : 'standard',
      });

      setIsRunUpApproaching(true);

      const fireStrike = () => {
        if (arcade.timing.rating === 'perfect') {
          triggerHaptic('pure');
          soundEngine.playSweetSpotKick(arcade.power, kickType);
          rendererRef.current?.emitPureStrike(ballStateRef.current.position);
          setStrikeFeedback('⚡ PERFECT STRIKE! 1.0x ACCURACY');
          setTimeout(() => setStrikeFeedback(null), 1800);
        } else if (arcade.timing.rating === 'great') {
          triggerHaptic('heavy');
          soundEngine.playKick(arcade.power, kickType);
          setStrikeFeedback('🎯 GREAT SHOT');
          setTimeout(() => setStrikeFeedback(null), 1400);
        } else if (arcade.timing.rating === 'good') {
          triggerHaptic('heavy');
          soundEngine.playKick(arcade.power, kickType);
          setStrikeFeedback('👍 GOOD SHOT');
          setTimeout(() => setStrikeFeedback(null), 1400);
        } else {
          triggerHaptic('heavy');
          soundEngine.playKick(arcade.power, kickType);
          setStrikeFeedback(arcade.timing.lateralAngleOffsetRad > 0 ? '↷ SLICE!' : '↶ HOOK!');
          setTimeout(() => setStrikeFeedback(null), 1600);
        }

        kickStartPosRef.current = { ...ballStateRef.current.position };
        kickStartLieRef.current = ballStateRef.current.lie;

        rendererRef.current?.emitParticles(
          ballStateRef.current.position,
          14,
          ballStateRef.current.lie === 'sand' ? 0xe0c98b : 0x4caf50
        );

        ballStateRef.current = {
          ...ballStateRef.current,
          velocity: arcade.velocity,
          spin: arcade.spin,
          isGrounded: kickType === 'putt',
          isRolling: kickType === 'putt',
          isSleeping: false,
        };

        shotElapsedTimeRef.current = 0;
        currentShotRecorderRef.current = new ReplayRecorder({
          holeNumber: currentHole.number,
          strokeNumber: strokeCount,
          kickType,
          distanceMeters: 0,
          isHoleOut: false,
        });
        currentShotRecorderRef.current.recordFrame(
          0,
          ballStateRef.current.position,
          arcade.velocity,
          arcade.spin
        );

        setIsBallInMotion(true);
        setStrokeCount((s) => s + 1);

        const ratingKey = arcade.timing.rating === 'perfect' ? 'pure' : arcade.timing.rating === 'great' ? 'great' : arcade.timing.rating === 'good' ? 'solid' : 'standard';
        rendererRef.current?.setShotDynamics(arcade.power, arcade.effectiveSpin, ratingKey);
        rendererRef.current?.setBallInFlight(true);
        rendererRef.current?.setCameraMode('flight');
        setCameraMode('flight');
        rendererRef.current?.updateTrajectoryLine([], false);
      };

      if (rendererRef.current) {
        rendererRef.current.startCharacterKick(
          kickType,
          fireStrike,
          () => {
            setIsRunUpApproaching(false);
          }
        );
      } else {
        fireStrike();
        setIsRunUpApproaching(false);
      }
    },
    [currentHole.number, isBallInMotion, isRunUpApproaching, kickType, screen, strokeCount]
  );

  const handleUpgradeAttribute = (attrKey: keyof PlayerAttributes) => {
    if ((profile.skillPoints || 0) <= 0) return;
    const currentLvl = profile.attributes?.[attrKey] || 1;
    if (currentLvl >= 10) return;

    soundEngine.playTap();
    triggerHaptic('heavy');

    setProfile((prev) => ({
      ...prev,
      skillPoints: Math.max(0, (prev.skillPoints || 0) - 1),
      attributes: {
        ...prev.attributes,
        [attrKey]: currentLvl + 1,
      },
    }));
  };

  // Execute Kick Action (via button or spacebar)
  const handleExecuteKick = () => {
    if (isBallInMotion || ballStateRef.current.inHole || isRunUpApproaching) return;

    if (isPracticeMode) {
      const maxKmh = kickType === 'drive' ? 122 : kickType === 'chip' ? 78 : 46;
      const speedKmh = Math.round(power * maxKmh);
      const est = getEstimatedKickDistance(kickType, power, ballStateRef.current.lie);
      handlePracticeSwing({
        power,
        speedKmh,
        slicePercent: Math.round(spin.side * 65),
        carryMeters: est.carryMeters,
        totalMeters: est.totalMeters,
        strikeRating: power >= 0.85 ? 'pure' : power >= 0.65 ? 'great' : 'standard',
      });
      return;
    }

    const est = getEstimatedKickDistance(kickType, power, ballStateRef.current.lie);
    const maxKmh = kickType === 'drive' ? 122 : kickType === 'chip' ? 78 : 46;
    const isPure = power >= 0.88;
    setLastSwipeFeedback({
      power,
      speedKmh: Math.round(power * maxKmh),
      carryMeters: est.carryMeters,
      totalMeters: est.totalMeters,
      slicePercent: Math.round(spin.side * 65),
      isPractice: false,
      timestamp: Date.now(),
      strikeRating: isPure ? 'pure' : power >= 0.65 ? 'great' : 'standard',
    });

    setIsRunUpApproaching(true);

    const fireButtonKick = () => {
      if (isPure) {
        triggerHaptic('pure');
        soundEngine.playSweetSpotKick(power, kickType);
        rendererRef.current?.emitPureStrike(ballStateRef.current.position);
        setStrikeFeedback('⚡ PURE STRIKE!');
        setTimeout(() => setStrikeFeedback(null), 1800);
      } else {
        triggerHaptic('heavy');
        soundEngine.playKick(power, kickType);
      }

      // Save kick starting position & lie for daily mission calculations
      kickStartPosRef.current = { ...ballStateRef.current.position };
      kickStartLieRef.current = ballStateRef.current.lie;

      // Divot grass / sand particles at kick spot
      rendererRef.current?.emitParticles(
        ballStateRef.current.position,
        12,
        ballStateRef.current.lie === 'sand' ? 0xe0c98b : 0x4caf50
      );

      const kick = calculateKickVelocity(
        kickType,
        power,
        aimAngleRad,
        spin,
        ballStateRef.current.lie,
        profile.attributes
      );

      ballStateRef.current = {
        ...ballStateRef.current,
        velocity: kick.velocity,
        spin: kick.spin,
        isGrounded: kickType === 'putt',
        isRolling: kickType === 'putt',
        isSleeping: false,
      };

      // Initialize Instant Replay recorder
      shotElapsedTimeRef.current = 0;
      currentShotRecorderRef.current = new ReplayRecorder({
        holeNumber: currentHole.number,
        strokeNumber: strokeCount,
        kickType,
        distanceMeters: 0,
        isHoleOut: false,
      });
      currentShotRecorderRef.current.recordFrame(
        0,
        ballStateRef.current.position,
        kick.velocity,
        kick.spin
      );

      setIsBallInMotion(true);
      setStrokeCount((s) => s + 1);

      // Switch camera to dynamic flight follow cam and enable motion trail
      rendererRef.current?.setShotDynamics(power, spin, isPure ? 'pure' : undefined);
      rendererRef.current?.setBallInFlight(true);
      rendererRef.current?.setCameraMode('flight');
      setCameraMode('flight');
      rendererRef.current?.updateTrajectoryLine([], false);
      rendererRef.current?.updatePuttingReadLine([], false);
    };

    if (rendererRef.current) {
      rendererRef.current.startCharacterKick(
        kickType,
        fireButtonKick,
        () => {
          setIsRunUpApproaching(false);
        }
      );
    } else {
      fireButtonKick();
      setIsRunUpApproaching(false);
    }
  };

  const handleToggleFastForward = useCallback(() => {
    if (!isBallInMotion) return;
    soundEngine.playTurboWhoosh();
    setIsFastForward((prev) => !prev);
  }, [isBallInMotion]);

  // Keyboard navigation & controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (screen === 'playing') {
        if (e.code === 'Space' && !isBallInMotion) {
          e.preventDefault();
          handleExecuteKick();
        } else if (e.code === 'KeyP') {
          e.preventDefault();
          setIsPracticeMode((prev) => !prev);
        } else if (e.code === 'Escape') {
          e.preventDefault();
          setScreen('paused');
        } else if (e.code === 'KeyO') {
          setShowDailyMissions((s) => !s);
        } else if (e.code === 'KeyL') {
          setShowTournamentLeaderboard((s) => !s);
        } else if (e.code === 'KeyN' || e.code === 'KeyV') {
          setIsMiniMapOpen((s) => !s);
        } else if (e.code === 'KeyM') {
          handleToggleMute();
        } else if (e.code === 'KeyC') {
          handleCycleCamera();
        } else if (e.code === 'KeyF') {
          if (isBallInMotion) {
            handleToggleFastForward();
          } else {
            handleToggleFlyover();
          }
        } else if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
          setAimAngleRad((a) => {
            const next = a + 0.04; // Aim left increases angle
            updateAimVisuals(next, power, kickType, spin);
            return next;
          });
        } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
          setAimAngleRad((a) => {
            const next = a - 0.04; // Aim right decreases angle
            updateAimVisuals(next, power, kickType, spin);
            return next;
          });
        } else if (e.code === 'ArrowUp' || e.code === 'KeyW') {
          setPower((p) => {
            const next = Math.min(1.0, p + 0.05);
            updateAimVisuals(aimAngleRad, next, kickType, spin);
            return next;
          });
        } else if (e.code === 'KeyR') {
          if (lastReplayTrack && !isBallInMotion && !activeReplayTrack) {
            handleStartReplay();
          }
        } else if (e.code === 'KeyG') {
          setShowGreenGrid((g) => !g);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [screen, isBallInMotion, aimAngleRad, power, kickType, spin, updateAimVisuals, lastReplayTrack, activeReplayTrack]);

  // 3. Instant Replay Playback Loop
  useEffect(() => {
    if (!activeReplayTrack || !rendererRef.current) return;

    let animId = 0;
    let lastT = performance.now();

    const replayLoop = (now: number) => {
      const rawDt = (now - lastT) / 1000;
      const dt = Math.min(rawDt, 0.05);
      lastT = now;

      if (isReplayPlaying) {
        setReplayTime((prevTime) => {
          const nextTime = prevTime + dt * replaySpeed;
          if (nextTime >= activeReplayTrack.duration) {
            setIsReplayPlaying(false);
            return activeReplayTrack.duration;
          }
          return nextTime;
        });
      }

      const sample = sampleReplayAt(activeReplayTrack, replayTime);
      const camPose = getReplayCameraPose(
        sample.position,
        sample.velocity,
        currentHole.pinPosition,
        replayCameraAngle
      );

      rendererRef.current?.setReplayBallAndCamera(sample.position, camPose);

      animId = requestAnimationFrame(replayLoop);
    };

    animId = requestAnimationFrame(replayLoop);
    return () => cancelAnimationFrame(animId);
  }, [activeReplayTrack, isReplayPlaying, replaySpeed, replayCameraAngle, replayTime, currentHole]);

  const handleStartReplay = (trackToPlay?: ReplayTrack) => {
    const target = trackToPlay || lastReplayTrack;
    if (!target) return;
    setActiveReplayTrack(target);
    setReplayTime(0);
    setIsReplayPlaying(true);
  };

  const handleExitReplay = () => {
    if (rendererRef.current) {
      rendererRef.current.exitReplay();
      rendererRef.current.setBallPosition(ballStateRef.current.position);
      rendererRef.current.setCameraMode('aim');
    }
    setActiveReplayTrack(null);
  };

  // 4. Ambient Environmental Soundscape
  useEffect(() => {
    if (screen === 'playing' && !isMuted) {
      soundEngine.startAmbience(currentCourse.theme);
    } else {
      soundEngine.stopAmbience();
    }
    return () => {
      soundEngine.stopAmbience();
    };
  }, [screen, currentCourse.theme, isMuted]);

  // Load new course or hole
  const loadHole = (course: CourseData, holeIdx: number) => {

    setCurrentCourse(course);
    setCurrentHoleIndex(holeIdx);
    const hole = course.holes[holeIdx] || course.holes[0];

    // Reset ball to tee
    const initialY = getTerrainHeight(hole, hole.teePosition.x, hole.teePosition.z) + BALL_RADIUS;
    const initialPos = { ...hole.teePosition, y: initialY };

    // Reset hazard tracking for missions
    currentHoleHitBunkerRef.current = false;
    currentHoleHitWaterRef.current = false;
    kickStartPosRef.current = { ...initialPos };
    kickStartLieRef.current = 'tee';

    ballStateRef.current = {
      position: initialPos,
      velocity: { x: 0, y: 0, z: 0 },
      spin: { x: 0, y: 0, z: 0 },
      isGrounded: true,
      isRolling: false,
      isSleeping: true,
      inWater: false,
      inHole: false,
      lie: 'tee',
      lastValidPosition: initialPos,
      distanceTraveledInShot: 0,
      airTime: 0,
    };

    setHudBallPos(initialPos);
    setHudBallLie('tee');
    setStrokeCount(1);
    setKickType('drive');
    setPower(0.75);
    setAimAngleRad(hole.defaultAimAngle);
    setSpin({ top: 0, side: 0 });
    setIsBallInMotion(false);
    setCameraMode('aim');
    setIsFlyover(false);
    currentShotRecorderRef.current = null;
    setLastReplayTrack(null);
    setActiveReplayTrack(null);


    // Randomize gentle breeze
    const newWind = {
      speed: Math.round((Math.random() * 5 + 2) * 10) / 10,
      angleRad: Math.random() * Math.PI * 2,
    };
    setWind(newWind);
    soundEngine.updateWindIntensity(newWind.speed);

    if (rendererRef.current) {
      rendererRef.current.loadHole(course, hole);
      rendererRef.current.setActiveHole(hole);
      rendererRef.current.setActiveWind(newWind);
      updateAimVisuals(hole.defaultAimAngle, 0.75, 'drive', { top: 0, side: 0 });
    }
  };

  const handleStartGame = () => {
    soundEngine.playTap();
    soundEngine.playWhistle();
    setScreen('playing');
    updateAimVisuals(aimAngleRad, power, kickType, spin);
  };

  const handleSelectCourse = (course: CourseData) => {
    soundEngine.playTap();
    soundEngine.playWhistle();
    loadHole(course, 0);
    setTournament(createTournament(profile.name, course.id, course.holes.length, 'Continental Cup'));
    setShowCourseSelect(false);
    setScreen('playing');
  };

  const handleNewTournament = (tier: TournamentState['tier']) => {
    soundEngine.playTap();
    soundEngine.playWhistle();
    const newTourney = createTournament(profile.name, currentCourse.id, currentCourse.holes.length, tier);
    setTournament(newTourney);
    loadHole(currentCourse, 0);
    setShowTournamentHub(false);
    setScreen('playing');
  };

  const handleNextHole = () => {
    soundEngine.playTap();
    const nextIdx = currentHoleIndex + 1;
    if (nextIdx < currentCourse.holes.length) {
      loadHole(currentCourse, nextIdx);
      setScreen('playing');
    } else {
      // Tournament Finished!
      setScreen('tournament_podium');
    }
  };

  const handleEquipBall = (ballId: string) => {
    soundEngine.playTap();
    const ball = INITIAL_BALLS.find((b) => b.id === ballId);
    if (!ball) return;
    setProfile((prev) => ({ ...prev, equippedBallId: ballId }));
    rendererRef.current?.updateBallCustomization(ball.primaryColor, ball.secondaryColor);
  };

  const handleBuyBall = (ball: FootGolfBallCustomization) => {
    if (profile.coins < ball.cost) return;
    soundEngine.playTap();
    setProfile((prev) => ({
      ...prev,
      coins: prev.coins - ball.cost,
      unlockedBalls: [...prev.unlockedBalls, ball.id],
      equippedBallId: ball.id,
    }));
    rendererRef.current?.updateBallCustomization(ball.primaryColor, ball.secondaryColor);
  };

  const handleEquipTrail = (trailId: MotionTrailStyleId) => {
    soundEngine.playTap();
    triggerHaptic('light');
    setProfile((prev) => ({
      ...prev,
      equippedTrailId: trailId,
    }));
    rendererRef.current?.setMotionTrailStyle(trailId);
  };

  const handleUpdateCustomTrail = (custom: Partial<MotionTrailConfig>) => {
    soundEngine.playTap();
    setProfile((prev) => ({
      ...prev,
      customTrailConfig: {
        ...(prev.customTrailConfig || {}),
        ...custom,
      },
    }));
    rendererRef.current?.setMotionTrailConfig(custom);
  };

  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    soundEngine.setMuted(next);
  };

  const handleCycleCamera = () => {
    soundEngine.playTap();
    const modes: CameraMode[] = ['aim', 'flight', 'drone', 'green'];
    const currentIdx = modes.indexOf(cameraMode);
    const nextMode = modes[(currentIdx + 1) % modes.length];
    setCameraMode(nextMode);
    rendererRef.current?.setCameraMode(nextMode);
  };

  const handleToggleFlyover = () => {
    soundEngine.playTap();
    setIsFlyover((f) => !f);
    rendererRef.current?.toggleFlyover();
  };

  const handleClaimMission = (missionId: string) => {
    const { updatedMissions, rewardCoins } = claimDailyMission(dailyMissionsState.missions, missionId);
    setDailyMissionsState((prev) => ({ ...prev, missions: updatedMissions }));
    if (rewardCoins > 0) {
      setProfile((prev) => ({ ...prev, coins: prev.coins + rewardCoins }));
    }
  };

  const unclaimedMissionsCount = dailyMissionsState.missions.filter((m) => m.completed && !m.claimed).length;

  return (
    <div className="relative w-full h-full overflow-hidden select-none touch-none bg-slate-950 font-sans">
      {/* 3D WebGL Canvas Container */}
      <div ref={canvasMountRef} className="absolute inset-0 z-0 pointer-events-auto" />

      {/* Screen 1: Title Screen */}
      {screen === 'title' && (
        <TitleScreen
          onStartGame={handleStartGame}
          onOpenTournaments={() => setShowTournamentHub(true)}
          onOpenMissions={() => setShowDailyMissions(true)}
          onOpenCourses={() => setShowCourseSelect(true)}
          onOpenLocker={() => setShowLockerRoom(true)}
          unclaimedMissionsCount={unclaimedMissionsCount}
          skillPoints={profile.skillPoints || 0}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
        />
      )}

      {/* Screen 2: Interactive Flick Shot Gesture Layer & Playing HUD */}
      {screen === 'playing' && (
        <>
          {controlMode === 'arcade' ? (
            <ArcadeShotOverlay
              kickType={kickType}
              currentLie={ballStateRef.current.lie}
              baseAimAngleRad={aimAngleRad}
              baseSpin={spin}
              playerAttributes={profile.attributes}
              distanceToCupMeters={Math.hypot(
                currentHole.pinPosition.x - hudBallPos.x,
                currentHole.pinPosition.z - hudBallPos.z
              )}
              disabled={
                isBallInMotion ||
                isFlyover ||
                !!activeReplayTrack ||
                showSpinModal ||
                showDailyMissions ||
                showCourseSelect ||
                showTournamentHub ||
                showLockerRoom
              }
              onExecuteShot={handleArcadeShot}
              onNeedleUpdate={(needleVal, isPulling) => {
                rendererRef.current?.updateArcadeNeedle(needleVal, isPulling);
              }}
              onAimNudge={(deltaRad) => {
                const newAim = aimAngleRad + deltaRad;
                setAimAngleRad(newAim);
                updateAimVisuals(newAim, power, kickType, spin);
              }}
              onToggleControlMode={() => {
                soundEngine.playTap();
                triggerHaptic('light');
                setControlMode((m) => (m === 'arcade' ? 'classic' : 'arcade'));
              }}
              onSelectKickType={(type) => {
                setKickType(type);
                updateAimVisuals(aimAngleRad, power, type, spin);
              }}
            />
          ) : (
            <>
              <FlickShotOverlay
                kickType={kickType}
                englishSpin={spin}
                aimAngleRad={aimAngleRad}
                currentLie={ballStateRef.current.lie}
                isPracticeMode={isPracticeMode}
                onSwipePowerChange={(pwr, _kmh, isSwiping) => {
                  setLiveSwipePower(pwr);
                  setIsSwipingGesture(isSwiping);
                }}
                onPracticeSwing={handlePracticeSwing}
                disabled={
                  isBallInMotion ||
                  isFlyover ||
                  !!activeReplayTrack ||
                  showSpinModal ||
                  showDailyMissions ||
                  showCourseSelect ||
                  showTournamentHub ||
                  showLockerRoom
                }
                onFlickShot={handleFlickShot}
                onAimNudge={(deltaRad) => {
                  const newAim = aimAngleRad + deltaRad;
                  setAimAngleRad(newAim);
                  updateAimVisuals(newAim, power, kickType, spin);
                }}
              />

              {/* Practice Mode Active Notification Banner */}
              {isPracticeMode && (
                <div className="fixed top-14 sm:top-16 left-1/2 -translate-x-1/2 z-30 pointer-events-none flex items-center gap-2 bg-amber-500/90 text-slate-950 font-black px-4 py-1.5 rounded-full shadow-lg shadow-amber-500/25 text-xs animate-in fade-in slide-in-from-top-2 duration-200">
                  <span className="text-sm">🎯</span>
                  <span>PRACTICE MODE ACTIVE</span>
                  <span className="font-normal opacity-90 hidden sm:inline">· Swipes test speed & curve without striking ball</span>
                </div>
              )}

              {/* Vertical Power Feedback Bar on the side of the screen */}
              <VerticalPowerFeedbackBar
                currentSwipePower={liveSwipePower}
                isSwiping={isSwipingGesture}
                lastFeedback={lastSwipeFeedback}
                kickType={kickType}
                ballLie={hudBallLie}
                isPracticeMode={isPracticeMode}
                onTogglePracticeMode={() => setIsPracticeMode((p) => !p)}
                suggestedPuttPower={puttingReadLineData?.suggestedPower}
              />
            </>
          )}

          <GameHUD
            hole={currentHole}
            strokeCount={strokeCount}
            scoreRelativeToPar={scoreRelativeToPar}
            ballLie={hudBallLie}
            ballPos={hudBallPos}
            pinPos={currentHole.pinPosition}
            wind={wind}
            kickType={kickType}
            onSelectKickType={(type) => {
              setKickType(type);
              updateAimVisuals(aimAngleRad, power, type, spin);
            }}
            power={power}
            onPowerChange={(p) => {
              setPower(p);
              updateAimVisuals(aimAngleRad, p, kickType, spin);
            }}
            aimAngleRad={aimAngleRad}
            onAimChange={(a) => {
              setAimAngleRad(a);
              updateAimVisuals(a, power, kickType, spin);
            }}
            spin={spin}
            onOpenSpinModal={() => setShowSpinModal(true)}
            onExecuteKick={handleExecuteKick}
            isBallInMotion={isBallInMotion}
            cameraMode={cameraMode}
            onCycleCameraMode={handleCycleCamera}
            isFlyover={isFlyover}
            onToggleFlyover={handleToggleFlyover}
            isMuted={isMuted}
            onToggleMute={handleToggleMute}
            onPause={() => setScreen('paused')}
            onOpenMissions={() => setShowDailyMissions(true)}
            unclaimedMissionsCount={unclaimedMissionsCount}
            missionToast={missionToast}
            onOpenLeaderboard={() => setShowTournamentLeaderboard(true)}
            tournamentRank={tournament.leaderboard.find((c) => c.isPlayer)?.rank}
            tournamentTotalCompetitors={tournament.leaderboard.length}
            isMiniMapOpen={isMiniMapOpen}
            onToggleMiniMap={() => setIsMiniMapOpen((s) => !s)}
            hasReplay={!!lastReplayTrack && !activeReplayTrack}
            onTriggerReplay={() => handleStartReplay()}
            isReplaying={!!activeReplayTrack}
            showGreenGrid={showGreenGrid}
            onToggleGreenGrid={() => setShowGreenGrid((g) => !g)}
            puttingReadLine={puttingReadLineData}
            inFlightTelemetry={inFlightTelemetry}
            isPracticeMode={isPracticeMode}
            onTogglePracticeMode={() => setIsPracticeMode((p) => !p)}
            isFastForward={isFastForward}
            onToggleFastForward={handleToggleFastForward}
          />


          {/* Broadcast Instant Replay Overlay */}
          {activeReplayTrack && (
            <ReplayOverlay
              track={activeReplayTrack}
              currentTime={replayTime}
              isPlaying={isReplayPlaying}
              playbackSpeed={replaySpeed}
              cameraAngle={replayCameraAngle}
              onTogglePlay={() => setIsReplayPlaying((p) => !p)}
              onSeek={(t) => setReplayTime(t)}
              onChangeSpeed={(s) => setReplaySpeed(s)}
              onChangeCameraAngle={(a) => setReplayCameraAngle(a)}
              onRestart={() => {
                setReplayTime(0);
                setIsReplayPlaying(true);
              }}
              onExit={handleExitReplay}
            />
          )}

          {/* Dynamic Approach Run-Up Skip Action Button */}
          {isRunUpApproaching && (
            <div className="fixed bottom-24 sm:bottom-28 left-1/2 -translate-x-1/2 z-40 pointer-events-auto animate-in fade-in zoom-in-95 duration-150">
              <button
                onClick={() => rendererRef.current?.skipCharacterKick()}
                className="bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black text-xs sm:text-sm px-4 py-2 rounded-full shadow-xl shadow-emerald-500/40 flex items-center gap-2 border border-emerald-300 cursor-pointer transition-all tracking-wide uppercase"
              >
                <span>⚡</span>
                <span>Tap to Skip Approach</span>
              </button>
            </div>
          )}
        </>
      )}


      {/* Modals & Dialogs */}
      {showSpinModal && (
        <SpinModal
          spin={spin}
          onSpinChange={(newSpin) => {
            setSpin(newSpin);
            updateAimVisuals(aimAngleRad, power, kickType, newSpin);
          }}
          onClose={() => setShowSpinModal(false)}
        />
      )}

      {showCourseSelect && (
        <CourseSelectModal
          currentCourseId={currentCourse.id}
          onSelectCourse={handleSelectCourse}
          onClose={() => setShowCourseSelect(false)}
        />
      )}

      {showTournamentHub && (
        <TournamentHubModal
          tournament={tournament}
          onStartOrResumeTournament={() => {
            setShowTournamentHub(false);
            setScreen('playing');
          }}
          onNewTournament={handleNewTournament}
          onClose={() => setShowTournamentHub(false)}
        />
      )}

      {showTournamentLeaderboard && (
        <TournamentLeaderboardModal
          tournament={tournament}
          onClose={() => setShowTournamentLeaderboard(false)}
        />
      )}

      {showLockerRoom && (
        <LockerRoomModal
          profile={profile}
          balls={INITIAL_BALLS}
          onEquipBall={handleEquipBall}
          onBuyBall={handleBuyBall}
          onUpgradeAttribute={handleUpgradeAttribute}
          onEquipTrail={handleEquipTrail}
          onUpdateCustomTrail={handleUpdateCustomTrail}
          onClose={() => setShowLockerRoom(false)}
        />
      )}

      {/* Broadcast Style Hole-Out Celebration Banner */}
      {holeOutCelebration && (
        <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-950/95 border-2 border-emerald-400/80 rounded-3xl p-6 sm:p-8 shadow-[0_0_60px_rgba(16,185,129,0.35)] text-center transform scale-100 transition-all">
            <div className="text-4xl mb-2">
              {holeOutCelebration.scoreDelta <= -2
                ? '🦅✨'
                : holeOutCelebration.scoreDelta === -1
                ? '🐦🔥'
                : holeOutCelebration.scoreDelta === 0
                ? '🎯⛳'
                : '⚽'}
            </div>
            <h2
              className={`text-3xl sm:text-4xl font-black tracking-wider uppercase mb-1 ${
                holeOutCelebration.scoreDelta <= -2
                  ? 'text-amber-400'
                  : holeOutCelebration.scoreDelta === -1
                  ? 'text-emerald-400'
                  : holeOutCelebration.scoreDelta === 0
                  ? 'text-cyan-400'
                  : 'text-slate-200'
              }`}
            >
              {holeOutCelebration.title}
            </h2>
            <div className="text-xs uppercase font-extrabold text-slate-400 tracking-widest mb-4">
              Hole {currentHole.number} · Par {holeOutCelebration.par}
            </div>

            <div className="grid grid-cols-3 gap-2 bg-slate-900/90 rounded-2xl p-3 border border-slate-800 mb-4">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Strokes</span>
                <span className="text-xl font-black text-white">{holeOutCelebration.strokes}</span>
              </div>
              <div className="border-x border-slate-800">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Score</span>
                <span
                  className={`text-xl font-black ${
                    holeOutCelebration.scoreDelta < 0
                      ? 'text-emerald-400'
                      : holeOutCelebration.scoreDelta === 0
                      ? 'text-cyan-400'
                      : 'text-rose-400'
                  }`}
                >
                  {holeOutCelebration.scoreLabel}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Prize</span>
                <span className="text-xl font-black text-amber-400">+{holeOutCelebration.coinsEarned} 🪙</span>
              </div>
            </div>

            <div className="text-[11px] font-bold text-slate-400 flex items-center justify-center gap-1.5">
              <span>Final Kick:</span>
              <span className="text-emerald-400 font-black">{holeOutCelebration.distanceMeters}m</span>
              <span>straight into the cup!</span>
            </div>
          </div>
        </div>
      )}

      {/* Pure Strike / Impact Sweet-Spot Toast */}
      {strikeFeedback && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-40 pointer-events-none">
          <div className="bg-slate-950/95 border border-amber-400 text-amber-300 font-black text-xs sm:text-sm px-4 py-1.5 rounded-full shadow-2xl flex items-center gap-2">
            <span>{strikeFeedback}</span>
          </div>
        </div>
      )}

      {screen === 'hole_complete' && (
        <HoleCompleteModal
          hole={currentHole}
          strokes={strokesTakenFromCounter(strokeCount)}
          onNextHole={handleNextHole}
          onWatchReplay={lastReplayTrack ? () => {
            setScreen('playing');
            handleStartReplay();
          } : undefined}
          onViewLeaderboard={() => setShowTournamentHub(true)}
          onViewMissions={() => setShowDailyMissions(true)}
          isLastHole={currentHoleIndex + 1 >= currentCourse.holes.length}
        />
      )}


      {screen === 'tournament_podium' && (
        <TournamentPodiumModal
          tournament={tournament}
          onFinish={() => {
            const playerCompetitor = tournament.leaderboard.find((c) => c.isPlayer);
            const rank = playerCompetitor ? playerCompetitor.rank : 999;
            const wonTournament = rank === 1;
            const spEarned = rank === 1 ? 3 : rank === 2 ? 2 : rank === 3 ? 1 : 0;
            const xpEarned = rank === 1 ? 350 : rank === 2 ? 220 : rank === 3 ? 140 : 60;

            setProfile((prev) => {
              let newXp = (prev.currentXp || 0) + xpEarned;
              let newLevel = prev.playerLevel || 1;
              let xpTarget = prev.xpToNextLevel || 250;
              let bonusSp = 0;

              while (newXp >= xpTarget) {
                newXp -= xpTarget;
                newLevel += 1;
                bonusSp += 1;
                xpTarget = Math.round(xpTarget * 1.35);
              }

              return {
                ...prev,
                playerLevel: newLevel,
                currentXp: newXp,
                xpToNextLevel: xpTarget,
                skillPoints: (prev.skillPoints || 0) + spEarned + bonusSp,
                tournamentsWon: prev.tournamentsWon + (wonTournament ? 1 : 0),
                coins: prev.coins + (wonTournament ? tournament.purseCoins : 100),
                trophies: prev.trophies + (wonTournament ? 1 : 0),
              };
            });
            loadHole(currentCourse, 0);
            setScreen('title');
          }}
        />
      )}

      {screen === 'paused' && (
        <PauseModal
          onResume={() => setScreen('playing')}
          onRestartHole={() => {
            loadHole(currentCourse, currentHoleIndex);
            setScreen('playing');
          }}
          onOpenMissions={() => setShowDailyMissions(true)}
          onExitToTitle={() => {
            loadHole(currentCourse, 0);
            setScreen('title');
          }}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          settings={settings}
          activeQualityTier={activeQualityTier}
          onChangeSettings={setSettings}
        />
      )}

      {showDailyMissions && (
        <DailyMissionsModal
          missions={dailyMissionsState.missions}
          onClaim={handleClaimMission}
          onClose={() => setShowDailyMissions(false)}
          onPlayNow={screen !== 'playing' ? handleStartGame : undefined}
        />
      )}
    </div>
  );
}
