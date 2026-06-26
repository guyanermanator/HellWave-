/* audio/UIAudio.js — lightweight synthesized menu blips */

class UIAudio {
  constructor() {
    this._ctx = null;
    this._masterVolume = HW.DEFAULT_SETTINGS.masterVolume;
    this._sfxVolume = HW.DEFAULT_SETTINGS.sfxVolume;
  }

  setVolumes(masterVolume, sfxVolume) {
    this._masterVolume = Math.max(0, Math.min(1, masterVolume));
    this._sfxVolume = Math.max(0, Math.min(1, sfxVolume));
  }

  _ensureContext() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!this._ctx) this._ctx = new AudioCtx();
    if (this._ctx.state === 'suspended') this._ctx.resume().catch(() => {});
    return this._ctx;
  }

  blip(type = 'move') {
    const ctx = this._ensureContext();
    if (!ctx) return;

    const volume = this._masterVolume * this._sfxVolume;
    if (volume <= 0) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type === 'confirm' ? 'square' : 'triangle';

    const now = ctx.currentTime;
    const startFreq = type === 'confirm' ? 540 : type === 'back' ? 220 : 360;
    const endFreq = type === 'confirm' ? 760 : type === 'back' ? 160 : 300;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), now + 0.08);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, volume * 0.06), now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  }
}
