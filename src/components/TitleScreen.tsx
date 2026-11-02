/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';

interface TitleScreenProps {
  onStartGame: () => void;
  onOpenTournaments: () => void;
  onOpenMissions: () => void;
  onOpenCourses: () => void;
  onOpenLocker: () => void;
  unclaimedMissionsCount: number;
  skillPoints?: number;
  isMuted: boolean;
  onToggleMute: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  onStartGame,
  onOpenTournaments,
  onOpenMissions,
  onOpenCourses,
  onOpenLocker,
  unclaimedMissionsCount,
  skillPoints = 0,
  isMuted,
  onToggleMute,
}) => {
  // Bind Enter and Space keys to start game
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        onStartGame();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onStartGame]);

  return (
    <div className="safe-inset z-40 flex flex-col justify-between p-6 sm:p-10 pointer-events-none select-none">
      {/* Top Header: Mute / Sound status */}
      <div className="flex justify-between items-center w-full">
        <div className="flex items-center gap-2 bg-slate-950/70 border border-emerald-500/30 px-3 py-1.5 rounded-full pointer-events-auto shadow-md">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span className="text-[11px] font-bold tracking-wider uppercase text-emerald-400">
            FIFG World Tour · Live
          </span>
        </div>

        <button
          onClick={onToggleMute}
          className="w-10 h-10 rounded-full bg-slate-900/80 border border-slate-700/80 text-slate-200 hover:text-white flex items-center justify-center pointer-events-auto transition-transform active:scale-95 shadow-md"
          title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
          aria-label={isMuted ? 'Unmute Sound' : 'Mute Sound'}
        >
          {isMuted ? '🔇' : '🔊'}
        </button>
      </div>

      {/* Center Hero: Bespoke Inline SVG Title Emblem & Lockup */}
      <div className="flex flex-col items-center justify-center text-center my-auto">
        {/* Crest Emblem SVG */}
        <div className="w-28 h-28 sm:w-32 sm:h-32 mb-3 drop-shadow-[0_10px_20px_rgba(16,185,129,0.3)]">
          <svg viewBox="0 0 120 120" className="w-full h-full">
            {/* Outer golden shield */}
            <defs>
              <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="50%" stopColor="#059669" />
                <stop offset="100%" stopColor="#064e3b" />
              </linearGradient>
              <linearGradient id="goldRim" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fde047" />
                <stop offset="100%" stopColor="#d97706" />
              </linearGradient>
            </defs>

            {/* Shield polygon */}
            <polygon
              points="60,6 108,22 100,82 60,114 20,82 12,22"
              fill="url(#shieldGrad)"
              stroke="url(#goldRim)"
              strokeWidth="4"
              strokeLinejoin="round"
            />

            {/* FootGolf Cup & Green Ring inside */}
            <ellipse cx="60" cy="85" rx="26" ry="10" fill="#0f172a" stroke="#ffffff" strokeWidth="2" />
            <ellipse cx="60" cy="85" rx="16" ry="6" fill="#020617" />

            {/* Pin Flagpole */}
            <line x1="60" y1="85" x2="60" y2="28" stroke="#f8fafc" strokeWidth="3" />
            <circle cx="60" cy="27" r="4" fill="#fbbf24" />

            {/* Flag cloth */}
            <polygon points="60,30 84,39 60,48" fill="#ef4444" />

            {/* Soccer Ball Graphic */}
            <circle cx="60" cy="58" r="18" fill="#ffffff" stroke="#0f172a" strokeWidth="2.5" />
            <polygon points="60,52 66,56 64,63 56,63 54,56" fill="#0f172a" />
            <line x1="60" y1="52" x2="60" y2="40" stroke="#0f172a" strokeWidth="2" />
            <line x1="66" y1="56" x2="77" y2="52" stroke="#0f172a" strokeWidth="2" />
            <line x1="64" y1="63" x2="72" y2="73" stroke="#0f172a" strokeWidth="2" />
            <line x1="56" y1="63" x2="48" y2="73" stroke="#0f172a" strokeWidth="2" />
            <line x1="54" y1="56" x2="43" y2="52" stroke="#0f172a" strokeWidth="2" />
          </svg>
        </div>

        {/* Title Lockup */}
        <h1 className="text-4xl sm:text-6xl font-black uppercase tracking-tight text-white drop-shadow-lg">
          FOOT<span className="text-emerald-400">GOLF</span> PRO
        </h1>
        <div className="text-sm sm:text-base font-extrabold tracking-[0.25em] uppercase text-amber-300 drop-shadow mb-6">
          WORLD TOUR 3D
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm pointer-events-auto">
          <button
            onClick={onStartGame}
            data-start="true"
            className="flex-1 py-3.5 px-6 font-black text-sm uppercase tracking-wider bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl shadow-xl shadow-emerald-500/25 transition-all transform active:scale-95 cursor-pointer"
          >
            Tee Off (Start)
          </button>

          <button
            onClick={onOpenTournaments}
            className="py-3.5 px-5 font-bold text-sm uppercase tracking-wider bg-slate-900/90 hover:bg-slate-800 text-amber-300 border border-amber-500/40 rounded-xl shadow-lg transition-all active:scale-95 cursor-pointer"
          >
            🏆 Tournaments
          </button>
        </div>

        {/* Secondary Navigation */}
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 mt-3 pointer-events-auto">
          <button
            onClick={onOpenMissions}
            className="text-xs font-bold text-amber-300 hover:text-amber-200 flex items-center gap-1.5 bg-amber-950/40 border border-amber-600/40 px-3 py-1 rounded-full cursor-pointer transition-transform active:scale-95 shadow-sm"
          >
            <span>🎯 Daily Missions</span>
            {unclaimedMissionsCount > 0 ? (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            ) : (
              <span className="text-[10px] text-amber-400 font-mono">(3)</span>
            )}
          </button>
          <span className="text-slate-600">·</span>
          <button
            onClick={onOpenCourses}
            className="text-xs font-semibold text-slate-300 hover:text-white underline underline-offset-4 cursor-pointer"
          >
            Courses Tour
          </button>
          <span className="text-slate-600">·</span>
          <button
            onClick={onOpenLocker}
            className="text-xs font-semibold text-slate-300 hover:text-white underline underline-offset-4 cursor-pointer flex items-center gap-1.5"
          >
            <span>Locker & Skills</span>
            {skillPoints > 0 && (
              <span className="bg-emerald-500 text-slate-950 text-[10px] font-black px-1.5 py-0.5 rounded-full shadow-sm animate-pulse">
                +{skillPoints} SP
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Bottom Flat Control Hint Line */}
      <div className="w-full text-center">
        <p className="text-[11px] sm:text-xs text-slate-400 font-medium tracking-wide">
          Swipe to Aim · Pull Kick Meter · Curve with Spin · Space/Enter to Start · Esc Pause
        </p>
      </div>
    </div>
  );
};
