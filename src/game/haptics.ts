/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type HapticIntensity = 'light' | 'medium' | 'heavy' | 'pure';

/**
 * Maps haptic feedback patterns to navigator.vibrate.
 * Provides longer, weighted rhythmic pulses for 'pure' sweet-spot strikes.
 */
export function triggerHaptic(intensity: HapticIntensity = 'light'): void {
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
