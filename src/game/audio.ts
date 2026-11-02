/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { KickType, SurfaceType } from '../types';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  private initCtx(): AudioContext | null {
    if (this.ctx) return this.ctx;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    } catch {
      // AudioContext unavailable
    }
    return this.ctx;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.ctx && muted && this.ctx.state === 'running') {
      this.ctx.suspend();
    } else if (this.ctx && !muted && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  /** Suspends audio while the app is in the background. */
  public suspendForBackground() {
    if (this.ctx && this.ctx.state === 'running') {
      this.ctx.suspend().catch(() => {});
    }
  }

  /** Resumes audio when returning to the foreground (unless muted). */
  public resumeFromBackground() {
    if (this.isMuted) return;
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public resume() {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  }

  /**
   * Powerful soccer boot kick impact
   */
  public playKick(power: number, kickType: KickType) {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;
    this.resume();

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // Frequency sweep for kick thud
    const startFreq = kickType === 'chip' ? 190 : (kickType === 'putt' ? 120 : 160);
    const endFreq = 38;
    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(endFreq, t + 0.12);

    const volume = Math.min(1.0, 0.4 + power * 0.6);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.24);

    // Boot leather click noise burst
    const bufferSize = ctx.sampleRate * 0.05;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.2));
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = kickType === 'putt' ? 600 : 1200;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.3 * volume, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(t);
  }

  /**
   * Crisp acoustic "sweet spot" crack for pure strike
   */
  public playSweetSpotKick(power: number, kickType: KickType) {
    this.playKick(power, kickType);
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(1760, t + 0.08);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.14);
  }

  /**
   * Aerodynamic whoosh sound for practice swings (no ball strike impact)
   */
  public playPracticeWhoosh(power: number) {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;
    this.resume();

    const t = ctx.currentTime;
    const duration = 0.24;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const envelope = Math.sin((Math.PI * i) / bufferSize);
      data[i] = (Math.random() * 2 - 1) * envelope;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    const minFreq = 260;
    const maxFreq = 650 + power * 950;
    filter.frequency.setValueAtTime(minFreq, t);
    filter.frequency.exponentialRampToValueAtTime(maxFreq, t + duration * 0.45);
    filter.frequency.exponentialRampToValueAtTime(minFreq * 0.8, t + duration);
    filter.Q.value = 2.2;

    const gain = ctx.createGain();
    const volume = Math.max(0.18, Math.min(0.6, power * 0.65));
    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(volume, t + duration * 0.4);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start(t);
  }

  /**
   * Surface bounce / thud sound
   */
  public playBounce(surface: SurfaceType, impactSpeed: number) {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;
    this.resume();

    const t = ctx.currentTime;
    const speedFactor = Math.min(1.0, impactSpeed / 12);
    if (speedFactor < 0.08) return;

    if (surface === 'water') {
      this.playSplash();
      return;
    }

    if (surface === 'sand') {
      // Soft muffled sand puff
      const bufLen = ctx.sampleRate * 0.15;
      const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < bufLen; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufLen * 0.3));
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 450;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.5 * speedFactor, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      src.connect(f);
      f.connect(g);
      g.connect(ctx.destination);
      src.start(t);
      return;
    }

    // Grass / Green / Fairway bounce thud
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const freq = surface === 'green' ? 130 : 95;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.08);

    gain.gain.setValueAtTime(0.4 * speedFactor, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  /**
   * Water hazard splash sound
   */
  public playSplash() {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;
    this.resume();

    const t = ctx.currentTime;
    const bufLen = ctx.sampleRate * 0.4;
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufLen * 0.45));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, t);
    filter.frequency.exponentialRampToValueAtTime(250, t + 0.35);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.7, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(t);
  }

  /**
   * Ball sinks into footgolf cup (plastic thud + flag pin chime)
   */
  public playHoleIn() {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;
    this.resume();

    const t = ctx.currentTime;

    // Cup bottom thud
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(55, t + 0.15);
    gain.gain.setValueAtTime(0.6, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.2);

    // Flag pole metallic clink
    const ping = ctx.createOscillator();
    const pingGain = ctx.createGain();
    ping.type = 'sine';
    ping.frequency.setValueAtTime(2150, t + 0.04);
    ping.frequency.exponentialRampToValueAtTime(1900, t + 0.3);
    pingGain.gain.setValueAtTime(0.35, t + 0.04);
    pingGain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    ping.connect(pingGain);
    pingGain.connect(ctx.destination);
    ping.start(t + 0.04);
    ping.stop(t + 0.38);
  }

  /**
   * Resonant metallic ring when ball strikes the flagstick pin directly
   */
  public playPinClink() {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;
    this.resume();

    const t = ctx.currentTime;
    // Dual resonant harmonic frequencies for aluminum pin pole strike
    const freqs = [2650, 3980];
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.94, t + 0.32);

      const vol = idx === 0 ? 0.45 : 0.22;
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.36);
    });
  }

  /**
   * Fanfare melody for Birdie, Eagle, or Hole In One!
   */
  public playFanfare(scoreDelta: number) {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;
    this.resume();

    const t = ctx.currentTime;
    const notes = scoreDelta <= -2
      ? [523.25, 659.25, 783.99, 1046.5] // Eagle / Albatross (C5 - E5 - G5 - C6)
      : [440.0, 554.37, 659.25, 880.0]; // Birdie (A4 - C#5 - E5 - A5)

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + idx * 0.12);

      const noteStart = t + idx * 0.12;
      gain.gain.setValueAtTime(0.35, noteStart);
      gain.gain.exponentialRampToValueAtTime(0.001, noteStart + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(noteStart);
      osc.stop(noteStart + 0.5);
    });

    this.playCrowdCheer();
  }

  /**
   * Crowd cheering / applause simulation with intensity levels
   */
  public playCrowdCheer(intensity: 'applause' | 'cheer' | 'roar' = 'cheer') {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;
    this.resume();

    const t = ctx.currentTime;
    const duration = intensity === 'roar' ? 2.4 : intensity === 'applause' ? 1.2 : 1.7;
    const bufLen = Math.floor(ctx.sampleRate * duration);
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      const progress = i / bufLen;
      // Multi-layer applause with clapping bursts + vocal swell
      const env = Math.pow(Math.sin(progress * Math.PI), 1.2);
      const clapMod = 0.7 + 0.3 * Math.sin(progress * 42.0);
      d[i] = (Math.random() * 2 - 1) * env * clapMod * 0.35;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    const centerFreq = intensity === 'roar' ? 850 : intensity === 'applause' ? 1400 : 1100;
    filter.frequency.setValueAtTime(centerFreq, t);
    filter.Q.value = intensity === 'roar' ? 0.9 : 1.3;

    const peakGain = intensity === 'roar' ? 0.65 : intensity === 'applause' ? 0.3 : 0.45;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(peakGain, t + (intensity === 'roar' ? 0.35 : 0.2));
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration - 0.05);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(t);
  }

  /**
   * Tension heartbeat double-thump for close putting approaches
   */
  public playHeartbeat() {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;
    this.resume();

    const t = ctx.currentTime;
    [0, 0.16].forEach((delay) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(64, t + delay);
      osc.frequency.exponentialRampToValueAtTime(32, t + delay + 0.12);

      gain.gain.setValueAtTime(0.38, t + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.14);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t + delay);
      osc.stop(t + delay + 0.15);
    });
  }

  /**
   * UI Click / Tap
   */
  public playTap() {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;
    this.resume();

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(420, t);
    osc.frequency.exponentialRampToValueAtTime(220, t + 0.04);
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.05);
  }

  /**
   * Tournament match kick-off referee whistle (crisp dual harmonic chirp)
   */
  public playWhistle() {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;
    this.resume();

    const t = ctx.currentTime;
    [2400, 2750].forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.linearRampToValueAtTime(freq + 40, t + 0.06);
      osc.frequency.linearRampToValueAtTime(freq - 30, t + 0.12);
      osc.frequency.linearRampToValueAtTime(freq + 20, t + 0.18);

      gain.gain.setValueAtTime(0.22, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.26);
    });
  }

  /**
   * Resonant chime for clutch long-range hole outs (> 10m)
   */
  public playLongHoleOut() {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;
    this.resume();

    const t = ctx.currentTime;
    const arpeggio = [523.25, 659.25, 783.99, 1046.5, 1318.5]; // C5, E5, G5, C6, E6
    arpeggio.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + idx * 0.08);

      const noteStart = t + idx * 0.08;
      gain.gain.setValueAtTime(0.3, noteStart);
      gain.gain.exponentialRampToValueAtTime(0.001, noteStart + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(noteStart);
      osc.stop(noteStart + 0.52);
    });

    this.playCrowdCheer();
  }

  /**
   * High tension cup rim chatter and lip-out deflection sound
   */
  public playLipOut() {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;
    this.resume();

    const t = ctx.currentTime;

    // 1. Rapid rim scrapes / chatter clicks
    for (let c = 0; c < 4; c++) {
      const clickTime = t + c * 0.045;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1600 + c * 220, clickTime);
      osc.frequency.exponentialRampToValueAtTime(800, clickTime + 0.03);

      gain.gain.setValueAtTime(0.35 - c * 0.06, clickTime);
      gain.gain.exponentialRampToValueAtTime(0.001, clickTime + 0.035);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(clickTime);
      osc.stop(clickTime + 0.04);
    }

    // 2. High metallic rim ring
    const ringOsc = ctx.createOscillator();
    const ringGain = ctx.createGain();
    ringOsc.type = 'sine';
    ringOsc.frequency.setValueAtTime(2150, t);
    ringOsc.frequency.exponentialRampToValueAtTime(1920, t + 0.22);

    ringGain.gain.setValueAtTime(0.32, t);
    ringGain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);

    ringOsc.connect(ringGain);
    ringGain.connect(ctx.destination);
    ringOsc.start(t);
    ringOsc.stop(t + 0.25);

    // Trigger crowd gasp for heart-pounding near-miss drama
    this.playCrowdGasp();
  }

  /**
   * Collective spectator crowd gasp on lip-outs or near misses
   */
  public playCrowdGasp() {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;
    this.resume();

    const t = ctx.currentTime;
    const dur = 0.65;
    const bufLen = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const d = buf.getChannelData(0);

    for (let i = 0; i < bufLen; i++) {
      const p = i / bufLen;
      // Inhalation gasp envelope: fast rise, suspenseful hold, soft breath out
      const env = Math.sin(p * Math.PI) * Math.exp(-p * 0.8);
      d[i] = (Math.random() * 2 - 1) * env * 0.35;
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(680, t);
    filter.frequency.linearRampToValueAtTime(920, t + 0.25);
    filter.frequency.linearRampToValueAtTime(540, t + dur);
    filter.Q.value = 1.6;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(0.28, t + 0.18);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(t);
  }

  /**
   * Fast-forward turbo engage whoosh
   */
  public playTurboWhoosh() {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;
    this.resume();

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(740, t + 0.12);

    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  // --- Procedural Atmospheric Ambience ---
  private ambientGain: GainNode | null = null;
  private ambientFilter: BiquadFilterNode | null = null;
  private ambientSource: AudioBufferSourceNode | null = null;
  private ambientTheme: string = '';

  public startAmbience(theme: string) {
    if (this.isMuted) return;
    if (this.ambientTheme === theme && this.ambientSource) return;
    this.stopAmbience();

    const ctx = this.initCtx();
    if (!ctx) return;
    this.resume();

    this.ambientTheme = theme;
    const durSec = 3.0;
    const bufLen = Math.floor(ctx.sampleRate * durSec);
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const d = buf.getChannelData(0);

    // Procedural soft pink/brown wind noise buffer with crossfaded wrap for seamless looping
    for (let i = 0; i < bufLen; i++) {
      const white = Math.random() * 2 - 1;
      const smooth = Math.sin((i / bufLen) * Math.PI);
      d[i] = white * smooth * 0.18;
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';

    // Tailor acoustic frequency response to course theme
    if (theme === 'desert') {
      filter.frequency.setValueAtTime(320, ctx.currentTime);
      filter.Q.value = 1.8; // Low resonant desert gust
    } else if (theme === 'alpine') {
      filter.frequency.setValueAtTime(580, ctx.currentTime);
      filter.Q.value = 1.0; // Crisper mountain breeze
    } else if (theme === 'japanese_garden') {
      filter.frequency.setValueAtTime(450, ctx.currentTime);
      filter.Q.value = 1.3; // Gentle garden air
    } else {
      filter.frequency.setValueAtTime(500, ctx.currentTime);
      filter.Q.value = 1.2; // Parkland breeze
    }

    const gain = ctx.createGain();
    const targetGain = theme === 'desert' ? 0.06 : 0.045; // Gentle and unobtrusive
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(targetGain, ctx.currentTime + 1.2);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    src.start();
    this.ambientSource = src;
    this.ambientGain = gain;
    this.ambientFilter = filter;
  }

  public updateWindIntensity(windSpeed: number) {
    if (!this.ctx || !this.ambientGain || !this.ambientFilter || this.isMuted) return;
    try {
      const normalized = Math.max(0, Math.min(1, (windSpeed - 1.5) / 7.5));
      const targetGain = (this.ambientTheme === 'desert' ? 0.05 : 0.04) + normalized * 0.05;
      const baseFreq = this.ambientTheme === 'desert' ? 320 : this.ambientTheme === 'alpine' ? 580 : 500;
      const targetFreq = baseFreq + normalized * 320;

      this.ambientGain.gain.linearRampToValueAtTime(targetGain, this.ctx.currentTime + 0.8);
      this.ambientFilter.frequency.linearRampToValueAtTime(targetFreq, this.ctx.currentTime + 0.8);
    } catch {
      // Ignored
    }
  }

  public stopAmbience() {
    if (this.ambientGain && this.ctx) {
      try {
        const curGain = this.ambientGain.gain.value;
        this.ambientGain.gain.setValueAtTime(curGain, this.ctx.currentTime);
        this.ambientGain.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + 0.5);
      } catch {
        // Ignored
      }
    }
    if (this.ambientSource) {
      try {
        this.ambientSource.stop(this.ctx ? this.ctx.currentTime + 0.5 : 0);
      } catch {
        // Ignored
      }
      this.ambientSource = null;
    }
    this.ambientFilter = null;
    this.ambientTheme = '';
  }
}

export const soundEngine = new SoundEngine();

