/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import { SpinControl } from '../types';

interface SpinModalProps {
  spin: SpinControl;
  onSpinChange: (newSpin: SpinControl) => void;
  onClose: () => void;
}

export const SpinModal: React.FC<SpinModalProps> = ({ spin, onSpinChange, onClose }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handlePointer = (clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const radius = rect.width / 2;

    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Limit to circle
    const clampedDist = Math.min(dist, radius * 0.88);
    const angle = Math.atan2(dy, dx);

    const nx = (Math.cos(angle) * clampedDist) / (radius * 0.88);
    const ny = (Math.sin(angle) * clampedDist) / (radius * 0.88);

    // Contact point mapping:
    // If you kick the bottom (ny > 0) -> backspin (top: -ny)
    // If you kick the top (ny < 0) -> topspin (top: -ny)
    // If you kick the right (nx > 0) -> spins left / hooks left (side: -nx)
    // If you kick the left (nx < 0) -> spins right / slices right (side: -nx)
    onSpinChange({
      side: Math.round(-nx * 100) / 100,
      top: Math.round(-ny * 100) / 100,
    });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    handlePointer(e.clientX, e.clientY);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    handlePointer(e.clientX, e.clientY);
  };

  const onPointerUp = () => {
    setIsDragging(false);
  };

  // Convert spin back to dot coordinates
  const radiusPercent = 40;
  const dotX = 50 - spin.side * radiusPercent;
  const dotY = 50 - spin.top * radiusPercent;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 pointer-events-auto">
      <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-6 w-full max-w-sm text-center shadow-2xl">
        <h3 className="text-lg font-bold text-white tracking-wide uppercase mb-1">
          Kick Contact Point & Spin
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          Tap or drag the red impact dot to curve the ball or add backspin/topspin.
        </p>

        {/* 2D Interactive Soccer Ball representation */}
        <div className="flex justify-center my-3">
          <div
            ref={containerRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className="relative w-48 h-48 rounded-full border-4 border-slate-700 bg-gradient-to-br from-slate-100 to-slate-300 shadow-inner cursor-crosshair touch-none overflow-hidden select-none"
          >
            {/* Soccer Ball Pattern lines */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-40" viewBox="0 0 100 100">
              <polygon points="50,42 58,48 55,58 45,58 42,48" fill="#1e293b" />
              <line x1="50" y1="42" x2="50" y2="24" stroke="#1e293b" strokeWidth="2" />
              <line x1="58" y1="48" x2="74" y2="44" stroke="#1e293b" strokeWidth="2" />
              <line x1="55" y1="58" x2="68" y2="72" stroke="#1e293b" strokeWidth="2" />
              <line x1="45" y1="58" x2="32" y2="72" stroke="#1e293b" strokeWidth="2" />
              <line x1="42" y1="48" x2="26" y2="44" stroke="#1e293b" strokeWidth="2" />
              {/* Center crosshair */}
              <line x1="50" y1="0" x2="50" y2="100" stroke="#94a3b8" strokeDasharray="3,3" strokeWidth="1" />
              <line x1="0" y1="50" x2="100" y2="50" stroke="#94a3b8" strokeDasharray="3,3" strokeWidth="1" />
            </svg>

            {/* Impact Red Target Dot */}
            <div
              className="absolute w-6 h-6 -ml-3 -mt-3 rounded-full bg-red-600 border-2 border-white shadow-lg pointer-events-none transition-transform"
              style={{
                left: `${dotX}%`,
                top: `${dotY}%`,
              }}
            >
              <div className="absolute inset-1 rounded-full bg-red-400" />
            </div>
          </div>
        </div>

        {/* Spin labels */}
        <div className="grid grid-cols-2 gap-2 text-xs my-3 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
          <div>
            <span className="text-slate-400">Curve:</span>{' '}
            <span className="font-semibold text-emerald-400">
              {spin.side > 0.05 ? `Slice Right (+${Math.round(spin.side * 100)}%)` :
               spin.side < -0.05 ? `Hook Left (${Math.round(spin.side * 100)}%)` : 'Straight'}
            </span>
          </div>
          <div>
            <span className="text-slate-400">Vertical:</span>{' '}
            <span className="font-semibold text-amber-400">
              {spin.top > 0.05 ? `Topspin (+${Math.round(spin.top * 100)}%)` :
               spin.top < -0.05 ? `Backspin (${Math.round(spin.top * 100)}%)` : 'Neutral'}
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => onSpinChange({ top: 0, side: 0 })}
            className="flex-1 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
          >
            Reset Center
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-md"
          >
            Apply Spin
          </button>
        </div>
      </div>
    </div>
  );
};
