/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * True when running inside the Capacitor Android (or iOS) shell. Reads the bridge object
 * that the native runtime injects, so this module stays safe to import in Node tests.
 */
export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return !!cap?.isNativePlatform?.();
}
