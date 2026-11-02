/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState, useRef } from 'react';
import { HoleData, KickType, SurfaceType, Vector3D } from '../types';
import {
  calculateAimTargetPoint,
  calculateHoleBounds,
  mapToWorldCoordinates,
  worldToMapCoordinates,
} from '../game/minimap';

interface HoleMiniMapProps {
  hole: HoleData;
  ballPos: Vector3D;
  pinPos: Vector3D;
  ballLie: SurfaceType;
  aimAngleRad: number;
  power: number;
  kickType: KickType;
  wind: { speed: number; angleRad: number };
  onAimChange: (angleRad: number) => void;
  isOpen: boolean;
  onToggleOpen: () => void;
}

export const HoleMiniMap: React.FC<HoleMiniMapProps> = ({
  hole,
  ballPos,
  pinPos,
  ballLie,
  aimAngleRad,
  power,
  kickType,
  wind,
  onAimChange,
  isOpen,
  onToggleOpen,
}) => {
  // Sizing mode: 'compact' or 'tactical' (expanded)
  const [isTacticalSize, setIsTacticalSize] = useState<boolean>(false);
  const [tapRipple, setTapRipple] = useState<{ x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Viewport dimensions
  const viewWidth = isTacticalSize ? 250 : 155;
  const viewHeight = isTacticalSize ? 350 : 215;
  const padding = 16;

  // Memoize bounds
  const bounds = useMemo(() => calculateHoleBounds(hole, 16), [hole]);

  // Map world positions to 2D SVG
  const teeCoords = useMemo(
    () => worldToMapCoordinates(hole.teePosition, bounds, viewWidth, viewHeight, padding),
    [hole.teePosition, bounds, viewWidth, viewHeight]
  );

  const pinCoords = useMemo(
    () => worldToMapCoordinates(pinPos, bounds, viewWidth, viewHeight, padding),
    [pinPos, bounds, viewWidth, viewHeight]
  );

  const ballCoords = useMemo(
    () => worldToMapCoordinates(ballPos, bounds, viewWidth, viewHeight, padding),
    [ballPos, bounds, viewWidth, viewHeight]
  );

  // Projected aim landing point
  const targetPoint = useMemo(
    () => calculateAimTargetPoint(ballPos, aimAngleRad, power, kickType, ballLie),
    [ballPos, aimAngleRad, power, kickType, ballLie]
  );


  const targetCoords = useMemo(
    () => worldToMapCoordinates(targetPoint, bounds, viewWidth, viewHeight, padding),
    [targetPoint, bounds, viewWidth, viewHeight]
  );

  // Scale factor: pixels per meter (approx based on height and length)
  const pixelsPerMeter = (viewHeight - 2 * padding) / (bounds.length || 1);

  // Direct distance to pin
  const distToPinMeters = Math.round(
    Math.hypot(pinPos.x - ballPos.x, pinPos.z - ballPos.z)
  );

  // Wind relative angle in degrees
  const windAngleDeg = Math.round((wind.angleRad * 180) / Math.PI);

  // Handle interactive click-to-aim on mini-map
  const handleMapClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Convert SVG pixels to world coordinate
    const worldPos = mapToWorldCoordinates(
      { mapX: clickX, mapY: clickY },
      bounds,
      viewWidth,
      viewHeight,
      padding
    );

    // Calculate angle from ball to clicked spot
    const dx = worldPos.worldX - ballPos.x;
    const dz = worldPos.worldZ - ballPos.z;
    const newAngle = Math.atan2(dx, dz);

    setTapRipple({ x: clickX, y: clickY });
    setTimeout(() => setTapRipple(null), 500);

    onAimChange(newAngle);
  };

  if (!isOpen) {
    return (
      <button
        onClick={onToggleOpen}
        className="pointer-events-auto bg-slate-950/90 border border-emerald-500/50 hover:border-emerald-400 text-emerald-300 hover:text-white px-2.5 py-1.5 rounded-xl text-xs font-bold shadow-xl flex items-center gap-1.5 transition-all active:scale-95"
        title="Open Hole Mini-Map [N]"
        aria-label="Open Hole Mini-Map"
      >
        <span>🗺️</span>
        <span className="hidden sm:inline">Mini-Map</span>
        <span className="text-[10px] text-amber-300 font-mono font-normal">
          {distToPinMeters}m
        </span>
      </button>
    );
  }

  return (
    <div
      className={`pointer-events-auto bg-slate-950/92 border border-emerald-500/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col transition-all duration-200 select-none ${
        isTacticalSize ? 'w-[250px]' : 'w-[155px]'
      }`}
      style={{ zIndex: 35 }}
    >
      {/* Mini-Map Header Bar */}
      <div className="flex items-center justify-between px-2.5 py-1.5 bg-slate-900/90 border-b border-slate-800 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">🗺️</span>
          <div>
            <span className="font-black text-white text-[11px] block leading-tight">
              Hole {hole.number}
            </span>
            <span className="text-[9px] text-amber-300 font-bold font-mono">
              {distToPinMeters}m to Pin
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Size toggle */}
          <button
            onClick={() => setIsTacticalSize((prev) => !prev)}
            className="w-6 h-6 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors active:scale-95"
            title={isTacticalSize ? 'Compact View' : 'Tactical Zoom'}
            aria-label="Toggle Mini-Map Zoom"
          >
            {isTacticalSize ? (
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
              </svg>
            )}
          </button>

          {/* Close button */}
          <button
            onClick={onToggleOpen}
            className="w-6 h-6 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors active:scale-95"
            title="Close Mini-Map [N]"
            aria-label="Close Mini-Map"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* SVG Canvas Map */}
      <div className="relative bg-[#0d2818] overflow-hidden cursor-crosshair">
        <svg
          ref={svgRef}
          width={viewWidth}
          height={viewHeight}
          onClick={handleMapClick}
          className="w-full block"
          style={{ touchAction: 'none' }}
        >
          {/* Subtle tactical grid background */}
          <defs>
            <pattern id="miniMapGrid" width="24" height="24" patternUnits="userSpaceOnUse">
              <path
                d="M 24 0 L 0 0 0 24"
                fill="none"
                stroke="#1b4d24"
                strokeWidth="0.5"
                opacity="0.4"
              />
            </pattern>
          </defs>
          <rect width={viewWidth} height={viewHeight} fill="url(#miniMapGrid)" />

          {/* 1. Fairways */}
          {hole.fairways.map((fw, idx) => {
            const center = worldToMapCoordinates(fw, bounds, viewWidth, viewHeight, padding);
            const radiusX = fw.rx * pixelsPerMeter * (bounds.width / bounds.length || 1);
            const radiusY = fw.rz * pixelsPerMeter;
            return (
              <g key={`fw-${idx}`}>
                {/* Fairway border */}
                <ellipse
                  cx={center.mapX}
                  cy={center.mapY}
                  rx={radiusX}
                  ry={radiusY}
                  fill="#15803d"
                  stroke="#22c55e"
                  strokeWidth="1.2"
                  opacity="0.85"
                />
              </g>
            );
          })}

          {/* 2. Greens */}
          {hole.greens.map((gr, idx) => {
            const center = worldToMapCoordinates(gr, bounds, viewWidth, viewHeight, padding);
            const radius = Math.max(7, gr.radius * pixelsPerMeter);
            return (
              <g key={`gr-${idx}`}>
                {/* Green outer turf */}
                <circle
                  cx={center.mapX}
                  cy={center.mapY}
                  r={radius}
                  fill="#22c55e"
                  stroke="#4ade80"
                  strokeWidth="1.5"
                  opacity="0.95"
                />
                {/* Green apron ring */}
                <circle
                  cx={center.mapX}
                  cy={center.mapY}
                  r={radius * 0.55}
                  fill="#4ade80"
                  opacity="0.25"
                />
              </g>
            );
          })}

          {/* 3. Water Hazards */}
          {hole.waters.map((wt, idx) => {
            const center = worldToMapCoordinates(wt, bounds, viewWidth, viewHeight, padding);
            const radiusX = wt.rx * pixelsPerMeter * (bounds.width / bounds.length || 1);
            const radiusY = wt.rz * pixelsPerMeter;
            return (
              <g key={`wt-${idx}`}>
                {/* Water Shoreline Foam Rim */}
                <ellipse
                  cx={center.mapX}
                  cy={center.mapY}
                  rx={radiusX + 1.5}
                  ry={radiusY + 1.5}
                  fill="none"
                  stroke="#e0f2fe"
                  strokeWidth="1.5"
                  strokeDasharray="3 2"
                  opacity="0.75"
                />
                {/* Water Basin */}
                <ellipse
                  cx={center.mapX}
                  cy={center.mapY}
                  rx={radiusX}
                  ry={radiusY}
                  fill="#0284c7"
                  stroke="#38bdf8"
                  strokeWidth="1"
                  opacity="0.92"
                />
              </g>
            );
          })}

          {/* 4. Sand Bunkers */}
          {hole.bunkers.map((bk, idx) => {
            const center = worldToMapCoordinates(bk, bounds, viewWidth, viewHeight, padding);
            const radiusX = Math.max(4, bk.rx * pixelsPerMeter * (bounds.width / bounds.length || 1));
            const radiusY = Math.max(4, bk.rz * pixelsPerMeter);
            return (
              <ellipse
                key={`bk-${idx}`}
                cx={center.mapX}
                cy={center.mapY}
                rx={radiusX}
                ry={radiusY}
                fill="#f59e0b"
                stroke="#b45309"
                strokeWidth="1"
                opacity="0.95"
              />
            );
          })}

          {/* 5. Trees */}
          {hole.trees.map((tr, idx) => {
            const tCoords = worldToMapCoordinates(tr, bounds, viewWidth, viewHeight, padding);
            const treeColor = tr.type === 'sakura' ? '#f472b6' : tr.type === 'palm' ? '#eab308' : '#166534';
            return (
              <circle
                key={`tr-${idx}`}
                cx={tCoords.mapX}
                cy={tCoords.mapY}
                r={2}
                fill={treeColor}
                opacity="0.75"
              />
            );
          })}

          {/* 6. Yardage Concentric Rings from Pin */}
          {[50, 100, 150].map((dist) => {
            const rPx = dist * pixelsPerMeter;
            if (rPx > viewHeight * 0.95) return null;
            const ringColor = dist === 50 ? '#ffffff' : dist === 100 ? '#ef4444' : '#3b82f6';
            return (
              <g key={`ring-${dist}`}>
                <circle
                  cx={pinCoords.mapX}
                  cy={pinCoords.mapY}
                  r={rPx}
                  fill="none"
                  stroke={ringColor}
                  strokeWidth="0.8"
                  strokeDasharray="2 3"
                  opacity="0.38"
                />
                {isTacticalSize && (
                  <text
                    x={pinCoords.mapX + rPx + 2}
                    y={pinCoords.mapY + 3}
                    fill={ringColor}
                    fontSize="8"
                    fontFamily="monospace"
                    opacity="0.65"
                  >
                    {dist}m
                  </text>
                )}
              </g>
            );
          })}

          {/* 7. Tee Box Marker */}
          <rect
            x={teeCoords.mapX - 4}
            y={teeCoords.mapY - 2.5}
            width="8"
            height="5"
            rx="1.5"
            fill="#3b82f6"
            stroke="#93c5fd"
            strokeWidth="0.8"
          />

          {/* 8. Pin & Flag Icon */}
          <circle
            cx={pinCoords.mapX}
            cy={pinCoords.mapY}
            r={3.5}
            fill="#facc15"
            stroke="#ca8a04"
            strokeWidth="1"
          />
          <path
            d={`M ${pinCoords.mapX} ${pinCoords.mapY} L ${pinCoords.mapX} ${pinCoords.mapY - 9} L ${pinCoords.mapX + 6} ${pinCoords.mapY - 6.5} L ${pinCoords.mapX} ${pinCoords.mapY - 4}`}
            fill="#ef4444"
            stroke="#b91c1c"
            strokeWidth="0.8"
          />

          {/* 9. Aim Trajectory Line & Projected Target Marker */}
          <line
            x1={ballCoords.mapX}
            y1={ballCoords.mapY}
            x2={targetCoords.mapX}
            y2={targetCoords.mapY}
            stroke="#22d3ee"
            strokeWidth="1.5"
            strokeDasharray="3 2"
          />
          {/* Target crosshair / landing circle */}
          <circle
            cx={targetCoords.mapX}
            cy={targetCoords.mapY}
            r={3.5}
            fill="none"
            stroke="#22d3ee"
            strokeWidth="1.2"
          />
          <circle
            cx={targetCoords.mapX}
            cy={targetCoords.mapY}
            r={1}
            fill="#22d3ee"
          />

          {/* 10. Player's Ball with Radar Ping Ring */}
          <circle
            cx={ballCoords.mapX}
            cy={ballCoords.mapY}
            r={6}
            fill="#ffffff"
            opacity="0.25"
            className="animate-ping"
          />
          <circle
            cx={ballCoords.mapX}
            cy={ballCoords.mapY}
            r={3.8}
            fill="#ffffff"
            stroke="#0f172a"
            strokeWidth="1.2"
          />
          <circle
            cx={ballCoords.mapX}
            cy={ballCoords.mapY}
            r={1.4}
            fill="#10b981"
          />

          {/* 11. Tap-to-Aim Ripple Feedback */}
          {tapRipple && (
            <circle
              cx={tapRipple.x}
              cy={tapRipple.y}
              r={10}
              fill="none"
              stroke="#22d3ee"
              strokeWidth="2"
              className="animate-ping"
            />
          )}
        </svg>

        {/* Tactical Wind Indicator Overlay */}
        <div className="absolute top-1.5 right-1.5 bg-slate-950/80 border border-slate-800 rounded-lg px-1.5 py-0.5 flex items-center gap-1 text-[9px] pointer-events-none">
          <span
            className="text-cyan-400 font-bold inline-block"
            style={{ transform: `rotate(${windAngleDeg}deg)` }}
          >
            ↑
          </span>
          <span className="font-mono text-cyan-300 font-bold">
            {wind.speed}
          </span>
        </div>

        {/* Tap to Aim hint badge */}
        <div className="absolute bottom-1 inset-x-0 text-center pointer-events-none">
          <span className="text-[8px] font-bold text-emerald-300/80 bg-slate-950/80 px-2 py-0.5 rounded-full border border-emerald-500/30">
            Tap to Aim
          </span>
        </div>
      </div>

      {/* Mini-Map Footer: Lie & Target Distance Info */}
      <div className="px-2 py-1 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-[10px]">
        <span className="text-slate-400 uppercase font-semibold">
          Lie: <span className="text-slate-200 font-bold capitalize">{ballLie}</span>
        </span>
        <span className="text-cyan-300 font-mono font-bold">
          Aim: {targetPoint.estimatedDistanceMeters}m
        </span>
      </div>
    </div>
  );
};
