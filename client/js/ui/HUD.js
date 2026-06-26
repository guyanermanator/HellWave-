/* ui/HUD.js — score, lives, now-playing, waveform, timing */

class HUD {
  constructor() {
    this._scoreEl = document.getElementById('score-value');
    this._livesEl = document.getElementById('hud-lives');
    this._bpmEl = document.getElementById('bpm-value');
    this._beatEl = document.getElementById('beat-indicator');
    this._trackEl = document.getElementById('hud-track-name');
    this._artistEl = document.getElementById('hud-track-artist');
    this._elapsedEl = document.getElementById('hud-time-elapsed');
    this._durationEl = document.getElementById('hud-time-duration');
    this._progressFill = document.getElementById('hud-progress-fill');
    this._waveformCanvas = document.getElementById('hud-waveform');
    this._thumbImg = document.getElementById('hud-thumbnail-img');
    this._statusEl = document.getElementById('hud-track-status');
    this._lastScore = -1;
    this._lastLives = -1;
    this._beatFlash = 0;
    this._waveform = [];
    this._waveformDirty = true;
  }

  configureTrack(trackData = {}) {
    this._trackEl.textContent = trackData.title || 'Unknown Track';
    this._artistEl.textContent = trackData.artist || 'YouTube';
    this._bpmEl.textContent = trackData.bpm ? Math.round(trackData.bpm) : '--';
    this._durationEl.textContent = this._formatTime(trackData.duration || 0);
    this._elapsedEl.textContent = this._formatTime(0);
    this._statusEl.textContent = trackData.analysisKey ? 'Synced seed ready' : 'Demo mode';
    this._waveform = Array.isArray(trackData.waveform) ? trackData.waveform : [];
    this._waveformDirty = true;
    if (this._thumbImg) {
      this._thumbImg.src = trackData.thumbnail || `https://i.ytimg.com/vi/${trackData.videoId || 'dQw4w9WgXcQ'}/hqdefault.jpg`;
      this._thumbImg.alt = trackData.title || 'Track artwork';
    }
    this._drawWaveform(0);
  }

  onBeat() {
    this._beatEl.classList.add('pulse');
    this._beatFlash = 0.3;
  }

  update(state, beatTracker, currentTime, duration, freqFrame = {}) {
    if (state.score !== this._lastScore) {
      this._scoreEl.textContent = state.score.toLocaleString();
      this._lastScore = state.score;
    }

    if (state.lives !== this._lastLives) {
      this._livesEl.innerHTML = '';
      for (let i = 0; i < HW.PLAYER_LIVES; i++) {
        const icon = document.createElement('div');
        icon.className = 'life-icon' + (i >= state.lives ? ' lost' : '');
        this._livesEl.appendChild(icon);
      }
      this._lastLives = state.lives;
    }

    if (this._beatFlash > 0) {
      this._beatFlash -= 0.016;
      if (this._beatFlash <= 0) {
        this._beatEl.classList.remove('pulse');
        this._beatFlash = 0;
      }
    }

    const progress = duration > 0 ? Math.max(0, Math.min(1, currentTime / duration)) : 0;
    this._elapsedEl.textContent = this._formatTime(currentTime);
    if (this._progressFill) this._progressFill.style.width = `${Math.round(progress * 100)}%`;
    this._drawWaveform(progress, freqFrame);
  }

  _drawWaveform(progress, freqFrame = {}) {
    if (!this._waveformCanvas) return;
    const ctx = this._waveformCanvas.getContext('2d');
    const w = this._waveformCanvas.width;
    const h = this._waveformCanvas.height;
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(0, 0, w, h);

    const bars = this._waveform.length ? this._waveform : new Array(HW.UI_WAVEFORM_POINTS).fill(0.3);
    const step = w / bars.length;
    for (let i = 0; i < bars.length; i++) {
      const value = bars[i] || 0;
      const barH = Math.max(2, value * h);
      const x = i * step;
      ctx.fillStyle = i / bars.length <= progress ? '#44ccff' : 'rgba(170,102,255,0.55)';
      ctx.fillRect(x, h - barH, Math.max(1, step - 1), barH);
    }

    const playheadX = progress * w;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(playheadX, 0, 2, h);

    const accent = ((freqFrame.sub || 0) + (freqFrame.bass || 0) + (freqFrame.presence || 0)) / 3;
    ctx.fillStyle = `rgba(255,255,255,${0.05 + accent * 0.18})`;
    ctx.fillRect(0, 0, w, h);
  }

  _formatTime(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    const mins = Math.floor(sec / 60);
    const secs = String(sec % 60).padStart(2, '0');
    return `${mins}:${secs}`;
  }
}
