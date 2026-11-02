import React, { useRef, useState, useCallback } from 'react';
import { FlickGestureData, KickType, SpinControl, SurfaceType } from '../types';
import { calculateFlickShot, getEstimatedKickDistance } from '../game/physics';

interface FlickShotOverlayProps {
  kickType: KickType;
  englishSpin: SpinControl;
  aimAngleRad?: number;
  currentLie?: SurfaceType;
  disabled: boolean;
  isPracticeMode?: boolean;
  onFlickShot: (gesture: FlickGestureData) => void;
  onAimNudge: (deltaRad: number) => void;
  onSwipePowerChange?: (power: number, speedKmh: number, isSwiping: boolean) => void;
  onPracticeSwing?: (result: {
    power: number;
    speedKmh: number;
    slicePercent: number;
    carryMeters: number;
    totalMeters: number;
    strikeRating: 'pure' | 'great' | 'solid' | 'push' | 'pull' | 'standard';
  }) => void;
}

interface TouchPoint {
  x: number;
  y: number;
  time: number;
}

export const FlickShotOverlay: React.FC<FlickShotOverlayProps> = ({
  kickType,
  englishSpin,
  aimAngleRad = 0,
  currentLie = 'fairway',
  disabled,
  isPracticeMode = false,
  onFlickShot,
  onAimNudge,
  onSwipePowerChange,
  onPracticeSwing,
}) => {
  const [isFlicking, setIsFlicking] = useState(false);
  const [startPoint, setStartPoint] = useState<TouchPoint | null>(null);
  const [currentPoint, setCurrentPoint] = useState<TouchPoint | null>(null);
  const [gesturePath, setGesturePath] = useState<TouchPoint[]>([]);

  const [flickTelemetry, setFlickTelemetry] = useState<{
    speedKmh: number;
    powerPercent: number;
    slicePercent: number;
    combinedSlicePercent: number;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  const pointsHistory = useRef<TouchPoint[]>([]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    const pt: TouchPoint = {
      x: e.clientX,
      y: e.clientY,
      time: performance.now(),
    };
    setStartPoint(pt);
    setCurrentPoint(pt);
    setGesturePath([pt]);
    pointsHistory.current = [pt];
    setIsFlicking(true);
    setFlickTelemetry(null);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isFlicking || !startPoint || disabled) return;
    const now = performance.now();
    const pt: TouchPoint = {
      x: e.clientX,
      y: e.clientY,
      time: now,
    };
    setCurrentPoint(pt);

    // Append to gesture path (limit to last 18 points for clean visual trail)
    setGesturePath((prev) => {
      const next = [...prev, pt];
      return next.length > 18 ? next.slice(next.length - 18) : next;
    });

    // High-polling touch unpacking (W3C getCoalescedEvents equivalent of Android AMotionEvent historical batch)
    const nativeEvt = e.nativeEvent as PointerEvent;
    const subEvents =
      typeof nativeEvt.getCoalescedEvents === 'function' ? nativeEvt.getCoalescedEvents() : [nativeEvt];

    for (const sub of subEvents) {
      pointsHistory.current.push({
        x: sub.clientX,
        y: sub.clientY,
        time: sub.timeStamp || now,
      });
    }

    if (pointsHistory.current.length > 24) {
      pointsHistory.current = pointsHistory.current.slice(pointsHistory.current.length - 24);
    }

    const firstPt = pointsHistory.current[0] || startPoint;
    const dt = Math.max(20, now - firstPt.time);
    const dx = pt.x - startPoint.x;
    const dy = startPoint.y - pt.y; // upward is positive
    const dist = Math.hypot(pt.x - firstPt.x, firstPt.y - pt.y);
    const pxPerMs = dist / dt;

    const normalizedPower = Math.max(0.15, Math.min(1.0, Math.pow(pxPerMs / 2.1, 0.92)));
    const maxKmh = kickType === 'drive' ? 122 : kickType === 'chip' ? 78 : 46;
    const speedKmh = Math.round(normalizedPower * maxKmh);
    const slicePercent = Math.round(Math.max(-100, Math.min(100, (dx / Math.max(40, dy)) * 100)));
    const combinedSlicePercent = Math.round(
      Math.max(-100, Math.min(100, slicePercent + englishSpin.side * 65))
    );

    onSwipePowerChange?.(normalizedPower, speedKmh, true);

    setFlickTelemetry({
      speedKmh,
      powerPercent: Math.round(normalizedPower * 100),
      slicePercent,
      combinedSlicePercent,
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isFlicking || !startPoint || disabled) {
      setIsFlicking(false);
      setStartPoint(null);
      setCurrentPoint(null);
      setGesturePath([]);
      setFlickTelemetry(null);
      onSwipePowerChange?.(0, 0, false);
      return;
    }

    const now = performance.now();
    const endPt: TouchPoint = {
      x: e.clientX,
      y: e.clientY,
      time: now,
    };

    const dx = endPt.x - startPoint.x;
    const dy = startPoint.y - endPt.y; // upward is positive
    const totalDist = Math.hypot(dx, dy);
    const dt = Math.max(30, now - startPoint.time);

    // If upward swipe with sufficient velocity and distance, process shot!
    if (dy > 20 && totalDist > 26 && dt < 800) {
      const gestureData: FlickGestureData = {
        startX: startPoint.x,
        startY: startPoint.y,
        endX: endPt.x,
        endY: endPt.y,
        durationMs: dt,
      };

      const flick = calculateFlickShot(
        gestureData,
        aimAngleRad,
        englishSpin,
        kickType,
        currentLie
      );

      const est = getEstimatedKickDistance(kickType, flick.power, currentLie);

      onSwipePowerChange?.(flick.power, flick.speedKmh, false);

      if (isPracticeMode) {
        onPracticeSwing?.({
          power: flick.power,
          speedKmh: flick.speedKmh,
          slicePercent: Math.round(flick.flickSlice * 100),
          carryMeters: est.carryMeters,
          totalMeters: est.totalMeters,
          strikeRating: flick.strikeRating || 'standard',
        });
      } else {
        try {
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate([18, 28]);
          }
        } catch {
          // Haptic fallback
        }

        onFlickShot(gestureData);
      }
    } else {
      onSwipePowerChange?.(0, 0, false);
      if (Math.abs(dx) > 25 && Math.abs(dy) < 35) {
        // Horizontal swipe to fine-tune aim angle
        onAimNudge((dx / 200) * 0.15);
      }
    }

    setIsFlicking(false);
    setStartPoint(null);
    setCurrentPoint(null);
    setGesturePath([]);
    setTimeout(() => setFlickTelemetry(null), 800);
  };

  // Build SVG path data for smooth curved flick gesture
  const svgPathD = React.useMemo(() => {
    if (gesturePath.length < 2) return '';
    let d = `M ${gesturePath[0].x} ${gesturePath[0].y}`;
    for (let i = 1; i < gesturePath.length; i++) {
      const p0 = gesturePath[i - 1];
      const p1 = gesturePath[i];
      const mx = (p0.x + p1.x) / 2;
      const my = (p0.y + p1.y) / 2;
      d += ` Q ${p0.x} ${p0.y}, ${mx} ${my}`;
    }
    const last = gesturePath[gesturePath.length - 1];
    d += ` L ${last.x} ${last.y}`;
    return d;
  }, [gesturePath]);

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={`fixed inset-0 z-20 touch-none select-none ${
        disabled ? 'pointer-events-none' : 'pointer-events-auto cursor-grab active:cursor-grabbing'
      }`}
    >
      {/* Visual Flick Trajectory Arc on Screen */}
      {isFlicking && startPoint && currentPoint && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-30">
          <defs>
            <linearGradient id="flickGrad" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
              <stop offset="50%" stopColor="#34d399" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#fbbf24" stopOpacity="1.0" />
            </linearGradient>
            <filter id="flickGlow">
              <feGaussianBlur stdDeviation="4.0" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Smooth Curved Gesture Trail */}
          {svgPathD && (
            <path
              d={svgPathD}
              fill="none"
              stroke="url(#flickGrad)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#flickGlow)"
            />
          )}

          {/* Start Anchor */}
          <circle
            cx={startPoint.x}
            cy={startPoint.y}
            r="16"
            fill="none"
            stroke="#10b981"
            strokeWidth="3"
            strokeDasharray="5,4"
            className="animate-spin"
          />
          <circle cx={startPoint.x} cy={startPoint.y} r="6" fill="#34d399" />

          {/* Arrowhead / Release Tip */}
          <circle
            cx={currentPoint.x}
            cy={currentPoint.y}
            r="10"
            fill="#fbbf24"
            stroke="#ffffff"
            strokeWidth="2.5"
            filter="url(#flickGlow)"
          />
        </svg>
      )}

      {/* Floating Flick Telemetry HUD */}
      {flickTelemetry && currentPoint && (
        <div
          className="absolute z-40 pointer-events-none transform -translate-x-1/2 -translate-y-full mb-5 bg-slate-950/95 border border-emerald-500/70 px-4 py-2 rounded-2xl shadow-2xl backdrop-blur-none text-center"
          style={{
            left: `${currentPoint.x}px`,
            top: `${currentPoint.y - 15}px`,
          }}
        >
          <div className="flex items-center gap-2 text-xs font-black">
            {isPracticeMode && (
              <span className="text-amber-400 bg-amber-950/90 px-1 py-0.5 rounded border border-amber-500/60 text-[10px]">
                🎯 PRACTICE
              </span>
            )}
            <span className="text-emerald-400">⚡ {flickTelemetry.speedKmh} km/h</span>
            <span className="text-slate-600">|</span>
            <span
              className={
                flickTelemetry.powerPercent > 90
                  ? 'text-rose-400'
                  : flickTelemetry.powerPercent > 75
                  ? 'text-amber-400'
                  : 'text-emerald-300'
              }
            >
              PWR {flickTelemetry.powerPercent}%
            </span>
            {(Math.abs(flickTelemetry.combinedSlicePercent) > 6 || Math.abs(englishSpin.top) > 0.05) && (
              <>
                <span className="text-slate-600">|</span>
                <span
                  className={
                    flickTelemetry.combinedSlicePercent > 0 ? 'text-amber-400' : 'text-blue-400'
                  }
                >
                  {flickTelemetry.combinedSlicePercent > 0
                    ? `Slice ↷ +${flickTelemetry.combinedSlicePercent}%`
                    : `↶ Hook ${flickTelemetry.combinedSlicePercent}%`}
                </span>
                {englishSpin.top > 0.05 && (
                  <span className="text-emerald-400 ml-1">▲ Top</span>
                )}
                {englishSpin.top < -0.05 && (
                  <span className="text-purple-400 ml-1">▼ Back</span>
                )}
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
