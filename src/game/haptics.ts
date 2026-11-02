/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { isNativeApp } from '../platform/native';
import { getActiveSettings } from './settings';

export type HapticIntensity = 'light' | 'medium' | 'heavy' | 'pure';

type HapticsModule = typeof import('@capacitor/haptics');
let nativeHaptics: Promise<HapticsModule> | null = null;

function loadNativeHaptics(): Promise<HapticsModule> {
  if (!nativeHaptics) nativeHaptics = import('@capacitor/haptics');
  return nativeHaptics;
}

/**
 * Native haptics through Capacitor. Android maps impact styles to the device's tuned
 * haptic effects, which feel crisper than fixed-duration vibration.
 */
async function playNative(intensity: HapticIntensity): Promise<void> {
  const { Haptics, ImpactStyle } = await loadNativeHaptics();
  switch (intensity) {
    case 'light':
      await Haptics.impact({ style: ImpactStyle.Light });
      break;
    case 'medium':
      await Haptics.impact({ style: ImpactStyle.Medium });
      break;
    case 'heavy':
      await Haptics.impact({ style: ImpactStyle.Heavy });
      break;
    case 'pure': {
      // Escalating sequence for sweet-spot strikes
      const steps = [ImpactStyle.Light, ImpactStyle.Medium, ImpactStyle.Heavy];
      for (let i = 0; i < steps.length; i++) {
        await Haptics.impact({ style: steps[i] });
        await new Promise((r) => setTimeout(r, 70));
      }
      break;
    }
  }
}

/** A very short tick, used as the timing needle crosses rating bands. */
export function triggerSelectionTick(): void {
  if (!getActiveSettings().haptics) return;
  if (isNativeApp()) {
    loadNativeHaptics()
      // Android ignores selectionChanged unless a selection gesture has started
      .then(async ({ Haptics }) => {
        await Haptics.selectionStart();
        await Haptics.selectionChanged();
      })
      .catch(() => {});
    return;
  }
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      navigator.vibrate(6);
    } catch {
      // Ignore unsupported vibration
    }
  }
}

/**
 * Maps haptic feedback patterns to navigator.vibrate.
 * Provides longer, weighted rhythmic pulses for 'pure' sweet-spot strikes.
 */
export function triggerHaptic(intensity: HapticIntensity = 'light'): void {
  if (!getActiveSettings().haptics) return;
  if (isNativeApp()) {
    playNative(intensity).catch(() => {});
    return;
  }
  if (typeof navigator === 'undefined' || !navigator.vibrate) {
    return;
  }

  try {
    switch (intensity) {
      case 'light':
        // Crisp single pulse for button taps, practice swings, and fine adjustments
        navigator.vibrate(18);
        break;

      case 'medium':
        // Moderate single pulse for standard impacts and ball socket pickup
        navigator.vibrate(32);
        break;

      case 'heavy':
        // Double pulse with tactile punch for solid strikes, bunker hits, and rim lip-outs
        navigator.vibrate([45, 30, 45]);
        break;

      case 'pure':
        // Escalating multi-pulse sequence providing substantial tactile weight for sweet-spot strikes
        navigator.vibrate([30, 35, 60, 40, 100]);
        break;
    }
  } catch {
    // Gracefully ignore vibrate errors (e.g. user gesture permissions or unsupported devices)
  }
}
