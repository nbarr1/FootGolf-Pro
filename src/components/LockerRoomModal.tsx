/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  FootGolfBallCustomization,
  PlayerAttributes,
  PlayerProfile,
  MotionTrailConfig,
  MotionTrailStyleId,
} from '../types';
import { DEFAULT_MOTION_TRAIL_CONFIGS, getMotionTrailPreset } from '../game/motionTrails';

interface LockerRoomModalProps {
  profile: PlayerProfile;
  balls: FootGolfBallCustomization[];
  onEquipBall: (ballId: string) => void;
  onBuyBall: (ball: FootGolfBallCustomization) => void;
  onUpgradeAttribute?: (attrKey: keyof PlayerAttributes) => void;
  onEquipTrail?: (trailId: MotionTrailStyleId) => void;
  onUpdateCustomTrail?: (custom: Partial<MotionTrailConfig>) => void;
  onClose: () => void;
}

export const LockerRoomModal: React.FC<LockerRoomModalProps> = ({
  profile,
  balls,
  onEquipBall,
  onBuyBall,
  onUpgradeAttribute,
  onEquipTrail,
  onUpdateCustomTrail,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'attributes' | 'balls' | 'trails' | 'records'>('attributes');

  const attributes = profile.attributes || {
    power: 1,
    accuracy: 1,
    spinControl: 1,
    finesse: 1,
  };

  const attributeSpecs: {
    key: keyof PlayerAttributes;
    name: string;
    icon: string;
    description: string;
    currentValue: string;
    nextValue: string;
  }[] = [
    {
      key: 'power',
      name: 'Power',
      icon: '⚡',
      description: 'Increases maximum kick launch velocity & drive carry distance.',
      currentValue: `+${((attributes.power - 1) * 2.5).toFixed(1)}% Carry`,
      nextValue: `+${(attributes.power * 2.5).toFixed(1)}% Carry`,
    },
    {
      key: 'accuracy',
      name: 'Accuracy',
      icon: '🎯',
      description: 'Expands the "Pure Strike" sweet spot window & reduces swipe drift.',
      currentValue: `+${(attributes.accuracy - 1) * 3}% Sweet Spot`,
      nextValue: `+${attributes.accuracy * 3}% Sweet Spot`,
    },
    {
      key: 'spinControl',
      name: 'Spin Control',
      icon: '🌀',
      description: 'Amplifies aerodynamic Magnus curl & green check-up backspin bite.',
      currentValue: `+${(attributes.spinControl - 1) * 4}% Curve Response`,
      nextValue: `+${attributes.spinControl * 4}% Curve Response`,
    },
    {
      key: 'finesse',
      name: 'Finesse',
      icon: '⛳',
      description: 'Raises putting cup capture speed threshold to prevent lip-outs.',
      currentValue: `${(4.2 + (attributes.finesse - 1) * 0.06).toFixed(2)} m/s Capture`,
      nextValue: `${(4.2 + attributes.finesse * 0.06).toFixed(2)} m/s Capture`,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 pointer-events-auto">
      <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-4 sm:p-6 w-full max-w-xl text-left shadow-2xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center mb-3 pb-3 border-b border-slate-800">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-white tracking-wide uppercase flex items-center gap-2">
              <span>Locker Room & Athlete Pro</span>
            </h2>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1 text-xs text-slate-300">
              <span className="font-semibold text-emerald-400">👤 {profile.name}</span>
              <span className="bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded text-[11px] font-bold text-emerald-300">
                Lvl {profile.playerLevel || 1}
              </span>
              <span className="text-amber-400 font-mono font-bold">🪙 {profile.coins}</span>
              <span className="text-yellow-300 font-mono font-bold">🏆 {profile.trophies}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center font-bold"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-3 border-b border-slate-800/80 pb-2">
          <button
            onClick={() => setActiveTab('attributes')}
            className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'attributes'
                ? 'bg-emerald-500 text-slate-950 shadow-md'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <span>🏋️ Training & Stats</span>
            {(profile.skillPoints || 0) > 0 && (
              <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-1.5 py-0.2 rounded-full">
                +{profile.skillPoints}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('balls')}
            className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'balls'
                ? 'bg-emerald-500 text-slate-950 shadow-md'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <span>⚽ Match Balls</span>
          </button>

          <button
            onClick={() => setActiveTab('trails')}
            className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'trails'
                ? 'bg-emerald-500 text-slate-950 shadow-md'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <span>🌈 Motion Trails</span>
          </button>

          <button
            onClick={() => setActiveTab('records')}
            className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'records'
                ? 'bg-emerald-500 text-slate-950 shadow-md'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <span>📊 Career Stats</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-1">
          {/* TAB 1: Attributes & Training Progression */}
          {activeTab === 'attributes' && (
            <div className="space-y-3">
              {/* Level & XP Banner */}
              <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800">
                <div className="flex justify-between items-center mb-1 text-xs">
                  <span className="font-extrabold uppercase text-slate-300">
                    Level {profile.playerLevel || 1} Athlete
                  </span>
                  <span className="font-mono text-emerald-400 text-[11px] font-bold">
                    {profile.currentXp || 0} / {profile.xpToNextLevel || 300} XP
                  </span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                  <div
                    className="bg-emerald-400 h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round(((profile.currentXp || 0) / (profile.xpToNextLevel || 300)) * 100)
                      )}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between items-center mt-2.5 pt-2 border-t border-slate-900 text-xs">
                  <span className="text-slate-400 text-[11px]">
                    Earn XP from every hole & tournament podium to level up!
                  </span>
                  <div className="flex items-center gap-1 bg-amber-950/60 border border-amber-500/40 px-2.5 py-1 rounded-lg">
                    <span className="text-amber-400 font-black text-xs">
                      ⭐ {profile.skillPoints || 0} SP
                    </span>
                  </div>
                </div>
              </div>

              {/* Attribute Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {attributeSpecs.map((attr) => {
                  const level = attributes[attr.key] || 1;
                  const isMaxed = level >= 10;
                  const canUpgrade = (profile.skillPoints || 0) > 0 && !isMaxed;

                  return (
                    <div
                      key={attr.key}
                      className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-black text-white flex items-center gap-1.5">
                            <span>{attr.icon}</span>
                            <span>{attr.name}</span>
                          </span>
                          <span className="text-xs font-mono font-bold text-emerald-400">
                            Lvl {level}/10
                          </span>
                        </div>

                        <p className="text-[10px] text-slate-400 leading-tight mb-2">
                          {attr.description}
                        </p>

                        {/* Level Pips */}
                        <div className="flex gap-1 mb-2">
                          {Array.from({ length: 10 }).map((_, i) => (
                            <div
                              key={i}
                              className={`h-1.5 flex-1 rounded-full ${
                                i < level ? 'bg-emerald-400' : 'bg-slate-800'
                              }`}
                            />
                          ))}
                        </div>

                        <div className="text-[10px] text-slate-400 mb-2">
                          <span>Effect: </span>
                          <span className="text-white font-bold">{attr.currentValue}</span>
                          {!isMaxed && (
                            <span className="text-emerald-400 ml-1">➔ {attr.nextValue}</span>
                          )}
                        </div>
                      </div>

                      <button
                        disabled={!canUpgrade}
                        onClick={() => onUpgradeAttribute?.(attr.key)}
                        className={`w-full py-1.5 px-3 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                          isMaxed
                            ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                            : canUpgrade
                            ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md active:scale-95'
                            : 'bg-slate-800/80 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        {isMaxed ? 'MAX LEVEL' : 'Upgrade (1 SP)'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: Match Balls */}
          {activeTab === 'balls' && (
            <div className="grid grid-cols-2 gap-2.5">
              {balls.map((ball) => {
                const isEquipped = profile.equippedBallId === ball.id;
                const isUnlocked = profile.unlockedBalls.includes(ball.id);
                const canAfford = profile.coins >= ball.cost;

                return (
                  <div
                    key={ball.id}
                    className={`p-3 rounded-xl border flex flex-col justify-between ${
                      isEquipped
                        ? 'bg-emerald-950/60 border-emerald-500 ring-1 ring-emerald-500/40'
                        : isUnlocked
                        ? 'bg-slate-800/80 border-slate-700'
                        : 'bg-slate-950/60 border-slate-800 opacity-80'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-white">{ball.name}</span>
                        <div
                          className="w-4 h-4 rounded-full border border-white/40 shadow-sm"
                          style={{ backgroundColor: ball.primaryColor }}
                        />
                      </div>
                      <div className="text-[10px] text-slate-400 space-y-0.5 mb-2">
                        <div>
                          Loft Bonus: <span className="text-emerald-400">+{Math.round(ball.bonusLoft * 100)}%</span>
                        </div>
                        <div>
                          Roll Bonus: <span className="text-amber-400">+{Math.round(ball.bonusRoll * 100)}%</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      {isEquipped ? (
                        <div className="py-1 text-center text-[11px] font-bold text-emerald-400 bg-emerald-900/40 rounded-lg">
                          Equipped
                        </div>
                      ) : isUnlocked ? (
                        <button
                          onClick={() => onEquipBall(ball.id)}
                          className="w-full py-1 text-[11px] font-bold bg-slate-700 hover:bg-slate-600 text-white rounded-lg"
                        >
                          Equip
                        </button>
                      ) : (
                        <button
                          disabled={!canAfford}
                          onClick={() => onBuyBall(ball)}
                          className={`w-full py-1 text-[11px] font-bold rounded-lg ${
                            canAfford
                              ? 'bg-amber-600 hover:bg-amber-500 text-white'
                              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          Unlock 🪙 {ball.cost}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 3: Motion Trails & Dynamic Color Tuner */}
          {activeTab === 'trails' && (() => {
            const equippedTrailId = profile.equippedTrailId || 'championship_gold';
            const currentPreset = getMotionTrailPreset(equippedTrailId);
            const effectiveConfig: MotionTrailConfig = {
              ...currentPreset,
              ...(profile.customTrailConfig || {}),
            };

            return (
              <div className="space-y-4">
                {/* Custom Palette & Dynamics Tuner for Active Equipped Trail */}
                <div className="bg-slate-950/90 rounded-xl p-3.5 border border-emerald-500/40 shadow-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🎨</span>
                      <h3 className="text-xs font-black uppercase text-white tracking-wider">
                        Active Trail Color & Ribbon Tuner
                      </h3>
                    </div>
                    <button
                      onClick={() => {
                        onUpdateCustomTrail?.({
                          baseColor: currentPreset.baseColor,
                          highPowerColor: currentPreset.highPowerColor,
                          spinLeftColor: currentPreset.spinLeftColor,
                          spinRightColor: currentPreset.spinRightColor,
                          particleColor: currentPreset.particleColor,
                          ribbonWidth: currentPreset.ribbonWidth,
                        });
                      }}
                      className="text-[10px] font-bold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded transition-colors"
                      title="Reset current trail to default preset colors"
                    >
                      ↺ Reset Defaults
                    </button>
                  </div>

                  {/* Dynamic Color Response Spectrum Preview */}
                  <div className="mb-3">
                    <div className="text-[10px] text-slate-300 font-bold mb-1 flex justify-between">
                      <span>Live Color Gradient Response</span>
                      <span className="text-slate-400 font-mono text-[9px]">Power ➔ Cruise ➔ Hook ➔ Slice</span>
                    </div>
                    <div
                      className="h-4 rounded-lg w-full border border-slate-700 shadow-inner"
                      style={{
                        background: `linear-gradient(90deg, ${effectiveConfig.highPowerColor} 0%, ${effectiveConfig.baseColor} 45%, ${effectiveConfig.spinLeftColor} 75%, ${effectiveConfig.spinRightColor} 100%)`,
                      }}
                    />
                    <div className="flex justify-between text-[9px] text-slate-400 mt-0.5 px-0.5 font-mono">
                      <span className="text-rose-400 font-bold">⚡ High Power</span>
                      <span className="text-slate-300 font-bold">● Base Cruise</span>
                      <span className="text-cyan-400 font-bold">↶ Hook</span>
                      <span className="text-pink-400 font-bold">↷ Slice</span>
                    </div>
                  </div>

                  {/* 4 Dynamic Color Pickers */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                    {/* Base Color */}
                    <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800 flex flex-col justify-between">
                      <div className="text-[10px] font-bold text-slate-300 mb-1">Base Cruise</div>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={effectiveConfig.baseColor}
                          onChange={(e) => onUpdateCustomTrail?.({ baseColor: e.target.value })}
                          className="w-7 h-7 rounded border border-slate-700 cursor-pointer bg-transparent"
                        />
                        <span className="text-[10px] font-mono text-slate-400 uppercase">
                          {effectiveConfig.baseColor}
                        </span>
                      </div>
                    </div>

                    {/* High Power Flare */}
                    <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800 flex flex-col justify-between">
                      <div className="text-[10px] font-bold text-rose-300 mb-1">Power Flare</div>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={effectiveConfig.highPowerColor}
                          onChange={(e) => onUpdateCustomTrail?.({ highPowerColor: e.target.value })}
                          className="w-7 h-7 rounded border border-slate-700 cursor-pointer bg-transparent"
                        />
                        <span className="text-[10px] font-mono text-slate-400 uppercase">
                          {effectiveConfig.highPowerColor}
                        </span>
                      </div>
                    </div>

                    {/* Left Hook Spin */}
                    <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800 flex flex-col justify-between">
                      <div className="text-[10px] font-bold text-cyan-300 mb-1">Hook (Left)</div>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={effectiveConfig.spinLeftColor}
                          onChange={(e) => onUpdateCustomTrail?.({ spinLeftColor: e.target.value })}
                          className="w-7 h-7 rounded border border-slate-700 cursor-pointer bg-transparent"
                        />
                        <span className="text-[10px] font-mono text-slate-400 uppercase">
                          {effectiveConfig.spinLeftColor}
                        </span>
                      </div>
                    </div>

                    {/* Right Slice Spin */}
                    <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800 flex flex-col justify-between">
                      <div className="text-[10px] font-bold text-pink-300 mb-1">Slice (Right)</div>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={effectiveConfig.spinRightColor}
                          onChange={(e) => onUpdateCustomTrail?.({ spinRightColor: e.target.value })}
                          className="w-7 h-7 rounded border border-slate-700 cursor-pointer bg-transparent"
                        />
                        <span className="text-[10px] font-mono text-slate-400 uppercase">
                          {effectiveConfig.spinRightColor}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Ribbon Width Slider */}
                  <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between gap-3">
                    <div className="text-[10px] text-slate-300 font-bold whitespace-nowrap">
                      Ribbon Width: <span className="text-emerald-400 font-mono">{(effectiveConfig.ribbonWidth).toFixed(2)}m</span>
                    </div>
                    <input
                      type="range"
                      min="0.08"
                      max="0.32"
                      step="0.02"
                      value={effectiveConfig.ribbonWidth}
                      onChange={(e) => onUpdateCustomTrail?.({ ribbonWidth: parseFloat(e.target.value) })}
                      className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                    />
                  </div>
                </div>

                {/* Trail Presets List */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <span>✨ Motion Trail Presets</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {DEFAULT_MOTION_TRAIL_CONFIGS.map((trail) => {
                      const isEquipped = equippedTrailId === trail.id;

                      return (
                        <div
                          key={trail.id}
                          className={`p-3 rounded-xl border flex flex-col justify-between transition-all ${
                            isEquipped
                              ? 'bg-emerald-950/50 border-emerald-500 ring-1 ring-emerald-500/50 shadow-md'
                              : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-black text-white">{trail.name}</span>
                              {isEquipped && (
                                <span className="text-[10px] font-black uppercase text-emerald-400 bg-emerald-900/50 px-2 py-0.5 rounded border border-emerald-500/30">
                                  Equipped
                                </span>
                              )}
                            </div>

                            <p className="text-[10px] text-slate-400 leading-tight mb-2">
                              {trail.description}
                            </p>

                            {/* Trail Gradient Preview Bar */}
                            <div
                              className="h-2.5 rounded-full w-full mb-2.5 border border-slate-800"
                              style={{
                                background: `linear-gradient(90deg, ${trail.highPowerColor} 0%, ${trail.baseColor} 50%, ${trail.spinLeftColor} 75%, ${trail.spinRightColor} 100%)`,
                              }}
                            />

                            {/* Color Swatch Dots */}
                            <div className="flex items-center gap-1.5 mb-2.5 text-[9px] text-slate-400 font-mono">
                              <span
                                className="w-2.5 h-2.5 rounded-full border border-white/20 inline-block"
                                style={{ backgroundColor: trail.baseColor }}
                                title={`Base: ${trail.baseColor}`}
                              />
                              <span
                                className="w-2.5 h-2.5 rounded-full border border-white/20 inline-block"
                                style={{ backgroundColor: trail.highPowerColor }}
                                title={`Power Flare: ${trail.highPowerColor}`}
                              />
                              <span
                                className="w-2.5 h-2.5 rounded-full border border-white/20 inline-block"
                                style={{ backgroundColor: trail.spinLeftColor }}
                                title={`Hook Flare: ${trail.spinLeftColor}`}
                              />
                              <span
                                className="w-2.5 h-2.5 rounded-full border border-white/20 inline-block"
                                style={{ backgroundColor: trail.spinRightColor }}
                                title={`Slice Flare: ${trail.spinRightColor}`}
                              />
                              <span className="text-slate-500 ml-auto">{trail.ribbonWidth.toFixed(2)}m</span>
                            </div>
                          </div>

                          <button
                            onClick={() => onEquipTrail?.(trail.id)}
                            disabled={isEquipped}
                            className={`w-full py-1.5 px-3 rounded-lg text-[11px] font-bold tracking-wide transition-all ${
                              isEquipped
                                ? 'bg-emerald-900/30 text-emerald-400/80 cursor-default border border-emerald-500/20'
                                : 'bg-slate-800 hover:bg-slate-700 text-white shadow hover:border-slate-600'
                            }`}
                          >
                            {isEquipped ? 'Active Trail' : 'Equip Style'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* TAB 4: Career Records */}
          {activeTab === 'records' && (
            <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
              <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
                <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-sans">Eagles</span>
                  <span className="text-amber-400 font-bold">{profile.stats.eagles}</span>
                </div>
                <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-sans">Birdies</span>
                  <span className="text-emerald-400 font-bold">{profile.stats.birdies}</span>
                </div>
                <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-sans">Pars</span>
                  <span className="text-slate-200 font-bold">{profile.stats.pars}</span>
                </div>
                <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-sans">Holes Played</span>
                  <span className="text-slate-200 font-bold">{profile.stats.holesPlayed}</span>
                </div>
                <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-sans">Tournaments Won</span>
                  <span className="text-yellow-400 font-bold">{profile.tournamentsWon}</span>
                </div>
                <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-sans">Longest Kick</span>
                  <span className="text-blue-400 font-bold">{profile.stats.longestKickMeters}m</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
