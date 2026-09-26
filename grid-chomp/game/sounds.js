// Синтезированные звуки и процедурная фоновая музыка Grid Chomp через Web Audio API.
// Никаких чужих аудиофайлов — только генерация осцилляторами.

import { getSoundPack, getMusicTheme } from '../lib/catalog';

export class SoundManager {
  constructor({ soundPackId = 'classic', musicThemeId = 'ambient' } = {}) {
    this.ctx = null;
    this.muted = false;
    this.musicMuted = false;
    this.musicTimer = null;
    this.musicIndex = 0;
    this.sirenNodes = null;
    this.sirenGain = null;
    this.pack = getSoundPack(soundPackId);
    this.theme = getMusicTheme(musicThemeId);
  }

  setPack(id) {
    this.pack = getSoundPack(id);
    if (this.sirenNodes) this.stopSiren();
  }

  setTheme(id) {
    this.theme = getMusicTheme(id);
    if (this.musicTimer) this.restartMusic();
  }

  setMuted(v) {
    this.muted = v;
    if (v) {
      this.stopSiren();
      this.stopMusic();
    }
  }

  setMusicMuted(v) {
    this.musicMuted = v;
    if (v) this.stopMusic();
    else this.startMusic();
  }

  ensureCtx() {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  tone(freq, duration = 0.1, type = null, volume = 0.15, slideTo = null) {
    if (this.muted) return;
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t = ctx.currentTime;
    osc.type = type || this.pack.wave;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + duration);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  note(freq, duration = 0.5, type = 'sine', volume = 0.04) {
    if (this.muted) return;
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t = ctx.currentTime;
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(volume, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  coin() {
    this.tone(880, 0.07, 'square', 0.05, 1320);
  }

  death() {
    this.tone(this.pack.base, 0.7, 'sawtooth', 0.16, this.pack.base * 0.3);
  }

  shieldHit() {
    this.tone(520, 0.25, 'triangle', 0.14, 260);
  }

  respawn() {
    [1, 1.25, 1.5].forEach((m, i) => {
      setTimeout(() => this.tone(this.pack.base * m, 0.16, 'square', 0.1), i * 90);
    });
  }

  difficultyUp() {
    this.tone(this.pack.base * 1.5, 0.2, 'sawtooth', 0.1, this.pack.base * 2);
  }

  power() {
    [1, 1.3, 1.6, 2].forEach((m, i) => {
      setTimeout(() => this.tone(this.pack.base * m, 0.12, 'square', 0.1), i * 70);
    });
  }

  startSiren() {
    if (this.muted || this.sirenNodes) return;
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const gain = ctx.createGain();
    osc.type = this.pack.wave;
    osc.frequency.value = this.pack.siren;
    lfo.frequency.value = 2.2;
    lfoGain.gain.value = 26;
    gain.gain.value = 0.0;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    lfo.start();
    this.sirenNodes = { osc, lfo, gain };
    this.sirenGain = gain;
  }

  // level: 0..1 — близость полиции (0 — далеко, 1 — вплотную).
  setThreat(level) {
    if (!this.sirenNodes) return;
    const target = Math.max(0, Math.min(1, level)) * 0.05;
    const t = this.ensureCtx()?.currentTime;
    if (t == null) return;
    this.sirenGain.gain.setTargetAtTime(target, t, 0.1);
  }

  stopSiren() {
    if (!this.sirenNodes) return;
    try {
      this.sirenNodes.osc.stop();
      this.sirenNodes.lfo.stop();
      this.sirenNodes.gain.disconnect();
    } catch (e) {
      /* ignore */
    }
    this.sirenNodes = null;
    this.sirenGain = null;
  }

  startMusic() {
    if (this.muted || this.musicMuted) return;
    const ctx = this.ensureCtx();
    if (!ctx || this.musicTimer) return;
    this.musicIndex = 0;
    const intervalMs = Math.max(160, Math.round(1000 / (this.theme.tempo * 2)));

    const playStep = () => {
      if (this.muted || this.musicMuted || !this.musicTimer) return;
      const c = this.ensureCtx();
      if (!c) return;
      const scale = this.theme.scale;
      const deg = scale[this.musicIndex % scale.length];
      const octave = this.musicIndex % 8 === 0 ? 12 : 0;
      const freq = this.theme.base * Math.pow(2, (deg + octave) / 12);
      this.note(freq, 0.5, this.theme.wave, 0.035);
      if (this.musicIndex % 4 === 0) this.note(this.theme.base / 2, 0.9, 'sine', 0.028);
      this.musicIndex = (this.musicIndex + 1) % 64;
    };

    playStep();
    this.musicTimer = setInterval(playStep, intervalMs);
  }

  stopMusic() {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  restartMusic() {
    this.stopMusic();
    this.startMusic();
  }

  pauseAll() {
    this.stopSiren();
  }
}
