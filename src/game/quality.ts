/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Rendering quality tiers and an adaptive frame-time monitor.
 * Kept free of Three.js and DOM so the decision logic can be unit tested.
 */

export type QualityTier = 'low' | 'medium' | 'high';
export type QualityPreference = QualityTier | 'auto';

export interface QualitySettings {
  tier: QualityTier;
  /** Upper bound for renderer pixel ratio before dynamic scaling. */
  maxPixelRatio: number;
  shadows: boolean;
  shadowMapSize: number;
  softShadows: boolean;
  postProcessing: boolean;
  /** Target frame time in milliseconds. */
  frameBudgetMs: number;
}

export const QUALITY_PRESETS: Record<QualityTier, QualitySettings> = {
  low: {
    tier: 'low',
    maxPixelRatio: 1,
    shadows: false,
    shadowMapSize: 512,
    softShadows: false,
    postProcessing: false,
    frameBudgetMs: 1000 / 30,
  },
  medium: {
    tier: 'medium',
    maxPixelRatio: 1.5,
    shadows: true,
    shadowMapSize: 1024,
    softShadows: false,
    postProcessing: false,
    frameBudgetMs: 1000 / 60,
  },
  high: {
    tier: 'high',
    maxPixelRatio: 2,
    shadows: true,
    shadowMapSize: 2048,
    softShadows: true,
    postProcessing: true,
    frameBudgetMs: 1000 / 60,
  },
};

const TIER_ORDER: QualityTier[] = ['low', 'medium', 'high'];

export function lowerTier(tier: QualityTier): QualityTier {
  const i = TIER_ORDER.indexOf(tier);
  return TIER_ORDER[Math.max(0, i - 1)];
}

/** Picks the starting tier. Auto starts on medium unless the GPU is a software rasterizer. */
export function resolveInitialTier(pref: QualityPreference, isSoftwareGl: boolean): QualityTier {
  if (isSoftwareGl) return 'low';
  return pref === 'auto' ? 'medium' : pref;
}

export function computePixelRatio(settings: QualitySettings, devicePixelRatio: number, dynamicScale: number): number {
  const base = Math.min(devicePixelRatio || 1, settings.maxPixelRatio);
  return Math.max(0.5, base * dynamicScale);
}

export interface MonitorDecision {
  /** New dynamic resolution scale (0.6-1.0) to apply, if it changed. */
  scale?: number;
  /** A lower tier to switch to, when scaling alone can't meet the budget. */
  downgradeTo?: QualityTier;
}

/**
 * Collects frame times in fixed windows and adjusts resolution scale first, then the
 * quality tier, when frames consistently miss the budget. Only steps the tier down,
 * never up, to avoid oscillating between tiers.
 */
export class FrameTimeMonitor {
  static readonly WINDOW_MS = 2000;
  static readonly MIN_SCALE = 0.6;

  private windowElapsed = 0;
  private windowFrames = 0;
  private slowWindows = 0;
  private fastWindows = 0;
  public scale = 1;

  constructor(public settings: QualitySettings, private readonly adaptive: boolean) {}

  setSettings(settings: QualitySettings) {
    this.settings = settings;
    this.scale = 1;
    this.reset();
  }

  reset() {
    this.windowElapsed = 0;
    this.windowFrames = 0;
    this.slowWindows = 0;
    this.fastWindows = 0;
  }

  /** Feed one frame's duration in milliseconds. Returns a decision at the end of each window. */
  sample(frameMs: number): MonitorDecision | null {
    if (!this.adaptive) return null;
    // Ignore huge gaps (tab switches, breakpoints)
    if (frameMs > 250) return null;
    this.windowElapsed += frameMs;
    this.windowFrames++;
    if (this.windowElapsed < FrameTimeMonitor.WINDOW_MS) return null;

    const avg = this.windowElapsed / this.windowFrames;
    this.windowElapsed = 0;
    this.windowFrames = 0;
    const budget = this.settings.frameBudgetMs;

    if (avg > budget * 1.15) {
      this.fastWindows = 0;
      this.slowWindows++;
      if (this.scale > FrameTimeMonitor.MIN_SCALE + 1e-6) {
        this.scale = Math.max(FrameTimeMonitor.MIN_SCALE, +(this.scale - 0.1).toFixed(2));
        return { scale: this.scale };
      }
      if (this.slowWindows >= 2 && this.settings.tier !== 'low') {
        return { downgradeTo: lowerTier(this.settings.tier) };
      }
      return null;
    }

    this.slowWindows = 0;
    if (avg < budget * 0.75 && this.scale < 1) {
      this.fastWindows++;
      if (this.fastWindows >= 3) {
        this.fastWindows = 0;
        this.scale = Math.min(1, +(this.scale + 0.1).toFixed(2));
        return { scale: this.scale };
      }
    }
    return null;
  }
}
