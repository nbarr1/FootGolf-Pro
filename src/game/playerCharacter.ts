/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { KickType, Vector3D } from '../types';

export type CharacterAnimState = 'idle' | 'runup' | 'putting' | 'follow_through_hold' | 'celebrate' | 'hidden';

export class PlayerCharacter {
  public group: THREE.Group;

  // Hierarchical Body Parts for Procedural Skeletal Animation
  private rootPivot: THREE.Group;
  private torsoGroup: THREE.Group;
  private headGroup: THREE.Group;
  private leftArm: THREE.Group;
  private rightArm: THREE.Group;
  private leftLeg: THREE.Group;
  private rightLeg: THREE.Group;
  private rightKickingFoot: THREE.Group;

  // Materials for dynamic styling
  private jerseyMaterial: THREE.MeshStandardMaterial;
  private shortsMaterial: THREE.MeshStandardMaterial;
  private skinMaterial: THREE.MeshStandardMaterial;
  private cleatMaterial: THREE.MeshStandardMaterial;
  private sockMaterial: THREE.MeshStandardMaterial;

  // Animation State
  private animState: CharacterAnimState = 'idle';
  private animTimer: number = 0;
  private animDuration: number = 0;
  private kickType: KickType = 'drive';
  private onContactCallback: (() => void) | null = null;
  private onCompleteCallback: (() => void) | null = null;
  private hasTriggeredContact: boolean = false;

  // Stance and targeting offsets
  private currentAimAngle: number = 0;
  private ballPosition: Vector3D = { x: 0, y: 0, z: 0 };
  private approachDistance: number = 1.45;

  // Anchored kick origin to ensure player remains stationary at kick spot during flight
  private kickOrigin: Vector3D = { x: 0, y: 0, z: 0 };
  private kickAimAngle: number = 0;
  private kickTerrainHeight: number = 0;

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'PlayerCharacter';

    // Materials
    this.jerseyMaterial = new THREE.MeshStandardMaterial({
      color: 0x10b981, // Emerald jersey by default
      roughness: 0.65,
      metalness: 0.05,
    });
    this.shortsMaterial = new THREE.MeshStandardMaterial({
      color: 0x0f172a, // Slate navy shorts
      roughness: 0.8,
    });
    this.skinMaterial = new THREE.MeshStandardMaterial({
      color: 0xe2a882, // Athletic skin tone
      roughness: 0.75,
    });
    this.sockMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff, // White athletic socks
      roughness: 0.6,
    });
    this.cleatMaterial = new THREE.MeshStandardMaterial({
      color: 0xf59e0b, // Amber soccer cleats
      roughness: 0.35,
      metalness: 0.25,
    });

    this.rootPivot = new THREE.Group();
    this.group.add(this.rootPivot);

    // Build the athletic player model
    this.torsoGroup = new THREE.Group();
    this.headGroup = new THREE.Group();
    this.leftArm = new THREE.Group();
    this.rightArm = new THREE.Group();
    this.leftLeg = new THREE.Group();
    this.rightLeg = new THREE.Group();
    this.rightKickingFoot = new THREE.Group();

    this.buildCharacterMesh();
  }

  private buildCharacterMesh() {
    // Height of athlete: ~1.78m
    // Hips level: y = 0.92m
    const hipsY = 0.92;

    // 1. Pelvis / Shorts
    const hipsGeom = new THREE.CylinderGeometry(0.18, 0.16, 0.22, 8);
    const hipsMesh = new THREE.Mesh(hipsGeom, this.shortsMaterial);
    hipsMesh.position.y = hipsY;
    this.rootPivot.add(hipsMesh);

    // 2. Torso & Jersey
    this.torsoGroup.position.set(0, hipsY + 0.1, 0);
    const torsoGeom = new THREE.CylinderGeometry(0.22, 0.18, 0.44, 8);
    const torsoMesh = new THREE.Mesh(torsoGeom, this.jerseyMaterial);
    torsoMesh.position.y = 0.22;
    this.torsoGroup.add(torsoMesh);

    // Jersey Collar Trim
    const collarGeom = new THREE.TorusGeometry(0.09, 0.02, 6, 12);
    collarGeom.rotateX(Math.PI / 2);
    const collarMesh = new THREE.Mesh(collarGeom, this.sockMaterial);
    collarMesh.position.y = 0.44;
    this.torsoGroup.add(collarMesh);

    // 3. Head & Hair
    this.headGroup.position.set(0, 0.48, 0);
    const neckGeom = new THREE.CylinderGeometry(0.065, 0.075, 0.1, 8);
    const neckMesh = new THREE.Mesh(neckGeom, this.skinMaterial);
    neckMesh.position.y = 0.04;
    this.headGroup.add(neckMesh);

    const headGeom = new THREE.SphereGeometry(0.115, 8, 8);
    const headMesh = new THREE.Mesh(headGeom, this.skinMaterial);
    headMesh.position.y = 0.16;
    headMesh.scale.set(1.0, 1.15, 1.05);
    this.headGroup.add(headMesh);

    // Hair / Headband
    const hairGeom = new THREE.SphereGeometry(0.12, 8, 8, 0, Math.PI * 2, 0, Math.PI * 0.55);
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.9 });
    const hairMesh = new THREE.Mesh(hairGeom, hairMat);
    hairMesh.position.y = 0.18;
    this.headGroup.add(hairMesh);

    this.torsoGroup.add(this.headGroup);

    // 4. Arms
    // Left Arm (Plant side balance)
    this.leftArm.position.set(-0.25, 0.38, 0);
    const armGeom = new THREE.CylinderGeometry(0.05, 0.045, 0.42, 6);
    armGeom.translate(0, -0.2, 0);
    const lArmMesh = new THREE.Mesh(armGeom, this.skinMaterial);
    this.leftArm.add(lArmMesh);
    this.torsoGroup.add(this.leftArm);

    // Right Arm (Swing balance)
    this.rightArm.position.set(0.25, 0.38, 0);
    const rArmMesh = new THREE.Mesh(armGeom, this.skinMaterial);
    this.rightArm.add(rArmMesh);
    this.torsoGroup.add(this.rightArm);

    this.rootPivot.add(this.torsoGroup);

    // 5. Left Leg (Plant leg)
    this.leftLeg.position.set(-0.11, hipsY - 0.05, 0);
    const thighGeom = new THREE.CylinderGeometry(0.07, 0.055, 0.44, 6);
    thighGeom.translate(0, -0.2, 0);
    const lThighMesh = new THREE.Mesh(thighGeom, this.shortsMaterial);
    this.leftLeg.add(lThighMesh);

    // Left Shin & Sock
    const shinGeom = new THREE.CylinderGeometry(0.055, 0.045, 0.42, 6);
    shinGeom.translate(0, -0.6, 0);
    const lShinMesh = new THREE.Mesh(shinGeom, this.sockMaterial);
    this.leftLeg.add(lShinMesh);

    // Left Cleat
    const cleatGeom = new THREE.BoxGeometry(0.1, 0.07, 0.22);
    cleatGeom.translate(0, -0.83, 0.05);
    const lCleatMesh = new THREE.Mesh(cleatGeom, this.cleatMaterial);
    this.leftLeg.add(lCleatMesh);

    this.rootPivot.add(this.leftLeg);

    // 6. Right Leg (Kicking leg)
    this.rightLeg.position.set(0.11, hipsY - 0.05, 0);
    const rThighMesh = new THREE.Mesh(thighGeom, this.shortsMaterial);
    this.rightLeg.add(rThighMesh);

    const rShinMesh = new THREE.Mesh(shinGeom, this.sockMaterial);
    this.rightLeg.add(rShinMesh);

    // Right Cleat (with separate pivot for kicking snap)
    this.rightKickingFoot.position.set(0, -0.83, 0.05);
    const rCleatMesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.22), this.cleatMaterial);
    this.rightKickingFoot.add(rCleatMesh);
    this.rightLeg.add(this.rightKickingFoot);

    this.rootPivot.add(this.rightLeg);

    // Cast shadows
    this.group.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = false;
      }
    });
  }

  /**
   * Set custom jersey and cleat colors
   */
  public setJerseyColors(primaryHex: string, secondaryHex: string) {
    this.jerseyMaterial.color.set(primaryHex);
    this.cleatMaterial.color.set(secondaryHex);
  }

  /**
   * Update character position, posture, and procedural skeletal animation frame
   */
  public update(dt: number, aimAngle: number, ballPos: Vector3D, terrainHeight: number) {
    if (this.animState === 'hidden') {
      this.group.visible = false;
      return;
    }
    this.group.visible = true;

    this.currentAimAngle = aimAngle;
    this.ballPosition = ballPos;

    // Normalizing angle forward vector
    const forwardX = Math.sin(aimAngle);
    const forwardZ = Math.cos(aimAngle);
    const lateralX = Math.cos(aimAngle);
    const lateralZ = -Math.sin(aimAngle);

    if (this.animState === 'idle') {
      this.animTimer += dt;
      // Natural idle stance: positioned ~0.38m to the left and 0.18m behind the ball
      const stanceX = ballPos.x - lateralX * 0.38 - forwardX * 0.18;
      const stanceZ = ballPos.z - lateralZ * 0.38 - forwardZ * 0.18;
      const stanceY = terrainHeight;

      this.group.position.set(stanceX, stanceY, stanceZ);
      this.group.rotation.y = aimAngle;

      // Gentle natural breathing and idle weight shifting
      const breath = Math.sin(this.animTimer * 2.5);
      this.torsoGroup.position.y = 1.02 + breath * 0.012;
      this.headGroup.rotation.set(0.18 + Math.cos(this.animTimer * 1.8) * 0.03, 0, 0); // Eyes looking down at ball
      this.leftArm.rotation.set(breath * 0.05, 0, 0);
      this.rightArm.rotation.set(-breath * 0.05, 0, 0);
      this.rightLeg.rotation.set(0.04, 0, 0);
      this.leftLeg.rotation.set(-0.02, 0, 0);
      this.rightKickingFoot.rotation.set(0, 0, 0);
    } else if (this.animState === 'runup') {
      this.animTimer += dt;
      const progress = Math.min(1.0, this.animTimer / this.animDuration);

      // Contact occurs at exactly progress = 0.72 (~0.32s into a 0.44s approach)
      const contactPoint = 0.72;

      if (!this.hasTriggeredContact && progress >= contactPoint) {
        this.hasTriggeredContact = true;
        this.onContactCallback?.();
      }

      // Calculations anchored strictly to kick origin so ball flight never moves the character
      const origForwardX = Math.sin(this.kickAimAngle);
      const origForwardZ = Math.cos(this.kickAimAngle);
      const origLateralX = Math.cos(this.kickAimAngle);
      const origLateralZ = -Math.sin(this.kickAimAngle);

      if (progress < contactPoint) {
        // Phase 1: Approach Run-Up acceleration towards the ball
        const stepProgress = progress / contactPoint;
        const currentApproachDist = (1 - stepProgress) * this.approachDistance + 0.18;
        const posX = this.kickOrigin.x - origLateralX * 0.32 - origForwardX * currentApproachDist;
        const posZ = this.kickOrigin.z - origLateralZ * 0.32 - origForwardZ * currentApproachDist;
        this.group.position.set(posX, this.kickTerrainHeight, posZ);
        this.group.rotation.y = this.kickAimAngle;

        // Running strides: alternating leg swings
        const strideAngle = Math.sin(stepProgress * Math.PI * 4) * 0.65;
        this.leftLeg.rotation.set(strideAngle, 0, 0);
        this.rightLeg.rotation.set(-strideAngle, 0, 0);
        this.leftArm.rotation.set(-strideAngle * 0.8, 0, 0);
        this.rightArm.rotation.set(strideAngle * 0.8, 0, 0);

        // Backswing right leg right before contact (progress 0.5 -> 0.72)
        if (stepProgress > 0.6) {
          const backswing = (stepProgress - 0.6) / 0.4;
          this.rightLeg.rotation.x = -0.85 * backswing; // Big windup!
          this.torsoGroup.rotation.x = -0.25 * backswing; // Lean forward
          this.leftArm.rotation.z = -0.4 * backswing; // Arm balance
        }
      } else {
        // Phase 2: Impact and Follow-Through kick snap (anchored at kick origin)
        const followProgress = (progress - contactPoint) / (1 - contactPoint);
        const posX = this.kickOrigin.x - origLateralX * 0.32 - origForwardX * 0.12;
        const posZ = this.kickOrigin.z - origLateralZ * 0.32 - origForwardZ * 0.12;
        this.group.position.set(posX, this.kickTerrainHeight, posZ);
        this.group.rotation.y = this.kickAimAngle;

        // Kicking leg whips forward and high
        const kickSnap = Math.sin(followProgress * Math.PI * 0.5);
        this.rightLeg.rotation.set(0.95 * kickSnap, 0, 0);
        this.rightKickingFoot.rotation.set(0.4 * kickSnap, 0, 0);
        this.leftLeg.rotation.set(-0.15, 0, 0); // Solid plant
        this.torsoGroup.rotation.set(0.15 * kickSnap, 0, 0); // Recline on follow-through
        this.rightArm.rotation.set(-0.7 * kickSnap, 0, 0);
        this.leftArm.rotation.set(0.5 * kickSnap, 0, 0);
      }

      if (progress >= 1.0) {
        // Instead of returning to idle and sliding with moving ball, hold follow-through at kick origin!
        this.animState = 'follow_through_hold';
        this.animTimer = 0;
        this.onCompleteCallback?.();
      }
    } else if (this.animState === 'putting') {
      this.animTimer += dt;
      const progress = Math.min(1.0, this.animTimer / this.animDuration);
      const contactPoint = 0.55;

      if (!this.hasTriggeredContact && progress >= contactPoint) {
        this.hasTriggeredContact = true;
        this.onContactCallback?.();
      }

      const origForwardX = Math.sin(this.kickAimAngle);
      const origForwardZ = Math.cos(this.kickAimAngle);
      const origLateralX = Math.cos(this.kickAimAngle);
      const origLateralZ = -Math.sin(this.kickAimAngle);

      // Compact balanced putting stance beside ball at kick origin
      const posX = this.kickOrigin.x - origLateralX * 0.32 - origForwardX * 0.08;
      const posZ = this.kickOrigin.z - origLateralZ * 0.32 - origForwardZ * 0.08;
      this.group.position.set(posX, this.kickTerrainHeight, posZ);
      this.group.rotation.y = this.kickAimAngle;

      if (progress < contactPoint) {
        // Draw foot back in smooth pendulum
        const p = progress / contactPoint;
        this.rightLeg.rotation.set(-0.32 * Math.sin(p * Math.PI * 0.5), 0, 0);
        this.torsoGroup.rotation.set(0.12, 0, 0);
        this.headGroup.rotation.set(0.35, 0, 0); // Looking directly down at ball
      } else {
        // Gentle forward stroke through the ball
        const p = (progress - contactPoint) / (1 - contactPoint);
        this.rightLeg.rotation.set(0.38 * Math.sin(p * Math.PI * 0.5), 0, 0);
      }

      if (progress >= 1.0) {
        // Hold putting finish pose at the putt spot while ball rolls
        this.animState = 'follow_through_hold';
        this.animTimer = 0;
        this.onCompleteCallback?.();
      }
    } else if (this.animState === 'follow_through_hold') {
      this.animTimer += dt;
      // Stays strictly stationary at the kick spot throughout the ball's flight
      const origForwardX = Math.sin(this.kickAimAngle);
      const origForwardZ = Math.cos(this.kickAimAngle);
      const origLateralX = Math.cos(this.kickAimAngle);
      const origLateralZ = -Math.sin(this.kickAimAngle);

      const offsetDist = this.kickType === 'putt' ? 0.08 : 0.12;
      const posX = this.kickOrigin.x - origLateralX * 0.32 - origForwardX * offsetDist;
      const posZ = this.kickOrigin.z - origLateralZ * 0.32 - origForwardZ * offsetDist;
      this.group.position.set(posX, this.kickTerrainHeight, posZ);
      this.group.rotation.y = this.kickAimAngle;

      if (this.kickType === 'putt') {
        // Putting follow-through hold
        this.rightLeg.rotation.set(0.25, 0, 0);
        this.leftLeg.rotation.set(-0.02, 0, 0);
        this.torsoGroup.rotation.set(0.06, 0, 0);
        this.leftArm.rotation.set(0.1, 0, 0);
        this.rightArm.rotation.set(-0.1, 0, 0);
      } else {
        // Full kick follow-through hold: balanced stance watching the shot
        const microBreathe = Math.sin(this.animTimer * 2.2) * 0.02;
        this.rightLeg.rotation.set(0.72 + microBreathe, 0, 0);
        this.rightKickingFoot.rotation.set(0.25, 0, 0);
        this.leftLeg.rotation.set(-0.12, 0, 0); // Solid grounded plant leg
        this.torsoGroup.rotation.set(0.1 + microBreathe, 0, 0);
        this.rightArm.rotation.set(-0.55, 0, 0);
        this.leftArm.rotation.set(0.45, 0, 0);
      }

      // Athletic head tracking: eyes track the ball flying and rolling downfield
      const dx = ballPos.x - posX;
      const dy = ballPos.y - (this.kickTerrainHeight + 1.55);
      const dz = ballPos.z - posZ;
      const horizDist = Math.hypot(dx, dz);
      if (horizDist > 0.6) {
        const ballHeading = Math.atan2(dx, dz);
        let headYaw = ballHeading - this.kickAimAngle;
        while (headYaw > Math.PI) headYaw -= Math.PI * 2;
        while (headYaw < -Math.PI) headYaw += Math.PI * 2;
        this.headGroup.rotation.y = THREE.MathUtils.clamp(headYaw, -0.75, 0.75);

        const pitch = Math.atan2(dy, horizDist);
        this.headGroup.rotation.x = THREE.MathUtils.clamp(-pitch + 0.08, -0.45, 0.45);
      }
    } else if (this.animState === 'celebrate') {
      this.animTimer += dt;
      // Fist pump celebration!
      const pump = Math.sin(this.animTimer * 6.0);
      this.rightArm.rotation.set(-2.2 + pump * 0.3, 0, 0); // Right arm punching air
      this.leftArm.rotation.set(-1.8, 0, 0);
      this.torsoGroup.rotation.set(0, Math.sin(this.animTimer * 3.0) * 0.2, 0);
    }
  }

  /**
   * Triggers the animated kick run-up or putting stroke anchored at the given origin
   */
  public startKick(
    kickType: KickType,
    originPos: Vector3D,
    aimAngle: number,
    terrainHeight: number,
    onContact: () => void,
    onComplete: () => void
  ) {
    this.kickType = kickType;
    this.kickOrigin = { x: originPos.x, y: originPos.y, z: originPos.z };
    this.kickAimAngle = aimAngle;
    this.kickTerrainHeight = terrainHeight;
    this.onContactCallback = onContact;
    this.onCompleteCallback = onComplete;
    this.hasTriggeredContact = false;
    this.animTimer = 0;

    if (kickType === 'putt') {
      this.animState = 'putting';
      this.animDuration = 0.38; // 380ms smooth pendulum putting stroke
    } else {
      this.animState = 'runup';
      this.animDuration = 0.44; // 440ms dynamic 2-step run-up and strike
    }
  }

  /**
   * Instantly bypasses run-up for speedrun or immediate action, holding follow-through at origin
   */
  public skipKick() {
    if ((this.animState === 'runup' || this.animState === 'putting') && !this.hasTriggeredContact) {
      this.hasTriggeredContact = true;
      this.onContactCallback?.();
    }
    this.animState = 'follow_through_hold';
    this.animTimer = 0;
    this.onCompleteCallback?.();
  }

  /**
   * Called when the ball comes to a complete rest: instantly positions character at new ball lie
   */
  public onBallStopped(newBallPos: Vector3D, newAimAngle: number, newTerrainHeight: number) {
    if (this.animState === 'celebrate') return;

    this.animState = 'idle';
    this.animTimer = 0;
    this.hasTriggeredContact = false;
    this.ballPosition = { ...newBallPos };
    this.currentAimAngle = newAimAngle;

    // Immediately place character at the new ball lie
    const forwardX = Math.sin(newAimAngle);
    const forwardZ = Math.cos(newAimAngle);
    const lateralX = Math.cos(newAimAngle);
    const lateralZ = -Math.sin(newAimAngle);

    const stanceX = newBallPos.x - lateralX * 0.38 - forwardX * 0.18;
    const stanceZ = newBallPos.z - lateralZ * 0.38 - forwardZ * 0.18;
    const stanceY = newTerrainHeight;

    this.group.position.set(stanceX, stanceY, stanceZ);
    this.group.rotation.y = newAimAngle;

    // Reset limbs to neutral idle stance
    this.headGroup.rotation.set(0.18, 0, 0);
    this.torsoGroup.rotation.set(0, 0, 0);
    this.leftLeg.rotation.set(-0.02, 0, 0);
    this.rightLeg.rotation.set(0.04, 0, 0);
    this.rightKickingFoot.rotation.set(0, 0, 0);
    this.leftArm.rotation.set(0, 0, 0);
    this.rightArm.rotation.set(0, 0, 0);
  }

  /**
   * Celebrate a holed putt or eagle!
   */
  public playCelebration() {
    this.animState = 'celebrate';
    this.animTimer = 0;
  }

  /**
   * Reset to idle stance
   */
  public resetToIdle() {
    this.animState = 'idle';
    this.animTimer = 0;
    this.hasTriggeredContact = false;
    this.headGroup.rotation.set(0.18, 0, 0);
    this.torsoGroup.rotation.set(0, 0, 0);
    this.leftLeg.rotation.set(-0.02, 0, 0);
    this.rightLeg.rotation.set(0.04, 0, 0);
    this.rightKickingFoot.rotation.set(0, 0, 0);
    this.leftArm.rotation.set(0, 0, 0);
    this.rightArm.rotation.set(0, 0, 0);
  }

  public setVisible(visible: boolean) {
    this.group.visible = visible;
  }

  public dispose() {
    this.jerseyMaterial.dispose();
    this.shortsMaterial.dispose();
    this.skinMaterial.dispose();
    this.cleatMaterial.dispose();
    this.sockMaterial.dispose();
  }
}
