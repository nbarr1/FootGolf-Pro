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

## Build the APK on GitHub

The **Build APK** workflow (`.github/workflows/build-apk.yml`) builds the app on GitHub's servers.

| Trigger | What it builds |
| --- | --- |
| Pull request | Debug APK |
| Push to `main` | Debug APK, plus a signed release APK and AAB when signing secrets are set |
| Push a tag such as `v1.2.0` | The same as `main`, attached to a GitHub release for that tag |
| **Run workflow** button (Actions tab) | Debug APK, plus release builds when the **release** box is checked and signing secrets are set |

To download a build, open the run on the **Actions** tab and select the `footgolf-pro-debug-apk` or `footgolf-pro-release` artifact under **Artifacts**. Each build's version code is the workflow run number. Tag builds use the tag as the version name, and other builds use `0.1.<run number>`.

### Set up release signing

Release builds need an upload key. Google Play uses it to verify that updates come from you, so keep a backup of the keystore and its passwords outside the repository.

1. Create a keystore. You can replace `upload` with another alias.

   ```bash
   keytool -genkeypair -v -keystore upload-keystore.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
   ```

2. Encode the keystore as Base64.

   ```bash
   base64 -w 0 upload-keystore.jks > upload-keystore.b64
   ```

3. In the GitHub repository, go to **Settings** > **Secrets and variables** > **Actions**, and add these repository secrets:

   | Secret | Value |
   | --- | --- |
   | `ANDROID_KEYSTORE_BASE64` | The contents of `upload-keystore.b64` |
   | `ANDROID_KEYSTORE_PASSWORD` | The keystore password |
   | `ANDROID_KEY_ALIAS` | The key alias, such as `upload` |
   | `ANDROID_KEY_PASSWORD` | The key password |

4. Delete `upload-keystore.b64`, and store `upload-keystore.jks` somewhere safe.

Without these secrets, the workflow builds only the debug APK and adds a notice to the run summary. Pull requests never receive the signing secrets.

## Release builds

To build a signed release locally, set the same values as environment variables, then run Gradle in `android/`. `ANDROID_KEYSTORE_PATH` is the path to the `.jks` file.

```bash
ANDROID_KEYSTORE_PATH=/path/to/upload-keystore.jks ANDROID_KEYSTORE_PASSWORD=... ANDROID_KEY_ALIAS=upload ANDROID_KEY_PASSWORD=... ./gradlew bundleRelease
```

Upload the resulting `.aab` file to Google Play. Keep the keystore and its passwords out of the repository.
