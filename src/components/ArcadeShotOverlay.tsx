/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  ArcadeShotExecutionResult,
  calculatePullbackState,
  resolveArcadeShot,
  MAX_DRAG_STANDARD_PX,
  MAX_DRAG_OVERPOWER_PX,
} from '../game/arcadeControls';
import {
  calculateNeedleFrequency,
  getNeedlePosition,
  TimingRatingResult,
} from '../game/timingGauge';
import { evaluatePuttingPullback } from '../game/puttingSystem';
import { getEstimatedKickDistance } from '../game/physics';
import { KickType, PlayerAttributes, SpinControl, SurfaceType } from '../types';
import { triggerHaptic } from '../game/haptics';
import { Zap, Target, Flag, ChevronLeft, ChevronRight } from 'lucide-react';

interface ArcadeShotOverlayProps {
  kickType: KickType;
  currentLie: SurfaceType;
  baseAimAngleRad: number;
  baseSpin: SpinControl;
  playerAttributes?: PlayerAttributes;
  disabled?: boolean;
  distanceToCupMeters?: number;
  onExecuteShot: (result: ArcadeShotExecutionResult) => void;
  onNeedleUpdate?: (needleValue: number, isPulling: boolean) => void;
  onAimNudge?: (deltaRad: number) => void;
  onCancelPullback?: () => void;
  onToggleControlMode?: () => void;
  onSelectKickType?: (type: KickType) => void;
}

export const ArcadeShotOverlay: React.FC<ArcadeShotOverlayProps> = ({
  kickType,
  currentLie,
  baseAimAngleRad,
  baseSpin,
  playerAttributes,
  disabled = false,
  distanceToCupMeters = 15,
  onExecuteShot,
  onNeedleUpdate,
  onAimNudge,
  onCancelPullback,
  onSelectKickType,
}) => {
  const [isPulling, setIsPulling] = useState<boolean>(false);
  const [powerNormalized, setPowerNormalized] = useState<number>(0);
  const [isOverpower, setIsOverpower] = useState<boolean>(false);
  const [centeringOffset, setCenteringOffset] = useState<number>(0);
  const [needleValue, setNeedleValue] = useState<number>(0);
  const [activeRating, setActiveRating] = useState<TimingRatingResult | null>(null);
  const [visualPullOffset, setVisualPullOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Upper screen touch pan for aiming
  const aimPanOriginRef = useRef<number | null>(null);
  const isAimPanningRef = useRef<boolean>(false);

  const dragOriginRef = useRef<{ x: number; y: number } | null>(null);
  const pullStartTimeRef = useRef<number>(0);
  const needleValueRef = useRef<number>(0);
  const powerNormalizedRef = useRef<number>(0);
  const centeringOffsetRef = useRef<number>(0);
  const isPullingRef = useRef<boolean>(false);
  const animFrameIdRef = useRef<number>(0);
  const lastSweetSpotHapticRef = useRef<number>(0);

  // Putting specific calculation
  const puttingEval = kickType === 'putt'
    ? evaluatePuttingPullback(
        powerNormalized * MAX_DRAG_STANDARD_PX,
        distanceToCupMeters,
        28,
        playerAttributes?.finesse || 1
      )
    : null;

  // Real-time harmonic needle oscillation loop while pulling
  useEffect(() => {
    if (!isPulling) {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      setNeedleValue(0);
      needleValueRef.current = 0;
      onNeedleUpdate?.(0, false);
      return;
    }

    const freq = calculateNeedleFrequency(
      kickType,
      currentLie,
      powerNormalizedRef.current,
      playerAttributes
    );

    const updateLoop = () => {
      if (!isPullingRef.current) return;

      const elapsedSec = (performance.now() - pullStartTimeRef.current) / 1000;
      const pos = getNeedlePosition(elapsedSec, freq);
      needleValueRef.current = pos;
      setNeedleValue(pos);
      onNeedleUpdate?.(pos, true);

      // Light haptic feedback tick on sweet spot crossing
      if (Math.abs(pos) < 0.08 && performance.now() - lastSweetSpotHapticRef.current > 280) {
        lastSweetSpotHapticRef.current = performance.now();
        triggerHaptic('light');
      }

      animFrameIdRef.current = requestAnimationFrame(updateLoop);
    };

    animFrameIdRef.current = requestAnimationFrame(updateLoop);

    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    };
  }, [isPulling, kickType, currentLie, playerAttributes, onNeedleUpdate]);

  // Aim Panning Handlers on field area
  const handleAimPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || isPulling) return;
    aimPanOriginRef.current = e.clientX;
    isAimPanningRef.current = true;
  };

  const handleAimPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isAimPanningRef.current || aimPanOriginRef.current === null || isPulling) return;
    const dx = e.clientX - aimPanOriginRef.current;
    if (Math.abs(dx) > 3) {
      // Invert sign so dragging to the right rotates aim to the right
      const deltaRad = -dx * 0.0035;
      onAimNudge?.(deltaRad);
      aimPanOriginRef.current = e.clientX;
    }
  };

  const handleAimPointerUp = () => {
    isAimPanningRef.current = false;
    aimPanOriginRef.current = null;
  };

  // Ball Socket Pointer/Touch Drag Handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);

    dragOriginRef.current = { x: e.clientX, y: e.clientY };
    pullStartTimeRef.current = performance.now();
    isPullingRef.current = true;
    setIsPulling(true);
    setPowerNormalized(0);
    powerNormalizedRef.current = 0;
    setCenteringOffset(0);
    centeringOffsetRef.current = 0;
    setVisualPullOffset({ x: 0, y: 0 });
    triggerHaptic('medium');
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPullingRef.current || !dragOriginRef.current) return;
    e.stopPropagation();

    const dx = e.clientX - dragOriginRef.current.x;
    const dy = e.clientY - dragOriginRef.current.y; // downward pull is positive

    const pull = calculatePullbackState(dy, dx, MAX_DRAG_STANDARD_PX, MAX_DRAG_OVERPOWER_PX);

    // Haptic buzz when crossing into Overpower (>100%)
    if (pull.isOverpower && !isOverpower) {
      triggerHaptic('heavy');
    }

    setPowerNormalized(pull.powerNormalized);
    powerNormalizedRef.current = pull.powerNormalized;
    setIsOverpower(pull.isOverpower);
    setCenteringOffset(pull.centeringOffset);
    centeringOffsetRef.current = pull.centeringOffset;

    // Track visual pullback translation
    setVisualPullOffset({
      x: Math.max(-36, Math.min(36, dx * 0.45)),
      y: Math.max(0, Math.min(MAX_DRAG_OVERPOWER_PX, dy)),
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPullingRef.current) return;
    e.stopPropagation();
    isPullingRef.current = false;
    setIsPulling(false);
    setVisualPullOffset({ x: 0, y: 0 });
    onNeedleUpdate?.(0, false);

    const currentPower = powerNormalizedRef.current;

    // If power is very small (< 0.12), treat as cancelled drag so user can adjust aim without firing
    if (currentPower < 0.12) {
      setPowerNormalized(0);
      setIsOverpower(false);
      onCancelPullback?.();
      return;
    }

    // Resolve shot with timing rating and lateral deviations
    const result = resolveArcadeShot(
      currentPower,
      needleValueRef.current,
      centeringOffsetRef.current,
      baseAimAngleRad,
      baseSpin,
      kickType,
      currentLie,
      playerAttributes
    );

    setActiveRating(result.timing);
    setTimeout(() => {
      setActiveRating(null);
    }, 2200);

    // Haptic feedback corresponding to timing precision
    if (result.timing.rating === 'perfect') {
      triggerHaptic('pure');
    } else if (result.timing.rating === 'great') {
      triggerHaptic('heavy');
    } else {
      triggerHaptic('medium');
    }

    onExecuteShot(result);
  };

  // Visual layout helpers
  const powerPercent = Math.min(100, Math.round(powerNormalized * 100));
  const needlePercent = ((needleValue + 1.0) / 2.0) * 100; // 0% to 100% across bar

  return (
    <div className="absolute inset-0 pointer-events-none select-none z-30 flex flex-col justify-end">
      {/* Upper Area: Drag to Aim Pan on 3D field (below top header bar) */}
      {!disabled && !isPulling && (
        <div
          onPointerDown={handleAimPointerDown}
          onPointerMove={handleAimPointerMove}
          onPointerUp={handleAimPointerUp}
          onPointerCancel={handleAimPointerUp}
          className="absolute inset-x-0 top-16 bottom-88 pointer-events-auto touch-none cursor-ew-resize"
        />
      )}

      {/* Raised Shot Mechanic Section: Elevated generously on screen with plenty of downward pull room */}
      <div className="absolute bottom-36 sm:bottom-44 inset-x-0 flex flex-col items-center pointer-events-none">
        {/* 1. Timing Release Banner Feedback */}
        {activeRating && (
          <div
            className="mb-4 px-6 py-2 rounded-full font-black text-xl tracking-wider shadow-2xl animate-bounce border-2"
            style={{
              backgroundColor: `${activeRating.colorHex}22`,
              borderColor: activeRating.colorHex,
              color: activeRating.colorHex,
            }}
          >
            {activeRating.label}
          </div>
        )}

        {/* 2. Overpower Notice Banner */}
        {isPulling && isOverpower && (
          <div className="mb-2 px-3 py-1 rounded-md bg-red-600/90 text-white text-xs font-bold tracking-wider uppercase animate-pulse flex items-center gap-1 shadow-lg border border-red-400">
            <Zap className="w-3.5 h-3.5 text-yellow-300" />
            OVERPOWER {powerPercent}% (+40% NEEDLE SPEED)
          </div>
        )}

        {/* 3. Putting Speed Window Indicator (When putting) */}
        {isPulling && kickType === 'putt' && puttingEval && (
          <div className="mb-2 px-4 py-2 rounded-xl bg-slate-900/90 border border-emerald-500/40 text-center shadow-xl flex items-center gap-3">
            <Flag className="w-4 h-4 text-emerald-400" />
            <div>
              <div className="text-xs font-semibold text-slate-300">
                Cup: {puttingEval.distanceToCupMeters}m | Roll: {puttingEval.projectedRollMeters}m
              </div>
              <div
                className="text-sm font-black tracking-wide"
                style={{ color: puttingEval.colorHex }}
              >
                {puttingEval.label}
              </div>
            </div>
          </div>
        )}

        {/* 4. Arcade Timing Needle Gauge Ribbon (Visible during active pullback) */}
        {isPulling && (
          <div className="w-72 sm:w-80 mb-3 bg-slate-950/85 rounded-2xl p-2.5 border border-slate-700/60 shadow-2xl">
            <div className="flex justify-between items-center text-[10px] uppercase font-bold text-slate-400 px-1 mb-1">
              <span className="text-red-400">Slice</span>
              <span className="text-amber-400">Good</span>
              <span className="text-sky-400">Great</span>
              <span className="text-yellow-400 font-black">★ Perfect ★</span>
              <span className="text-sky-400">Great</span>
              <span className="text-amber-400">Good</span>
              <span className="text-red-400">Hook</span>
            </div>

            {/* Color-Coded Target Zones Bar */}
            <div className="relative h-6 rounded-lg overflow-hidden flex shadow-inner border border-slate-800">
              {/* Left Slice */}
              <div className="w-[15%] bg-gradient-to-r from-red-600 to-red-500" />
              {/* Left Good */}
              <div className="w-[16%] bg-gradient-to-r from-amber-600 to-amber-500" />
              {/* Left Great */}
              <div className="w-[13%] bg-gradient-to-r from-sky-600 to-sky-500" />
              {/* Center Perfect */}
              <div className="w-[12%] bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-400 shadow-[0_0_12px_rgba(250,204,21,0.8)]" />
              {/* Right Great */}
              <div className="w-[13%] bg-gradient-to-r from-sky-500 to-sky-600" />
              {/* Right Good */}
              <div className="w-[16%] bg-gradient-to-r from-amber-500 to-amber-600" />
              {/* Right Hook */}
              <div className="w-[15%] bg-gradient-to-r from-red-500 to-red-600" />

              {/* Oscillating Needle Blade */}
              <div
                className="absolute top-0 bottom-0 w-1.5 -ml-0.75 bg-white shadow-[0_0_8px_#ffffff] transition-transform duration-75 ease-out"
                style={{
                  left: `${needlePercent}%`,
                }}
              >
                <div className="w-3 h-3 bg-white rotate-45 -mt-1 -ml-0.75 rounded-xs shadow-md" />
              </div>
            </div>
          </div>
        )}

        {/* Shot Type & Distance At-A-Glance Selector (visible when idle / aiming) */}
        {!disabled && !isPulling && (
          <div className="mb-3 flex items-center gap-1.5 bg-slate-950/90 border border-slate-700/80 p-1.5 rounded-2xl shadow-2xl pointer-events-auto">
            {(['drive', 'chip', 'putt'] as KickType[]).map((type) => {
              const isActive = kickType === type;
              const est = getEstimatedKickDistance(type, 1.0, currentLie);
              return (
                <button
                  key={type}
                  onClick={() => onSelectKickType?.(type)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                    isActive
                      ? 'bg-yellow-400 text-slate-950 shadow-md scale-102 font-black'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/70 font-bold'
                  }`}
                  title={`Switch to ${type.toUpperCase()} (${est.totalMeters}m)`}
                >
                  <span>{type}</span>
                  <span
                    className={`font-mono text-[11px] ${
                      isActive ? 'text-slate-950 font-black' : 'text-slate-500 font-semibold'
                    }`}
                  >
                    {est.totalMeters}m
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* 5. Drag-and-Release Ball Socket & Aim Nudge Controls (Hidden while ball is in motion) */}
        {!disabled && (
          <div className="flex flex-col items-center animate-in fade-in duration-200">
            <div className="relative pointer-events-auto flex items-center justify-center gap-6">
              {/* Aim Nudge Left Button: Pushing left rotates aim to the LEFT */}
              {!isPulling && (
                <button
                  onClick={() => onAimNudge?.(0.045)}
                  className="p-3 rounded-full bg-slate-900/80 border border-slate-700/80 text-slate-200 hover:text-yellow-400 active:scale-90 transition-all shadow-lg cursor-pointer"
                  title="Aim Left"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}

              {/* Ball Socket Target: Elevated with plenty of clear downward drag space */}
              <div
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                className="relative w-28 h-28 rounded-full cursor-grab active:cursor-grabbing select-none flex items-center justify-center touch-none transition-transform"
              >
                {/* Outer Guide Halo (stationary launch socket) */}
                <div
                  className={`absolute inset-0 rounded-full border-2 border-dashed transition-all duration-150 ${
                    isOverpower
                      ? 'border-red-500 scale-110 shadow-[0_0_20px_rgba(239,68,68,0.6)] animate-pulse'
                      : isPulling
                      ? 'border-yellow-400/80 scale-105 shadow-[0_0_15px_rgba(250,204,21,0.4)]'
                      : 'border-slate-500/50 hover:border-emerald-400/70'
                  }`}
                />

                {/* Radial Power Ring Progress */}
                <svg className="absolute inset-0 w-full h-full -rotate-90">
                  <circle
                    cx="56"
                    cy="56"
                    r="48"
                    fill="none"
                    stroke="#1e293b"
                    strokeWidth="5"
                  />
                  <circle
                    cx="56"
                    cy="56"
                    r="48"
                    fill="none"
                    stroke={isOverpower ? '#ef4444' : '#facc15'}
                    strokeWidth="6"
                    strokeDasharray={301.6}
                    strokeDashoffset={301.6 * (1 - Math.min(1.25, powerNormalized) / 1.25)}
                    strokeLinecap="round"
                    className="transition-all duration-75"
                  />
                </svg>

                {/* Slingshot Pullback Elastic Tether Line */}
                {isPulling && visualPullOffset.y > 4 && (
                  <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
                    <line
                      x1="56"
                      y1="56"
                      x2={56 + visualPullOffset.x}
                      y2={56 + visualPullOffset.y}
                      stroke={isOverpower ? '#ef4444' : '#facc15'}
                      strokeWidth="3"
                      strokeDasharray="4 2"
                      opacity="0.85"
                    />
                  </svg>
                )}

                {/* Socket Core Pip (Physically translates down with tactile slingshot drag) */}
                <div
                  className={`w-16 h-16 rounded-full border flex flex-col items-center justify-center shadow-2xl ${
                    isOverpower
                      ? 'bg-red-950/95 border-red-400 shadow-red-500/50'
                      : isPulling
                      ? 'bg-slate-900/95 border-yellow-400 shadow-yellow-500/30'
                      : 'bg-slate-900/90 border-slate-700/80'
                  }`}
                  style={{
                    transform: isPulling
                      ? `translate(${visualPullOffset.x}px, ${visualPullOffset.y}px)`
                      : 'none',
                    transition: isPulling ? 'none' : 'transform 0.18s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                  }}
                >
                  {isPulling ? (
                    <div className="text-center">
                      <span className={`text-base font-black ${isOverpower ? 'text-red-400' : 'text-yellow-400'}`}>
                        {powerPercent}%
                      </span>
                      <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-tighter">
                        {isOverpower ? 'OVERPOWER' : 'POWER'}
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <Target className="w-6 h-6 text-yellow-400 animate-pulse" />
                      <span className="text-[9px] font-bold text-slate-300 uppercase tracking-tight mt-0.5">
                        PULL BACK
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Aim Nudge Right Button: Pushing right rotates aim to the RIGHT */}
              {!isPulling && (
                <button
                  onClick={() => onAimNudge?.(-0.045)}
                  className="p-3 rounded-full bg-slate-900/80 border border-slate-700/80 text-slate-200 hover:text-yellow-400 active:scale-90 transition-all shadow-lg cursor-pointer"
                  title="Aim Right"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Pull Instructions / Release Hint */}
            <div className="mt-2 text-[11px] font-bold tracking-wider text-slate-300/80 uppercase">
              {isPulling
                ? powerNormalized < 0.12
                  ? 'Release to cancel shot'
                  : 'Release when needle hits center'
                : 'Drag ball down to shoot'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
