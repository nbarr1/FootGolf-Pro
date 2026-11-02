/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { isNativeApp } from './native';

export interface LifecycleHandlers {
  /** The app moved to the background (screen off, app switch). */
  onBackground: () => void;
  /** The app returned to the foreground. */
  onForeground: () => void;
  /** Android hardware or gesture back. Return true when handled; false lets the app exit. */
  onBack?: () => boolean;
}

/**
 * Subscribes to page visibility (works in browsers and the Android WebView) and,
 * in the native app, to the hardware back button. Returns an unsubscribe function.
 */
export function subscribeLifecycle(handlers: LifecycleHandlers): () => void {
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') handlers.onBackground();
    else handlers.onForeground();
  };
  document.addEventListener('visibilitychange', onVisibility);

  let removeNative: (() => void) | null = null;
  let disposed = false;
  if (isNativeApp()) {
    import('@capacitor/app')
      .then(async ({ App }) => {
        const backHandle = await App.addListener('backButton', () => {
          const handled = handlers.onBack?.() ?? false;
          if (!handled) App.exitApp();
        });
        if (disposed) backHandle.remove();
        else removeNative = () => backHandle.remove();
      })
      .catch(() => {});
  }

  return () => {
    disposed = true;
    document.removeEventListener('visibilitychange', onVisibility);
    removeNative?.();
  };
}

/** Configures the Android status bar to overlay the game with light icons. */
export async function configureSystemUi(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setOverlaysWebView({ overlay: true });
    await StatusBar.setStyle({ style: Style.Dark });
  } catch {
    // Status bar plugin unavailable
  }
}
