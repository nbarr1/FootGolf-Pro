/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { TournamentState } from '../types';

interface TournamentLeaderboardModalProps {
  tournament: TournamentState;
  onClose: () => void;
}

export const TournamentLeaderboardModal: React.FC<TournamentLeaderboardModalProps> = ({
  tournament,
  onClose,
}) => {
  const player = tournament.leaderboard.find((c) => c.isPlayer);
  const leader = tournament.leaderboard[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 pointer-events-auto">
      <div className="bg-slate-900 border border-emerald-500/40 rounded-2xl p-5 sm:p-6 w-full max-w-xl text-left shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center mb-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🏆</span>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white tracking-wide uppercase">
                {tournament.name}
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="text-amber-400 font-semibold">{tournament.tier}</span>
                <span>•</span>
                <span>Hole {Math.min(tournament.currentHoleIndex + 1, tournament.totalHoles)} of {tournament.totalHoles}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center font-bold transition-all active:scale-95"
            aria-label="Close Leaderboard"
          >
            ✕
          </button>
        </div>

        {/* Live Standing Summary Banner */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 mb-3 flex items-center justify-between text-xs">
          <div>
            <span className="text-slate-400 uppercase font-bold text-[10px] block">Your Standing</span>
            <span className="text-base font-black text-emerald-400">
              {player ? `#${player.rank}` : '-'}
              <span className="text-xs text-slate-300 ml-1.5 font-normal">
                ({player?.scoreRelativeToPar === 0 ? 'E' : (player?.scoreRelativeToPar ?? 0) > 0 ? `+${player?.scoreRelativeToPar}` : player?.scoreRelativeToPar})
              </span>
            </span>
          </div>

          <div className="text-right">
            <span className="text-slate-400 uppercase font-bold text-[10px] block">Tournament Leader</span>
            <span className="text-base font-black text-amber-400">
              {leader?.name || '-'}
              <span className="text-xs text-amber-300 ml-1.5 font-normal">
                ({leader?.scoreRelativeToPar === 0 ? 'E' : (leader?.scoreRelativeToPar ?? 0) > 0 ? `+${leader?.scoreRelativeToPar}` : leader?.scoreRelativeToPar})
              </span>
            </span>
          </div>
        </div>

        {/* Leaderboard Table with Hole-by-Hole breakdown */}
        <div className="flex-1 overflow-y-auto border border-slate-800 rounded-xl overflow-hidden mb-3">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-950 text-slate-400 font-semibold sticky top-0 border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3 w-10 text-center">Pos</th>
                <th className="py-2.5 px-3">Competitor</th>
                <th className="py-2.5 px-2 text-center">H1</th>
                <th className="py-2.5 px-2 text-center">H2</th>
                <th className="py-2.5 px-2 text-center">H3</th>
                <th className="py-2.5 px-3 text-center">To Par</th>
                <th className="py-2.5 px-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {tournament.leaderboard.map((comp) => {
                const isLeader = comp.rank === 1;
                const scoreStr = comp.scoreRelativeToPar === 0
                  ? 'E'
                  : comp.scoreRelativeToPar > 0
                  ? `+${comp.scoreRelativeToPar}`
                  : `${comp.scoreRelativeToPar}`;

                return (
                  <tr
                    key={comp.id}
                    className={`transition-colors ${
                      comp.isPlayer
                        ? 'bg-emerald-950/40 text-emerald-300 font-bold'
                        : isLeader
                        ? 'bg-amber-950/20 text-slate-200'
                        : 'hover:bg-slate-800/40 text-slate-300'
                    }`}
                  >
                    <td className="py-2 px-3 text-center font-bold">
                      {comp.rank === 1 ? '🥇' : comp.rank === 2 ? '🥈' : comp.rank === 3 ? '🥉' : `${comp.rank}`}
                    </td>
                    <td className="py-2 px-3 font-sans">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">{comp.countryCode}</span>
                        <div className="truncate max-w-[120px] sm:max-w-[160px]">
                          <span className={comp.isPlayer ? 'text-emerald-300 font-bold' : 'text-slate-200'}>
                            {comp.name} {comp.isPlayer && '(You)'}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-2 px-2 text-center text-slate-300">
                      {comp.strokesPerHole[0] !== undefined ? comp.strokesPerHole[0] : '-'}
                    </td>
                    <td className="py-2 px-2 text-center text-slate-300">
                      {comp.strokesPerHole[1] !== undefined ? comp.strokesPerHole[1] : '-'}
                    </td>
                    <td className="py-2 px-2 text-center text-slate-300">
                      {comp.strokesPerHole[2] !== undefined ? comp.strokesPerHole[2] : '-'}
                    </td>
                    <td className="py-2 px-3 text-center font-bold">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[11px] ${
                          comp.scoreRelativeToPar < 0
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : comp.scoreRelativeToPar === 0
                            ? 'text-slate-300'
                            : 'bg-rose-500/20 text-rose-400'
                        }`}
                      >
                        {scoreStr}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-slate-100 tabular-nums">
                      {comp.totalStrokes > 0 ? comp.totalStrokes : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div className="flex justify-between items-center text-[11px] text-slate-400 pt-2 border-t border-slate-800">
          <span>Purse: 🪙 {tournament.purseCoins} Coins</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-all active:scale-95"
          >
            Back to Match
          </button>
        </div>
      </div>
    </div>
  );
};
