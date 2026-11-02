/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { CameraMode } from '../game/renderer3d';
import { HoleData, KickType, SpinControl, SurfaceType, Vector3D } from '../types';
import { getEstimatedKickDistance } from '../game/physics';
import { HoleMiniMap } from './HoleMiniMap';
import {
  Menu,
  X,
  Wind,
  Flag,
  CircleDot,
  Compass,
  Volume2,
  VolumeX,
  Pause,
  Eye,
  Grid,
  Zap,
} from 'lucide-react';

interface GameHUDProps {
  hole: HoleData;
  strokeCount: number;
  scoreRelativeToPar: number;
  ballLie: SurfaceType;
  ballPos: Vector3D;
  pinPos: Vector3D;
  wind: { speed: number; angleRad: number };
  kickType: KickType;
  onSelectKickType: (type: KickType) => void;
  power: number;
  onPowerChange: (power: number) => void;
  aimAngleRad: number;
  onAimChange: (angle: number) => void;
  spin: SpinControl;
  onOpenSpinModal: () => void;
  onExecuteKick: () => void;
  isBallInMotion: boolean;
  cameraMode: CameraMode;
  onCycleCameraMode: () => void;
  isFlyover: boolean;
  onToggleFlyover: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  onPause: () => void;
  onOpenMissions?: () => void;
  unclaimedMissionsCount?: number;
  missionToast?: { title: string; reward: number; icon: string } | null;
  onOpenLeaderboard?: () => void;
  tournamentRank?: number;
  tournamentTotalCompetitors?: number;
  isMiniMapOpen?: boolean;
  onToggleMiniMap?: () => void;
  hasReplay?: boolean;
  onTriggerReplay?: () => void;
  isReplaying?: boolean;
  showGreenGrid?: boolean;
  onToggleGreenGrid?: () => void;
  puttingReadLine?: {
    points: Vector3D[];
    totalBreakDeg: number;
    breakDirection: 'left' | 'right' | 'straight';
    suggestedPower: number;
    elevationDeltaMeters?: number;
    stopsShortDistance?: number;
    reachesCup?: boolean;
    rollDistanceMeters?: number;
  } | null;
  inFlightTelemetry?: {
    altitudeMeters: number;
    speedKmh: number;
    carryMeters: number;
  } | null;
  isPracticeMode?: boolean;
  onTogglePracticeMode?: () => void;
  isFastForward?: boolean;
  onToggleFastForward?: () => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  hole,
  strokeCount,
  scoreRelativeToPar,
  ballLie,
  ballPos,
  pinPos,
  wind,
  kickType,
  onSelectKickType,
  aimAngleRad,
  onAimChange,
  onOpenSpinModal,
  isBallInMotion,
  cameraMode,
  onCycleCameraMode,
  isFlyover,
  onToggleFlyover,
  isMuted,
  onToggleMute,
  onPause,
  showGreenGrid = true,
  onToggleGreenGrid,
  inFlightTelemetry,
  isFastForward = false,
  onToggleFastForward,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [showEmbeddedMap, setShowEmbeddedMap] = useState<boolean>(false);

  const distToPinMeters = Math.round(
    Math.hypot(pinPos.x - ballPos.x, pinPos.z - ballPos.z)
  );

  const windAngleDeg = Math.round((wind.angleRad * 180) / Math.PI);

  const formatScore = (val: number) => {
    if (val === 0) return 'E';
    return val > 0 ? `+${val}` : `${val}`;
  };

  return (
    <div className="safe-inset pointer-events-none select-none z-40 flex flex-col justify-between">
      {/* Top Header Bar: Clean & Minimal - Pin Distance, Lie, & Drop-down Menu */}
      <div className="pt-3 px-4 flex justify-between items-start pointer-events-auto z-50">
        {/* Left: Distance to Pin & Surface Lie badge at a glance */}
        <div className="flex items-center gap-2">
          <div className="px-3.5 py-2 rounded-2xl bg-slate-950/85 text-slate-200 border border-slate-700/80 shadow-2xl flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 font-black text-xs">
              <Flag className="w-4 h-4 text-emerald-400 fill-emerald-400/20" />
              <span className="font-mono text-sm font-black text-yellow-300">{distToPinMeters}m</span>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">to pin</span>
            </div>
            <div className="h-3.5 w-px bg-slate-700/80" />
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Lie:</span>
              <span
                className={`text-[11px] font-black uppercase tracking-wider ${
                  ballLie === 'green'
                    ? 'text-emerald-400'
                    : ballLie === 'fairway' || ballLie === 'tee'
                    ? 'text-emerald-300'
                    : ballLie === 'sand'
                    ? 'text-amber-400'
                    : ballLie === 'rough'
                    ? 'text-amber-300'
                    : 'text-rose-400'
                }`}
              >
                {ballLie}
              </span>
            </div>
          </div>

          {/* Top Bar Shot Type & Max Distance (Quick glance indicator) */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-slate-950/85 text-slate-200 border border-slate-700/80 shadow-2xl">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Club:</span>
            <span className="text-yellow-400 text-xs font-black uppercase tracking-wider">{kickType}</span>
            <span className="text-slate-600">·</span>
            <span className="text-white font-mono text-xs font-black">
              {getEstimatedKickDistance(kickType, 1.0, ballLie).totalMeters}m
            </span>
          </div>
        </div>

        {/* Right: Drop-down Menu trigger button */}
        <button
          onClick={() => setIsMenuOpen((prev) => !prev)}
          className={`px-3.5 py-2 rounded-2xl flex items-center gap-2 text-xs font-black shadow-2xl transition-all active:scale-95 border cursor-pointer ${
            isMenuOpen
              ? 'bg-amber-500 text-slate-950 border-amber-300'
              : 'bg-slate-950/85 text-slate-200 border-slate-700/80 hover:border-yellow-400/80'
          }`}
          title="Toggle Course & Shot Menu"
        >
          {isMenuOpen ? (
            <>
              <X className="w-4 h-4" />
              <span>CLOSE</span>
            </>
          ) : (
            <>
              <Menu className="w-4 h-4 text-yellow-400" />
              <span>HOLE {hole.number} · PAR {hole.par}</span>
              <span className="text-slate-400 font-mono text-[11px] ml-1 flex items-center gap-1">
                <Wind className="w-3 h-3 text-cyan-400" />
                {wind.speed.toFixed(1)}m/s
              </span>
            </>
          )}
        </button>
      </div>

      {/* Drop-Down Menu Drawer (Visible only when user taps the menu button) */}
      {isMenuOpen && (
        <div className="absolute top-14 right-4 w-80 sm:w-88 max-h-[82vh] overflow-y-auto bg-slate-950/95 border border-slate-700/80 rounded-3xl p-4 shadow-2xl pointer-events-auto z-50 animate-in fade-in slide-in-from-top-3 flex flex-col gap-4 text-slate-200">
          {/* Section 1: Hole Telemetry & Scorecard */}
          <div className="bg-slate-900/90 rounded-2xl p-3 border border-slate-800">
            <div className="flex justify-between items-center mb-2">
              <div>
                <span className="text-xs font-black text-yellow-400 tracking-wider uppercase">
                  Hole {hole.number}
                </span>
                <span className="text-xs text-slate-400 ml-2 font-bold">
                  Par {hole.par} · {hole.lengthMeters}m
                </span>
              </div>
              <div
                className={`text-xs font-black px-2 py-0.5 rounded-full ${
                  scoreRelativeToPar < 0
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/50'
                    : scoreRelativeToPar > 0
                    ? 'bg-rose-950 text-rose-400 border border-rose-500/50'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                {formatScore(scoreRelativeToPar)}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-slate-950/80 rounded-xl p-2 border border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Strokes</span>
                <span className="text-base font-black text-white">{strokeCount + 1}</span>
              </div>
              <div className="bg-slate-950/80 rounded-xl p-2 border border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Pin Dist</span>
                <span className="text-base font-black text-yellow-300 font-mono">{distToPinMeters}m</span>
              </div>
              <div className="bg-slate-950/80 rounded-xl p-2 border border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Current Lie</span>
                <span className="text-xs font-black text-emerald-400 uppercase mt-1 block">
                  {ballLie}
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Wind Compass */}
          <div className="bg-slate-900/90 rounded-2xl p-3 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-full bg-cyan-950/80 border border-cyan-500/60 flex items-center justify-center transition-transform shadow-inner"
                style={{ transform: `rotate(${windAngleDeg}deg)` }}
              >
                <Compass className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Wind Velocity</span>
                <span className="text-sm font-black text-cyan-300 font-mono">{wind.speed.toFixed(1)} m/s</span>
              </div>
            </div>
            <span className="text-xs font-bold text-slate-400 font-mono">{windAngleDeg}°</span>
          </div>

          {/* Section 3: Club / Kick Type Selector */}
          <div className="bg-slate-900/90 rounded-2xl p-3 border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-2">Club Selection</span>
            <div className="grid grid-cols-3 gap-2">
              {(['drive', 'chip', 'putt'] as KickType[]).map((type) => {
                const isActive = kickType === type;
                const est = getEstimatedKickDistance(type, 1.0, ballLie);
                return (
                  <button
                    key={type}
                    onClick={() => {
                      onSelectKickType(type);
                    }}
                    className={`py-2 px-1 rounded-xl text-xs font-black uppercase tracking-wider transition-all border flex flex-col items-center gap-0.5 cursor-pointer ${
                      isActive
                        ? 'bg-yellow-400 text-slate-950 border-yellow-300 shadow-md scale-102'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <span>{type}</span>
                    <span className={`text-[10px] font-mono ${isActive ? 'text-slate-950 font-bold' : 'text-slate-500'}`}>
                      {est.totalMeters}m
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 4: Ball Spin & Mini-Map Toggles */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                setIsMenuOpen(false);
                onOpenSpinModal();
              }}
              className="py-2.5 px-3 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
            >
              <CircleDot className="w-4 h-4 text-yellow-400" />
              <span>Ball Spin</span>
            </button>

            <button
              onClick={() => setShowEmbeddedMap((prev) => !prev)}
              className={`py-2.5 px-3 rounded-2xl border text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-transform ${
                showEmbeddedMap
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-500/60'
                  : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
              }`}
            >
              <Flag className="w-4 h-4 text-emerald-400" />
              <span>{showEmbeddedMap ? 'Hide Map' : 'Mini-Map'}</span>
            </button>
          </div>

          {/* Embedded Mini-Map inside dropdown drawer if toggled */}
          {showEmbeddedMap && (
            <div className="bg-slate-900 rounded-2xl p-2 border border-slate-800 flex justify-center">
              <HoleMiniMap
                hole={hole}
                ballPos={ballPos}
                pinPos={pinPos}
                ballLie={ballLie}
                wind={wind}
                aimAngleRad={aimAngleRad}
                onAimChange={onAimChange}
                power={1.0}
                kickType={kickType}
                isOpen={true}
                onToggleOpen={() => setShowEmbeddedMap(false)}
              />
            </div>
          )}

          {/* Section 5: Camera Views & Course Visuals */}
          <div className="bg-slate-900/90 rounded-2xl p-3 border border-slate-800 flex flex-col gap-2">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Camera & Visuals</span>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={onCycleCameraMode}
                className="py-2 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-bold text-slate-300 flex flex-col items-center gap-1 hover:border-slate-700"
              >
                <Eye className="w-3.5 h-3.5 text-sky-400" />
                <span className="uppercase">{cameraMode}</span>
              </button>

              <button
                onClick={onToggleFlyover}
                className={`py-2 rounded-xl border text-[11px] font-bold flex flex-col items-center gap-1 ${
                  isFlyover
                    ? 'bg-amber-950 border-amber-500 text-amber-300'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <span>🚁</span>
                <span>Flyover</span>
              </button>

              {onToggleGreenGrid && (
                <button
                  onClick={onToggleGreenGrid}
                  className={`py-2 rounded-xl border text-[11px] font-bold flex flex-col items-center gap-1 ${
                    showGreenGrid
                      ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <Grid className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Grid</span>
                </button>
              )}
            </div>
          </div>

          {/* Section 6: Sound & Match Options */}
          <div className="flex gap-2">
            <button
              onClick={onToggleMute}
              className="flex-1 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-bold text-slate-300 flex items-center justify-center gap-2"
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
              <span>{isMuted ? 'Unmute' : 'Mute'}</span>
            </button>

            <button
              onClick={() => {
                setIsMenuOpen(false);
                onPause();
              }}
              className="flex-1 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-bold text-slate-300 flex items-center justify-center gap-2"
            >
              <Pause className="w-4 h-4 text-yellow-400" />
              <span>Pause</span>
            </button>
          </div>
        </div>
      )}

      {/* In-Flight Telemetry Banner: Shows ONLY when ball is flying/rolling */}
      {isBallInMotion && inFlightTelemetry && (
        <div className="self-center flex flex-wrap items-center justify-center gap-2 mb-8 pointer-events-auto z-30">
          <div className="bg-slate-950/95 border border-cyan-500/60 px-4 py-2 rounded-2xl shadow-2xl flex items-center gap-3 text-xs font-black">
            <span className="text-cyan-400 uppercase tracking-widest text-[10px]">FLIGHT</span>
            <span className="text-slate-400 text-[10px]">ALT:</span>
            <span className="text-cyan-300 font-mono text-sm">{inFlightTelemetry.altitudeMeters.toFixed(1)}m</span>
            <span className="text-slate-700">|</span>
            <span className="text-slate-400 text-[10px]">SPEED:</span>
            <span className="text-amber-400 font-mono text-sm">{Math.round(inFlightTelemetry.speedKmh)} km/h</span>
            <span className="text-slate-700">|</span>
            <span className="text-slate-400 text-[10px]">DIST:</span>
            <span className="text-emerald-400 font-mono text-sm">{Math.round(inFlightTelemetry.carryMeters)}m</span>
          </div>

          {onToggleFastForward && (
            <button
              onClick={onToggleFastForward}
              className={`px-3 py-2 rounded-2xl text-xs font-black uppercase flex items-center gap-1 shadow-2xl transition-all active:scale-95 border ${
                isFastForward
                  ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-amber-500/40 animate-pulse'
                  : 'bg-slate-950/95 text-amber-300 border-amber-500/60 hover:bg-slate-900'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{isFastForward ? '2.4x TURBO ON' : '2.4x TURBO'}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
