# FootGolf Pro: Android modernization plan

This document is the working plan for turning FootGolf Pro into a high-quality Android game. It covers three things:

1. An audit of the repository as it stands, with file references.
2. Research into architecture, tooling, and asset libraries for Android games.
3. A prioritized backlog of gameplay and visual improvements.

Research sources are listed at the end. Where sources disagreed or could not be confirmed against an official page, the text says so.

---

## 1. Repository audit

### 1.1 What the project is

FootGolf Pro is a browser game generated in Google AI Studio. The stack is:

- **UI:** React 19, Tailwind CSS 4, `motion`, and `lucide-react`.
- **3D:** Three.js r186 using `WebGLRenderer`, with all geometry and textures built procedurally in code. There are no model or texture files.
- **Physics:** A custom TypeScript ball simulation in `src/game/physics.ts` and `src/game/deterministicPhysics.ts`. It includes drag, Magnus lift, per-surface friction and restitution, and cup capture.
- **Audio:** Synthesized at runtime with Web Audio oscillators (`src/game/audio.ts`). There are no audio files.
- **Haptics:** `navigator.vibrate` patterns (`src/game/haptics.ts:12`).
- **Persistence:** `localStorage` for the profile and daily missions (`src/App.tsx:88`, `src/App.tsx:183`).
- **Size:** About 15,000 lines of TypeScript. `src/game/renderer3d.ts` (2,820 lines) and `src/App.tsx` (1,932 lines) hold most of the logic.

There is no Android project, no Capacitor or Trusted Web Activity wrapper, and no web app manifest or service worker. Today the game runs only in a browser.

### 1.2 Baseline health (verified November 2, 2026)

| Check | Result |
| --- | --- |
| `bun install` | Succeeds |
| `npm install` | **Fails.** `vite@8.3.5` has an optional peer dependency on `esbuild@^0.27 \|\| ^0.28`, but `package.json` pins `esbuild@^0.25.0`. |
| `bun run test` (44 tests) | All pass |
| `bun run lint` (`tsc --noEmit`) | Clean |
| `bun run build` | Succeeds. Output is one 1.02 MB JS chunk (271 KB gzip), and Vite warns about chunk size. |

### 1.3 Strengths to keep

The following existing work is worth building on:

- **Fixed-timestep physics at 60 Hz with an accumulator cap** (`src/App.tsx:369`). This is the standard pattern for stable game physics.
- **Headless, DOM-free shot simulation** (`src/game/deterministicPhysics.ts`). It makes server-side shot validation and unit testing possible.
- **Unit tests for core game math** covering physics, timing gauge, putting, replay, missions, and trails.
- **Arcade control design.** The plan in `.aistudio/.../implementation_plan.md` describes aim, then pullback, then a timing needle with Perfect, Great, and Good windows, and overpower up to 125%. This shot model is well established in mobile golf games.
- **Software-GL detection** that turns off shadows and antialiasing on emulators (`src/game/renderer3d.ts:166`).
- **Reused scratch vectors and a pooled particle buffer** in the renderer, which reduce garbage collection pauses.

### 1.4 Issues found

The following table lists the issues found, by severity.

| # | Severity | Area | Finding | Location |
| --- | --- | --- | --- | --- |
| A1 | High | Performance | The physics loop calls `setInFlightTelemetry` on every 60 Hz step. Each call re-renders the whole `App` component tree while the ball is in flight. | `src/App.tsx:423` |
| A2 | High | Performance | The game runs two independent `requestAnimationFrame` loops: physics in `App.tsx` and rendering in `renderer3d.ts`. They can drift out of phase, which causes stutter. | `src/App.tsx:782`, `src/game/renderer3d.ts:2674` |
| A3 | High | Performance | Dynamic resolution scaling is a no-op. `setDynamicResolutionScale` stores a value that nothing reads. | `src/game/renderer3d.ts:2346` |
| A4 | High | Performance | Every tree is built from new, unshared geometries and materials, with several meshes per tree. Draw calls scale with tree count. Instancing or merging would remove most of them. | `src/game/renderer3d.ts:1183` |
| A5 | High | Platform | The game has no Android packaging, no lifecycle handling (no `visibilitychange` pause for audio and loops), and no safe-area insets for display cutouts. | Whole app |
| A6 | Medium | Performance | The UI uses 19 `backdrop-blur` layers. Blur behind translucent panels is expensive on mobile GPUs because it composites over a live WebGL canvas. | `src/components/*` |
| A7 | Medium | Performance | The physics effect depends on `[currentHole, wind, updateAimVisuals]`. A change to any of them tears down and restarts the loop and resets the accumulator. | `src/App.tsx:786` |
| A8 | Medium | Architecture | `App.tsx` mixes game rules, the physics loop, missions, tournaments, replay, and UI. That makes features hard to test and change. | `src/App.tsx` |
| A9 | Medium | Correctness | The terrain mesh is a 260 × 420 m plane with 110 × 160 segments, about 5 m per cell. Physics samples the analytic `getTerrainHeight`, but the renderer shows the interpolated mesh, so the ball can float or sink slightly on slopes. | `src/game/renderer3d.ts:1016`, `src/game/physics.ts:48` |
| A10 | Medium | Product | `metadata.json` advertises "online multiplayer tournaments," but opponents are local bots with `Math.random` scores that ignore course conditions. | `src/game/tournament.ts:214` |
| A11 | Medium | Determinism | Bot scoring uses unseeded `Math.random`, so tournaments can't be replayed or validated. | `src/game/tournament.ts:153` |
| A12 | Low | Bundle | `@google/genai`, `express`, and `dotenv` are runtime dependencies, but no file in `src/` imports them. | `package.json` |
| A13 | Low | Repository | About 30 screenshot PNG files sit in the repository root, plus 75 more under `.aistudio/`. The repository is 34 MB. | Repository root |
| A14 | Low | Hygiene | The package name is still `react-example`, version `0.0.0`. | `package.json` |

### 1.5 Visual assessment from the committed screenshots

The screenshots, such as `final_polished_gameplay.png` and `gameplay_shot_landed.png`, show:

- **Washed-out contrast.** `FogExp2` density `0.007` combined with ACES tone mapping at exposure `1.15` makes the mid-ground fade to pale green-white within about 60 m. Fairway, rough, and green are hard to tell apart.
- **No visible shadows**, likely because the screenshots were taken under software GL. Shadow quality on real hardware is unverified.
- **Flat, vertex-colored ground** with no texture detail. The grass texture is a small canvas texture.
- **Primitive trees and props** made from cones, dodecahedrons, and cylinders.
- **A dense HUD.** The classic-mode panel uses about one third of a 720p landscape screen, and the top-right holds 10 icon buttons.

---

## 2. Architecture research and recommendation

### 2.1 Options considered

The following table compares four ways to ship on Android.

| Option | Description | Fit for this repository |
| --- | --- | --- |
| **A. Keep the web stack and wrap it with Capacitor** | Package the existing Vite build into an Android app that runs in the system WebView. Native plugins provide haptics, storage, and game services. | **Highest reuse.** All 15,000 lines and 44 tests carry over. The main risk is WebView performance variance between devices. |
| B. Trusted Web Activity (TWA) or installable PWA | Ship the web app through Chrome rather than a WebView. | Good rendering performance, but native plugin access such as Play Games Services is limited. |
| C. Port to Unity 6 | Rewrite in C# with URP. | The most mature mobile tooling and ecosystem, according to the comparisons consulted. It means a full rewrite and has license terms that depend on revenue. |
| D. Port to Godot 4.x | Rewrite in GDScript or C#. Godot is MIT licensed. | Free and open. Sources disagree on how its mobile 3D quality compares with Unity's. It also means a full rewrite. |

### 2.2 Recommendation

> **Recommendation (judgment call, not a verified benchmark):** Keep TypeScript and Three.js, and package the game with Capacitor (option A). Add a performance gate: if a mid-range test device can't hold a stable 30 fps after the phase 1 fixes, re-evaluate option C.

Reasons:

- The game's hardest-won assets are its shot model, physics, and tests, and they're pure TypeScript. A port to Unity or Godot throws them away.
- The scene is small (one hole, one ball, one character, about 10-40 props). It fits within what WebGL2 handles well on mid-range Android hardware, provided draw calls and fill rate are controlled.
- Developer reports on Capacitor's Android performance are mixed, and WebView behavior varies by device. Treat real-device profiling as a hard requirement, not an afterthought.

### 2.3 Target architecture

The target is a deterministic simulation core with a thin renderer and UI around it.

```
┌──────────────────────────────────────────────────────────────┐
│ React UI layer (menus, HUD)                                  │
│  - Reads game state through a store (Zustand) using          │
│    selectors, throttled to 10-15 Hz for telemetry            │
└──────────────▲───────────────────────────────────────────────┘
               │ events and snapshots
┌──────────────┴───────────────────────────────────────────────┐
│ Game core (pure TS, no DOM, no Three.js)                     │
│  - Shot finite-state machine: aim → pullback → timing →      │
│    flight → rest                                             │
│  - Fixed-step simulation (existing physics.ts)               │
│  - Seeded random number generator (tournaments, wind, bots)  │
│  - Rules: scoring, missions, progression                     │
└──────────────▲───────────────────────────────────────────────┘
               │ interpolated render state
┌──────────────┴───────────────────────────────────────────────┐
│ Single main loop (one requestAnimationFrame)                 │
│  accumulate → step core N times → interpolate → render       │
└──────────────▲───────────────────────────────────────────────┘
               │
┌──────────────┴───────────────────────────────────────────────┐
│ Renderer (Three.js)                                          │
│  - Asset manager (glTF + KTX2 + meshopt)                     │
│  - Quality tiers: low, medium, high                          │
│  - VFX (three.quarks), post-processing (pmndrs)              │
└──────────────▲───────────────────────────────────────────────┘
               │
┌──────────────┴───────────────────────────────────────────────┐
│ Platform adapter (Capacitor)                                 │
│  - Haptics, app lifecycle, status bar, safe area,            │
│    preferences storage, Play Games Services, ads/IAP         │
└──────────────────────────────────────────────────────────────┘
```

### 2.4 Recommended libraries and tools

The following table lists recommended additions, with the reason for each.

| Concern | Recommendation | Why |
| --- | --- | --- |
| Android packaging | **Capacitor** (`@capacitor/core`, `@capacitor/android`) | Reuses the Vite build. It provides an official plugin set and an Android Studio project for profiling and Play Store builds. |
| Haptics | **`@capacitor/haptics`** | Provides `ImpactStyle.Light/Medium/Heavy` and notification feedback through native APIs. It replaces `navigator.vibrate`, which gives coarse, duration-only buzzes. |
| Lifecycle | **`@capacitor/app`** plus `visibilitychange` | Pauses the main loop and suspends `AudioContext` when the app goes to the background. |
| Storage | **`@capacitor/preferences`** | Android can clear WebView `localStorage` under storage pressure. Native preferences persist more reliably. |
| Game services | Play Games Services through a Capacitor plugin | Provides leaderboards, achievements, and cloud saves. The one plugin found, `capacitor-game-connect`, lists support only up to Capacitor 5 and was last updated in July 2024. Plan on writing a small custom plugin against Play Games Services v2. |
| State | **Zustand** | Lets the game loop write state without re-rendering React, and lets the HUD subscribe through selectors. This fixes issue A1. |
| Physics | Keep the custom ball physics. Consider **Rapier** (`@dimforge/rapier3d`) only if you add rigid-body props such as tree trunks, pins, or moving obstacles. | The existing model is specialized for ball flight. Rapier's documentation states that its WASM build is cross-platform deterministic, which suits replays and anti-cheat if it's adopted. |
| 3D assets | **glTF 2.0 (`.glb`)** processed with **glTF-Transform**, using **meshopt** geometry compression and **KTX2/Basis Universal** textures | KTX2 transcodes at load time to a GPU-native format (ETC2 or ASTC on Android). That cuts GPU memory and upload time compared with PNG or JPEG. Meshopt decodes faster than Draco. |
| Particles and VFX | **three.quarks** | A batched, instanced particle system with a visual editor and JSON export. It replaces the hand-written `THREE.Points` pool for grass spray, sand splash, and celebration effects. |
| Post-processing | **pmndrs `postprocessing`** | Merges effects into fewer full-screen passes. Use it only on the high tier. Each full-screen pass is costly on mobile, so profile each effect. |
| Renderer | Stay on `WebGLRenderer`. Evaluate `WebGPURenderer` later. | Three.js offers `WebGPURenderer` with a WebGL2 fallback, but sources disagree on Android GPU coverage. Revisit once you have device data. |
| Audio | **Recorded SFX** (OGG or M4A) loaded into Web Audio buffers, keeping synthesized audio as a fallback | Recorded kicks, crowd sounds, and ambience sound noticeably more realistic than oscillators. |
| Build and CI | Fix the esbuild pin, add `vite-plugin-pwa` (optional), and add GitHub Actions for lint, test, build, and an Android debug APK | Repeatable builds |

### 2.5 Asset libraries

The following libraries are commonly cited as CC0, which allows commercial use without attribution. **Confirm each asset's license on the official site before shipping.** The sources consulted were mostly secondary guides.

| Library | Use in FootGolf Pro |
| --- | --- |
| **Kenney** (kenney.nl) | Low-poly nature kits, UI packs, and sound effect packs for menus, props, and interface sounds. |
| **Quaternius** | Stylized low-poly trees, rocks, and characters, delivered as glTF. A good match for the current art direction. |
| **Poly Haven** | HDRI skies for image-based lighting and reflections, plus PBR ground textures for grass, sand, and dirt. |
| **Mixamo** (Adobe, free with an account, not CC0) | Rigged character animation (kick, idle, celebration) to retarget onto a glTF player. Read Adobe's terms before use. |
| **freesound.org** (license varies per sound: CC0, CC-BY, or CC-BY-NC) | Crowd ambience, birdsong, wind, and ball impacts. Avoid CC-BY-NC sounds in a commercial game. |

### 2.6 Google Play requirements to plan for

The following requirements come from third-party guides. Check them against the Play Console policy pages before release.

- **Target API level:** New apps and updates must target Android 16 (API level 36). One guide gives August 31, 2026 as the deadline, with an extension to November 1, 2026.
- **16 KB memory page size:** Native `.so` libraries must use 16 KB alignment. Guides give enforcement dates ranging from May 2026 to February 2027. Capacitor apps include few native libraries, but check every library you add, such as Rapier's WASM build or ad SDKs.
- **Android App Bundle (`.aab`)** is the required upload format.

---

## 3. Gameplay improvement suggestions

The suggestions are grouped by effort and ordered by expected player impact within each group.

### 3.1 Feel and responsiveness (high impact, low to medium effort)

1. **Single input model in portrait.** Mobile golf games usually play in portrait with one thumb. Make arcade drag-and-release the default and move the classic slider panel into an accessibility setting. Lock orientation to portrait in the Android manifest and redesign the HUD for a 9:19.5 aspect ratio.
2. **Aim magnifier.** While the player drags the landing target, show a zoomed inset of the landing area, as many mobile golf games do. Fingers cover the exact spot otherwise.
3. **Native haptics tied to the timing needle.** Fire a light `selectionChanged` tick as the needle crosses each rating band during pullback. Fire `ImpactStyle.Heavy` on contact, scaled by the rating.
4. **Hit-stop on a perfect strike.** Freeze the simulation for 60-80 ms on contact, then release. Hit-stop is a widely used game-feel technique that makes contact feel weighty. Add it to the existing `triggerCameraImpact`.
5. **Ball-cam with slow-motion near the cup.** When a ball rolls within about 3 m of the cup with a chance to drop, slow time to around 0.4× and push the camera in. The existing heartbeat cue (`App.tsx`, "Cup Proximity Heartbeat") can drive this.
6. **Shot preview honesty.** Show the predicted landing ring for power and aim but hide bounce and roll, so the player reads the terrain. Reveal full roll prediction only as an earned ball perk.

### 3.2 Depth and strategy (medium effort)

7. **Lie-dependent shot rules.** `kickPowerModifier` already exists per surface. Show it in the HUD before the kick, for example "Rough −22% power." Restrict overpower from sand and deep rough.
8. **Wind rings tied to ball stats.** The plan document mentions wind rings, but the renderer shows only drifting wisps. Draw rings around the landing target whose offset equals the wind drift for the selected ball's wind resistance. Players can then learn to correct by a number of rings.
9. **Ball and boot loadouts with clear trade-offs.** Extend `FootGolfBallCustomization` from cosmetics into stats: power, accuracy, curl, wind resistance, and roll. Every ball should have a clear weakness so no single choice dominates.
10. **Curl (sidespin) as a skill shot.** Soccer-ball curl is the unique feature of footgolf. Add a swipe-curve gesture during release that bends the shot around trees. The Magnus term already exists in `physics.ts`.
11. **More holes and designed hazards.** Four courses with three holes each (12 holes) is thin. Target 9 holes per course. Add dog-leg holes, elevated greens, and water carries, so different lines carry different risks.

### 3.3 Meta and retention (medium to high effort)

12. **Make tournaments honest.** Either relabel tournaments as offline "vs. CPU" events or implement asynchronous multiplayer:
    - Record each player's shot inputs (power, aim, timing deviation, and seed).
    - Re-simulate them server-side with `simulateHeadlessShot` to validate scores. The deterministic core already supports this.
    - Run ghost replays of other players' shots using the existing `ReplayRecorder`.
13. **Seeded bots that play the course.** Replace `Math.random` scores with bots that simulate real shots through `simulateHeadlessShot` using skill-scaled timing error. Their scores then respond to wind and hole difficulty, and their shots can appear on the minimap.
14. **Play Games Services** leaderboards per hole and course, achievements that mirror existing daily missions, and cloud save.
15. **Season structure.** Rotate a featured course weekly with a leaderboard. Use daily missions (already built) as the daily hook.

### 3.4 Accessibility

16. Add a reduced-motion option (camera shake and flashes off), color-blind-safe target ring colors (the yellow, orange, and cyan rings rely on hue), a left-handed HUD layout, and a minimum touch target of 48 × 48 dp, which is Android's guideline.

---

## 4. Visual effects improvement suggestions

### 4.1 Lighting and atmosphere (highest visual return per hour)

1. **Image-based lighting from an HDRI sky.** Replace `RoomEnvironment` (an indoor studio light setup) with a Poly Haven outdoor HDRI per course, prefiltered with PMREM. This alone gives grass, ball, and character plausible outdoor reflections and ambient color.
2. **Sky and fog tuned per course.** Use a gradient sky dome or `three/addons/objects/Sky.js` instead of a flat `scene.background` color. Cut `FogExp2` density to about 0.002-0.003 and tint the fog toward the horizon color, so the far fairway stays readable.
3. **Shadow quality.** Fit the shadow camera to the active area around the ball and the target (tighter than ±60 m), and update it when the camera mode changes. Use `PCFSoftShadowMap` on the high tier and `PCFShadowMap` on medium. Bake static tree shadows into the ground texture on the low tier.
4. **Exposure.** Lower `toneMappingExposure` from 1.15 to around 0.9-1.0 once IBL is in place, or try `AgXToneMapping`, which Three.js supports. Choose by eye on a device.

### 4.2 Ground and course surfaces

5. **Splat-mapped terrain shader.** Replace vertex colors with a splat or mask texture that blends tiling KTX2 grass, rough, sand, and green textures. Keep mower stripes as a cheap procedural modulation in the shader. Vertex colors at about 5 m per cell can't produce crisp fairway or bunker edges.
6. **Adaptive terrain detail.** Increase mesh density near the green and the ball (or use a two-level mesh) so the visual surface matches the physics surface. This fixes issue A9.
7. **Instanced grass tufts** in the rough near the camera, using `InstancedMesh` with a wind-sway vertex shader. Show them only on medium and high tiers, and limit them to about 30 m from the camera.
8. **Water.** Replace the oscillating plane with a scrolling normal-map shader plus a fresnel term. That costs one material and gives a large improvement.

### 4.3 Props and characters

9. **glTF props from Quaternius or Kenney**, merged per material or drawn with `InstancedMesh`. This fixes issue A4 and improves silhouettes.
10. **Rigged glTF player** with Mixamo or hand-made animation clips (idle, run-up, kick variations, celebration, disappointment), driven by `AnimationMixer`. The current procedural `PlayerCharacter` (522 lines) can stay as a fallback.
11. **Spectators and flag sway.** Use billboarded crowd sprites around the green, which react on birdie or better. Keep the existing flag shader.

### 4.4 VFX (three.quarks)

12. **Surface-aware impact effects:** grass clippings on fairway landings, a sand burst in bunkers, a water splash with ripple rings, and a divot decal at the kick point.
13. **Strike-quality trails.** The existing `motionTrails.ts` is good. Add a short-lived shockwave ring at contact on a Perfect strike, and a heat-shimmer trail on overpower.
14. **Hole-in celebration.** Replace `canvas-confetti` (a 2D overlay) with 3D confetti and a firework burst above the cup. Add a brief golden flash with high-tier bloom.

### 4.5 Post-processing (high tier only)

15. Use pmndrs `postprocessing` with merged passes: SMAA in place of MSAA, a subtle bloom threshold on emissive parts only (target rings, trails, sun), and a vignette. Skip SSAO and depth of field on mobile unless profiling shows headroom.

### 4.6 UI polish

16. **Replace `backdrop-blur` panels** with solid or semi-transparent fills. This fixes issue A6.
17. **Diegetic indicators.** Show distance-to-pin and lie as world-space labels near the ball instead of HUD boxes.
18. **Reduce the top bar to 3-4 buttons** and move the rest into the pause menu.

---

## 5. Performance budget for Android

The following targets are starting points. Validate them on a real mid-range device; recent Android One or Pixel "a"-series phones are reasonable picks.

| Metric | Low tier | Medium tier | High tier |
| --- | --- | --- | --- |
| Frame rate | Stable 30 fps | 60 fps | 60 fps |
| Draw calls | < 80 | < 150 | < 250 |
| Triangles on screen | < 100k | < 250k | < 500k |
| Shadow map size | Off or baked | 1024 | 2048 |
| Pixel ratio | 1.0 | min(DPR, 1.5) | min(DPR, 2) |
| Post-processing | None | None | SMAA, bloom, vignette |
| Texture memory | < 64 MB | < 128 MB | < 192 MB |
| JS heap | < 150 MB | < 200 MB | < 250 MB |
| Cold start to title screen | < 3 s | < 3 s | < 3 s |

Implement automatic tier selection: start on medium, sample average frame time over the first 5 seconds of play, and step down a tier if it exceeds budget. Make `setDynamicResolutionScale` call `renderer.setPixelRatio` so resolution scaling works (issue A3).

---

## 6. Roadmap

### Phase 0: Foundation (about 1 week)

- [x] Fix the npm install conflict: bump `esbuild` to `^0.28` or remove it, since Vite bundles its own.
- [x] Remove unused dependencies (`@google/genai`, `express`, `dotenv`) and rename the package.
- [x] Move screenshots out of the repository root into `docs/screenshots/`. (`.aistudio/` was left in place because AI Studio manages it.)
- [x] Add GitHub Actions for `lint`, `test`, and `build` on pull requests, plus a debug APK build.

### Phase 1: Performance and architecture (about 2-3 weeks)

- [x] Throttle HUD telemetry to about 12 Hz (A1). A Zustand store wasn't needed for this fix and was not added.
- [x] Merge the two loops into one main loop with render interpolation (A2, A7).
- [x] Implement real dynamic resolution and quality tiers (A3, section 5).
- [x] Instance or merge props (A4). Remove `backdrop-blur` (A6).
- [x] Extract hole scoring and bot play into `src/game/core/` with tests (A8, partial: `App.tsx` still holds most UI state).
- [x] Add a seeded random number generator and use it for tournaments and bots (A11).

### Phase 2: Android shell (about 1-2 weeks)

- [x] Add Capacitor and the Android platform. Target API 36 and lock portrait orientation.
- [x] Add haptics, app lifecycle, preferences, status bar, and safe-area handling (A5).
- [ ] Profile on two or three real devices with Android Studio Profiler and Chrome remote DevTools. **Go/no-go gate for the web stack (section 2.2).** Needs physical devices.
- [ ] Set up a signed release `.aab` and an internal testing track on Play Console. Needs a Play Console account and an upload key.

### Phase 3: Visual upgrade (about 3-4 weeks)

- [ ] Build the asset pipeline: glTF-Transform with meshopt and KTX2, and lazy loading per course. Deferred until art assets are chosen.
- [x] Add image-based lighting, sky, fog, and exposure tuning (section 4.1), using a procedural sky instead of an HDRI file.
- [x] Add a baked surface texture with a grass detail shader (section 4.2.5). Adaptive mesh detail (4.2.6) was not needed once the texture carried the edges.
- [ ] Add glTF props and a rigged player (section 4.3). Deferred until art assets are chosen.
- [x] Add surface-aware impact effects and high-tier post-processing (sections 4.4 and 4.5). Effects use the existing particle pool rather than three.quarks.

### Phase 4: Gameplay depth (about 3-4 weeks)

- [x] Adapt the HUD and camera for portrait, and add needle haptics, hit-stop, and cup slow motion (section 3.1). The aim magnifier is not built yet.
- [x] Add a wind guide and lie modifiers (section 3.2). Ball stats and curl gestures are not built yet.
- [x] Expand to 9 holes per course.
- [x] Add bots that simulate real shots (section 3.3, item 13).

### Phase 5: Online and live operations (scope to be decided)

- [ ] Add Play Games Services leaderboards, achievements, and cloud save.
- [ ] Add asynchronous tournaments with server-side shot validation and ghost replays.
- [ ] Add weekly featured courses and seasons.

---

## 7. Implementation status

The first implementation pass covered phases 0-4, except the items that need physical devices, a Play Console account, art assets, or a backend. This section records what changed, what was measured, and where the work departed from the plan.

### 7.1 Bugs found and fixed along the way

- **Stale stroke count at hole-out.** The physics loop's closure read the stroke count from when the hole started, so hole-out titles, rewards, and missions used the wrong number.
- **Tournament off by one.** The HUD counter holds the stroke about to be taken, and tournaments recorded that value, so every hole was scored one stroke worse than it was played.
- **HUD distances didn't match the ball.** On flat ground, a full drive traveled about 75 m while the HUD promised 135 m, and a full putt on a green rolled more than 100 m. That made every par 3 unreachable in one kick. Kicks are now calibrated, with a modeled drag crisis and a tested estimate kept within 20% of simulation.
- **Bunker and tee mismatch.** The visible sand and tee areas didn't match where the physics changed surface.

### 7.2 Measurements

Measurements were taken in headless Chromium with a software renderer (SwiftShader), so they show relative cost, not phone frame rates.

| Measurement | Before | After |
| --- | --- | --- |
| Prop meshes on hole 1 | 51 | 15 |
| Draw calls, hole 1 tee shot (medium / high tier) | Not measured | 67 / 87 |
| Main JS bundle (gzip) | 271 KB | 286 KB, plus 74 KB of post-processing loaded only on the high tier |
| Unit tests | 44 | 80 |
| Debug APK | None | 4.8 MB, target API 36, no native libraries |

### 7.3 Departures from the plan

- **Sky:** a procedural sky (three's `Sky` shader) baked per course replaces the HDRI files, which avoids several megabytes of downloads.
- **Effects:** surface-aware impacts use the existing particle pool rather than three.quarks.
- **State:** throttling telemetry fixed the re-render problem without adding Zustand.
- **Holes:** holes 4-9 come from a seeded generator. Seeds were picked by running physics bots and keeping holes that play near par, and a test re-checks them.

### 7.4 Remaining work

- Profile on real Android devices (the go/no-go gate in section 2.2).
- Signed release builds and Play Console setup.
- Art: glTF props, a rigged player, and recorded audio.
- Aim magnifier, ball stats, and curl gestures.
- Play Games Services, asynchronous multiplayer, and seasons (phase 5).

## 8. Sources

Web research was carried out on November 2, 2026. Most results were secondary sources (blogs and guides), so treat specific dates and figures as provisional until confirmed against official documentation.

- [Capacitor discussion on Android WebView performance (GitHub)](https://github.com/ionic-team/capacitor/discussions/3899)
- [Ultimate guide to animation performance in Capacitor apps (Capgo)](https://capgo.app/blog/ultimate-guide-to-animation-performance-in-capacitor-apps/)
- [@capacitor/haptics (npm)](https://npmjs.com/package/@capacitor/haptics)
- [Ionic haptics documentation](https://ionicframework.com/docs/native/haptics)
- [WebGPU and Three.js migration guide, 2026 (Utsubo)](https://www.utsubo.com/blog/webgpu-threejs-migration-guide)
- [What Chrome WebGPU support means for browser 3D](https://digitalstrategyforce.com/journal/what-does-chrome-webgpu-support-mean-for-browser-3d/)
- [Google Play API 36 deadline and upgrade checklist (DEV Community)](https://dev.to/timbuilds/google-plays-api-36-deadline-passed-heres-the-extension-and-the-upgrade-checklist-1n4a)
- [16 KB page size and SDK 35/36 platform changes](https://fulldive-com.pages.dev/post/16kb-page-size-sdk-35-36-android-platform-changes/)
- [Rapier determinism guide (official)](https://rapier.rs/docs/user_guides/javascript/determinism)
- [Khronos: KTX 2.0 and Basis Universal](https://www.khronos.org/developers/linkto/compressed-texture-transmission-ktx2-basis-universal)
- [Basis Universal (KTX2) compression tutorial (egjs-view3d)](https://naver.github.io/egjs-view3d/docs/tutorials/Compression/Basisu)
- [pmndrs/postprocessing (GitHub)](https://github.com/pmndrs/postprocessing)
- [three.quarks (GitHub)](https://github.com/Alchemist0823/three.quarks/)
- [capacitor-game-connect (GitHub)](https://github.com/openforge/capacitor-game-connect)
- [Where to find free game assets in 2026 (Cinevva)](https://app.cinevva.com/guides/game-assets-guide)
- [Awesome CC0 asset list (GitHub)](https://www.github.com/madjin/awesome-cc0)
- [Best Android game engine 2026: Unity vs. Godot](https://5stardesigners.com/blog/best-android-game-engine-2026-unity-vs-godot-compared/)
- [Unity WebGL vs. Godot vs. PlayCanvas for web 3D (Cinevva)](https://app.cinevva.com/guides/unity-godot-playcanvas-web)
