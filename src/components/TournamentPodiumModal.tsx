/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { TournamentState } from '../types';

interface TournamentPodiumModalProps {
  tournament: TournamentState;
  onFinish: () => void;
}

export const TournamentPodiumModal: React.FC<TournamentPodiumModalProps> = ({
  tournament,
  onFinish,
}) => {
  const player = tournament.leaderboard.find((c) => c.isPlayer);
  const playerRank = player?.rank || 8;
  const isWinner = playerRank === 1;
  const isPodium = playerRank <= 3;

  useEffect(() => {
    if (isPodium) {
      confetti({
        disableForReducedMotion: true,
        particleCount: 150,
        spread: 90,
        origin: { y: 0.5 },
      });
    }
  }, [isPodium]);

  const top3 = tournament.leaderboard.slice(0, 3);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 pointer-events-auto">
      <div className="bg-slate-900 border border-emerald-500/40 rounded-3xl p-6 sm:p-8 w-full max-w-lg text-center shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="text-5xl mb-2">{isWinner ? '🏆' : isPodium ? '🎖️' : '⛳'}</div>

        <div className="text-xs uppercase font-extrabold tracking-widest text-emerald-400 mb-1">
          {tournament.name}
        </div>

        <h2 className="text-2xl sm:text-3xl font-black uppercase text-white mb-1">
          {isWinner ? 'Tournament Champion!' : isPodium ? 'Podium Finish!' : 'Tournament Complete'}
        </h2>

        <p className="text-xs text-slate-300 mb-6">
          You finished in <span className="font-bold text-amber-400 font-mono">#{playerRank} Place</span> with a total score of{' '}
          <span className="font-bold text-emerald-400 font-mono">
            {player?.scoreRelativeToPar === 0 ? 'E' : (player?.scoreRelativeToPar || 0) > 0 ? `+${player?.scoreRelativeToPar}` : player?.scoreRelativeToPar}
          </span>
          .
        </p>

        {/* Podium visualization */}
        <div className="grid grid-cols-3 gap-2 items-end mb-6 bg-slate-950/70 p-4 rounded-2xl border border-slate-800 min-h-36">
          {/* 2nd Place */}
          {top3[1] && (
            <div className="flex flex-col items-center">
              <span className="text-xl mb-1">{top3[1].countryCode}</span>
              <span className="text-[11px] font-bold text-slate-200 truncate max-w-full">
                {top3[1].name}
              </span>
              <span className="text-[10px] text-slate-400 font-mono mb-1">{top3[1].totalStrokes} st</span>
              <div className="w-full bg-slate-700 h-16 rounded-t-lg flex items-center justify-center font-bold text-sm text-slate-300">
                🥈 2
              </div>
            </div>
          )}

          {/* 1st Place */}
          {top3[0] && (
            <div className="flex flex-col items-center">
              <span className="text-2xl mb-1">{top3[0].countryCode}</span>
              <span className="text-xs font-black text-amber-300 truncate max-w-full">
                {top3[0].name}
              </span>
              <span className="text-[10px] text-amber-400 font-mono mb-1">{top3[0].totalStrokes} st</span>
              <div className="w-full bg-amber-500 h-24 rounded-t-lg flex items-center justify-center font-black text-lg text-slate-950 shadow-lg shadow-amber-500/20">
                🥇 1
              </div>
            </div>
          )}

          {/* 3rd Place */}
          {top3[2] && (
            <div className="flex flex-col items-center">
              <span className="text-xl mb-1">{top3[2].countryCode}</span>
              <span className="text-[11px] font-bold text-slate-200 truncate max-w-full">
                {top3[2].name}
              </span>
              <span className="text-[10px] text-slate-400 font-mono mb-1">{top3[2].totalStrokes} st</span>
              <div className="w-full bg-amber-800/80 h-12 rounded-t-lg flex items-center justify-center font-bold text-xs text-amber-200">
                🥉 3
              </div>
            </div>
          )}
        </div>

        {/* Prize Rewards */}
        <div className="bg-amber-950/30 border border-amber-600/30 rounded-xl p-3 mb-6 text-xs text-amber-300 font-semibold flex justify-around">
          <div>Coins Won: <span className="font-bold text-white tabular-nums">🪙 +{isWinner ? tournament.purseCoins : isPodium ? Math.round(tournament.purseCoins * 0.4) : 100}</span></div>
          {isWinner && <div>Trophy: <span className="font-bold text-white">🏆 {tournament.trophyReward}</span></div>}
        </div>

        <button
          onClick={onFinish}
          data-start="true"
          className="w-full py-3.5 px-6 font-black text-sm uppercase tracking-wider bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl shadow-lg shadow-emerald-500/25 transition-all"
        >
          Collect Rewards & Continue
        </button>
      </div>
    </div>
  );
};
