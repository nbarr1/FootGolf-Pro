# Building the Android app

FootGolf Pro ships on Android as a [Capacitor](https://capacitorjs.com/) app. The game itself is the Vite web build in `dist/`, which Capacitor copies into the native project under `android/`.

## Requirements

- [Bun](https://bun.sh/) (or Node.js with npm)
- JDK 21
- The Android SDK with platform 36 and build tools 36. Android Studio installs these, or use the command-line tools and set `ANDROID_HOME`.

## Build a debug APK

1. Install dependencies.

   ```bash
   bun install
   ```

2. Build the web game, copy it into the Android project, and compile the APK.

   ```bash
   bun run android:debug
   ```

   The APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`.

3. Install it on a connected device with USB debugging turned on.

   ```bash
   adb install -r android/app/build/outputs/apk/debug/app-debug.apk
   ```

To work in Android Studio instead, run `bun run android:sync` and then `bun run android:open`.

## Profile on a device

- Open `chrome://inspect` in desktop Chrome while the app runs on a USB-connected device. Select the FootGolf Pro WebView to use the Performance panel and see JavaScript frame times.
- Use the Android Studio Profiler for CPU, memory, and GPU rendering.
- The pause menu shows which graphics tier the automatic quality system picked. Set it to **Auto** to let the game lower resolution, then quality, when frames miss their budget.

## Platform behavior

| Feature | Implementation |
| --- | --- |
| Orientation | Locked to portrait in `AndroidManifest.xml`. |
| Target API level | 36 (Android 16), set in `android/variables.gradle`. |
| Haptics | `@capacitor/haptics` in the app, with `navigator.vibrate` as the browser fallback (`src/game/haptics.ts`). |
| Saved progress | Written to `localStorage` and mirrored to `@capacitor/preferences`, then restored on launch (`src/platform/storage.ts`). |
| Background | Rendering and audio pause when the app is hidden, and gameplay opens the pause menu (`src/platform/lifecycle.ts`). |
| Back button | Closes the open dialog, toggles pause during play, and exits from the title screen. |
| Display cutouts | Overlay layers use the `safe-inset` CSS class, built on `env(safe-area-inset-*)`. |

## Release builds

A Play Store release needs a signed Android App Bundle (`.aab`). Create an upload key, configure signing in `android/app/build.gradle`, and run `./gradlew bundleRelease` in `android/`. Keep the keystore and its passwords out of the repository.
