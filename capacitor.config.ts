import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.footgolfpro.game',
  appName: 'FootGolf Pro',
  webDir: 'dist',
  android: {
    // Keep WebView content behind system bars handled by CSS safe-area insets
    backgroundColor: '#0f2b1d',
  },
  plugins: {
    StatusBar: {
      overlaysWebView: true,
      style: 'DARK',
    },
  },
};

export default config;
