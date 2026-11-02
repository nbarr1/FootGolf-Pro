# Implementation Plan: Premium Arcade Mobile Mechanics Refactor (Golf Clash / Ultimate Golf)

## Architectural Overview

We are refactoring the footgolf core gameplay loop to match the mechanical feel and architectural precision of industry-leading arcade golf titles (**Golf Clash** & **Ultimate Golf**). 

The interaction is structured as a deterministic finite-state machine (FSM) that clearly separates user input, game rules, physics simulation, and 3D visual presentation.

```
       [ AIMING STATE ]
  (Target Bullseye on Terrain)
  - Drag landing ring across terrain
  - Adjust for wind & elevation guide
  - Tap/drag ball to begin pullback
              │
              ▼
      [ PULLBACK STATE ]
  (Inverse Ball Drag & Centering)
  - Drag backwards from ball origin
  - Clamped to 100% standard distance
  - Expandable up to 125% OVERPOWER
              │
              ▼
   [ TIMING WINDOW STATE ]
  (Rapid Oscillating Needle)
  - Needle sweeps across concentric gauge
  - Overpower increases oscillation speed
  - Release triggers rating calculation:
    • PERFECT (±0.0 to ±0.15): 0 lateral deviation
    • GREAT   (±0.15 to ±0.45): slight drift
    • GOOD    (±0.45 to ±0.75): moderate drift
    • HOOK / SLICE (> ±0.75): heavy curve
              │
              ▼
     [ BALL FLIGHT STATE ]
  (Deterministic Physics Simulation)
  - Pure calculation without Three.js reliance
  - Inputs: Launch Force, Release Deviation, Wind, Ball Stats
  - Synchronous headless simulation for server validation
              │
              ▼
  [ REST / TRANSITION STATE ]
  - Ball settles at lie; instant follow-up lie transition
```

---

## 1. User Review Required & Confirmed Architectural Choices

Based on the design clarification:
1. **Target Reticle & Timing Needle Presentation**:
   - The landing zone displays a 3D concentric ring target placed directly onto the terrain surface (Yellow Bullseye = Perfect, Orange Ring = Great, Blue Ring = Good, Outer Ring = Fairway boundary).
   - During pullback, a rapid oscillating needle sweeps dynamically across the target bullseye, giving immediate visual feedback for timing.
2. **Overpower Mechanics**:
   - Pulling beyond 100% drag unlocks **Overpower up to 125%**, featuring visual tension indicators (pulsing ball aura, camera screen shake) and a **1.4x faster needle oscillation**, penalizing poorly timed shots.
3. **Putting Mechanics**:
   - Inside the putting green (or within putting distance), the game switches to a dedicated putting pullback line with cup capture speed thresholds (avoiding overpowered putts bouncing over the hole).

---

## 2. Proposed Architectural Changes & Modular Scripts

### Pillar 1: Drag-and-Release Pullback Mechanics (`src/game/arcadeControls.ts`)
- **Inverse Vector Math**:
  - Dragging down/backwards from the screen touch origin generates forward launch force in the camera's forward-facing direction.
  - Direction vector is computed as:
    $$\vec{D}_{\text{pull}} = \text{clamp}\left(\frac{\vec{P}_{\text{touch}} - \vec{P}_{\text{origin}}}{R_{\text{max}}}, 0, 1.25\right)$$
  - Normal drag range: $0.0 \to 1.0$ (100% normal power).
  - Overpower extension: $1.0 \to 1.25$ (125% power with needle speed escalation).
- **Centering Guide**:
  - Detects if the drag vector is pulled straight backward or tilted, allowing subtle intentional shape bias while centering the ball in the launch socket.

### Pillar 2: Arcade Timing Component (`src/game/timingGauge.ts`)
- **Harmonic Needle Oscillation**:
  - Needle position $\theta(t) \in [-1.0, 1.0]$ driven by sine wave:
    $$\theta(t) = \sin(2\pi \cdot f_{\text{needle}} \cdot t)$$
  - Base frequency $f_{\text{needle}} = 0.85\text{ Hz}$ to $1.15\text{ Hz}$ based on club/kick type and ball attributes.
  - When in Overpower ($P > 1.0$), frequency scales:
    $$f_{\text{active}} = f_{\text{needle}} \cdot (1.0 + 1.6 \cdot (P - 1.0))$$
- **Precision Windows & Lateral Deviations**:
  - **PERFECT**: $|\theta| \le 0.12$ $\implies$ Accuracy Factor = $1.0$, Lateral Offset = $0.0^\circ$.
  - **GREAT**: $0.12 < |\theta| \le 0.38$ $\implies$ Accuracy Factor = $0.95$, Lateral Offset = $\text{sign}(\theta) \times 2.8^\circ$.
  - **GOOD**: $0.38 < |\theta| \le 0.68$ $\implies$ Accuracy Factor = $0.85$, Lateral Offset = $\text{sign}(\theta) \times 6.5^\circ$.
  - **HOOK / SLICE**: $|\theta| > 0.68$ $\implies$ Accuracy Factor = $0.65$, Lateral Offset = $\text{sign}(\theta) \times 14.5^\circ$ with heavy sidespin curl.

### Pillar 3: Ground Concentric Bullseye Reticle in 3D (`src/game/renderer3d.ts`)
- Add high-visibility, terrain-projected concentric target circles to `FootGolfRenderer`:
  - Inner Circle: Vibrant Golden Yellow (Perfect landing circle).
  - Middle Ring: Warm Amber Orange (Great landing ring).
  - Outer Ring: Electric Cyan Blue (Good landing ring).
- Add dynamic 3D needle blade oscillating across the reticle plane during active pullback, synced with HUD audio/visual cues.
- Add wind ring displacement ring guide (wind ring system standard in Golf Clash: rings correspond to MPH values based on ball wind resistance).

### Pillar 4: Deterministic Physics & Server Validation (`src/game/deterministicPhysics.ts`)
- Decouple the kick initiation and trajectory steps into pure mathematical functions:
  ```typescript
  export interface HeadlessShotInput {
    startPos: Vector3Tuple;
    targetPos: Vector3Tuple;
    powerNormalized: number;     // 0.0 - 1.25
    timingDeviation: number;     // -1.0 to 1.0
    wind: { x: number; z: number; speed: number };
    ballStats: {
      powerRating: number;       // e.g. 1.0 - 1.2
      windResistance: number;    // 0.0 - 0.5 reduction
      bounceCoefficient: number; // 0.7 - 0.95
    };
    lieType: 'fairway' | 'rough' | 'bunker' | 'green';
  }
  
  export interface HeadlessSimulationResult {
    initialVelocity: Vector3Tuple;
    landingSpot: Vector3Tuple;
    finalRestSpot: Vector3Tuple;
    inHole: boolean;
    bounces: number;
    flightDuration: number;
    trajectoryPoints: Vector3Tuple[];
  }
  ```
- **Server Validation Hook**: Any client-submitted shot can be simulated synchronously in <2 milliseconds headlessly on Node.js/Cloud Run without any Three.js canvas or WebGL dependency to verify anti-cheat integrity.

### Pillar 5: Dedicated Putting System (`src/game/puttingSystem.ts`)
- In putting mode:
  - Concentric flight reticle is replaced with a smooth cup-guided path line.
  - Pullback distance controls ground rollout distance with an illuminated "Cup Capture Speed" sweet-spot window.
  - Overpowering the putt risks rimming out or flying past the cup.

---

## 3. Step-by-Step Implementation Sequence

1. **Create `src/game/timingGauge.ts`**:
   - Pure math module for needle oscillation, timing evaluation, ratings, and lateral spin/angle modifiers.
   - Add unit test suite in `src/game/timingGauge.test.ts`.

2. **Create `src/game/arcadeControls.ts`**:
   - Manages the touch/mouse input states: `IDLE`, `AIMING`, `PULLBACK`, `RELEASING`.
   - Normalizes pullback distance, clamps to 100% / 125% overpower, detects release timestamp, queries `timingGauge`.

3. **Create `src/game/deterministicPhysics.ts`**:
   - Pure headless trajectory and ball physics calculation.
   - Connects with existing `stepBallPhysics` and guarantees zero WebGL/DOM dependency.
   - Add unit test suite in `src/game/deterministicPhysics.test.ts`.

4. **Enhance `FootGolfRenderer` in `src/game/renderer3d.ts`**:
   - Add terrain-projected concentric target circles (Yellow, Orange, Blue) at the aimed landing position.
   - Add 3D oscillating needle / reticle indicator.
   - Support dragging the target landing spot freely in Aiming state.

5. **Create `src/components/ArcadeShotOverlay.tsx`**:
   - Modern, tactile mobile HUD overlay:
     - Pullback socket guide and tension indicator at bottom of screen.
     - Dynamic timing gauge banner showing "PERFECT!", "GREAT", "GOOD", or "SLICE/HOOK" with crisp impact animations.
     - Overpower meter with orange/red glow and needle speed multiplier badge.
     - Putting mode visual track when on the green.

6. **Integrate into `src/App.tsx`**:
   - Connect FSM state machine transitions seamlessly into the game loop.
   - Preserve existing modes (Classic, Speed, Target, Career, Tournaments, Multiplayer).

---

## 4. Verification & Testing Plan

1. **Unit Tests (`npm test`)**:
   - `timingGauge.test.ts`: Validate precision thresholds (Perfect, Great, Good, Hook/Slice), frequencies, and overpower multiplier.
   - `deterministicPhysics.test.ts`: Validate that headless simulation produces identical rest coordinates for identical input seeds without floating-point drift.
   - Existing 35 tests verified and passing.

2. **Type Checking & Linting**:
   - Run `npx tsc --noEmit` and `lint_applet` to guarantee zero TypeScript or syntax issues.

3. **Gameplay Verification in Browser**:
   - Drag target ring to aim shot.
   - Touch and pull back ball to initiate shot; verify power meter smoothly tracks from 0% to 100% and expands into 125% Overpower.
   - Observe timing needle swinging across the reticle; release on center to trigger "PERFECT" with straight flight; release off-center to observe slice/hook lateral drift.
   - Test putting on the green: verify smooth guide line and cup capture speed indicator.
   - Confirm ball comes to a complete rest and transitions cleanly to next lie without glitching.
