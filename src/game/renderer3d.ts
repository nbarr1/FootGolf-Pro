/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import type { EffectComposer } from 'postprocessing';
import {
  BALL_RADIUS,
  CUP_RADIUS,
  getTerrainHeight,
  getTerrainNormal,
  getSurfaceLie,
} from './physics';
import { generateGreenGrid, GreenGridSpec } from './greenGrid';
import { PlayerCharacter } from './playerCharacter';
import { getActiveSettings } from './settings';
import { AtmosphereSettings, getAtmosphere, sunDirection } from './atmosphere';
import { batchStaticMeshes, BatchResult, disposeChildren } from './staticBatcher';
import {
  computePixelRatio,
  FrameTimeMonitor,
  QUALITY_PRESETS,
  QualityPreference,
  QualitySettings,
  QualityTier,
  resolveInitialTier,
} from './quality';
import { CourseData, HoleData, KickType, MotionTrailConfig, MotionTrailStyleId, SpinControl, Vector3D } from '../types';
import { DEFAULT_MOTION_TRAIL_CONFIGS, getMotionTrailPreset, calculateDynamicTrailColor } from './motionTrails';

export type CameraMode = 'aim' | 'flight' | 'drone' | 'green';

export interface Particle {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  color: THREE.Color;
  size: number;
}

export class FootGolfRenderer {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean = false;
  private frameId: number = 0;
  private isDestroyed: boolean = false;

  // Scene Objects
  private terrainMesh: THREE.Mesh | null = null;
  private ballGroup: THREE.Group;
  private ballMesh: THREE.Mesh;
  private ballShadow: THREE.Mesh;
  private playerCharacter: PlayerCharacter;
  private cupGroup: THREE.Group;
  private flagCloth: THREE.Mesh;
  private propGroup: THREE.Group;
  private aimTrajectoryLine: THREE.Line;
  private trajectoryPointsGeom: THREE.BufferGeometry;

  // Lighting
  private dirLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;

  // Particle pool
  private particles: Particle[] = [];
  private particlePoints: THREE.Points;
  private particleGeom: THREE.BufferGeometry;
  private particlePositions: Float32Array;
  private particleColors: Float32Array;
  private maxParticles = 450;

  // Camera animation targets
  private cameraMode: CameraMode = 'aim';
  private targetCamPos = new THREE.Vector3();
  private targetLookAt = new THREE.Vector3();
  private currentCamLookAt = new THREE.Vector3();
  private aimAngleRad: number = 0;
  private isFlyoverActive: boolean = false;
  private flyoverProgress: number = 0;

  // Reusable scratch vectors to avoid runtime GC
  private _scratchVec = new THREE.Vector3();
  private _scratchVec2 = new THREE.Vector3();

  // Textures
  private ballTexture: THREE.CanvasTexture;
  private grassTexture: THREE.CanvasTexture;
  private grassBumpTexture: THREE.CanvasTexture;
  private flagTexture: THREE.CanvasTexture;
  private sunGroup: THREE.Group | null = null;

  // Putting Read Line & Animated Beads
  private puttingLineMesh: THREE.Line;
  private puttingLineGeom: THREE.BufferGeometry;
  private puttingBeadsGroup: THREE.Group;
  private puttingBeadMeshes: THREE.Mesh[] = [];
  private puttingPoints: THREE.Vector3[] = [];
  private puttingAnimProgress: number = 0;
  private cupBeaconMesh: THREE.Mesh;
  private puttingStopMarker: THREE.Mesh;
  private currentKickType: KickType = 'drive';

  // Dynamic 3D Projected Landing Target Reticle & Arcade Timing Needle
  private landingTargetGroup: THREE.Group;
  private landingTargetOuterRing: THREE.Mesh;
  private landingTargetInnerRing: THREE.Mesh;
  private arcadeNeedleGroup: THREE.Group;
  private arcadeNeedleMesh: THREE.Mesh;

  // In-flight Aerodynamic 3D Motion Ribbon & Trail
  private flightRibbonMesh: THREE.Mesh;
  private flightRibbonGeom: THREE.BufferGeometry;
  private flightRibbonPositions: Float32Array;
  private flightRibbonColors: Float32Array;
  private flightTrailLine: THREE.Line;
  private flightTrailGeom: THREE.BufferGeometry;
  private flightTrailPositions: THREE.Vector3[] = [];
  private flightTrailColors: Float32Array;
  private flightTrailNodes: { pos: THREE.Vector3; color: { r: number; g: number; b: number }; width: number }[] = [];
  private flightTrailMax = 32;
  private isBallInFlight: boolean = false;
  private flightVaporCooldown: number = 0;
  private motionTrailConfig: MotionTrailConfig = { ...DEFAULT_MOTION_TRAIL_CONFIGS[0] };
  private activeShotPower: number = 0.5;
  private activeShotSpin: SpinControl = { top: 0, side: 0 };
  private activeStrikeRating: string = 'standard';

  // Water Hazards Group
  private waterGroup: THREE.Group;

  // Atmospheric Clouds & Wind Direction
  private cloudsGroup: THREE.Group;
  private activeWind: { speed: number; angleRad: number } | null = null;
  private activeCourse: CourseData | null = null;

  // Green Slope Contour Topography Grid
  private greenGridGroup: THREE.Group;
  private greenGridMesh: THREE.LineSegments | null = null;
  private greenSlopeBeadsGroup: THREE.Group;
  private greenSlopeBeads: {
    mesh: THREE.Mesh;
    basePos: THREE.Vector3;
    fallDir: THREE.Vector3;
    progress: number;
    speed: number;
  }[] = [];
  private currentGridHoleId: number = -1;

  // Dynamic Atmospheric Wind Particles & Wisps
  private windWispsPoints: THREE.Points;
  private windWispsGeom: THREE.BufferGeometry;
  private windWispsPositions: Float32Array;
  private windWispsData: {
    offset: THREE.Vector3;
    speedMul: number;
    swayFreq: number;
    swayPhase: number;
  }[] = [];
  private maxWindWisps = 40;

  // Replay Camera & Playback Overrides
  private isReplayMode: boolean = false;
  private replayCamPos: THREE.Vector3 = new THREE.Vector3();
  private replayLookAt: THREE.Vector3 = new THREE.Vector3();

  // Dynamic Camera Impact & Resolution Scaling
  private cameraImpactTrauma: number = 0;
  private currentDrsScale: number = 1.0;

  constructor(container: HTMLElement, course: CourseData, hole: HoleData, qualityPref: QualityPreference = 'auto') {

    this.container = container;

    // 1. Detect Software WebGL
    this.isSoftwareGl = (() => {
      try {
        const gl = document.createElement('canvas').getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    // 2. Initialize WebGLRenderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    // Debug override (?forceQuality=high) to inspect tiers on machines with software GL
    const forced = new URLSearchParams(window.location.search).get('forceQuality') as QualityTier | null;
    if (forced && forced in QUALITY_PRESETS) this.isSoftwareGl = false;
    this.qualitySettings = QUALITY_PRESETS[forced && forced in QUALITY_PRESETS ? forced : resolveInitialTier(qualityPref, this.isSoftwareGl)];
    this.frameMonitor = new FrameTimeMonitor(this.qualitySettings, qualityPref === 'auto' && !this.isSoftwareGl);
    this.renderer.setPixelRatio(computePixelRatio(this.qualitySettings, window.devicePixelRatio, 1));
    this.renderer.setSize(container.clientWidth || 800, container.clientHeight || 600);
    this.renderer.shadowMap.enabled = this.qualitySettings.shadows;
    this.renderer.shadowMap.type = this.qualitySettings.softShadows ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;

    container.appendChild(this.renderer.domElement);

    // 3. Scene & Camera Setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(course.skyColor);
    this.scene.fog = new THREE.FogExp2(course.fogColor, 0.0026);

    this.camera = new THREE.PerspectiveCamera(
      (container.clientWidth || 800) / (container.clientHeight || 600) < 0.9 ? 64 : 52,
      (container.clientWidth || 800) / (container.clientHeight || 600),
      0.1,
      800
    );

    // 4. Sky and image-based lighting are baked per course in applyAtmosphere()

    // 5. Balanced Lighting Rig
    this.hemiLight = new THREE.HemisphereLight('#f1f5f9', '#2d5236', 0.85);
    this.scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight('#fff5e0', 1.6);
    this.dirLight.position.set(40, 80, 40);
    if (!this.isSoftwareGl) {
      this.dirLight.castShadow = this.qualitySettings.shadows;
      this.dirLight.shadow.mapSize.width = this.qualitySettings.shadowMapSize;
      this.dirLight.shadow.mapSize.height = this.qualitySettings.shadowMapSize;
      this.dirLight.shadow.camera.near = 0.5;
      this.dirLight.shadow.camera.far = 300;
      const d = 60;
      this.dirLight.shadow.camera.left = -d;
      this.dirLight.shadow.camera.right = d;
      this.dirLight.shadow.camera.top = d;
      this.dirLight.shadow.camera.bottom = -d;
      this.dirLight.shadow.bias = -0.0005;
      this.dirLight.shadow.normalBias = 0.02;
    }
    this.scene.add(this.dirLight);
    this.scene.add(this.dirLight.target);

    // 5b. Atmospheric Sun Disc & Glowing Corona Halo
    this.sunGroup = new THREE.Group();
    const sunDir = new THREE.Vector3(40, 80, 40).normalize();
    const sunPos = sunDir.clone().multiplyScalar(360);
    this.sunGroup.position.copy(sunPos);
    this.sunGroup.lookAt(0, 0, 0);

    const discGeom = new THREE.CircleGeometry(16, 28);
    const discMat = new THREE.MeshBasicMaterial({
      color: 0xfffbeb,
      depthWrite: false,
    });
    this.sunGroup.add(new THREE.Mesh(discGeom, discMat));

    const coronaGeom = new THREE.RingGeometry(15, 54, 32);
    const coronaMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.38,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.sunGroup.add(new THREE.Mesh(coronaGeom, coronaMat));

    const auraGeom = new THREE.RingGeometry(50, 96, 32);
    const auraMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.14,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.sunGroup.add(new THREE.Mesh(auraGeom, auraMat));
    this.scene.add(this.sunGroup);

    // Procedural Textures
    this.ballTexture = this.createSoccerBallTexture('#ffffff', '#1e293b');
    this.grassTexture = this.createGrassDetailTexture();
    this.grassBumpTexture = this.createGrassBumpTexture();
    this.flagTexture = this.createFlagTexture(hole.number);

    // 6. Build Ball Group (3-12 parts: Ball, Seam Rings, Contact Shadow)
    this.ballGroup = new THREE.Group();
    const ballGeom = new THREE.SphereGeometry(BALL_RADIUS, 24, 24);
    const ballMat = new THREE.MeshStandardMaterial({
      map: this.ballTexture,
      roughness: 0.35,
      metalness: 0.05,
    });
    this.ballMesh = new THREE.Mesh(ballGeom, ballMat);
    this.ballMesh.castShadow = !this.isSoftwareGl;
    this.ballGroup.add(this.ballMesh);

    // Radial contact shadow beneath ball
    const shadowGeom = new THREE.CircleGeometry(BALL_RADIUS * 1.35, 16);
    shadowGeom.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x07150a,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    this.ballShadow = new THREE.Mesh(shadowGeom, shadowMat);
    this.ballShadow.position.y = -BALL_RADIUS + 0.012;
    this.ballGroup.add(this.ballShadow);
    this.scene.add(this.ballGroup);

    // 6b. 3D Animated Athletic Player Character
    this.playerCharacter = new PlayerCharacter();
    this.scene.add(this.playerCharacter.group);

    // 7. FootGolf Cup & Pin Flag (3-12 parts: Outer Rim, Cup Well, Pole, Flag Cloth, Finial, Base)
    this.cupGroup = new THREE.Group();
    const cupRimGeom = new THREE.TorusGeometry(CUP_RADIUS, 0.025, 12, 32);
    cupRimGeom.rotateX(Math.PI / 2);
    const cupRimMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.3,
      metalness: 0.7,
    });
    const cupRim = new THREE.Mesh(cupRimGeom, cupRimMat);
    this.cupGroup.add(cupRim);

    // Inner dark cup cylinder
    const cupInnerGeom = new THREE.CylinderGeometry(CUP_RADIUS - 0.01, CUP_RADIUS - 0.02, 0.35, 24, 1, true);
    const cupInnerMat = new THREE.MeshBasicMaterial({ color: 0x050e08, side: THREE.BackSide });
    const cupInner = new THREE.Mesh(cupInnerGeom, cupInnerMat);
    cupInner.position.y = -0.175;
    this.cupGroup.add(cupInner);

    // Flagpole
    const poleGeom = new THREE.CylinderGeometry(0.015, 0.018, 2.5, 12);
    poleGeom.translate(0, 1.25, 0);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.2, metalness: 0.8 });
    const pole = new THREE.Mesh(poleGeom, poleMat);
    this.cupGroup.add(pole);

    // Golden Finial Ball on top
    const finialGeom = new THREE.SphereGeometry(0.045, 12, 12);
    finialGeom.translate(0, 2.52, 0);
    const finialMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.15, metalness: 0.9 });
    this.cupGroup.add(new THREE.Mesh(finialGeom, finialMat));

    // Regulation FootGolf Tournament Flag with Multi-segment Cloth
    const flagGeom = new THREE.PlaneGeometry(0.85, 0.52, 14, 8);
    flagGeom.translate(0.85 / 2, 2.22, 0); // anchor at left edge on flagpole
    const flagMat = new THREE.MeshStandardMaterial({
      map: this.flagTexture,
      roughness: 0.65,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });
    this.flagCloth = new THREE.Mesh(flagGeom, flagMat);
    this.flagCloth.castShadow = !this.isSoftwareGl;
    this.cupGroup.add(this.flagCloth);

    // Holographic Cup Beacon Ring (Pulsing Putting Target)
    const beaconGeom = new THREE.RingGeometry(CUP_RADIUS * 0.95, CUP_RADIUS * 1.45, 32);
    beaconGeom.rotateX(-Math.PI / 2);
    const beaconMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.cupBeaconMesh = new THREE.Mesh(beaconGeom, beaconMat);
    this.cupBeaconMesh.position.y = 0.02;
    this.cupBeaconMesh.visible = false;
    this.cupGroup.add(this.cupBeaconMesh);

    this.scene.add(this.cupGroup);

    // 8. Prop Group (Trees, Rocks, Tee Markers, Fairway Markers)
    this.propGroup = new THREE.Group();
    this.scene.add(this.propGroup);

    // 9. Aim Trajectory Line
    this.trajectoryPointsGeom = new THREE.BufferGeometry();
    const lineMat = new THREE.LineDashedMaterial({
      color: 0xfacc15,
      dashSize: 0.8,
      gapSize: 0.4,
      linewidth: 3,
    });
    this.aimTrajectoryLine = new THREE.Line(this.trajectoryPointsGeom, lineMat);
    this.scene.add(this.aimTrajectoryLine);

    // 9b. Dynamic 3D Projected Concentric Landing Target Reticle (Golf Clash style)
    this.landingTargetGroup = new THREE.Group();

    // Ring 1: Bullseye Center Core (Perfect Zone - Golden Yellow)
    const bullseyeDiscGeom = new THREE.CircleGeometry(0.24, 24);
    bullseyeDiscGeom.rotateX(-Math.PI / 2);
    const bullseyeDiscMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const bullseyeDisc = new THREE.Mesh(bullseyeDiscGeom, bullseyeDiscMat);
    bullseyeDisc.position.y = 0.006;
    this.landingTargetGroup.add(bullseyeDisc);
    this.landingTargetInnerRing = bullseyeDisc;

    // Ring 2: Great Zone Ring (Amber Orange)
    const greatRingGeom = new THREE.RingGeometry(0.24, 0.58, 32);
    greatRingGeom.rotateX(-Math.PI / 2);
    const greatRingMat = new THREE.MeshBasicMaterial({
      color: 0xf97316,
      transparent: true,
      opacity: 0.82,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const greatRing = new THREE.Mesh(greatRingGeom, greatRingMat);
    greatRing.position.y = 0.005;
    this.landingTargetGroup.add(greatRing);

    // Ring 3: Good Zone Ring (Cyan Blue)
    const goodRingGeom = new THREE.RingGeometry(0.58, 0.98, 32);
    goodRingGeom.rotateX(-Math.PI / 2);
    const goodRingMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.78,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const goodRing = new THREE.Mesh(goodRingGeom, goodRingMat);
    goodRing.position.y = 0.004;
    this.landingTargetGroup.add(goodRing);
    this.landingTargetOuterRing = goodRing;

    // Ring 4: Outer Border Hazard Ring (Crisp White with High Contrast)
    const borderRingGeom = new THREE.RingGeometry(0.98, 1.08, 32);
    borderRingGeom.rotateX(-Math.PI / 2);
    const borderRingMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const borderRing = new THREE.Mesh(borderRingGeom, borderRingMat);
    borderRing.position.y = 0.003;
    this.landingTargetGroup.add(borderRing);

    // Crosshair cardinal alignment ticks
    for (let c = 0; c < 4; c++) {
      const angle = (c * Math.PI) / 2;
      const tickGeom = new THREE.PlaneGeometry(0.06, 0.36);
      tickGeom.rotateX(-Math.PI / 2);
      tickGeom.rotateY(angle);
      const tickMesh = new THREE.Mesh(tickGeom, borderRingMat);
      tickMesh.position.set(Math.cos(angle) * 1.04, 0.007, Math.sin(angle) * 1.04);
      this.landingTargetGroup.add(tickMesh);
    }

    // 3D Oscillating Needle Blade across Landing Target
    this.arcadeNeedleGroup = new THREE.Group();
    this.arcadeNeedleGroup.position.set(0, 0.04, 0);

    // Needle arm geometry pointing along local Z
    const needleGeom = new THREE.ConeGeometry(0.12, 1.15, 4);
    needleGeom.rotateX(Math.PI / 2);
    needleGeom.translate(0, 0, 0.55); // anchor base at center
    const needleMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });
    this.arcadeNeedleMesh = new THREE.Mesh(needleGeom, needleMat);
    this.arcadeNeedleGroup.add(this.arcadeNeedleMesh);

    // Central needle pivot disc
    const pivotGeom = new THREE.CircleGeometry(0.14, 16);
    pivotGeom.rotateX(-Math.PI / 2);
    const pivotMat = new THREE.MeshBasicMaterial({ color: 0xffffff, depthWrite: false });
    const pivot = new THREE.Mesh(pivotGeom, pivotMat);
    pivot.position.y = 0.01;
    this.arcadeNeedleGroup.add(pivot);

    this.arcadeNeedleGroup.visible = false;
    this.landingTargetGroup.add(this.arcadeNeedleGroup);

    this.landingTargetGroup.visible = false;
    this.scene.add(this.landingTargetGroup);

    // 10. Particle System with smooth circular particle texture
    const createCircleParticleTexture = () => {
      const c = document.createElement('canvas');
      c.width = 32;
      c.height = 32;
      const ctx = c.getContext('2d');
      if (ctx) {
        const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
        grad.addColorStop(0, 'rgba(255,255,255,1)');
        grad.addColorStop(0.5, 'rgba(255,255,255,0.7)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 32, 32);
      }
      return new THREE.CanvasTexture(c);
    };
    const circleParticleTex = createCircleParticleTexture();

    this.particlePositions = new Float32Array(this.maxParticles * 3);
    this.particleColors = new Float32Array(this.maxParticles * 3);
    this.particleGeom = new THREE.BufferGeometry();
    this.particleGeom.setAttribute('position', new THREE.BufferAttribute(this.particlePositions, 3));
    this.particleGeom.setAttribute('color', new THREE.BufferAttribute(this.particleColors, 3));

    const particleMat = new THREE.PointsMaterial({
      size: 0.16,
      map: circleParticleTex,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    this.particlePoints = new THREE.Points(this.particleGeom, particleMat);
    this.scene.add(this.particlePoints);

    // 11. Putting Read Line Mesh & Animated Roll Beads
    this.puttingLineGeom = new THREE.BufferGeometry();
    const putLineMat = new THREE.LineBasicMaterial({
      color: 0x34d399,
      linewidth: 3,
      transparent: true,
      opacity: 0.9,
    });
    this.puttingLineMesh = new THREE.Line(this.puttingLineGeom, putLineMat);
    this.puttingLineMesh.visible = false;
    this.scene.add(this.puttingLineMesh);

    this.puttingBeadsGroup = new THREE.Group();
    const beadGeom = new THREE.SphereGeometry(0.065, 8, 8);
    const beadMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x059669,
      emissiveIntensity: 0.9,
      roughness: 0.2,
    });
    for (let b = 0; b < 24; b++) {
      const bead = new THREE.Mesh(beadGeom, beadMat);
      bead.visible = false;
      this.puttingBeadMeshes.push(bead);
      this.puttingBeadsGroup.add(bead);
    }
    this.scene.add(this.puttingBeadsGroup);

    // Projected Putting Endpoint Stop Ring Marker
    const stopGeom = new THREE.RingGeometry(0.16, 0.32, 28);
    stopGeom.rotateX(-Math.PI / 2);
    const stopMat = new THREE.MeshBasicMaterial({
      color: 0x34d399,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.puttingStopMarker = new THREE.Mesh(stopGeom, stopMat);
    this.puttingStopMarker.visible = false;
    this.scene.add(this.puttingStopMarker);

    // 12. In-flight Aerodynamic 3D Motion Ribbon (TrackMan/Toptracer Broadcast Ribbon)
    this.flightRibbonGeom = new THREE.BufferGeometry();
    const ribbonVertCount = this.flightTrailMax * 2;
    this.flightRibbonPositions = new Float32Array(ribbonVertCount * 3);
    this.flightRibbonColors = new Float32Array(ribbonVertCount * 3);

    const ribbonIndices: number[] = [];
    for (let i = 0; i < this.flightTrailMax - 1; i++) {
      const v0 = i * 2;
      const v1 = i * 2 + 1;
      const v2 = (i + 1) * 2;
      const v3 = (i + 1) * 2 + 1;
      ribbonIndices.push(v0, v1, v2);
      ribbonIndices.push(v1, v3, v2);
    }
    this.flightRibbonGeom.setIndex(ribbonIndices);
    this.flightRibbonGeom.setAttribute(
      'position',
      new THREE.BufferAttribute(this.flightRibbonPositions, 3)
    );
    this.flightRibbonGeom.setAttribute(
      'color',
      new THREE.BufferAttribute(this.flightRibbonColors, 3)
    );

    const ribbonMat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
    });
    this.flightRibbonMesh = new THREE.Mesh(this.flightRibbonGeom, ribbonMat);
    this.flightRibbonMesh.visible = false;
    this.scene.add(this.flightRibbonMesh);

    // Secondary Core Tracer Line
    this.flightTrailGeom = new THREE.BufferGeometry();
    const trailPositions = new Float32Array(this.flightTrailMax * 3);
    this.flightTrailColors = new Float32Array(this.flightTrailMax * 3);
    for (let t = 0; t < this.flightTrailMax; t++) {
      const alpha = 1 - t / this.flightTrailMax;
      this.flightTrailColors[t * 3] = 0.95 * alpha;     // R
      this.flightTrailColors[t * 3 + 1] = 0.85 * alpha; // G
      this.flightTrailColors[t * 3 + 2] = 0.35 * alpha; // B
    }
    this.flightTrailGeom.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
    this.flightTrailGeom.setAttribute('color', new THREE.BufferAttribute(this.flightTrailColors, 3));
    const trailMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      linewidth: 3,
    });
    this.flightTrailLine = new THREE.Line(this.flightTrailGeom, trailMat);
    this.flightTrailLine.visible = false;
    this.scene.add(this.flightTrailLine);

    // 13. Water Hazards Group
    this.waterGroup = new THREE.Group();
    this.scene.add(this.waterGroup);

    // 14. Atmospheric 3D Clouds Group
    this.cloudsGroup = new THREE.Group();
    this.buildClouds();
    this.scene.add(this.cloudsGroup);

    // 15. Green Slope Contour Grid Group
    this.greenGridGroup = new THREE.Group();
    this.greenSlopeBeadsGroup = new THREE.Group();
    this.greenGridGroup.add(this.greenSlopeBeadsGroup);
    this.greenGridGroup.visible = false;
    this.scene.add(this.greenGridGroup);

    // 16. Dynamic Atmospheric Wind Particles & Wisps
    this.windWispsPositions = new Float32Array(this.maxWindWisps * 3);
    this.windWispsGeom = new THREE.BufferGeometry();
    this.windWispsGeom.setAttribute(
      'position',
      new THREE.BufferAttribute(this.windWispsPositions, 3)
    );
    const wispColor =
      course.theme === 'desert'
        ? 0xfde047
        : course.theme === 'alpine'
        ? 0xf0fdf4
        : course.theme === 'japanese_garden'
        ? 0xfbcfe8
        : 0xdcfce7;
    const wispMat = new THREE.PointsMaterial({
      color: wispColor,
      size: 0.16,
      map: circleParticleTex,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.windWispsPoints = new THREE.Points(this.windWispsGeom, wispMat);
    this.scene.add(this.windWispsPoints);

    // Initialize wind wisp offsets around camera/player
    for (let w = 0; w < this.maxWindWisps; w++) {
      this.windWispsData.push({
        offset: new THREE.Vector3(
          (Math.random() - 0.5) * 45,
          Math.random() * 7 + 0.8,
          (Math.random() - 0.5) * 45
        ),
        speedMul: 0.8 + Math.random() * 0.45,
        swayFreq: 2.0 + Math.random() * 3.0,
        swayPhase: Math.random() * Math.PI * 2,
      });
    }

    this.activeCourse = course;
    // Bake the sky on the first frame: a bake during construction can come out empty
    this.pendingAtmosphere = course;
    this.setPostProcessing(this.qualitySettings.postProcessing);


    // Build course terrain and props
    this.buildTerrain(course, hole);
    this.buildProps(hole);
    this.buildGrassTufts(hole);

    // Position cup
    this.cupGroup.position.set(hole.pinPosition.x, hole.pinPosition.y, hole.pinPosition.z);

    // Position ball at tee
    this.setBallPosition(hole.teePosition);

    // Initial camera look
    this.currentCamLookAt.copy(this.ballGroup.position);
    this.updateCameraInstant(hole);

    // Resize handler
    window.addEventListener('resize', this.onResize);

    // Start render loop
    this.startLoop();
  }

  private onResize = () => {
    if (!this.container || this.isDestroyed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    // Widen the vertical field of view on portrait screens to keep enough of the hole in view
    this.camera.fov = this.camera.aspect < 0.9 ? 64 : 52;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer?.setSize(w, h);
  };

  /**
   * Procedural FIFA / FIFG Regulation Match Ball Texture with thermobonded seam debossing,
   * high-visibility aerodynamic speed graphics, and micro-pebble grip texture
   */
  public createSoccerBallTexture(primaryColor = '#ffffff', secondaryColor = '#1e293b'): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // 1. Primary ball base color
    ctx.fillStyle = primaryColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Micro-pebble leather grain for authentic match ball grip sheen
    ctx.fillStyle = '#000000';
    ctx.globalAlpha = 0.035;
    for (let p = 0; p < 8000; p++) {
      const px = Math.random() * canvas.width;
      const py = Math.random() * canvas.height;
      ctx.fillRect(px, py, 1.5, 1.5);
    }
    ctx.globalAlpha = 1.0;

    // Authentic pentagon panel with debossed seam & 3D bevel shading
    const drawPentagon = (cx: number, cy: number, r: number) => {
      // Outer seam shadow
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = (i * 2 * Math.PI) / 5 - Math.PI / 2;
        const x = cx + (r + 3) * Math.cos(a);
        const y = cy + (r + 3) * Math.sin(a);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
      ctx.fill();

      // Main pentagon body
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = (i * 2 * Math.PI) / 5 - Math.PI / 2;
        const x = cx + r * Math.cos(a);
        const y = cy + r * Math.sin(a);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = secondaryColor;
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 4;
      ctx.stroke();

      // Inner high-contrast spin chevrons / aerodynamic accents
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.38, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = primaryColor;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.18, 0, Math.PI * 2);
      ctx.fill();
    };

    // Staggered pattern of 32-panel pentagons across UV space
    const r = 48;
    for (let row = 0; row < 5; row++) {
      const y = (row + 0.5) * (canvas.height / 5);
      const xOffset = (row % 2) * 102;
      for (let x = xOffset; x < canvas.width + 100; x += 204) {
        drawPentagon(x, y, r);
      }
    }

    // Thermobonded aerodynamic seam grooves connecting panels
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.45)';
    ctx.lineWidth = 3;
    for (let row = 0; row < 5; row++) {
      const y = (row + 0.5) * (canvas.height / 5);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Outer seam border
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    return tex;
  }

  /**
   * Procedural Grass canvas color texture with rich lush turf blades and moisture variation
   */
  /**
   * Neutral-gray grass detail (mean ~50% gray) used as a multiplier over the baked surface.
   */
  private createGrassDetailTexture(): THREE.CanvasTexture {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'rgb(128,128,128)';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 5000; i++) {
      const v = Math.floor(96 + Math.random() * 64);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.globalAlpha = 0.5;
      ctx.fillRect(Math.random() * size, Math.random() * size, 1.5, 2 + Math.random() * 5);
    }
    ctx.globalAlpha = 1.0;
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    return tex;
  }

  /**
   * High-contrast procedural bump map texture for lush turf depth
   */
  private createGrassBumpTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Mid-gray baseline
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, 512, 512);

    // Noise fibers for blade heights
    for (let i = 0; i < 9000; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const val = Math.floor(Math.random() * 180 + 75);
      ctx.fillStyle = `rgb(${val},${val},${val})`;
      ctx.globalAlpha = 0.45;
      ctx.fillRect(x, y, 2, Math.random() * 5 + 2);
    }
    ctx.globalAlpha = 1.0;

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(28, 28);
    tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    return tex;
  }

  /**
   * Procedural Regulation Tournament Flag Texture
   */
  public createFlagTexture(holeNumber: number = 1): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 320;
    const ctx = canvas.getContext('2d')!;

    // Vibrant regulation flag red base with subtle luxury fabric weave gradient
    const grad = ctx.createLinearGradient(0, 0, 512, 320);
    grad.addColorStop(0, '#dc2626');
    grad.addColorStop(0.5, '#ef4444');
    grad.addColorStop(1, '#b91c1c');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 320);

    // Subtle micro-weave canvas fabric texture
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.06;
    for (let y = 0; y < 320; y += 4) {
      ctx.fillRect(0, y, 512, 2);
    }
    for (let x = 0; x < 512; x += 4) {
      ctx.fillRect(x, 0, 2, 320);
    }
    ctx.globalAlpha = 1.0;

    // Checkered championship bottom trim
    const checkSize = 16;
    for (let x = 0; x < 512; x += checkSize) {
      for (let y = 320 - checkSize * 2; y < 320; y += checkSize) {
        const isBlack = ((x / checkSize) + (y / checkSize)) % 2 === 0;
        ctx.fillStyle = isBlack ? '#0f172a' : '#f8fafc';
        ctx.fillRect(x, y, checkSize, checkSize);
      }
    }

    // Top gold trim piping
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(0, 0, 512, 8);

    // Left reinforced hoist sleeve (navy with gold grommet rings)
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 36, 320);

    // Grommet rings on hoist
    const drawGrommet = (gy: number) => {
      ctx.beginPath();
      ctx.arc(18, gy, 9, 0, Math.PI * 2);
      ctx.fillStyle = '#e2e8f0';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(18, gy, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#0f172a';
      ctx.fill();
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2;
      ctx.stroke();
    };
    drawGrommet(35);
    drawGrommet(285);

    // Center Tournament Crest / Shield
    const cx = 270;
    const cy = 145;

    // White disc background
    ctx.beginPath();
    ctx.arc(cx, cy, 78, 0, Math.PI * 2);
    ctx.fillStyle = '#f8fafc';
    ctx.fill();
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 7;
    ctx.stroke();

    // Inner gold ring
    ctx.beginPath();
    ctx.arc(cx, cy, 70, 0, Math.PI * 2);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Header text
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 20px "Inter", "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('HOLE', cx, cy - 38);

    // Huge bold Hole Number
    ctx.fillStyle = '#dc2626';
    ctx.font = '900 64px "Inter", "Segoe UI", system-ui, sans-serif';
    ctx.fillText(String(holeNumber), cx, cy + 10);

    // Tournament star sub-label
    ctx.fillStyle = '#d97706';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText('★ CHAMPIONSHIP ★', cx, cy + 50);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    return tex;
  }

  /**
   * Update the flag cloth texture when hole changes
   */
  public updateFlagTexture(holeNumber: number) {
    if (this.flagTexture) this.flagTexture.dispose();
    this.flagTexture = this.createFlagTexture(holeNumber);
    if (this.flagCloth && (this.flagCloth.material as THREE.MeshStandardMaterial).map) {
      (this.flagCloth.material as THREE.MeshStandardMaterial).map = this.flagTexture;
      (this.flagCloth.material as THREE.MeshStandardMaterial).needsUpdate = true;
    }
  }

  /**
   * Construct 3D Terrain mesh using course contours and hole features
   */
  private buildTerrain(course: CourseData, hole: HoleData) {
    if (this.terrainMesh) {
      this.scene.remove(this.terrainMesh);
      this.terrainMesh.geometry.dispose();
      (this.terrainMesh.material as THREE.Material).dispose();
    }

    const sizeX = 260;
    const sizeZ = 420;
    const segX = this.isSoftwareGl ? 64 : 110;
    const segZ = this.isSoftwareGl ? 90 : 160;

    const geom = new THREE.PlaneGeometry(sizeX, sizeZ, segX, segZ);
    geom.rotateX(-Math.PI / 2);

    const posAttr = geom.attributes.position as THREE.BufferAttribute;
    const colorAttr = new Float32Array(posAttr.count * 3);

    const colRough = new THREE.Color(course.roughColor);
    const colFairway = new THREE.Color(course.fairwayColor);
    const colGreen = new THREE.Color(course.greenColor);
    const colSand = new THREE.Color(course.sandColor);
    const colWater = new THREE.Color(course.waterColor);
    const colTee = new THREE.Color('#388e3c');

    const tempCol = new THREE.Color();
    const palette = { colRough, colFairway, colGreen, colSand, colWater, colTee };

    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const z = posAttr.getZ(i) + hole.pinPosition.z * 0.45; // center grid along hole path
      posAttr.setZ(i, z);

      const h = getTerrainHeight(hole, x, z);
      posAttr.setY(i, this.sampleSurface(hole, palette, x, z, h, tempCol));

      colorAttr[i * 3] = tempCol.r;
      colorAttr[i * 3 + 1] = tempCol.g;
      colorAttr[i * 3 + 2] = tempCol.b;
    }

    geom.setAttribute('color', new THREE.BufferAttribute(colorAttr, 3));
    geom.computeVertexNormals();

    // Planar UVs across the whole terrain for the baked surface map
    const zMin = hole.pinPosition.z * 0.45 - sizeZ / 2;
    const uvAttr = geom.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < posAttr.count; i++) {
      uvAttr.setXY(i, (posAttr.getX(i) + sizeX / 2) / sizeX, 1 - (posAttr.getZ(i) - zMin) / sizeZ);
    }
    uvAttr.needsUpdate = true;

    this.surfaceTexture?.dispose();
    this.surfaceTexture = this.bakeSurfaceTexture(hole, palette, sizeX, sizeZ, zMin);

    const mat = new THREE.MeshStandardMaterial({
      map: this.surfaceTexture,
      roughness: 0.86,
      metalness: 0.0,
      bumpMap: this.grassBumpTexture,
      bumpScale: 0.05,
    });
    this.applyTerrainDetail(mat);

    this.terrainMesh = new THREE.Mesh(geom, mat);
    this.terrainMesh.receiveShadow = !this.isSoftwareGl;
    this.scene.add(this.terrainMesh);

    // Build shimmering translucent water surfaces with shoreline foam
    while (this.waterGroup.children.length > 0) {
      const wChild = this.waterGroup.children[0] as THREE.Mesh;
      this.waterGroup.remove(wChild);
      if (wChild.geometry) wChild.geometry.dispose();
      if (wChild.material) (wChild.material as THREE.Material).dispose();
    }

    for (const wt of hole.waters) {
      const maxR = Math.max(wt.rx, wt.rz);
      const waterGeom = new THREE.CircleGeometry(maxR, 36);
      waterGeom.rotateX(-Math.PI / 2);
      waterGeom.scale(wt.rx / maxR, 1, wt.rz / maxR);
      const waterNormals = this.getWaterNormalTexture();
      const waterMat = new THREE.MeshStandardMaterial({
        color: course.theme === 'japanese_garden' ? 0x0b5f8a : 0x0a6fa8,
        roughness: 0.08,
        metalness: 0.1,
        normalMap: waterNormals,
        normalScale: new THREE.Vector2(0.35, 0.35),
        envMapIntensity: 2.2,
        transparent: true,
        opacity: 0.92,
      });
      const waterMesh = new THREE.Mesh(waterGeom, waterMat);
      waterMesh.position.set(wt.x, -0.15, wt.z);
      this.waterGroup.add(waterMesh);

      // Shoreline surf foam rim around water hazard perimeter
      const foamGeom = new THREE.RingGeometry(maxR * 0.93, maxR * 1.04, 36);
      foamGeom.rotateX(-Math.PI / 2);
      foamGeom.scale(wt.rx / maxR, 1, wt.rz / maxR);
      const foamMat = new THREE.MeshBasicMaterial({
        color: 0xe0f2fe,
        transparent: true,
        opacity: 0.52,
        side: THREE.DoubleSide,
      });
      const foamMesh = new THREE.Mesh(foamGeom, foamMat);
      foamMesh.position.set(wt.x, -0.13, wt.z);
      this.waterGroup.add(foamMesh);
    }
  }

  private surfaceTexture: THREE.CanvasTexture | null = null;

  /**
   * Bakes the course surface (fairway stripes, greens, bunkers, water, tee) into a texture
   * at a resolution set by the quality tier. Texels are about 0.3-1 m, so feature edges stay
   * sharp instead of blending across ~5 m terrain triangles.
   */
  private bakeSurfaceTexture(
    hole: HoleData,
    palette: Parameters<FootGolfRenderer['sampleSurface']>[1],
    sizeX: number,
    sizeZ: number,
    zMin: number
  ): THREE.CanvasTexture {
    const width = this.qualitySettings.tier === 'high' ? 768 : this.qualitySettings.tier === 'medium' ? 512 : 256;
    const height = Math.round((width * sizeZ) / sizeX);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    const image = ctx.createImageData(width, height);
    const data = image.data;
    const c = new THREE.Color();

    for (let row = 0; row < height; row++) {
      const z = zMin + ((row + 0.5) / height) * sizeZ;
      for (let col = 0; col < width; col++) {
        const x = -sizeX / 2 + ((col + 0.5) / width) * sizeX;
        this.sampleSurface(hole, palette, x, z, 0, c);
        c.convertLinearToSRGB();
        const o = (row * width + col) * 4;
        data[o] = Math.max(0, Math.min(255, c.r * 255));
        data[o + 1] = Math.max(0, Math.min(255, c.g * 255));
        data[o + 2] = Math.max(0, Math.min(255, c.b * 255));
        data[o + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    return tex;
  }

  /**
   * Multiplies a tiling, neutral-gray grass detail texture over the terrain's base color,
   * so close-up ground shows blades and variation without a large unique texture.
   */
  private applyTerrainDetail(mat: THREE.MeshStandardMaterial) {
    const detail = this.grassTexture;
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.detailMap = { value: detail };
      shader.uniforms.detailRepeat = { value: new THREE.Vector2(130, 210) };
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          '#include <common>\nuniform sampler2D detailMap;\nuniform vec2 detailRepeat;'
        )
        .replace(
          '#include <map_fragment>',
          `#include <map_fragment>
          float detailLum = texture2D(detailMap, vMapUv * detailRepeat).r;
          diffuseColor.rgb *= mix(1.0, detailLum * 2.0, 0.55);`
        );
    };
    mat.customProgramCacheKey = () => 'terrain-detail-v1';
  }

  private waterNormalTexture: THREE.CanvasTexture | null = null;

  /**
   * Tiling ripple normal map built from layered sine waves. Scrolled every frame so
   * water reflects the sky with moving ripples at the cost of one texture.
   */
  private getWaterNormalTexture(): THREE.CanvasTexture {
    if (this.waterNormalTexture) return this.waterNormalTexture;
    const size = 128;
    const heights = new Float32Array(size * size);
    const tau = Math.PI * 2;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        heights[y * size + x] =
          Math.sin(tau * (u * 3 + v * 2)) * 0.5 +
          Math.sin(tau * (u * -5 + v * 4) + 1.3) * 0.3 +
          Math.sin(tau * (u * 7 - v * 9) + 2.1) * 0.2;
      }
    }
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const img = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const hL = heights[y * size + ((x - 1 + size) % size)];
        const hR = heights[y * size + ((x + 1) % size)];
        const hD = heights[((y - 1 + size) % size) * size + x];
        const hU = heights[((y + 1) % size) * size + x];
        const nx = (hL - hR) * 2.0;
        const ny = (hD - hU) * 2.0;
        const len = Math.hypot(nx, ny, 1);
        const o = (y * size + x) * 4;
        img.data[o] = ((nx / len) * 0.5 + 0.5) * 255;
        img.data[o + 1] = ((ny / len) * 0.5 + 0.5) * 255;
        img.data[o + 2] = ((1 / len) * 0.5 + 0.5) * 255;
        img.data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(6, 6);
    this.waterNormalTexture = tex;
    return tex;
  }

  private grassTufts: THREE.InstancedMesh | null = null;
  private grassUniforms = { uTime: { value: 0 }, uWind: { value: new THREE.Vector2(0.4, 0.2) } };

  /**
   * Scatters instanced grass tufts across the rough along the hole corridor (medium and
   * high tiers). Each tuft is three crossed blades; all tufts are one draw call, and a
   * vertex shader sways blade tips with the wind.
   */
  private buildGrassTufts(hole: HoleData) {
    if (this.grassTufts) {
      this.scene.remove(this.grassTufts);
      this.grassTufts.geometry.dispose();
      (this.grassTufts.material as THREE.Material).dispose();
      this.grassTufts = null;
    }
    const tier = this.qualitySettings.tier;
    if (tier === 'low') return;
    const target = tier === 'high' ? 3500 : 1600;

    // Three blades, each a thin triangle, rotated around the tuft center
    const positions: number[] = [];
    const heights: number[] = [];
    for (let b = 0; b < 3; b++) {
      const a = (b / 3) * Math.PI;
      const cx = Math.cos(a);
      const cz = Math.sin(a);
      const w = 0.055;
      positions.push(-cx * w, 0, -cz * w, cx * w, 0, cz * w, cx * 0.02, 0.24, cz * 0.02);
      heights.push(0, 0, 1);
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute('bladeHeight', new THREE.Float32BufferAttribute(heights, 1));
    geom.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      color: this.activeCourse?.theme === 'desert' ? 0x6b7a35 : 0x356b2c,
      roughness: 0.9,
      side: THREE.DoubleSide,
    });
    const uniforms = this.grassUniforms;
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uniforms.uTime;
      shader.uniforms.uWind = uniforms.uWind;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float bladeHeight;\nuniform float uTime;\nuniform vec2 uWind;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          vec4 tuftOrigin = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          float sway = sin(uTime * 2.2 + tuftOrigin.x * 0.35 + tuftOrigin.z * 0.27) * 0.5 + 0.5;
          transformed.xz += uWind * bladeHeight * bladeHeight * (0.35 + sway * 0.65) * 0.12;`
        );
    };
    mat.customProgramCacheKey = () => 'grass-tufts-v1';

    const mesh = new THREE.InstancedMesh(geom, mat, target);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const posV = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const tee = hole.teePosition;
    const pin = hole.pinPosition;
    const len = Math.hypot(pin.x - tee.x, pin.z - tee.z) || 1;
    let placed = 0;
    let seed = hole.number * 9301 + 49297;
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    for (let attempt = 0; attempt < target * 6 && placed < target; attempt++) {
      // Sample along the tee-to-pin corridor, up to 45 m either side
      const t = rand() * 1.15 - 0.05;
      const side = (rand() - 0.5) * 90;
      const x = tee.x + ((pin.x - tee.x) * t) + (-(pin.z - tee.z) / len) * side;
      const z = tee.z + ((pin.z - tee.z) * t) + ((pin.x - tee.x) / len) * side;
      if (getSurfaceLie(hole, x, z) !== 'rough') continue;
      posV.set(x, getTerrainHeight(hole, x, z) - 0.02, z);
      q.setFromAxisAngle(up, rand() * Math.PI * 2);
      const sz = 0.7 + rand() * 0.8;
      scale.set(sz, sz * (0.8 + rand() * 0.6), sz);
      m.compose(posV, q, scale);
      mesh.setMatrixAt(placed++, m);
    }
    mesh.count = placed;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.receiveShadow = true;
    this.grassTufts = mesh;
    this.scene.add(mesh);
  }

  /**
   * Surface color and rendered height at a point. Shared by terrain vertices and the
   * baked surface texture so both agree with the physics boundaries in getSurfaceLie.
   */
  private static readonly COLLAR_COLOR = new THREE.Color('#1e4e26');
  private static readonly BUNKER_LIP_COLOR = new THREE.Color('#274e13');
  private _surfScratchA = new THREE.Color();
  private _surfScratchB = new THREE.Color();

  private sampleSurface(
    hole: HoleData,
    palette: { colRough: THREE.Color; colFairway: THREE.Color; colGreen: THREE.Color; colSand: THREE.Color; colWater: THREE.Color; colTee: THREE.Color },
    x: number,
    z: number,
    h: number,
    out: THREE.Color
  ): number {
    const { colRough, colFairway, colGreen, colSand, colWater, colTee } = palette;
    let y = h;
    // Determine vertex color based on terrain feature
    out.copy(colRough);

    // Fairways with championship cross-cut diamond mower striping
    for (const fw of hole.fairways) {
      const dx = (x - fw.x) / fw.rx;
      const dz = (z - fw.z) / fw.rz;
      const dSq = dx * dx + dz * dz;
      if (dSq <= 1.0) {
        // Crisp ~1.2 m mown edge that matches the physics boundary
        const edgeMeters = (1 - Math.sqrt(dSq)) * Math.min(fw.rx, fw.rz);
        const blend = Math.min(1, edgeMeters / 1.2);
        // Two-axis diagonal diamond mowing pattern
        const s1 = Math.sin((x * 0.707 + z * 0.707) * 0.65);
        const s2 = Math.sin((-x * 0.707 + z * 0.707) * 0.65);
        const stripe = (s1 * s2 > 0 ? 0.045 : -0.045);
        const stripedFairway = this._surfScratchA.copy(colFairway);
        stripedFairway.r = Math.max(0, Math.min(1, stripedFairway.r + stripe * 0.5));
        stripedFairway.g = Math.max(0, Math.min(1, stripedFairway.g + stripe));
        stripedFairway.b = Math.max(0, Math.min(1, stripedFairway.b + stripe * 0.35));
        out.lerp(stripedFairway, blend);
      }
    }

    // Greens & Manicured Collar / Fringe
    for (const gr of hole.greens) {
      const dist = Math.sqrt((x - gr.x) ** 2 + (z - gr.z) ** 2);
      if (dist <= gr.radius) {
        const blend = Math.min(1, (gr.radius - dist) / 0.6);
        out.lerp(colGreen, blend * 0.96);
      } else if (dist <= gr.radius + 1.8) {
        // Manicured Green Apron / Collar
        const collarBlend = 1 - (dist - gr.radius) / 1.8;
        const colCollar = FootGolfRenderer.COLLAR_COLOR;
        out.lerp(colCollar, collarBlend * 0.75);
      }
    }

    // Bunkers with sculpted raised turf lips and depressed sand basin
    for (const bk of hole.bunkers) {
      const dx = (x - bk.x) / bk.rx;
      const dz = (z - bk.z) / bk.rz;
      const dSq = dx * dx + dz * dz;
      if (dSq <= 1.35) {
        if (dSq <= 1.0) {
          // Sand basin with raked ripples
          const sandRake = Math.sin((x + z * 0.5) * 5.0) * 0.025;
          const rakedSand = this._surfScratchB.copy(colSand);
          rakedSand.r += sandRake;
          rakedSand.g += sandRake * 0.9;
          out.lerp(rakedSand, 0.95);
          y = (h - 0.38);
        } else {
          // Sculpted bunker turf lip
          const lipFactor = Math.sin(((Math.sqrt(dSq) - 1.0) / (Math.sqrt(1.35) - 1.0)) * Math.PI);
          y = (h + 0.22 * lipFactor);
          out.lerp(FootGolfRenderer.BUNKER_LIP_COLOR, lipFactor * 0.45);
        }
      }
    }

    // Water hazard depression
    for (const wt of hole.waters) {
      const dx = (x - wt.x) / wt.rx;
      const dz = (z - wt.z) / wt.rz;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d <= 1.0) {
        out.lerp(colWater, 0.95);
      }
      // Smooth bank so the water plane meets the ground along a clean curve
      if (d <= 1.35) {
        const t = Math.min(1, Math.max(0, (1.35 - d) / 0.45));
        const bank = t * t * (3 - 2 * t);
        y = Math.min(y, h + (-0.45 - h) * bank);
      }
    }

    // Tee Box
    const toTee = Math.sqrt((x - hole.teePosition.x) ** 2 + (z - hole.teePosition.z) ** 2);
    if (toTee < 3.0) {
      out.lerp(colTee, 0.9);
    }

    return y;
  }

  /**
   * Builds 3-12 part procedural trees, boulders, tee markers, and yardage posts
   */
  private buildProps(hole: HoleData) {
    // Clear old props (including nested geometries and materials)
    disposeChildren(this.propGroup);

    // 1. Multi-part Trees (Pine or Palm)
    for (const tree of hole.trees) {
      const y = getTerrainHeight(hole, tree.x, tree.z);
      const treeGroup = new THREE.Group();
      treeGroup.position.set(tree.x, y, tree.z);
      const s = tree.scale || 1.0;

      if (tree.type === 'palm') {
        // Multi-part Palm: Curved trunk cylinder segments, coconut cluster, 6 fronds
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.9 });
        const frondMat = new THREE.MeshStandardMaterial({ color: 0x388e3c, roughness: 0.7, side: THREE.DoubleSide });

        // Segmented Trunk
        const trunkGeom = new THREE.CylinderGeometry(0.2 * s, 0.35 * s, 4.5 * s, 8);
        trunkGeom.translate(0, 2.25 * s, 0);
        const trunkMesh = new THREE.Mesh(trunkGeom, trunkMat);
        trunkMesh.castShadow = !this.isSoftwareGl;
        treeGroup.add(trunkMesh);

        // Coconuts
        const cocoMat = new THREE.MeshStandardMaterial({ color: 0x4e342e, roughness: 0.8 });
        for (let c = 0; c < 3; c++) {
          const cocoGeom = new THREE.SphereGeometry(0.12 * s, 6, 6);
          const ang = (c * 2 * Math.PI) / 3;
          cocoGeom.translate(Math.cos(ang) * 0.25 * s, 4.3 * s, Math.sin(ang) * 0.25 * s);
          treeGroup.add(new THREE.Mesh(cocoGeom, cocoMat));
        }

        // Drooping Fronds
        for (let f = 0; f < 6; f++) {
          const angle = (f * 2 * Math.PI) / 6;
          const frondGeom = new THREE.ConeGeometry(0.5 * s, 2.8 * s, 5);
          frondGeom.rotateZ(Math.PI / 2.6);
          frondGeom.rotateY(angle);
          frondGeom.translate(0, 4.5 * s, 0);
          const frondMesh = new THREE.Mesh(frondGeom, frondMat);
          frondMesh.castShadow = !this.isSoftwareGl;
          treeGroup.add(frondMesh);
        }
      } else if (tree.type === 'sakura') {
        // Multi-part Japanese Sakura Tree: Gnarled trunk + 3 layered pastel blossom tiers
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.95 });
        const blossomMat1 = new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.75, side: THREE.DoubleSide });
        const blossomMat2 = new THREE.MeshStandardMaterial({ color: 0xfbcfe8, roughness: 0.75, side: THREE.DoubleSide });
        const blossomMat3 = new THREE.MeshStandardMaterial({ color: 0xfce7f3, roughness: 0.75, side: THREE.DoubleSide });

        const trunkGeom = new THREE.CylinderGeometry(0.24 * s, 0.42 * s, 2.5 * s, 8);
        trunkGeom.translate(0, 1.25 * s, 0);
        const trunk = new THREE.Mesh(trunkGeom, trunkMat);
        trunk.castShadow = !this.isSoftwareGl;
        treeGroup.add(trunk);

        // Tier 1 (bottom canopy)
        const c1Geom = new THREE.DodecahedronGeometry(2.1 * s, 1);
        c1Geom.scale(1.25, 0.7, 1.15);
        c1Geom.translate(0, 2.8 * s, 0);
        const m1 = new THREE.Mesh(c1Geom, blossomMat1);
        m1.castShadow = !this.isSoftwareGl;
        treeGroup.add(m1);

        // Tier 2 (middle canopy)
        const c2Geom = new THREE.DodecahedronGeometry(1.65 * s, 1);
        c2Geom.scale(1.15, 0.75, 1.1);
        c2Geom.translate(0, 3.9 * s, 0);
        const m2 = new THREE.Mesh(c2Geom, blossomMat2);
        m2.castShadow = !this.isSoftwareGl;
        treeGroup.add(m2);

        // Tier 3 (top canopy crown)
        const c3Geom = new THREE.DodecahedronGeometry(1.15 * s, 1);
        c3Geom.scale(1.0, 0.8, 1.0);
        c3Geom.translate(0, 4.8 * s, 0);
        const m3 = new THREE.Mesh(c3Geom, blossomMat3);
        m3.castShadow = !this.isSoftwareGl;
        treeGroup.add(m3);
      } else {
        // Multi-part Pine: Tapered trunk + 3 layered conical foliage tiers
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.95 });
        const foliageMat = new THREE.MeshStandardMaterial({ color: 0x1b4332, roughness: 0.8 });

        const trunkGeom = new THREE.CylinderGeometry(0.22 * s, 0.38 * s, 2.2 * s, 8);
        trunkGeom.translate(0, 1.1 * s, 0);
        const trunk = new THREE.Mesh(trunkGeom, trunkMat);
        trunk.castShadow = !this.isSoftwareGl;
        treeGroup.add(trunk);

        // Tier 1 (bottom)
        const t1 = new THREE.ConeGeometry(2.0 * s, 2.8 * s, 8);
        t1.translate(0, 2.8 * s, 0);
        const m1 = new THREE.Mesh(t1, foliageMat);
        m1.castShadow = !this.isSoftwareGl;
        treeGroup.add(m1);

        // Tier 2 (middle)
        const t2 = new THREE.ConeGeometry(1.5 * s, 2.4 * s, 8);
        t2.translate(0, 4.2 * s, 0);
        const m2 = new THREE.Mesh(t2, foliageMat);
        m2.castShadow = !this.isSoftwareGl;
        treeGroup.add(m2);

        // Tier 3 (top peak)
        const t3 = new THREE.ConeGeometry(1.0 * s, 2.0 * s, 8);
        t3.translate(0, 5.5 * s, 0);
        const m3 = new THREE.Mesh(t3, foliageMat);
        m3.castShadow = !this.isSoftwareGl;
        treeGroup.add(m3);
      }

      this.propGroup.add(treeGroup);
    }

    // 2. Multi-faceted Boulders
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.9, flatShading: true });
    for (const rock of hole.rocks) {
      const y = getTerrainHeight(hole, rock.x, rock.z);
      const s = rock.scale || 1.0;
      const rockGeom = new THREE.DodecahedronGeometry(0.85 * s, 1);
      rockGeom.scale(1.2, 0.75, 1.0);
      const rockMesh = new THREE.Mesh(rockGeom, rockMat);
      rockMesh.position.set(rock.x, y + 0.3 * s, rock.z);
      rockMesh.castShadow = !this.isSoftwareGl;
      this.propGroup.add(rockMesh);
    }

    // 3. Championship Tee Markers (marble bases with finial spheres)
    const teeY = getTerrainHeight(hole, hole.teePosition.x, hole.teePosition.z);
    const baseGeom = new THREE.CylinderGeometry(0.24, 0.3, 0.08, 16);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.3, metalness: 0.2 });

    const teeBallMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.25, metalness: 0.5 });
    const teeBallGeom = new THREE.SphereGeometry(0.18, 16, 16);

    const leftBase = new THREE.Mesh(baseGeom, baseMat);
    leftBase.position.set(hole.teePosition.x - 2.2, teeY + 0.04, hole.teePosition.z);
    const leftBall = new THREE.Mesh(teeBallGeom, teeBallMat);
    leftBall.position.set(hole.teePosition.x - 2.2, teeY + 0.22, hole.teePosition.z);
    leftBall.castShadow = !this.isSoftwareGl;
    this.propGroup.add(leftBase);
    this.propGroup.add(leftBall);

    const rightBase = new THREE.Mesh(baseGeom, baseMat);
    rightBase.position.set(hole.teePosition.x + 2.2, teeY + 0.04, hole.teePosition.z);
    const rightBall = new THREE.Mesh(teeBallGeom, teeBallMat);
    rightBall.position.set(hole.teePosition.x + 2.2, teeY + 0.22, hole.teePosition.z);
    rightBall.castShadow = !this.isSoftwareGl;
    this.propGroup.add(rightBase);
    this.propGroup.add(rightBall);

    // 4. Tournament Yardage Signpost beside tee
    const signGroup = new THREE.Group();
    const postGeom = new THREE.CylinderGeometry(0.04, 0.05, 1.1, 8);
    postGeom.translate(0, 0.55, 0);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 });
    signGroup.add(new THREE.Mesh(postGeom, postMat));

    const boardGeom = new THREE.BoxGeometry(0.65, 0.45, 0.04);
    boardGeom.translate(0, 1.05, 0);
    const boardMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4, metalness: 0.3 });
    signGroup.add(new THREE.Mesh(boardGeom, boardMat));

    const plateGeom = new THREE.PlaneGeometry(0.58, 0.38);
    plateGeom.translate(0, 1.05, 0.025);
    const plateMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.25, metalness: 0.8 });
    signGroup.add(new THREE.Mesh(plateGeom, plateMat));

    signGroup.position.set(hole.teePosition.x + 3.2, teeY, hole.teePosition.z);
    signGroup.rotation.y = hole.defaultAimAngle;
    this.propGroup.add(signGroup);

    // 5. Fairway Distance Stakes (100m, 150m, 200m from pin)
    const pin = hole.pinPosition;
    const tee = hole.teePosition;
    const dx = tee.x - pin.x;
    const dz = tee.z - pin.z;
    const totalDist = Math.hypot(dx, dz);

    const stakes = [
      { dist: 100, color: 0xef4444 }, // Red: 100m
      { dist: 150, color: 0xf8fafc }, // White: 150m
      { dist: 200, color: 0x3b82f6 }, // Blue: 200m
    ];

    for (const stake of stakes) {
      if (totalDist > stake.dist + 15) {
        const frac = stake.dist / totalDist;
        const sx = pin.x + dx * frac + 8.5; // placed along right fairway border
        const sz = pin.z + dz * frac;
        const sy = getTerrainHeight(hole, sx, sz);

        const stakeGroup = new THREE.Group();
        stakeGroup.position.set(sx, sy, sz);

        const sPost = new THREE.Mesh(
          new THREE.CylinderGeometry(0.04, 0.04, 1.0, 8),
          new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 })
        );
        sPost.position.y = 0.5;
        stakeGroup.add(sPost);

        const sCap = new THREE.Mesh(
          new THREE.CylinderGeometry(0.05, 0.05, 0.3, 8),
          new THREE.MeshStandardMaterial({ color: stake.color, roughness: 0.3, metalness: 0.2 })
        );
        sCap.position.y = 0.85;
        stakeGroup.add(sCap);

        this.propGroup.add(stakeGroup);
      }
    }

    // 5b. Inlaid Championship Fairway Yardage Ground Markers (100m, 150m, 200m)
    for (const stake of stakes) {
      if (totalDist > stake.dist + 15) {
        const frac = stake.dist / totalDist;
        const fx = pin.x + dx * frac; // along fairway centerline
        const fz = pin.z + dz * frac;
        const fy = getTerrainHeight(hole, fx, fz);

        const discGroup = new THREE.Group();
        discGroup.position.set(fx, fy + 0.025, fz);

        // Outer bronze/steel bezel ring
        const outerRing = new THREE.Mesh(
          new THREE.RingGeometry(0.38, 0.48, 24),
          new THREE.MeshStandardMaterial({
            color: 0xd97706,
            roughness: 0.35,
            metalness: 0.8,
            side: THREE.DoubleSide,
          })
        );
        outerRing.rotateX(-Math.PI / 2);
        discGroup.add(outerRing);

        // Inner colored enamel disc
        const innerDisc = new THREE.Mesh(
          new THREE.CircleGeometry(0.38, 24),
          new THREE.MeshStandardMaterial({
            color: stake.color,
            roughness: 0.25,
            metalness: 0.5,
            side: THREE.DoubleSide,
          })
        );
        innerDisc.rotateX(-Math.PI / 2);
        discGroup.add(innerDisc);

        // Center core pip
        const pip = new THREE.Mesh(
          new THREE.CylinderGeometry(0.08, 0.08, 0.02, 16),
          new THREE.MeshStandardMaterial({
            color: 0x0f172a,
            roughness: 0.3,
            metalness: 0.7,
          })
        );
        pip.position.y = 0.01;
        discGroup.add(pip);

        this.propGroup.add(discGroup);
      }
    }

    // 6. Course-Themed Atmospheric Props
    if (this.activeCourse?.theme === 'japanese_garden') {
      // Procedural Japanese Stone Lanterns (Toro) flanking greens, ponds, and bridges
      const stoneMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.9, flatShading: true });
      const fireMat = new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.85,
        roughness: 0.3,
      });
      const roofMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.8, flatShading: true });

      const lanternLocations: { x: number; z: number }[] = [];
      lanternLocations.push({ x: hole.pinPosition.x - 7.5, z: hole.pinPosition.z - 3.5 });
      lanternLocations.push({ x: hole.pinPosition.x + 7.5, z: hole.pinPosition.z + 4.5 });
      for (const wt of hole.waters) {
        lanternLocations.push({ x: wt.x + wt.rx * 0.92 + 2.0, z: wt.z });
      }

      for (const loc of lanternLocations) {
        const ly = getTerrainHeight(hole, loc.x, loc.z);
        const toro = new THREE.Group();
        toro.position.set(loc.x, ly, loc.z);

        // Pedestal base
        const base = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.22, 0.55), stoneMat);
        base.position.y = 0.11;
        toro.add(base);

        // Column shaft
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.65, 6), stoneMat);
        shaft.position.y = 0.54;
        toro.add(shaft);

        // Middle stone platform
        const platform = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.28, 0.15, 6), stoneMat);
        platform.position.y = 0.94;
        toro.add(platform);

        // Light box / fire chamber with warm ember glow
        const lightBox = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.32, 0.34), fireMat);
        lightBox.position.y = 1.18;
        toro.add(lightBox);

        // Pagoda roof
        const roof = new THREE.Mesh(new THREE.ConeGeometry(0.58, 0.32, 4), roofMat);
        roof.position.y = 1.48;
        roof.rotation.y = Math.PI / 4;
        toro.add(roof);

        // Top finial jewel
        const jewel = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), stoneMat);
        jewel.position.y = 1.68;
        toro.add(jewel);

        this.propGroup.add(toro);
      }
    } else if (this.activeCourse?.theme === 'desert') {
      // Ancient Desert Stone Cairns (stacked flat riverbed rocks)
      const cairnMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.95, flatShading: true });
      const cairnLocations = [
        { x: hole.teePosition.x - 3.8, z: hole.teePosition.z + 1.5 },
        { x: hole.pinPosition.x + 8.5, z: hole.pinPosition.z - 2.0 },
      ];
      for (const loc of cairnLocations) {
        const cy = getTerrainHeight(hole, loc.x, loc.z);
        const cairn = new THREE.Group();
        cairn.position.set(loc.x, cy, loc.z);

        const r1 = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 0.22, 7), cairnMat);
        r1.position.y = 0.11;
        cairn.add(r1);

        const r2 = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.2, 7), cairnMat);
        r2.position.y = 0.31;
        r2.rotation.y = 0.5;
        cairn.add(r2);

        const r3 = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.18, 6), cairnMat);
        r3.position.y = 0.49;
        r3.rotation.y = 1.1;
        cairn.add(r3);

        const r4 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.14, 0), cairnMat);
        r4.position.y = 0.65;
        cairn.add(r4);

        this.propGroup.add(cairn);
      }
    } else if (this.activeCourse?.theme === 'alpine') {
      // Rustic Alpine Spectator Benches overlooking scenic views
      const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.85 });
      const stoneBenchMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.9 });
      const benchLocs = [
        { x: hole.teePosition.x + 4.5, z: hole.teePosition.z - 2.0, rot: hole.defaultAimAngle + Math.PI / 2 },
        { x: hole.pinPosition.x - 10.5, z: hole.pinPosition.z + 5.0, rot: Math.PI / 3 },
      ];
      for (const b of benchLocs) {
        const by = getTerrainHeight(hole, b.x, b.z);
        const bench = new THREE.Group();
        bench.position.set(b.x, by, b.z);
        bench.rotation.y = b.rot;

        const leg1 = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.42, 0.32), stoneBenchMat);
        leg1.position.set(-0.65, 0.21, 0);
        bench.add(leg1);

        const leg2 = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.42, 0.32), stoneBenchMat);
        leg2.position.set(0.65, 0.21, 0);
        bench.add(leg2);

        const seat = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 0.45), woodMat);
        seat.position.set(0, 0.45, 0);
        bench.add(seat);

        const back = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.25, 0.06), woodMat);
        back.position.set(0, 0.72, -0.2);
        bench.add(back);

        this.propGroup.add(bench);
      }
    }

    // Merge static, untextured prop meshes into one draw call per material
    this.lastPropBatch = batchStaticMeshes(this.propGroup);
  }

  private lastPropBatch: BatchResult = { meshesBefore: 0, meshesAfter: 0 };

  /** Draw-call diagnostics for the performance overlay and tests. */
  public getRenderStats() {
    const info = this.renderer.info;
    return {
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      propMeshesBefore: this.lastPropBatch.meshesBefore,
      propMeshesAfter: this.lastPropBatch.meshesAfter,
    };
  }

  /**
   * Set custom ball pattern and colors from locker room
   */
  public updateBallCustomization(primaryColor: string, secondaryColor: string) {
    this.ballTexture.dispose();
    this.ballTexture = this.createSoccerBallTexture(primaryColor, secondaryColor);
    (this.ballMesh.material as THREE.MeshStandardMaterial).map = this.ballTexture;
    (this.ballMesh.material as THREE.MeshStandardMaterial).needsUpdate = true;
  }

  /**
   * Set aerodynamic flight state
   */
  public setBallInFlight(inFlight: boolean) {
    this.isBallInFlight = inFlight;
    if (!inFlight) {
      this.flightTrailPositions = [];
      this.flightTrailNodes = [];
      this.flightTrailLine.visible = false;
      this.flightRibbonMesh.visible = false;
      if (this.activeHole) {
        const terrainH = getTerrainHeight(this.activeHole, this.ballGroup.position.x, this.ballGroup.position.z);
        this.playerCharacter.onBallStopped(this.ballGroup.position, this.aimAngleRad, terrainH);
      }
    } else {
      this.flightTrailPositions = [];
      this.flightTrailNodes = [];
    }
  }

  /**
   * Emit subtle aerodynamic wake vapor particles during flight
   */
  private emitFlightVapor(pos: Vector3D, vel: Vector3D, customColor?: THREE.Color) {
    if (this.particles.length >= this.maxParticles) {
      this.particles.shift();
    }
    const offset = 0.08;
    const pColor = customColor ? customColor.clone() : new THREE.Color(0xfef08a);
    this.particles.push({
      pos: new THREE.Vector3(
        pos.x + (Math.random() - 0.5) * offset,
        pos.y + (Math.random() - 0.5) * offset,
        pos.z + (Math.random() - 0.5) * offset
      ),
      vel: new THREE.Vector3(
        -vel.x * 0.08 + (Math.random() - 0.5) * 0.25,
        -vel.y * 0.08 + Math.random() * 0.2,
        -vel.z * 0.08 + (Math.random() - 0.5) * 0.25
      ),
      life: 0,
      maxLife: 0.32 + Math.random() * 0.18,
      color: pColor,
      size: 0.15 + Math.random() * 0.08,
    });
  }

  /**
   * Update 3D ball position, ground contact shadow, roll rotation, and flight trail
   */
  public setBallPosition(pos: Vector3D, spin?: Vector3D, vel?: Vector3D) {
    this.ballGroup.position.set(pos.x, pos.y, pos.z);

    // Dynamic ground contact shadow height scaling & fading
    if (this.activeHole) {
      const groundY = getTerrainHeight(this.activeHole, pos.x, pos.z);
      const heightAbove = Math.max(0, pos.y - (groundY + BALL_RADIUS));
      const shadowScale = Math.max(0.15, 1.0 - heightAbove * 0.08);
      this.ballShadow.scale.set(shadowScale, shadowScale, shadowScale);

      const shadowMat = this.ballShadow.material as THREE.MeshBasicMaterial;
      shadowMat.opacity = Math.max(0, 0.45 - heightAbove * 0.045);
      // Real shadow maps already draw the ball's shadow; keep the blob only without them
      this.ballShadow.visible = !this.renderer.shadowMap.enabled;
      this.ballShadow.position.y = -BALL_RADIUS - heightAbove + 0.012;
    }

    // Realistic roll rotation along movement direction
    if (vel) {
      const spd = Math.hypot(vel.x, vel.z);
      if (spd > 0.08) {
        const rollAngle = (spd * 0.016) / BALL_RADIUS;
        this.ballMesh.rotation.x += rollAngle * (vel.z / spd);
        this.ballMesh.rotation.z -= rollAngle * (vel.x / spd);
      }
    }

    // Ball axial spin (Magnus spin rotation clearly visible)
    if (spin) {
      this.ballMesh.rotation.y += spin.y * 0.035;
      this.ballMesh.rotation.x += spin.x * 0.02;
      this.ballMesh.rotation.z += spin.z * 0.02;
    }

    // Update in-flight aerodynamic 3D ribbon & center tracer line with dynamic power & spin colors
    if (this.isBallInFlight) {
      // 1. Dynamic Color & Width Modulation:
      // Computes instantaneous color from base theme, kick power, and active Magnus spin
      const liveSideSpin = spin && typeof spin.y === 'number' && spin.y !== 0
        ? THREE.MathUtils.clamp(spin.y / 24, -1, 1)
        : this.activeShotSpin.side;
      const liveTopSpin = spin && typeof spin.x === 'number' && spin.x !== 0
        ? THREE.MathUtils.clamp(spin.x / 18, -1, 1)
        : this.activeShotSpin.top;
      const liveSpeed = vel ? Math.hypot(vel.x, vel.y, vel.z) : 25;
      const speedFactor = Math.min(1.0, Math.max(0.2, liveSpeed / 24));
      const effectivePower = this.activeShotPower * speedFactor;
      const isPure = this.activeStrikeRating === 'pure';

      const sampleColor = calculateDynamicTrailColor(
        this.motionTrailConfig,
        effectivePower,
        liveSideSpin,
        liveTopSpin,
        isPure
      );

      const dynamicRibbonWidth = (this.motionTrailConfig.ribbonWidth || 0.16) *
        (1.0 + Math.max(0, effectivePower - 0.5) * 0.5);

      this.flightTrailNodes.unshift({
        pos: new THREE.Vector3(pos.x, pos.y, pos.z),
        color: sampleColor,
        width: dynamicRibbonWidth,
      });

      if (this.flightTrailNodes.length > this.flightTrailMax) {
        this.flightTrailNodes.pop();
      }

      const count = this.flightTrailNodes.length;
      if (count >= 2) {
        // 1. Center Tracer Line
        const posAttr = this.flightTrailGeom.attributes.position as THREE.BufferAttribute;
        const colAttr = this.flightTrailGeom.attributes.color as THREE.BufferAttribute;
        const array = posAttr.array as Float32Array;
        const colArray = colAttr.array as Float32Array;

        for (let i = 0; i < this.flightTrailMax; i++) {
          const node = i < count ? this.flightTrailNodes[i] : this.flightTrailNodes[count - 1];
          array[i * 3] = node.pos.x;
          array[i * 3 + 1] = node.pos.y;
          array[i * 3 + 2] = node.pos.z;

          const progress = i / count;
          const alpha = Math.max(0, 1 - progress);
          colArray[i * 3] = node.color.r * alpha;
          colArray[i * 3 + 1] = node.color.g * alpha;
          colArray[i * 3 + 2] = node.color.b * alpha;
        }

        posAttr.needsUpdate = true;
        colAttr.needsUpdate = true;
        this.flightTrailLine.visible = true;

        // 2. 3D Aerodynamic Quad Ribbon with Physical Width
        const rPosAttr = this.flightRibbonGeom.attributes.position as THREE.BufferAttribute;
        const rColAttr = this.flightRibbonGeom.attributes.color as THREE.BufferAttribute;
        const rPos = rPosAttr.array as Float32Array;
        const rCol = rColAttr.array as Float32Array;

        for (let i = 0; i < this.flightTrailMax; i++) {
          const curr = i < count ? this.flightTrailNodes[i] : this.flightTrailNodes[count - 1];
          const next = i + 1 < count ? this.flightTrailNodes[i + 1] : curr;

          let dx = next.pos.x - curr.pos.x;
          let dz = next.pos.z - curr.pos.z;
          const len = Math.hypot(dx, dz) || 0.001;
          dx /= len;
          dz /= len;

          const progress = i / count;
          const width = curr.width * Math.pow(Math.max(0, 1 - progress), 1.25);
          const px = -dz * width;
          const pz = dx * width;
          const py = 0.025 * (1 - progress);

          const v0 = i * 2;
          const v1 = i * 2 + 1;

          rPos[v0 * 3] = curr.pos.x + px;
          rPos[v0 * 3 + 1] = curr.pos.y + py;
          rPos[v0 * 3 + 2] = curr.pos.z + pz;

          rPos[v1 * 3] = curr.pos.x - px;
          rPos[v1 * 3 + 1] = curr.pos.y - py;
          rPos[v1 * 3 + 2] = curr.pos.z - pz;

          const alpha = Math.max(0, Math.pow(1 - progress, 1.35));
          rCol[v0 * 3] = curr.color.r * alpha;
          rCol[v0 * 3 + 1] = curr.color.g * alpha;
          rCol[v0 * 3 + 2] = curr.color.b * alpha;

          rCol[v1 * 3] = curr.color.r * alpha;
          rCol[v1 * 3 + 1] = curr.color.g * alpha;
          rCol[v1 * 3 + 2] = curr.color.b * alpha;
        }

        rPosAttr.needsUpdate = true;
        rColAttr.needsUpdate = true;
        this.flightRibbonMesh.visible = true;

        // 3. Vapor wake particles during flight matching modulated trail color
        if (vel) {
          const spd = Math.hypot(vel.x, vel.y, vel.z);
          if (spd > 7.0) {
            this.flightVaporCooldown = (this.flightVaporCooldown + 1) % 2;
            if (this.flightVaporCooldown === 0) {
              const headColor = this.flightTrailNodes[0].color;
              this.emitFlightVapor(pos, vel, new THREE.Color(headColor.r, headColor.g, headColor.b));
            }
          }
        }
      }
    } else {
      this.flightTrailLine.visible = false;
      this.flightRibbonMesh.visible = false;
    }
  }

  /**
   * Set the aiming direction angle in radians
   */
  public setAimAngle(angleRad: number) {
    this.aimAngleRad = angleRad;
  }

  /**
   * Set active shot / kick type to optimize camera framing
   */
  public setKickType(type: KickType) {
    this.currentKickType = type;
  }

  /**
   * Update the slope-aware putting read line and beaded roll path
   */
  public updatePuttingReadLine(points: Vector3D[], visible = true, reachesCup = false) {
    if (!visible || !points || points.length < 2) {
      this.puttingLineMesh.visible = false;
      this.puttingBeadsGroup.visible = false;
      if (this.cupBeaconMesh) this.cupBeaconMesh.visible = false;
      if (this.puttingStopMarker) this.puttingStopMarker.visible = false;
      this.puttingPoints = [];
      return;
    }

    const valid = points.filter(
      (p) => p && typeof p.x === 'number' && !isNaN(p.x) && !isNaN(p.y) && !isNaN(p.z)
    );

    if (valid.length < 2) {
      this.puttingLineMesh.visible = false;
      this.puttingBeadsGroup.visible = false;
      if (this.cupBeaconMesh) this.cupBeaconMesh.visible = false;
      if (this.puttingStopMarker) this.puttingStopMarker.visible = false;
      this.puttingPoints = [];
      return;
    }

    // Elevate slightly above terrain contours to prevent any z-fighting
    this.puttingPoints = valid.map((p) => {
      const terrainY = this.activeHole ? getTerrainHeight(this.activeHole, p.x, p.z) : p.y;
      return new THREE.Vector3(p.x, Math.max(p.y, terrainY + 0.04), p.z);
    });

    const positions = new Float32Array(this.puttingPoints.length * 3);
    for (let i = 0; i < this.puttingPoints.length; i++) {
      positions[i * 3] = this.puttingPoints[i].x;
      positions[i * 3 + 1] = this.puttingPoints[i].y;
      positions[i * 3 + 2] = this.puttingPoints[i].z;
    }

    this.puttingLineGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.puttingLineMesh.visible = true;
    this.puttingBeadsGroup.visible = true;
    if (this.cupBeaconMesh) this.cupBeaconMesh.visible = true;

    // Projected Roll Endpoint Stop Marker
    if (this.puttingStopMarker && this.puttingPoints.length > 0) {
      const lastPt = this.puttingPoints[this.puttingPoints.length - 1];
      this.puttingStopMarker.position.set(lastPt.x, lastPt.y + 0.02, lastPt.z);
      const markerMat = this.puttingStopMarker.material as THREE.MeshBasicMaterial;
      if (reachesCup) {
        markerMat.color.setHex(0xf59e0b); // Gold for cup capture
        this.puttingStopMarker.scale.set(1.2, 1.2, 1.2);
      } else {
        markerMat.color.setHex(0x34d399); // Emerald for projected roll stop
        this.puttingStopMarker.scale.set(1.0, 1.0, 1.0);
      }
      this.puttingStopMarker.visible = true;
    }
  }

  /**
   * Update the dynamic green slope topography contour grid and downhill break beads
   */
  public updateGreenGrid(hole: HoleData, visible = true) {
    if (!visible) {
      this.greenGridGroup.visible = false;
      return;
    }

    this.greenGridGroup.visible = true;

    // Only rebuild mesh if switching holes
    if (this.currentGridHoleId !== hole.id) {
      this.currentGridHoleId = hole.id;

      // Clean existing line mesh
      if (this.greenGridMesh) {
        this.greenGridGroup.remove(this.greenGridMesh);
        this.greenGridMesh.geometry.dispose();
        (this.greenGridMesh.material as THREE.Material).dispose();
        this.greenGridMesh = null;
      }

      // Clean existing slope beads
      while (this.greenSlopeBeadsGroup.children.length > 0) {
        const b = this.greenSlopeBeadsGroup.children[0] as THREE.Mesh;
        this.greenSlopeBeadsGroup.remove(b);
        if (b.geometry) b.geometry.dispose();
        if (b.material) (b.material as THREE.Material).dispose();
      }
      this.greenSlopeBeads = [];

      const gridSpec = generateGreenGrid(hole, 1.2, 1.5);

      // Build segment line vertices
      const lineVerts: number[] = [];
      for (const line of gridSpec.contourLines) {
        for (let i = 0; i < line.length - 1; i++) {
          lineVerts.push(line[i].x, line[i].y, line[i].z);
          lineVerts.push(line[i + 1].x, line[i + 1].y, line[i + 1].z);
        }
      }

      if (lineVerts.length > 0) {
        const lineGeom = new THREE.BufferGeometry();
        lineGeom.setAttribute('position', new THREE.Float32BufferAttribute(lineVerts, 3));
        const lineMat = new THREE.LineBasicMaterial({
          color: 0x34d399,
          transparent: true,
          opacity: 0.38,
          depthWrite: false,
        });
        this.greenGridMesh = new THREE.LineSegments(lineGeom, lineMat);
        this.greenGridGroup.add(this.greenGridMesh);
      }

      // Spawn downhill slope beads for nodes with visible break
      const beadGeom = new THREE.SphereGeometry(0.05, 8, 8);
      const slopeNodes = gridSpec.nodes.filter(
        (n) => n.inGreenRadius && n.slopeGradePct >= 1.0
      );

      // Stride select up to 24 beads
      const step = Math.max(1, Math.floor(slopeNodes.length / 24));
      for (let i = 0; i < slopeNodes.length; i += step) {
        if (this.greenSlopeBeads.length >= 24) break;
        const n = slopeNodes[i];
        const beadMat = new THREE.MeshStandardMaterial({
          color: 0x6ee7b7,
          emissive: 0x059669,
          emissiveIntensity: 0.9,
          roughness: 0.3,
          transparent: true,
          opacity: 0.8,
        });
        const mesh = new THREE.Mesh(beadGeom, beadMat);
        mesh.position.set(n.x, n.y + 0.045, n.z);
        this.greenSlopeBeadsGroup.add(mesh);
        this.greenSlopeBeads.push({
          mesh,
          basePos: new THREE.Vector3(n.x, n.y, n.z),
          fallDir: new THREE.Vector3(n.fallVector.x, 0, n.fallVector.z),
          progress: Math.random(),
          speed: 0.45 + n.slopeGradePct * 0.08,
        });
      }
    }
  }

  /**
   * Update atmospheric wind particle streaks drifting in 3D scene
   */
  private updateWindWisps(dt: number, time: number) {
    if (!this.windWispsPositions) return;

    const windSpeed = this.activeWind ? this.activeWind.speed : 3.5;
    const windAngle = this.activeWind ? this.activeWind.angleRad : 0.6;
    const windDx = Math.sin(windAngle);
    const windDz = Math.cos(windAngle);

    const anchorPos = this.ballGroup.position;

    for (let i = 0; i < this.maxWindWisps; i++) {
      const data = this.windWispsData[i];
      // Move relative offset along wind vector
      const spd = windSpeed * 1.8 * data.speedMul * dt;
      data.offset.x += windDx * spd;
      data.offset.z += windDz * spd;
      data.offset.y += Math.sin(time * data.swayFreq + data.swayPhase) * 0.35 * dt;

      // Wrap if drifted too far from anchor
      if (data.offset.length() > 32) {
        // Respawn on upwind side
        data.offset.x = -windDx * (22 + Math.random() * 8) + (Math.random() - 0.5) * 16;
        data.offset.z = -windDz * (22 + Math.random() * 8) + (Math.random() - 0.5) * 16;
        data.offset.y = Math.random() * 6.5 + 0.6;
      }

      this.windWispsPositions[i * 3] = anchorPos.x + data.offset.x;
      this.windWispsPositions[i * 3 + 1] = anchorPos.y + data.offset.y;
      this.windWispsPositions[i * 3 + 2] = anchorPos.z + data.offset.z;
    }

    this.windWispsGeom.attributes.position.needsUpdate = true;
  }

  /**
   * Instant Replay overrides for broadcast cam and ball position
   */
  public setReplayBallAndCamera(
    ballPos: Vector3D,
    camPose: { camPos: Vector3D; lookAt: Vector3D }
  ) {
    this.isReplayMode = true;
    this.playerCharacter.setVisible(false);
    this.ballGroup.position.set(ballPos.x, ballPos.y, ballPos.z);
    this.replayCamPos.set(camPose.camPos.x, camPose.camPos.y, camPose.camPos.z);
    this.replayLookAt.set(camPose.lookAt.x, camPose.lookAt.y, camPose.lookAt.z);
  }

  public exitReplay() {
    this.isReplayMode = false;
    this.playerCharacter.setVisible(true);
  }

  /**
   * Update the dotted aim trajectory line
   */
  public updateTrajectoryLine(points: Vector3D[], visible = true) {

    if (!visible || points.length < 2) {
      this.aimTrajectoryLine.visible = false;
      if (this.landingTargetGroup) this.landingTargetGroup.visible = false;
      return;
    }

    this.aimTrajectoryLine.visible = true;
    const positions = new Float32Array(points.length * 3);
    for (let i = 0; i < points.length; i++) {
      positions[i * 3] = points[i].x;
      positions[i * 3 + 1] = points[i].y + 0.05; // slight elevation above ground
      positions[i * 3 + 2] = points[i].z;
    }

    this.trajectoryPointsGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.trajectoryPointsGeom.computeVertexNormals();
    (this.aimTrajectoryLine as THREE.Line).computeLineDistances();

    // Align landing target reticle at endpoint of projected flight
    if (this.landingTargetGroup && points.length > 0) {
      const lastPt = points[points.length - 1];
      const terrainY = this.activeHole ? getTerrainHeight(this.activeHole, lastPt.x, lastPt.z) : lastPt.y;
      this.landingTargetGroup.position.set(lastPt.x, Math.max(lastPt.y, terrainY) + 0.035, lastPt.z);
      this.landingTargetGroup.visible = true;
    }
  }

  /**
   * Directly positions or hides the concentric landing target reticle and needle
   */
  public setArcadeLandingTarget(
    pos: Vector3D | null,
    visible: boolean,
    needleValue: number = 0,
    isPulling: boolean = false
  ) {
    if (!this.landingTargetGroup) return;
    if (!visible || !pos) {
      this.landingTargetGroup.visible = false;
      if (this.arcadeNeedleGroup) this.arcadeNeedleGroup.visible = false;
      return;
    }

    const terrainY = this.activeHole ? getTerrainHeight(this.activeHole, pos.x, pos.z) : pos.y;
    this.landingTargetGroup.position.set(pos.x, Math.max(pos.y, terrainY) + 0.035, pos.z);
    this.landingTargetGroup.visible = true;

    this.updateArcadeNeedle(needleValue, isPulling);
  }

  /**
   * Updates the 3D oscillating needle on top of the landing target
   */
  public updateArcadeNeedle(needleValue: number, isPulling: boolean) {
    if (!this.arcadeNeedleGroup || !this.arcadeNeedleMesh) return;
    if (!isPulling) {
      this.arcadeNeedleGroup.visible = false;
      return;
    }

    this.arcadeNeedleGroup.visible = true;
    // Oscillates ±75 degrees across the target plane
    this.arcadeNeedleGroup.rotation.y = -needleValue * (Math.PI * 0.42);

    const needleMat = this.arcadeNeedleMesh.material as THREE.MeshBasicMaterial;
    const absVal = Math.abs(needleValue);
    if (absVal <= 0.12) {
      needleMat.color.setHex(0xfacc15); // Vibrant Gold
    } else if (absVal <= 0.38) {
      needleMat.color.setHex(0x38bdf8); // Cyan
    } else if (absVal <= 0.70) {
      needleMat.color.setHex(0xfb923c); // Orange
    } else {
      needleMat.color.setHex(0xef4444); // Red
    }
  }

  /**
   * Emit grass divots or sand particles on kick or bounce
   */
  public emitParticles(pos: Vector3D, count: number, colorHex: number) {
    const col = new THREE.Color(colorHex);
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) {
        this.particles.shift();
      }
      this.particles.push({
        pos: new THREE.Vector3(
          pos.x + (Math.random() - 0.5) * 0.2,
          pos.y + 0.1,
          pos.z + (Math.random() - 0.5) * 0.2
        ),
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 4.5,
          Math.random() * 5.0 + 2.0,
          (Math.random() - 0.5) * 4.5
        ),
        life: 0,
        maxLife: Math.random() * 0.45 + 0.35,
        color: col,
        size: Math.random() * 0.18 + 0.12,
      });
    }
  }

  private static readonly IMPACT_PALETTES: Record<string, number[]> = {
    sand: [0xe8d3a0, 0xd9bf85, 0xf3e3bb, 0xc9ad72],
    rough: [0x2f6b2a, 0x3d7f33, 0x5a8f3c, 0x24521f],
    fairway: [0x4caf50, 0x66bb6a, 0x388e3c, 0x81c784],
    green: [0x66bb6a, 0x81c784, 0x4caf50],
    tee: [0x4caf50, 0x66bb6a, 0x388e3c],
  };

  /**
   * Landing and kick effects that depend on the surface: a fan of sand from bunkers,
   * clippings from rough and fairway, and a light puff of grass on greens. Count and
   * spread scale with impact speed.
   */
  public emitSurfaceImpact(pos: Vector3D, surface: string, impactSpeed: number) {
    if (surface === 'water') {
      this.emitWaterSplash(pos, Math.round(10 + impactSpeed * 2));
      return;
    }
    const palette = FootGolfRenderer.IMPACT_PALETTES[surface] ?? FootGolfRenderer.IMPACT_PALETTES.fairway;
    const strength = Math.min(1, impactSpeed / 14);
    const isSand = surface === 'sand';
    const count = Math.round((isSand ? 14 : surface === 'green' ? 3 : 6) + strength * (isSand ? 26 : 12));
    const spread = (isSand ? 3.2 : 2.2) * (0.5 + strength);
    const lift = (isSand ? 4.2 : 2.6) * (0.6 + strength);
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) this.particles.shift();
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random();
      this.particles.push({
        pos: new THREE.Vector3(pos.x + Math.cos(angle) * 0.1, pos.y - 0.05, pos.z + Math.sin(angle) * 0.1),
        vel: new THREE.Vector3(Math.cos(angle) * spread * r, lift * (0.5 + Math.random() * 0.8), Math.sin(angle) * spread * r),
        life: 0,
        maxLife: (isSand ? 0.55 : 0.45) + Math.random() * 0.35,
        color: new THREE.Color(palette[Math.floor(Math.random() * palette.length)]),
        size: (isSand ? 0.09 : 0.12) + Math.random() * 0.1,
      });
    }
  }

  /**
   * Multi-color victory confetti burst on holed shot
   */
  public emitConfetti(pos: Vector3D, count: number = 85) {
    const confettiColors = [
      0xf59e0b, // Championship Gold
      0xef4444, // Victory Crimson
      0x3b82f6, // Royal Blue
      0x10b981, // Emerald Green
      0xa855f7, // Tournament Violet
      0xf8fafc, // Pure Silver
    ];
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) {
        this.particles.shift();
      }
      const col = new THREE.Color(confettiColors[i % confettiColors.length]);
      const angle = Math.random() * Math.PI * 2;
      const spread = Math.random() * 3.8 + 1.2;
      this.particles.push({
        pos: new THREE.Vector3(
          pos.x + (Math.random() - 0.5) * 0.4,
          pos.y + 0.15,
          pos.z + (Math.random() - 0.5) * 0.4
        ),
        vel: new THREE.Vector3(
          Math.cos(angle) * spread,
          Math.random() * 7.0 + 5.5,
          Math.sin(angle) * spread
        ),
        life: 0,
        maxLife: Math.random() * 1.2 + 1.6, // Longer celebration float
        color: col,
        size: Math.random() * 0.22 + 0.16,
      });
    }
  }

  /**
   * Water hazard splash fountain
   */
  public emitWaterSplash(pos: Vector3D, count: number = 28) {
    const splashColors = [0x38bdf8, 0x7dd3fc, 0xe0f2fe, 0x0284c7];
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) {
        this.particles.shift();
      }
      const col = new THREE.Color(splashColors[i % splashColors.length]);
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 2.8 + 0.8;
      this.particles.push({
        pos: new THREE.Vector3(
          pos.x + (Math.random() - 0.5) * 0.3,
          pos.y,
          pos.z + (Math.random() - 0.5) * 0.3
        ),
        vel: new THREE.Vector3(
          Math.cos(angle) * speed,
          Math.random() * 5.2 + 3.0,
          Math.sin(angle) * speed
        ),
        life: 0,
        maxLife: Math.random() * 0.45 + 0.35,
        color: col,
        size: Math.random() * 0.2 + 0.12,
      });
    }
  }

  /**
   * Camera Mode Switcher
   */
  public setCameraMode(mode: CameraMode) {
    this.cameraMode = mode;
  }

  public toggleFlyover() {
    this.isFlyoverActive = !this.isFlyoverActive;
    this.flyoverProgress = 0;
  }

  public isFlyover(): boolean {
    return this.isFlyoverActive;
  }

  private updateCameraInstant(hole: HoleData) {
    // Aiming camera framed so the ball sits cleanly in the lower-third (~65% down viewport), completely clear of bottom controls
    const isPutt = this.currentKickType === 'putt';
    const backDist = isPutt ? 4.2 : 5.2;
    const height = isPutt ? 1.5 : 1.7;
    const lookDist = isPutt ? 14 : 18;
    const lookY = isPutt ? this.ballGroup.position.y - 1.8 : this.ballGroup.position.y - 2.2;

    this.targetCamPos.set(
      this.ballGroup.position.x - Math.sin(this.aimAngleRad) * backDist,
      this.ballGroup.position.y + height,
      this.ballGroup.position.z - Math.cos(this.aimAngleRad) * backDist
    );
    this.targetLookAt.set(
      this.ballGroup.position.x + Math.sin(this.aimAngleRad) * lookDist,
      lookY,
      this.ballGroup.position.z + Math.cos(this.aimAngleRad) * lookDist
    );

    this.camera.position.copy(this.targetCamPos);
    this.currentCamLookAt.copy(this.targetLookAt);
    this.camera.lookAt(this.currentCamLookAt);
  }

  private updateCamera(dt: number, hole: HoleData) {
    if (this.isReplayMode) {
      const replayDamp = 1 - Math.exp(-14.0 * dt);
      this.camera.position.lerp(this.replayCamPos, replayDamp);
      this.currentCamLookAt.lerp(this.replayLookAt, replayDamp);
      this.camera.lookAt(this.currentCamLookAt);
      return;
    }

    if (this.isFlyoverActive) {

      // Smooth scenic flyover from Tee along fairway to Pin
      this.flyoverProgress += dt * 0.14;
      if (this.flyoverProgress > 1.0) {
        this.isFlyoverActive = false;
        this.cameraMode = 'aim';
        return;
      }

      const p = this.flyoverProgress;
      const flyX = THREE.MathUtils.lerp(hole.teePosition.x, hole.pinPosition.x, p);
      const flyZ = THREE.MathUtils.lerp(hole.teePosition.z, hole.pinPosition.z, p);
      const flyY = getTerrainHeight(hole, flyX, flyZ) + 18 - Math.sin(p * Math.PI) * 5;

      this.targetCamPos.set(flyX + Math.sin(p * Math.PI * 2) * 12, flyY, flyZ - 20);
      this.targetLookAt.set(
        THREE.MathUtils.lerp(hole.teePosition.x, hole.pinPosition.x, Math.min(1, p + 0.15)),
        getTerrainHeight(hole, flyX, flyZ) + 2,
        THREE.MathUtils.lerp(hole.teePosition.z, hole.pinPosition.z, Math.min(1, p + 0.15))
      );
    } else if (this.cameraMode === 'flight') {
      // Dynamic broadcast follow camera with forward lead and terrain collision avoidance
      const followDist = 6.2;
      const followHeight = 3.2;
      const camX = this.ballGroup.position.x - Math.sin(this.aimAngleRad) * followDist;
      const camZ = this.ballGroup.position.z - Math.cos(this.aimAngleRad) * followDist;
      const groundAtCam = getTerrainHeight(hole, camX, camZ);
      const camY = Math.max(this.ballGroup.position.y + followHeight, groundAtCam + 2.4);

      this.targetCamPos.set(camX, camY, camZ);
      this.targetLookAt.set(
        this.ballGroup.position.x + Math.sin(this.aimAngleRad) * 14,
        this.ballGroup.position.y * 0.7 + 0.5,
        this.ballGroup.position.z + Math.cos(this.aimAngleRad) * 14
      );
    } else if (this.cameraMode === 'green') {
      // Zoomed on Green & Pin
      this.targetCamPos.set(
        hole.pinPosition.x + 8,
        hole.pinPosition.y + 5,
        hole.pinPosition.z - 10
      );
      this.targetLookAt.copy(this.cupGroup.position);
    } else if (this.cameraMode === 'drone') {
      // Top-down tactical drone view
      this.targetCamPos.set(
        this.ballGroup.position.x,
        this.ballGroup.position.y + 45,
        this.ballGroup.position.z - 8
      );
      this.targetLookAt.copy(this.ballGroup.position);
    } else {
      // Aim Mode elevated so ball sits cleanly in lower-third (~65% down viewport), completely clear of bottom controls
      const isPutt = this.currentKickType === 'putt';
      // Portrait screens: raise and pull back so the player doesn't block the fairway
      const portrait = this.camera.aspect < 0.9;
      const backDist = isPutt ? (portrait ? 5.0 : 4.2) : portrait ? 6.4 : 5.2;
      const height = isPutt ? (portrait ? 2.6 : 1.5) : portrait ? 3.6 : 1.7;
      const lookDist = isPutt ? 14 : portrait ? 26 : 18;
      const lookY = isPutt
        ? this.ballGroup.position.y - (portrait ? 0.8 : 1.8)
        : this.ballGroup.position.y - (portrait ? 0.6 : 2.2);

      this.targetCamPos.set(
        this.ballGroup.position.x - Math.sin(this.aimAngleRad) * backDist,
        this.ballGroup.position.y + height,
        this.ballGroup.position.z - Math.cos(this.aimAngleRad) * backDist
      );

      this.targetLookAt.set(
        this.ballGroup.position.x + Math.sin(this.aimAngleRad) * lookDist,
        lookY,
        this.ballGroup.position.z + Math.cos(this.aimAngleRad) * lookDist
      );
    }

    // Smooth exponential damping to avoid abrupt cuts
    const damping = 1 - Math.exp(-8.0 * dt);
    this.camera.position.lerp(this.targetCamPos, damping);
    this.currentCamLookAt.lerp(this.targetLookAt, damping);

    // Dynamic physical camera impact trauma (e.g. ground bounce, pin clink, lip-out)
    if (this.cameraImpactTrauma > 0.002) {
      const traumaSq = this.cameraImpactTrauma * this.cameraImpactTrauma;
      const shakeAmt = traumaSq * 0.32;
      this.camera.position.x += (Math.random() * 2 - 1) * shakeAmt;
      this.camera.position.y += (Math.random() * 2 - 1) * shakeAmt * 0.72;
      this.camera.position.z += (Math.random() * 2 - 1) * shakeAmt;
      this.cameraImpactTrauma = Math.max(0, this.cameraImpactTrauma - dt * 2.8);
    }

    this.camera.lookAt(this.currentCamLookAt);
  }

  /**
   * Triggers physical tactile camera impact trauma
   */
  public triggerCameraImpact(intensity: number = 0.28) {
    if (getActiveSettings().reducedMotion) return;
    this.cameraImpactTrauma = Math.min(1.0, this.cameraImpactTrauma + intensity);
  }

  private envTarget: THREE.WebGLRenderTarget | null = null;
  private pendingAtmosphere: CourseData | null = null;
  private atmosphere: AtmosphereSettings = getAtmosphere({ theme: 'parkland' });
  private sunDir = new THREE.Vector3(0.4, 0.8, 0.4).normalize();

  /**
   * Bakes a physically based sky for the course into a prefiltered environment map,
   * used both as the visible background and as image-based lighting, and aligns the
   * sun light, sun disc, fog, and exposure with it.
   */
  private applyAtmosphere(course: CourseData) {
    const atm = getAtmosphere(course);
    this.atmosphere = atm;
    const dir = sunDirection(atm);
    this.sunDir.set(dir.x, dir.y, dir.z);

    try {
      const sky = new Sky();
      sky.scale.setScalar(50);
      const u = sky.material.uniforms;
      u.turbidity.value = atm.turbidity;
      u.rayleigh.value = atm.rayleigh;
      u.mieCoefficient.value = atm.mieCoefficient;
      u.mieDirectionalG.value = atm.mieDirectionalG;
      u.sunPosition.value.copy(this.sunDir);
      const skyScene = new THREE.Scene();
      skyScene.add(sky);
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      const target = pmrem.fromScene(skyScene, 0, 0.1, 100);
      pmrem.dispose();
      sky.geometry.dispose();
      sky.material.dispose();
      this.envTarget?.dispose();
      this.envTarget = target;
      this.scene.background = target.texture;
      this.scene.environment = target.texture;
      this.scene.environmentIntensity = atm.envIntensity;
      this.scene.backgroundIntensity = atm.backgroundIntensity;
    } catch {
      // Fall back to a flat sky color if the sky can't be baked
      this.scene.background = new THREE.Color(course.skyColor);
      this.scene.environment = null;
    }

    this.dirLight.color.set(atm.sunColor);
    this.dirLight.intensity = atm.sunIntensity;
    this.hemiLight.intensity = atm.hemiIntensity;
    this.renderer.toneMappingExposure = atm.exposure;
    this.scene.fog = new THREE.FogExp2(course.fogColor, atm.fogDensity);

    if (this.sunGroup) {
      this.sunGroup.position.copy(this.sunDir).multiplyScalar(360);
      this.sunGroup.lookAt(0, 0, 0);
    }
    this.updateShadowFrustum(true);
  }

  private shadowCenter = new THREE.Vector3();

  /**
   * Keeps a tight shadow frustum centered on the ball (and so on the player), snapped to
   * whole shadow-map texels so shadow edges don't shimmer as the camera moves.
   */
  private updateShadowFrustum(force = false) {
    if (!this.dirLight.castShadow && !force) return;
    const halfSize = this.qualitySettings.tier === 'high' ? 45 : 35;
    const cam = this.dirLight.shadow.camera;
    if (cam.right !== halfSize) {
      cam.left = -halfSize;
      cam.right = halfSize;
      cam.top = halfSize;
      cam.bottom = -halfSize;
      cam.near = 1;
      cam.far = 400;
      cam.updateProjectionMatrix();
    }
    const texel = (halfSize * 2) / this.dirLight.shadow.mapSize.x;
    const p = this.ballGroup.position;
    this.shadowCenter.set(Math.round(p.x / texel) * texel, Math.round(p.y / texel) * texel, Math.round(p.z / texel) * texel);
    this.dirLight.target.position.copy(this.shadowCenter);
    this.dirLight.position.copy(this.sunDir).multiplyScalar(150).add(this.shadowCenter);
  }

  /**
   * Dynamic resolution scaling: lowers the render pixel ratio when frames miss budget.
   */
  public setDynamicResolutionScale(scale: number) {
    const clamped = Math.max(FrameTimeMonitor.MIN_SCALE, Math.min(1.0, scale));
    if (Math.abs(clamped - this.currentDrsScale) < 0.01) return;
    this.currentDrsScale = clamped;
    this.renderer.setPixelRatio(computePixelRatio(this.qualitySettings, window.devicePixelRatio, clamped));
    this.onResize();
  }

  private qualitySettings: QualitySettings;
  private frameMonitor: FrameTimeMonitor;
  private qualityListener: ((tier: QualityTier) => void) | null = null;

  public getQualityTier(): QualityTier {
    return this.qualitySettings.tier;
  }

  public onQualityChange(listener: ((tier: QualityTier) => void) | null) {
    this.qualityListener = listener;
  }

  /** Applies a quality preset at runtime: pixel ratio, shadows, and post-processing. */
  public setQualityPreference(pref: QualityPreference) {
    const tier = resolveInitialTier(pref, this.isSoftwareGl);
    this.frameMonitor = new FrameTimeMonitor(QUALITY_PRESETS[tier], pref === 'auto' && !this.isSoftwareGl);
    this.applyQuality(QUALITY_PRESETS[tier]);
  }

  private applyQuality(settings: QualitySettings) {
    const shadowsChanged = settings.shadows !== this.qualitySettings.shadows ||
      settings.softShadows !== this.qualitySettings.softShadows;
    const mapChanged = settings.shadowMapSize !== this.qualitySettings.shadowMapSize;
    this.qualitySettings = settings;
    this.frameMonitor.setSettings(settings);
    this.currentDrsScale = 1;
    this.renderer.setPixelRatio(computePixelRatio(settings, window.devicePixelRatio, 1));
    this.onResize();

    const shadows = settings.shadows && !this.isSoftwareGl;
    this.renderer.shadowMap.enabled = shadows;
    this.renderer.shadowMap.type = settings.softShadows ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    this.dirLight.castShadow = shadows;
    if (mapChanged) {
      this.dirLight.shadow.mapSize.set(settings.shadowMapSize, settings.shadowMapSize);
      this.dirLight.shadow.map?.dispose();
      this.dirLight.shadow.map = null;
    }
    if (shadowsChanged) {
      // Shadow toggles change shader variants, so materials must recompile
      this.scene.traverse((obj) => {
        const mat = (obj as THREE.Mesh).material;
        if (mat) (Array.isArray(mat) ? mat : [mat]).forEach((m) => (m.needsUpdate = true));
      });
    }
    this.onQualityApplied(settings);
    this.qualityListener?.(settings.tier);
  }

  private composer: EffectComposer | null = null;

  /** Turns tier-dependent features on or off. */
  protected onQualityApplied(settings: QualitySettings) {
    this.setPostProcessing(settings.postProcessing);
  }

  /**
   * High tier only: one merged effect pass with SMAA, bloom on bright highlights
   * (sun, target rings, trails), a light vignette, and ACES tone mapping.
   */
  private postProcessingRequested = false;

  private setPostProcessing(enabled: boolean) {
    this.postProcessingRequested = enabled;
    if (!enabled) {
      if (this.composer) {
        this.composer.dispose();
        this.composer = null;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      }
      return;
    }
    if (this.composer) return;
    // Loaded on demand so low and medium tiers don't download or parse it
    import('postprocessing')
      .then((pp) => {
        if (!this.postProcessingRequested || this.composer || this.isDestroyed) return;
        const composer = new pp.EffectComposer(this.renderer, { frameBufferType: THREE.HalfFloatType });
        composer.addPass(new pp.RenderPass(this.scene, this.camera));
        composer.addPass(
          new pp.EffectPass(
            this.camera,
            new pp.SMAAEffect(),
            new pp.BloomEffect({ luminanceThreshold: 3.0, luminanceSmoothing: 0.4, intensity: 0.45, mipmapBlur: true }),
            new pp.VignetteEffect({ offset: 0.32, darkness: 0.38 }),
            new pp.ToneMappingEffect({ mode: pp.ToneMappingMode.ACES_FILMIC })
          )
        );
        // Tone mapping now happens in the effect pass instead of the renderer
        this.renderer.toneMapping = THREE.NoToneMapping;
        const size = this.renderer.getSize(new THREE.Vector2());
        composer.setSize(size.x, size.y);
        this.composer = composer;
      })
      .catch(() => {
        this.composer = null;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      });
  }


  private updateQualityMonitor(rawDt: number) {
    const decision = this.frameMonitor.sample(rawDt * 1000);
    if (!decision) return;
    if (decision.downgradeTo) {
      this.applyQuality(QUALITY_PRESETS[decision.downgradeTo]);
    } else if (decision.scale !== undefined) {
      this.setDynamicResolutionScale(decision.scale);
    }
  }

  /**
   * Regulation FootGolf Flag fluttering with traveling aerodynamic sine waves
   */
  private updateFlag(time: number) {
    if (!this.flagCloth) return;

    const speed = this.activeWind ? this.activeWind.speed : 3.5;
    const angle = this.activeWind ? this.activeWind.angleRad : 0.6;

    // Flutter rotation on pole
    const flutter = Math.sin(time * (5.5 + speed * 1.2)) * (0.08 + speed * 0.015);
    this.flagCloth.rotation.y = angle + Math.PI / 2 + flutter;

    // Vertex wave displacement along length of cloth
    const geom = this.flagCloth.geometry as THREE.PlaneGeometry;
    if (geom && geom.attributes.position) {
      const pos = geom.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i); // x ranges from 0 to 0.85
        const u = Math.max(0, x) / 0.85; // normalized distance from hoist pole
        // Two traveling wave harmonics that intensify toward the free fly edge
        const wave1 = Math.sin(u * 9.5 - time * (5.5 + speed * 1.3)) * (u * 0.11);
        const wave2 = Math.cos(u * 17.0 - time * (8.5 + speed * 1.8)) * (u * 0.04);
        pos.setZ(i, wave1 + wave2);
      }
      pos.needsUpdate = true;
      geom.computeVertexNormals();
    }
  }

  /**
   * Build composite puffy procedural clouds
   */
  private buildClouds() {
    while (this.cloudsGroup.children.length > 0) {
      const c = this.cloudsGroup.children[0] as THREE.Group;
      this.cloudsGroup.remove(c);
      c.traverse((child) => {
        if ((child as THREE.Mesh).geometry) (child as THREE.Mesh).geometry.dispose();
      });
    }

    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.95,
      metalness: 0.02,
      transparent: true,
      opacity: 0.82,
    });

    for (let c = 0; c < 8; c++) {
      const cloud = new THREE.Group();
      const numPuffs = 4 + (c % 3);
      for (let p = 0; p < numPuffs; p++) {
        const rad = 3.5 + Math.random() * 2.8;
        const puffGeom = new THREE.SphereGeometry(rad, 7, 7);
        puffGeom.scale(1.35, 0.6, 1.15);
        const puffMesh = new THREE.Mesh(puffGeom, cloudMat);
        puffMesh.position.set(
          (p - numPuffs / 2) * 4.6 + (Math.random() - 0.5) * 2.2,
          (Math.random() - 0.5) * 1.5,
          (Math.random() - 0.5) * 3.0
        );
        cloud.add(puffMesh);
      }
      cloud.position.set(
        (c - 4) * 55 + (Math.random() - 0.5) * 20,
        78 + (c % 4) * 8,
        (c * 50) % 360 - 40
      );
      this.cloudsGroup.add(cloud);
    }
  }

  /**
   * Drifts clouds smoothly according to wind speed & angle
   */
  private updateClouds(dt: number) {
    const speed = this.activeWind ? this.activeWind.speed : 3.5;
    const angle = this.activeWind ? this.activeWind.angleRad : 0.6;
    const driftX = Math.sin(angle) * speed * 0.45 * dt;
    const driftZ = Math.cos(angle) * speed * 0.45 * dt;

    for (let i = 0; i < this.cloudsGroup.children.length; i++) {
      const cloud = this.cloudsGroup.children[i];
      cloud.position.x += driftX;
      cloud.position.z += driftZ;

      if (cloud.position.x > 220) cloud.position.x = -220;
      if (cloud.position.x < -220) cloud.position.x = 220;
      if (cloud.position.z > 400) cloud.position.z = -60;
      if (cloud.position.z < -60) cloud.position.z = 400;
    }
  }

  /**
   * Drifting sakura petal for Japanese Garden theme
   */
  private emitSakuraPetal() {
    if (this.particles.length >= this.maxParticles || !this.activeHole) return;
    const rx = this.ballGroup.position.x + (Math.random() - 0.5) * 35;
    const rz = this.ballGroup.position.z + (Math.random() - 0.5) * 35;
    const gy = getTerrainHeight(this.activeHole, rx, rz);
    const py = gy + Math.random() * 5.0 + 3.0;

    this.particles.push({
      pos: new THREE.Vector3(rx, py, rz),
      vel: new THREE.Vector3((Math.random() - 0.5) * 0.8, -0.6 - Math.random() * 0.4, (Math.random() - 0.5) * 0.8),
      life: 0,
      maxLife: 3.5 + Math.random() * 1.5,
      color: new THREE.Color(Math.random() > 0.5 ? 0xfbcfe8 : 0xf472b6),
      size: 0.12 + Math.random() * 0.06,
    });
  }

  /**
   * Sparkling golden burst for a Pure Strike
   */
  public emitPureStrike(pos: Vector3D) {
    for (let i = 0; i < 24; i++) {
      if (this.particles.length >= this.maxParticles) this.particles.shift();
      const angle = Math.random() * Math.PI * 2;
      const spd = Math.random() * 4.5 + 2.0;
      this.particles.push({
        pos: new THREE.Vector3(pos.x, pos.y + 0.1, pos.z),
        vel: new THREE.Vector3(Math.cos(angle) * spd, Math.random() * 4.2 + 2.2, Math.sin(angle) * spd),
        life: 0,
        maxLife: 0.48 + Math.random() * 0.25,
        color: new THREE.Color(0xfde047), // Sparkling Gold
        size: 0.2 + Math.random() * 0.12,
      });
    }
  }

  /**
   * Metallic sparkling burst when ball strikes the flagstick pin directly
   */
  public emitPinSpark(pos: Vector3D) {
    const sparkColors = [0xffffff, 0xfef08a, 0xf59e0b, 0x94a3b8];
    for (let i = 0; i < 22; i++) {
      if (this.particles.length >= this.maxParticles) this.particles.shift();
      const angle = Math.random() * Math.PI * 2;
      const spd = Math.random() * 5.2 + 2.8;
      this.particles.push({
        pos: new THREE.Vector3(pos.x, pos.y + 0.1, pos.z),
        vel: new THREE.Vector3(Math.cos(angle) * spd, Math.random() * 5.2 + 2.5, Math.sin(angle) * spd),
        life: 0,
        maxLife: 0.36 + Math.random() * 0.22,
        color: new THREE.Color(sparkColors[i % sparkColors.length]),
        size: 0.18 + Math.random() * 0.1,
      });
    }
  }

  /**
   * Update particle positions and lifecycle
   */
  private updateParticles(dt: number) {
    if (this.activeCourse?.theme === 'japanese_garden' && Math.random() < 0.08) {
      this.emitSakuraPetal();
    }

    let activeCount = 0;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }

      if (p.maxLife > 1.0) {
        // Confetti & sakura petal physics: light flutter gravity and horizontal air drift
        p.vel.y += -3.4 * dt;
        p.vel.x *= (1 - 1.1 * dt);
        p.vel.z *= (1 - 1.1 * dt);
        p.pos.x += p.vel.x * dt + Math.sin(p.life * 8.0 + i) * 0.08 * dt;
        p.pos.y += p.vel.y * dt;
        p.pos.z += p.vel.z * dt + Math.cos(p.life * 8.0 + i) * 0.08 * dt;
      } else {
        // Turf divots, sand, and splash: ballistic gravity
        p.vel.y += -9.81 * dt;
        p.pos.x += p.vel.x * dt;
        p.pos.y += p.vel.y * dt;
        p.pos.z += p.vel.z * dt;
      }

      this.particlePositions[activeCount * 3] = p.pos.x;
      this.particlePositions[activeCount * 3 + 1] = p.pos.y;
      this.particlePositions[activeCount * 3 + 2] = p.pos.z;

      this.particleColors[activeCount * 3] = p.color.r;
      this.particleColors[activeCount * 3 + 1] = p.color.g;
      this.particleColors[activeCount * 3 + 2] = p.color.b;

      activeCount++;
    }

    // Clear rest
    for (let i = activeCount; i < this.maxParticles; i++) {
      this.particlePositions[i * 3 + 1] = -999;
    }

    this.particleGeom.attributes.position.needsUpdate = true;
    this.particleGeom.attributes.color.needsUpdate = true;
  }

  /**
   * Switch course / hole
   */
  public loadHole(course: CourseData, hole: HoleData) {
    const courseChanged = this.activeCourse?.id !== course.id;
    this.activeCourse = course;
    this.activeHole = hole;
    if (courseChanged) this.pendingAtmosphere = course;

    this.buildTerrain(course, hole);
    this.buildProps(hole);
    this.buildGrassTufts(hole);
    this.buildClouds();

    this.cupGroup.position.set(hole.pinPosition.x, hole.pinPosition.y, hole.pinPosition.z);
    this.updateFlagTexture(hole.number);
    this.setBallPosition(hole.teePosition);
    this.aimAngleRad = hole.defaultAimAngle;
    this.cameraMode = 'aim';
    this.isFlyoverActive = false;
    this.setBallInFlight(false);
    const teeGroundY = getTerrainHeight(hole, hole.teePosition.x, hole.teePosition.z);
    this.playerCharacter.onBallStopped(hole.teePosition, hole.defaultAimAngle, teeGroundY);
    this.updateCameraInstant(hole);
  }

  private frameHook: ((rawDt: number) => void) | null = null;
  private isPaused = false;

  /**
   * Registers a callback that runs at the start of every frame, before the scene updates.
   * The game uses it to step physics so there is a single animation loop.
   */
  public setFrameHook(hook: ((rawDt: number) => void) | null) {
    this.frameHook = hook;
  }

  /** Pauses or resumes the frame loop (used when the app goes to the background). */
  public setPaused(paused: boolean) {
    if (this.isPaused === paused || this.isDestroyed) return;
    this.isPaused = paused;
    if (paused) {
      cancelAnimationFrame(this.frameId);
    } else {
      this.startLoop();
    }
  }

  /** Moves only the visible ball (no trail or spin updates); used for render interpolation. */
  public setBallRenderPosition(pos: Vector3D) {
    this.ballGroup.position.set(pos.x, pos.y, pos.z);
  }

  private startLoop() {
    let lastTime = performance.now();

    const tick = (currentTime: number) => {
      if (this.isDestroyed || this.isPaused) return;

      const rawDt = Math.max(0, (currentTime - lastTime) / 1000);
      const dt = Math.min(rawDt, 0.05); // clamped dt
      lastTime = currentTime;

      if (this.pendingAtmosphere) {
        const pending = this.pendingAtmosphere;
        this.pendingAtmosphere = null;
        this.applyAtmosphere(pending);
      }
      this.frameHook?.(rawDt);
      this.updateQualityMonitor(rawDt);
      this.updateShadowFrustum();

      // Dynamic animations
      this.updateFlag(currentTime * 0.001);
      this.updateParticles(dt);
      this.updateClouds(dt);

      // Animate putting beads along slope-aware read line
      if (this.puttingPoints.length >= 2 && this.puttingBeadsGroup.visible) {
        this.puttingAnimProgress = (this.puttingAnimProgress + dt * 0.35) % 1.0;
        const totalPts = this.puttingPoints.length;
        for (let b = 0; b < this.puttingBeadMeshes.length; b++) {
          const bead = this.puttingBeadMeshes[b];
          const frac = (this.puttingAnimProgress + b / this.puttingBeadMeshes.length) % 1.0;
          const sampleIdx = frac * (totalPts - 1);
          const i0 = Math.floor(sampleIdx);
          const i1 = Math.min(totalPts - 1, i0 + 1);
          const t = sampleIdx - i0;

          bead.visible = true;
          bead.position.lerpVectors(this.puttingPoints[i0], this.puttingPoints[i1], t);
          bead.position.y += 0.035;

          // Subtle pulse size for championship feel
          const pulse = 1.0 + Math.sin(currentTime * 0.005 + b) * 0.15;
          bead.scale.set(pulse, pulse, pulse);
        }
      }

      // Scroll water ripples
      if (this.waterNormalTexture) {
        this.waterNormalTexture.offset.x = (this.waterNormalTexture.offset.x + dt * 0.012) % 1;
        this.waterNormalTexture.offset.y = (this.waterNormalTexture.offset.y + dt * 0.007) % 1;
      }

      // Gentle water hazard shimmer & wave oscillation
      for (let w = 0; w < this.waterGroup.children.length; w++) {
        const waterMesh = this.waterGroup.children[w] as THREE.Mesh;
        waterMesh.rotation.z = Math.sin(currentTime * 0.0008 + w) * 0.02;
        waterMesh.position.y = -0.15 + Math.sin(currentTime * 0.002 + w * 1.5) * 0.022;
      }

      // Pulse putting cup beacon ring
      if (this.cupBeaconMesh && this.cupBeaconMesh.visible) {
        const bPulse = 1.0 + Math.sin(currentTime * 0.005) * 0.07;
        this.cupBeaconMesh.scale.set(bPulse, bPulse, bPulse);
        (this.cupBeaconMesh.material as THREE.MeshBasicMaterial).opacity =
          0.5 + Math.sin(currentTime * 0.006) * 0.22;
      }

      // Animate 3D landing target reticle
      if (this.landingTargetGroup && this.landingTargetGroup.visible) {
        const tSec = currentTime * 0.001;
        this.landingTargetOuterRing.rotation.z = tSec * 0.75;
        this.landingTargetInnerRing.rotation.z = -tSec * 1.15;
        const reticlePulse = 1.0 + Math.sin(tSec * 4.5) * 0.055;
        this.landingTargetGroup.scale.set(reticlePulse, 1.0, reticlePulse);
      }

      // Wind wisps drifting across 3D environment
      this.updateWindWisps(dt, currentTime * 0.001);
      this.grassUniforms.uTime.value = currentTime * 0.001;
      if (this.activeWind) {
        const ws = Math.min(1.5, this.activeWind.speed / 5);
        this.grassUniforms.uWind.value.set(Math.sin(this.activeWind.angleRad) * ws, Math.cos(this.activeWind.angleRad) * ws);
      }

      // Animate downhill slope break beads across green contour grid
      if (this.greenGridGroup.visible && this.greenSlopeBeads.length > 0) {
        for (let s = 0; s < this.greenSlopeBeads.length; s++) {
          const bead = this.greenSlopeBeads[s];
          bead.progress = (bead.progress + dt * bead.speed) % 1.0;
          const travel = bead.progress * 0.85;
          const currX = bead.basePos.x + bead.fallDir.x * travel;
          const currZ = bead.basePos.z + bead.fallDir.z * travel;
          const groundY = this.activeHole ? getTerrainHeight(this.activeHole, currX, currZ) : bead.basePos.y;
          bead.mesh.position.set(currX, groundY + 0.045, currZ);

          const alphaFade = Math.sin(bead.progress * Math.PI);
          (bead.mesh.material as THREE.MeshStandardMaterial).opacity = 0.3 + alphaFade * 0.6;
        }
      }

      // 3D Player Character & Camera motion
      if (this.activeHole) {
        const terrainH = getTerrainHeight(this.activeHole, this.ballGroup.position.x, this.ballGroup.position.z);
        this.playerCharacter.update(dt, this.aimAngleRad, this.ballGroup.position, terrainH);
        this.updateCamera(dt, this.activeHole);
      }

      if (this.composer) {
        // Count the whole frame across composer passes for the stats overlay
        this.renderer.info.autoReset = false;
        this.renderer.info.reset();
        this.composer.render(dt);
      } else {
        this.renderer.info.autoReset = true;
        this.renderer.render(this.scene, this.camera);
      }

      if (this.isSoftwareGl) {
        this.afterDraw(() => {
          this.frameId = requestAnimationFrame(tick);
        });
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    this.frameId = requestAnimationFrame(tick);
  }

  private activeHole: HoleData | null = null;
  public setActiveHole(hole: HoleData) {
    this.activeHole = hole;
  }

  public setActiveWind(wind: { speed: number; angleRad: number }) {
    this.activeWind = wind;
  }

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.isDestroyed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 60);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  /**
   * Starts character kick animation (run-up approach for drive/chip or compact putting stroke)
   */
  public startCharacterKick(kickType: KickType, onContact: () => void, onComplete: () => void) {
    const terrainH = this.activeHole
      ? getTerrainHeight(this.activeHole, this.ballGroup.position.x, this.ballGroup.position.z)
      : this.ballGroup.position.y;
    this.playerCharacter.startKick(
      kickType,
      this.ballGroup.position,
      this.aimAngleRad,
      terrainH,
      onContact,
      onComplete
    );
  }

  /**
   * Instantly bypasses run-up for fast action
   */
  public skipCharacterKick() {
    this.playerCharacter.skipKick();
  }

  /**
   * Triggers victory celebration animation on hole in
   */
  public playCharacterCelebration() {
    this.playerCharacter.playCelebration();
  }

  /**
   * Resets character to idle stance
   */
  public resetCharacterToIdle() {
    this.playerCharacter.resetToIdle();
  }

  /**
   * Updates character stance and positions at new lie when ball comes to rest
   */
  public onBallStopped(newBallPos: Vector3D, newAimAngle: number) {
    const terrainH = this.activeHole
      ? getTerrainHeight(this.activeHole, newBallPos.x, newBallPos.z)
      : newBallPos.y;
    this.playerCharacter.onBallStopped(newBallPos, newAimAngle, terrainH);
  }

  /**
   * Updates player jersey and cleat colors
   */
  public updatePlayerColors(primary: string, secondary: string) {
    this.playerCharacter.setJerseyColors(primary, secondary);
  }

  /**
   * Set custom motion trail configuration or preset style
   */
  public setMotionTrailConfig(config: Partial<MotionTrailConfig> | MotionTrailStyleId) {
    if (typeof config === 'string') {
      this.motionTrailConfig = getMotionTrailPreset(config);
    } else {
      this.motionTrailConfig = {
        ...this.motionTrailConfig,
        ...config,
      };
    }
  }

  /**
   * Quickly switch motion trail preset style
   */
  public setMotionTrailStyle(styleId: MotionTrailStyleId) {
    this.motionTrailConfig = getMotionTrailPreset(styleId);
  }

  /**
   * Get active motion trail configuration
   */
  public getMotionTrailConfig(): MotionTrailConfig {
    return { ...this.motionTrailConfig };
  }

  /**
   * Sets dynamic shot strike parameters that modulate in-flight trail colors
   */
  public setShotDynamics(power: number, spin: SpinControl, strikeRating?: string) {
    this.activeShotPower = Math.max(0.1, Math.min(1.0, power));
    this.activeShotSpin = { top: spin.top || 0, side: spin.side || 0 };
    this.activeStrikeRating = strikeRating || 'standard';
  }

  public dispose() {
    this.isDestroyed = true;
    window.removeEventListener('resize', this.onResize);
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    this.playerCharacter.dispose();

    if (this.flagTexture) this.flagTexture.dispose();
    if (this.grassTexture) this.grassTexture.dispose();
    this.surfaceTexture?.dispose();
    this.envTarget?.dispose();
    this.waterNormalTexture?.dispose();
    this.composer?.dispose();
    if (this.grassBumpTexture) this.grassBumpTexture.dispose();
    if (this.ballTexture) this.ballTexture.dispose();

    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
    this.renderer.dispose();
  }
}
