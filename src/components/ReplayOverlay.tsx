/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { ReplayTrack } from '../game/replay';

interface ReplayOverlayProps {
  track: ReplayTrack;
  currentTime: number;
  isPlaying: boolean;
  playbackSpeed: number; // 0.5 or 1.0
  cameraAngle: 'broadcast' | 'follow' | 'reverse_pin';
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onChangeSpeed: (speed: number) => void;
  onChangeCameraAngle: (angle: 'broadcast' | 'follow' | 'reverse_pin') => void;
  onRestart: () => void;
  onExit: () => void;
}

export const ReplayOverlay: React.FC<ReplayOverlayProps> = ({
  track,
  currentTime,
  isPlaying,
  playbackSpeed,
  cameraAngle,
  onTogglePlay,
  onSeek,
  onChangeSpeed,
  onChangeCameraAngle,
  onRestart,
  onExit,
}) => {
  // Hotkeys: Space to toggle play, R to restart, Esc to exit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        onTogglePlay();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onExit();
      } else if (e.key.toLowerCase() === 'r') {
        e.preventDefault();
        onRestart();
      } else if (e.key === '1') {
        onChangeCameraAngle('broadcast');
      } else if (e.key === '2') {
        onChangeCameraAngle('follow');
      } else if (e.key === '3') {
        onChangeCameraAngle('reverse_pin');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onTogglePlay, onExit, onRestart, onChangeCameraAngle]);

  const progressPct = Math.min(100, Math.max(0, (currentTime / (track.duration || 1)) * 100));

  const formatTime = (sec: number) => {
    const s = Math.floor(sec);
    const ms = Math.floor((sec - s) * 10);
    return `00:0${s}.${ms}`;
  };

  return (
    <div className="fixed inset-0 pointer-events-none z-40 flex flex-col justify-between p-3 sm:p-5 select-none font-sans">
      {/* Top TV Broadcast Header */}
      <div className="flex items-center justify-between w-full pointer-events-auto">
        <div className="flex items-center gap-2.5 bg-slate-950/90 border border-red-500/50 rounded-2xl px-3.5 py-2 shadow-2xl backdrop-blur-md">
          {/* Pulsing Red Replay Dot */}
          <div className="flex items-center gap-2 pr-3 border-r border-slate-800">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600"></span>
            </span>
            <span className="text-xs sm:text-sm font-black tracking-widest text-red-400 uppercase">
              REPLAY
            </span>
          </div>

          {/* Shot Telemetry */}
          <div className="flex items-center gap-2 text-xs">
            <span className="font-bold text-white">
              Hole {track.shotInfo.holeNumber}
            </span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-300 font-semibold">
              Stroke {track.shotInfo.strokeNumber}
            </span>
            <span className="text-slate-500">•</span>
            <span className="text-amber-400 font-black uppercase">
              {track.shotInfo.kickType}
            </span>
            <span className="text-slate-500">•</span>
            <span className="bg-emerald-950 border border-emerald-500/50 text-emerald-300 font-black px-1.5 py-0.5 rounded text-[11px] tabular-nums">
              {Math.round(track.shotInfo.distanceMeters)}m
            </span>
          </div>
        </div>

        {/* Exit Button */}
        <button
          onClick={onExit}
          className="bg-slate-950/90 border border-slate-700 hover:border-slate-500 hover:bg-slate-900 text-slate-200 hover:text-white px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-xl transition-all active:scale-95"
          title="Exit Replay [Esc]"
        >
          <span>✕</span>
          <span>Exit [Esc]</span>
        </button>
      </div>

      {/* Bottom Center Control Bar */}
      <div className="self-center w-full max-w-xl bg-slate-950/95 border border-slate-800 rounded-2xl p-3 sm:p-4 shadow-2xl backdrop-blur-md pointer-events-auto flex flex-col gap-2.5">
        {/* Timeline Scrub Bar */}
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono font-bold text-slate-400 tabular-nums w-12 text-right">
            {formatTime(currentTime)}
          </span>

          <div
            className="relative flex-1 h-2.5 bg-slate-800 rounded-full cursor-pointer overflow-hidden border border-slate-700/60"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const clickX = e.clientX - rect.left;
              const ratio = Math.min(1, Math.max(0, clickX / rect.width));
              onSeek(ratio * track.duration);
            }}
          >
            <div
              className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-red-600 via-amber-500 to-emerald-500 rounded-full transition-all duration-75"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <span className="text-[11px] font-mono font-bold text-slate-500 tabular-nums w-12">
            {formatTime(track.duration)}
          </span>
        </div>

        {/* Primary Controls Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-900">
          {/* Play / Pause & Restart */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={onRestart}
              className="h-8 px-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-all active:scale-95"
              title="Restart Replay [R]"
            >
              ⏮
            </button>
            <button
              onClick={onTogglePlay}
              className="h-8 px-3.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95"
              title="Play / Pause [Space]"
            >
              <span>{isPlaying ? '⏸ Pause' : '▶ Play'}</span>
            </button>
          </div>

          {/* Speed Selector */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5">
            <button
              onClick={() => onChangeSpeed(0.5)}
              className={`px-2 py-1 rounded text-[11px] font-bold transition-all ${
                playbackSpeed === 0.5
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              0.5x Slow-Mo
            </button>
            <button
              onClick={() => onChangeSpeed(1.0)}
              className={`px-2 py-1 rounded text-[11px] font-bold transition-all ${
                playbackSpeed === 1.0
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              1.0x Normal
            </button>
          </div>

          {/* Camera Angle Selector */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5">
            <button
              onClick={() => onChangeCameraAngle('broadcast')}
              className={`px-2 py-1 rounded text-[11px] font-bold transition-all ${
                cameraAngle === 'broadcast'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Sideline Broadcast TV Cam [1]"
            >
              🎥 Sideline
            </button>
            <button
              onClick={() => onChangeCameraAngle('follow')}
              className={`px-2 py-1 rounded text-[11px] font-bold transition-all ${
                cameraAngle === 'follow'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Tracking Follow Cam [2]"
            >
              🚁 Follow
            </button>
            <button
              onClick={() => onChangeCameraAngle('reverse_pin')}
              className={`px-2 py-1 rounded text-[11px] font-bold transition-all ${
                cameraAngle === 'reverse_pin'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Reverse Pin Cam [3]"
            >
              ⛳ Pin Cam
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
