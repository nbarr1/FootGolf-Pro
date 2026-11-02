/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import type { GameSettings } from '../game/settings';
import type { QualityPreference, QualityTier } from '../game/quality';

interface PauseModalProps {
  onResume: () => void;
  onRestartHole: () => void;
  onOpenMissions?: () => void;
  onExitToTitle: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  settings: GameSettings;
  activeQualityTier: QualityTier;
  onChangeSettings: (settings: GameSettings) => void;
}

const QUALITY_OPTIONS: { value: QualityPreference; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

export const PauseModal: React.FC<PauseModalProps> = ({
  onResume,
  onRestartHole,
  onOpenMissions,
  onExitToTitle,
  isMuted,
  onToggleMute,
  settings,
  activeQualityTier,
  onChangeSettings,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 pointer-events-auto">
      <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-6 w-full max-w-sm max-h-[90dvh] overflow-y-auto text-center shadow-2xl">
        <h2 className="text-xl font-black uppercase text-white tracking-wider mb-1">
          Game Paused
        </h2>
        <p className="text-xs text-slate-400 mb-6">Take a breather, striker.</p>

        <div className="flex flex-col gap-2.5">
          <button
            onClick={onResume}
            data-start="true"
            className="w-full py-3 px-4 font-bold text-xs uppercase tracking-wider bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl shadow-lg shadow-emerald-500/20"
          >
            Resume Match
          </button>

          {onOpenMissions && (
            <button
              onClick={onOpenMissions}
              className="w-full py-2.5 px-4 font-semibold text-xs text-amber-300 bg-amber-950/40 border border-amber-600/40 hover:bg-amber-900/40 rounded-xl flex items-center justify-center gap-1.5"
            >
              <span>🎯 View Daily Missions</span>
            </button>
          )}

          <button
            onClick={onRestartHole}
            className="w-full py-2.5 px-4 font-semibold text-xs text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-xl"
          >
            Restart Current Hole
          </button>

          <button
            onClick={onToggleMute}
            className="w-full py-2.5 px-4 font-semibold text-xs text-slate-300 bg-slate-800/80 hover:bg-slate-700 rounded-xl flex items-center justify-center gap-2"
          >
            <span>{isMuted ? '🔇 Sound Muted' : '🔊 Sound Enabled'}</span>
          </button>

          <div className="mt-2 rounded-xl bg-slate-800/60 p-3 text-left">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">Graphics quality</span>
              {settings.quality === 'auto' && (
                <span className="text-[10px] text-slate-400">Using {activeQualityTier}</span>
              )}
            </div>
            <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Graphics quality">
              {QUALITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  role="radio"
                  aria-checked={settings.quality === opt.value}
                  onClick={() => onChangeSettings({ ...settings, quality: opt.value })}
                  className={`min-h-12 rounded-lg text-xs font-bold ${
                    settings.quality === opt.value
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-slate-900 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <label className="mt-3 flex min-h-12 items-center justify-between gap-3 text-xs text-slate-200">
              <span>Reduce motion (no shake, slow motion, or hit-stop)</span>
              <input
                type="checkbox"
                className="h-5 w-5 accent-emerald-500"
                checked={settings.reducedMotion}
                onChange={(e) => onChangeSettings({ ...settings, reducedMotion: e.target.checked })}
              />
            </label>
            <label className="flex min-h-12 items-center justify-between gap-3 text-xs text-slate-200">
              <span>Vibration</span>
              <input
                type="checkbox"
                className="h-5 w-5 accent-emerald-500"
                checked={settings.haptics}
                onChange={(e) => onChangeSettings({ ...settings, haptics: e.target.checked })}
              />
            </label>
          </div>

          <button
            onClick={onExitToTitle}
            className="w-full py-2.5 px-4 font-semibold text-xs text-rose-300 hover:text-rose-200 bg-rose-950/30 border border-rose-800/40 rounded-xl mt-2"
          >
            Quit to Title Screen
          </button>
        </div>
      </div>
    </div>
  );
};
