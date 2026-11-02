/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { isNativeApp } from './native';

/** Keys the game persists. Native builds mirror them into Capacitor Preferences. */
export const PERSISTED_KEYS = ['footgolf_profile', 'footgolf_daily_missions', 'footgolf_settings'] as const;
export type PersistedKey = (typeof PERSISTED_KEYS)[number];

function safeLocalGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeLocalSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage blocked or full; native mirror (if any) still holds the value
  }
}

/** Synchronous read used during React state initialization. */
export function loadValue(key: PersistedKey): string | null {
  return safeLocalGet(key);
}

/**
 * Writes to localStorage immediately and, in the Android app, to native Preferences.
 * Android can clear WebView storage under pressure; Preferences survive that.
 */
export function saveValue(key: PersistedKey, value: string): void {
  safeLocalSet(key, value);
  if (isNativeApp()) {
    import('@capacitor/preferences')
      .then(({ Preferences }) => Preferences.set({ key, value }))
      .catch(() => {});
  }
}

/**
 * Restores values from native Preferences into localStorage before the app renders,
 * so synchronous reads see data that survived a WebView storage wipe.
 */
export async function hydrateNativeStorage(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    const { Preferences } = await import('@capacitor/preferences');
    await Promise.all(
      PERSISTED_KEYS.map(async (key) => {
        const { value } = await Preferences.get({ key });
        if (value !== null && safeLocalGet(key) === null) safeLocalSet(key, value);
      })
    );
  } catch {
    // Fall back to whatever localStorage holds
  }
}
