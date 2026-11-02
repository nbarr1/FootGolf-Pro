/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { DailyMission } from '../types';
import { getTimeUntilDailyReset } from '../game/missions';
import { soundEngine } from '../game/audio';

interface DailyMissionsModalProps {
  missions: DailyMission[];
  onClaim: (missionId: string) => void;
  onClose: () => void;
  onPlayNow?: () => void;
}

export const DailyMissionsModal: React.FC<DailyMissionsModalProps> = ({
  missions,
  onClaim,
  onClose,
  onPlayNow,
}) => {
  const [timeLeft, setTimeLeft] = useState(getTimeUntilDailyReset());

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(getTimeUntilDailyReset());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const completedCount = missions.filter((m) => m.completed).length;
  const unclaimedCount = missions.filter((m) => m.completed && !m.claimed).length;
  const totalBonusCoins = missions.reduce((sum, m) => sum + m.rewardCoins, 0);

  const handleClaimClick = (mission: DailyMission) => {
    soundEngine.playTap();
    confetti({
      particleCount: 60,
      spread: 60,
      origin: { y: 0.6 },
    });
    onClaim(mission.id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 pointer-events-auto select-none">
      <div className="bg-slate-900 border border-emerald-500/40 rounded-3xl p-5 sm:p-6 w-full max-w-lg text-left shadow-2xl max-h-[92vh] flex flex-col animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex justify-between items-start mb-4 pb-3 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">🎯</span>
              <h2 className="text-xl font-black text-white tracking-wide uppercase">
                Daily Missions
              </h2>
              {unclaimedCount > 0 && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 animate-bounce">
                  {unclaimedCount} REWARD{unclaimedCount > 1 ? 'S' : ''}!
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Three fresh challenges every day. Refreshes in{' '}
              <span className="font-mono text-emerald-400 font-bold">
                {timeLeft.hours}h {timeLeft.minutes}m
              </span>
              .
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center font-bold"
            aria-label="Close daily missions"
          >
            ✕
          </button>
        </div>

        {/* Progress & Total Purse Banner */}
        <div className="bg-slate-950/80 p-3 rounded-2xl border border-slate-800 mb-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold block">
              Goals Completed
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-emerald-400 tabular-nums">
                {completedCount}
              </span>
              <span className="text-xs text-slate-400 font-semibold">/ {missions.length}</span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">
              Daily Bonus Pool
            </span>
            <span className="text-base font-black text-amber-400 font-mono">
              🪙 +{totalBonusCoins} Coins
            </span>
          </div>
        </div>

        {/* Missions List */}
        <div className="space-y-3 overflow-y-auto flex-1 pr-1 mb-4">
          {missions.map((mission) => {
            const progressPercent = Math.min(100, Math.round((mission.progress / mission.target) * 100));

            return (
              <div
                key={mission.id}
                className={`p-3.5 rounded-2xl border transition-all ${
                  mission.claimed
                    ? 'bg-slate-950/60 border-slate-800/80 opacity-70'
                    : mission.completed
                    ? 'bg-emerald-950/40 border-emerald-500/70 shadow-lg shadow-emerald-500/10'
                    : 'bg-slate-800/60 border-slate-700/80'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center text-xl shadow-inner flex-shrink-0">
                      {mission.icon}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white leading-snug">
                        {mission.title}
                      </h3>
                      <p className="text-xs text-slate-300 leading-tight">
                        {mission.description}
                      </p>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <span className="text-xs font-bold text-amber-400 font-mono block">
                      🪙 +{mission.rewardCoins}
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-2.5">
                  <div className="flex justify-between text-[11px] font-mono font-semibold text-slate-400 mb-1">
                    <span>
                      {mission.progress} / {mission.target} {mission.unit || ''}
                    </span>
                    <span>{progressPercent}%</span>
                  </div>

                  <div className="w-full h-2 rounded-full bg-slate-900 border border-slate-800 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        mission.completed ? 'bg-emerald-500' : 'bg-emerald-600/70'
                      }`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>

                {/* Action button */}
                <div className="mt-3 flex justify-end">
                  {mission.claimed ? (
                    <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                      ✓ Claimed
                    </span>
                  ) : mission.completed ? (
                    <button
                      onClick={() => handleClaimClick(mission)}
                      className="py-1.5 px-4 font-black text-xs uppercase tracking-wider bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl shadow-lg shadow-amber-500/30 transition-all active:scale-95 animate-pulse"
                    >
                      Claim 🪙 +{mission.rewardCoins}
                    </button>
                  ) : (
                    <span className="text-[11px] font-bold text-slate-400 bg-slate-900/60 px-2.5 py-0.5 rounded-lg border border-slate-800">
                      In Progress
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="flex gap-2 pt-2 border-t border-slate-800">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 px-4 font-semibold text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl text-center"
          >
            Close
          </button>
          {onPlayNow && (
            <button
              onClick={() => {
                onClose();
                onPlayNow();
              }}
              data-start="true"
              className="flex-1 py-2.5 px-4 font-black text-xs uppercase tracking-wider bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl shadow-lg shadow-emerald-500/20 text-center"
            >
              Play Match ➔
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
