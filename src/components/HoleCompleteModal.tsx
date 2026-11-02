/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { getScoreTerm } from '../game/tournament';
import { HoleData } from '../types';

interface HoleCompleteModalProps {
  hole: HoleData;
  strokes: number;
  onNextHole: () => void;
  onWatchReplay?: () => void;
  onViewLeaderboard?: () => void;
  onViewMissions?: () => void;
  isLastHole: boolean;
}

export const HoleCompleteModal: React.FC<HoleCompleteModalProps> = ({
  hole,
  strokes,
  onNextHole,
  onWatchReplay,
  onViewLeaderboard,
  onViewMissions,
  isLastHole,
}) => {

  const delta = strokes - hole.par;
  const term = getScoreTerm(delta);

  useEffect(() => {
    if (delta <= 0) {
      // Fire celebration confetti on Par or better!
      confetti({
        disableForReducedMotion: true,
        particleCount: delta <= -2 ? 100 : 50,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  }, [delta]);

  const coinsEarned = delta <= -2 ? 150 : delta === -1 ? 80 : delta === 0 ? 40 : 15;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 pointer-events-auto">
      <div className="bg-slate-900 border border-emerald-500/40 rounded-3xl p-6 sm:p-8 w-full max-w-md text-center shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="text-4xl mb-2">
          {delta <= -2 ? '🦅' : delta === -1 ? '🐦' : delta === 0 ? '⛳' : '🏌️'}
        </div>

        <div className="text-xs uppercase font-extrabold tracking-widest text-emerald-400 mb-1">
          Hole {hole.number} Complete
        </div>

        <h2
          className={`text-3xl font-black uppercase tracking-tight mb-2 ${
            delta <= -2
              ? 'text-amber-400'
              : delta === -1
              ? 'text-emerald-400'
              : delta === 0
              ? 'text-white'
              : 'text-rose-400'
          }`}
        >
          {term}!
        </h2>

        {/* Score Card tile */}
        <div className="bg-slate-950/80 rounded-2xl p-4 my-5 border border-slate-800 grid grid-cols-3 gap-2">
          <div>
            <span className="text-[10px] text-slate-400 uppercase block font-semibold">Par</span>
            <span className="text-xl font-black text-slate-200 tabular-nums">{hole.par}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase block font-semibold">Strokes</span>
            <span className="text-xl font-black text-emerald-400 tabular-nums">{strokes}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase block font-semibold">Score</span>
            <span
              className={`text-xl font-black tabular-nums ${
                delta < 0 ? 'text-emerald-400' : delta === 0 ? 'text-slate-200' : 'text-rose-400'
              }`}
            >
              {delta === 0 ? 'E' : delta > 0 ? `+${delta}` : `${delta}`}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 text-xs font-semibold text-amber-400 mb-6 bg-amber-950/30 py-1.5 px-3 rounded-full border border-amber-600/30">
          <span>🪙 Earned +{coinsEarned} Coins</span>
        </div>

        <div className="flex flex-col gap-2.5">
          {onWatchReplay && (
            <button
              onClick={onWatchReplay}
              className="w-full py-2.5 px-4 font-bold text-xs uppercase tracking-wide bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md"
            >
              <span>↺</span>
              <span>Watch Final Shot Replay</span>
            </button>
          )}

          <button
            onClick={onNextHole}
            data-start="true"
            className="w-full py-3 px-6 font-black text-sm uppercase tracking-wider bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl shadow-lg shadow-emerald-500/25 transition-all active:scale-95"
          >
            {isLastHole ? 'View Tournament Results 🏆' : 'Next Hole ➔'}
          </button>


          {onViewLeaderboard && (
            <button
              onClick={onViewLeaderboard}
              className="w-full py-2.5 px-4 font-semibold text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl"
            >
              Tournament Leaderboard
            </button>
          )}

          {onViewMissions && (
            <button
              onClick={onViewMissions}
              className="w-full py-2 px-4 font-semibold text-xs text-amber-300 bg-amber-950/30 border border-amber-600/30 hover:bg-amber-900/30 rounded-xl flex items-center justify-center gap-1.5"
            >
              <span>🎯 Daily Missions</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
