/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { KickType, SurfaceType } from '../types';
import { getEstimatedKickDistance } from '../game/physics';

export interface SwipeFeedbackData {
  power: number;
  speedKmh: number;
  carryMeters: number;
  totalMeters: number;
  slicePercent: number;
  isPractice: boolean;
  timestamp: number;
  strikeRating?: 'pure' | 'great' | 'solid' | 'push' | 'pull' | 'standard';
}

interface VerticalPowerFeedbackBarProps {
  currentSwipePower: number; // 0..1 live while swiping
  isSwiping: boolean;
  lastFeedback: SwipeFeedbackData | null;
  kickType: KickType;
  ballLie: SurfaceType;
  isPracticeMode: boolean;
  onTogglePracticeMode?: () => void;
  suggestedPuttPower?: number | null;
}

export const VerticalPowerFeedbackBar: React.FC<VerticalPowerFeedbackBarProps> = ({
  currentSwipePower,
  isSwiping,
  lastFeedback,
  kickType,
  ballLie,
  isPracticeMode,
  onTogglePracticeMode,
  suggestedPuttPower,
}) => {
  // Determine display power: live while swiping, otherwise last feedback or 0
  const activePower = isSwiping
    ? currentSwipePower
    : lastFeedback
    ? lastFeedback.power
    : 0;

  const activePercent = Math.round(activePower * 100);
  const peakPercent = lastFeedback ? Math.round(lastFeedback.power * 100) : 0;
  const isPutt = kickType === 'putt' || ballLie === 'green';
  const targetPercent = isPutt && typeof suggestedPuttPower === 'number' && suggestedPuttPower > 0
    ? Math.round(suggestedPuttPower * 100)
    : null;

  // Calculate live or last estimated rollout for this power
  const distEst = getEstimatedKickDistance(kickType, Math.max(0.1, activePower), ballLie);
  const displayMeters = lastFeedback && !isSwiping ? lastFeedback.totalMeters : distEst.totalMeters;
  const displayCarry = lastFeedback && !isSwiping ? lastFeedback.carryMeters : distEst.carryMeters;

  // Speed in km/h
  const maxKmh = kickType === 'drive' ? 122 : kickType === 'chip' ? 78 : 46;
  const displaySpeedKmh = isSwiping
    ? Math.round(activePower * maxKmh)
    : lastFeedback
    ? lastFeedback.speedKmh
    : 0;

  // Putting Touch Evaluation
  const puttingTouchEval = (isPutt && targetPercent !== null && peakPercent > 0 && !isSwiping)
    ? Math.abs(peakPercent - targetPercent) <= 4
      ? { label: '🎯 SWEET TOUCH', color: 'text-emerald-400 bg-emerald-950/80 border-emerald-500/60' }
      : peakPercent < targetPercent
      ? { label: '⚠️ SHORT', color: 'text-amber-400 bg-amber-950/80 border-amber-500/60' }
      : { label: '⚠️ FIRM', color: 'text-rose-400 bg-rose-950/80 border-rose-500/60' }
    : null;

  return (
    <aside
      aria-label="Swipe Power Feedback Meter"
      className="fixed right-1 sm:right-4 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center pointer-events-auto select-none"
    >
      {/* Container Card with mobile responsive sizing */}
      <div className="bg-slate-950/90 border border-slate-800/90 rounded-2xl p-1.5 sm:p-2.5 shadow-2xl flex flex-col items-center w-14 sm:w-20 transition-all">
        {/* Practice Mode Toggle / Badge */}
        <button
          onClick={onTogglePracticeMode}
          className={`w-full py-1 mb-1 sm:mb-1.5 px-0.5 rounded-lg text-[8px] sm:text-[9px] font-black uppercase tracking-wider text-center transition-all cursor-pointer ${
            isPracticeMode
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30 animate-pulse'
              : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
          title={isPracticeMode ? 'Practice Mode Active (Click to Exit)' : 'Click to Enter Practice Mode'}
          aria-label="Toggle Practice Mode"
        >
          {isPracticeMode ? '🎯 Prc' : '⚡ Live'}
        </button>

        {/* Live / Last Power Percentage Readout */}
        <div className="text-center mb-1 w-full">
          <div className="text-[8px] sm:text-[9px] font-extrabold uppercase text-slate-400 tracking-wider">
            {isSwiping ? 'Swipe' : isPracticeMode ? 'Prc PWR' : 'Shot PWR'}
          </div>
          <div
            className={`text-sm sm:text-lg font-black font-mono leading-none ${
              activePercent >= 88
                ? 'text-rose-400'
                : activePercent >= 65
                ? 'text-amber-400'
                : activePercent > 0
                ? 'text-emerald-400'
                : 'text-slate-500'
            }`}
          >
            {activePercent > 0 ? `${activePercent}%` : '--%'}
          </div>
          <div className="text-[8px] sm:text-[9px] font-bold text-slate-400 mt-0.5">
            {displaySpeedKmh > 0 ? `${displaySpeedKmh}k` : 'Swipe'}
          </div>
        </div>

        {/* Vertical Meter Track */}
        <div className="relative w-4 sm:w-6 h-36 sm:h-52 bg-slate-900 rounded-full p-0.5 border border-slate-700/80 overflow-hidden flex flex-col justify-end shadow-inner">
          {/* Sweet Spot / Pure Strike Zone (Top 85% - 100%) */}
          {!isPutt && (
            <div
              className="absolute top-0 left-0 right-0 h-[15%] bg-rose-500/20 border-b border-rose-500/40 pointer-events-none z-10 flex items-center justify-center"
              title="Max / Sweet Spot Zone"
            >
              <span className="text-[6px] sm:text-[7px] font-black text-rose-300 opacity-80">MAX</span>
            </div>
          )}

          {/* Putting Target Sweet-Spot Zone (±4% of required power) */}
          {isPutt && targetPercent !== null && (
            <div
              className="absolute left-0 right-0 bg-emerald-500/30 border-y border-emerald-400/80 pointer-events-none z-10 flex items-center justify-center"
              style={{
                bottom: `${Math.max(0, targetPercent - 4)}%`,
                height: '8%',
              }}
              title={`Target Putting Power: ${targetPercent}%`}
            >
              <span className="text-[5px] sm:text-[6px] font-black text-emerald-200 tracking-tighter">🎯</span>
            </div>
          )}

          {/* Guidelines */}
          <div className="absolute top-[25%] left-0 right-0 border-b border-dashed border-slate-600/60 pointer-events-none z-10" />
          <div className="absolute top-[50%] left-0 right-0 border-b border-dashed border-slate-600/60 pointer-events-none z-10" />
          <div className="absolute top-[75%] left-0 right-0 border-b border-dashed border-slate-600/60 pointer-events-none z-10" />

          {/* Target Putting Notch Line */}
          {isPutt && targetPercent !== null && (
            <div
              className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
              style={{ bottom: `${Math.min(100, Math.max(0, targetPercent))}%` }}
              title={`Target Power: ${targetPercent}%`}
            >
              <div className="w-full h-1 bg-emerald-400 shadow-[0_0_8px_#34d399]" />
            </div>
          )}

          {/* Peak Needle (Last Strike / Practice Power) */}
          {peakPercent > 0 && (
            <div
              className="absolute left-0 right-0 z-20 pointer-events-none transition-all duration-300 flex items-center"
              style={{ bottom: `${Math.min(100, Math.max(0, peakPercent))}%` }}
            >
              <div className="w-full h-0.5 bg-white shadow-[0_0_6px_#ffffff]" />
            </div>
          )}

          {/* Dynamic Fill Bar */}
          <div
            className={`w-full rounded-full transition-[height] duration-75 ease-out relative ${
              isPutt
                ? 'bg-gradient-to-t from-emerald-500 via-teal-400 to-amber-400'
                : isPracticeMode
                ? 'bg-gradient-to-t from-cyan-500 via-amber-400 to-rose-500'
                : 'bg-gradient-to-t from-emerald-500 via-amber-400 to-rose-500'
            }`}
            style={{
              height: `${Math.min(100, Math.max(0, activePercent))}%`,
              boxShadow:
                activePercent > 0
                  ? isPutt
                    ? '0 0 10px rgba(52, 211, 153, 0.6)'
                    : activePercent >= 88
                    ? '0 0 14px rgba(244, 63, 94, 0.7)'
                    : activePercent >= 65
                    ? '0 0 10px rgba(251, 191, 36, 0.6)'
                    : '0 0 8px rgba(16, 185, 129, 0.5)'
                  : 'none',
            }}
          />
        </div>

        {/* Target Putting Indicator Chip */}
        {isPutt && targetPercent !== null && (
          <div className="mt-1 text-[7px] sm:text-[8px] font-black text-emerald-300 bg-emerald-950/80 px-1 py-0.5 rounded border border-emerald-500/50 text-center w-full whitespace-nowrap">
            🎯 {targetPercent}%
          </div>
        )}

        {/* Distance Rollout Readout */}
        <div className="text-center mt-1.5 w-full pt-1 border-t border-slate-800/80">
          <div className="text-[7px] sm:text-[8px] font-bold uppercase text-slate-500">Roll</div>
          <div className="text-[11px] sm:text-xs font-black text-slate-100 font-mono">
            ~{displayMeters}m
          </div>
          {displayCarry > 0 && (
            <div className="text-[7px] font-medium text-slate-400">
              Air: {displayCarry}m
            </div>
          )}

          {/* Putting Touch Evaluation Feedback */}
          {puttingTouchEval && (
            <div className="mt-1">
              <span className={`inline-block text-[7px] font-black px-1 py-0.5 rounded border ${puttingTouchEval.color}`}>
                {puttingTouchEval.label}
              </span>
            </div>
          )}

          {/* Last Strike Rating / Slice Badge (for non-putts) */}
          {!puttingTouchEval && lastFeedback && !isSwiping && (
            <div className="mt-1">
              {lastFeedback.strikeRating === 'pure' ? (
                <span className="inline-block text-[7px] sm:text-[8px] font-black text-amber-400 bg-amber-950/80 px-1 py-0.5 rounded border border-amber-600/50">
                  ⚡ PURE
                </span>
              ) : lastFeedback.strikeRating === 'great' ? (
                <span className="inline-block text-[7px] sm:text-[8px] font-black text-emerald-400 bg-emerald-950/80 px-1 py-0.5 rounded border border-emerald-600/50">
                  GREAT
                </span>
              ) : null}

              {Math.abs(lastFeedback.slicePercent) >= 8 && (
                <div
                  className={`text-[7px] sm:text-[8px] font-bold mt-0.5 ${
                    lastFeedback.slicePercent > 0 ? 'text-amber-400' : 'text-blue-400'
                  }`}
                >
                  {lastFeedback.slicePercent > 0
                    ? `↷ +${lastFeedback.slicePercent}%`
                    : `↶ ${lastFeedback.slicePercent}%`}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
