/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { TournamentState } from '../types';

interface TournamentHubModalProps {
  tournament: TournamentState;
  onStartOrResumeTournament: () => void;
  onNewTournament: (tier: TournamentState['tier']) => void;
  onClose: () => void;
}

export const TournamentHubModal: React.FC<TournamentHubModalProps> = ({
  tournament,
  onStartOrResumeTournament,
  onNewTournament,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 pointer-events-auto">
      <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-5 sm:p-6 w-full max-w-2xl text-left shadow-2xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-start mb-4 pb-3 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">🏆</span>
              <h2 className="text-lg sm:text-xl font-black text-white tracking-wide uppercase">
                {tournament.name}
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {tournament.tier}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Live stroke-play tournament with international competitors. Current Hole: {Math.min(tournament.currentHoleIndex + 1, tournament.totalHoles)} / {tournament.totalHoles}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center font-bold"
          >
            ✕
          </button>
        </div>

        {/* Prize Pool & Tier selector */}
        <div className="grid grid-cols-3 gap-2 mb-4 bg-slate-950/70 p-3 rounded-xl border border-slate-800 text-center">
          <div>
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Prize Purse</div>
            <div className="text-sm sm:text-base font-bold text-amber-400 tabular-nums">🪙 {tournament.purseCoins} Coins</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Trophy Award</div>
            <div className="text-sm sm:text-base font-bold text-yellow-300">🎖️ {tournament.trophyReward}</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Format</div>
            <div className="text-sm sm:text-base font-bold text-emerald-400">Stroke Play</div>
          </div>
        </div>

        {/* Live Leaderboard Table */}
        <div className="flex-1 overflow-y-auto mb-4 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-950 text-slate-400 font-semibold sticky top-0 border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3 w-10 text-center">Pos</th>
                <th className="py-2.5 px-3">Player</th>
                <th className="py-2.5 px-2 text-center">HCP</th>
                <th className="py-2.5 px-2 text-center">Thru</th>
                <th className="py-2.5 px-3 text-center">To Par</th>
                <th className="py-2.5 px-3 text-right">Strokes</th>
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
                      <div className="flex items-center gap-2">
                        <span className="text-base">{comp.countryCode}</span>
                        <div>
                          <span className={comp.isPlayer ? 'text-emerald-300 font-bold' : 'text-slate-200'}>
                            {comp.name} {comp.isPlayer && '(You)'}
                          </span>
                          <span className="text-[10px] text-slate-400 block font-sans">{comp.country}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-2 px-2 text-center text-slate-400">{comp.handicap}</td>
                    <td className="py-2 px-2 text-center text-slate-400">
                      {comp.strokesPerHole.length === tournament.totalHoles ? 'F' : comp.strokesPerHole.length}
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
                      {comp.totalStrokes}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Bottom Actions */}
        <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-800">
          <div className="flex gap-1.5 flex-1">
            <button
              onClick={() => onNewTournament('Regional Open')}
              className="px-2.5 py-2 text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
            >
              Regional
            </button>
            <button
              onClick={() => onNewTournament('Continental Cup')}
              className="px-2.5 py-2 text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
            >
              Continental
            </button>
            <button
              onClick={() => onNewTournament('World Championship')}
              className="px-2.5 py-2 text-[11px] font-semibold bg-amber-900/40 border border-amber-600/40 hover:bg-amber-800/40 text-amber-300 rounded-lg"
            >
              World Cup
            </button>
          </div>

          <button
            onClick={onStartOrResumeTournament}
            className="py-2.5 px-6 font-bold text-xs uppercase tracking-wider bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl shadow-lg shadow-emerald-500/20"
          >
            {tournament.currentHoleIndex >= tournament.totalHoles
              ? 'Restart Tournament'
              : `Play Hole ${tournament.currentHoleIndex + 1} ➔`}
          </button>
        </div>
      </div>
    </div>
  );
};
