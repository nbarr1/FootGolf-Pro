/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { QualityPreference } from './quality';

export interface GameSettings {
  quality: QualityPreference;
  /** Turns off camera shake, hit-stop, and slow-motion effects. */
  reducedMotion: boolean;
  haptics: boolean;
}

export const DEFAULT_SETTINGS: GameSettings = {
  quality: 'auto',
  reducedMotion: false,
  haptics: true,
};

export const SETTINGS_STORAGE_KEY = 'footgolf_settings';

const QUALITY_VALUES: QualityPreference[] = ['auto', 'low', 'medium', 'high'];

/** Parses stored settings, ignoring unknown or malformed values. */
export function parseSettings(raw: string | null | undefined): GameSettings {
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    const parsed = JSON.parse(raw) as Partial<GameSettings>;
    return {
      quality: QUALITY_VALUES.includes(parsed.quality as QualityPreference)
        ? (parsed.quality as QualityPreference)
        : DEFAULT_SETTINGS.quality,
      reducedMotion: typeof parsed.reducedMotion === 'boolean' ? parsed.reducedMotion : DEFAULT_SETTINGS.reducedMotion,
      haptics: typeof parsed.haptics === 'boolean' ? parsed.haptics : DEFAULT_SETTINGS.haptics,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** Module-level copy so non-React code (haptics, renderer effects) can read the live settings. */
let activeSettings: GameSettings = { ...DEFAULT_SETTINGS };

export function getActiveSettings(): GameSettings {
  return activeSettings;
}

export function setActiveSettings(settings: GameSettings): void {
  activeSettings = settings;
}
