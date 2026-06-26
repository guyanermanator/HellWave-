/* ui/HUD.js — score, lives, BPM, beat indicator */

class HUD {
  constructor(canvas) {
    this._scoreEl    = document.getElementById('score-value');
    this._livesEl    = document.getElementById('hud-lives');
    this._bpmEl      = document.getElementById('bpm-value');
    this._beatEl     = document.getElementById('beat-indicator');
    this._trackEl    = document.getElementById('hud-track-name');
    this._lastScore  = -1;
    this._lastLives  = -1;
    this._beatFlash  = 0;
  }

  setTrackName(name) {
    this._trackEl.textContent = name || '';
  }

  setBPM(bpm) {
    this._bpmEl.textContent = bpm ? Math.round(bpm) : '--';
  }

  onBeat() {
    this._beatEl.classList.add('pulse');
    this._beatFlash = 0.3;
  }

  update(state, beatTracker) {
    // Score (only update DOM if changed)
    if (state.score !== this._lastScore) {
      this._scoreEl.textContent = state.score.toLocaleString();
      this._lastScore = state.score;
    }

    // Lives
    if (state.lives !== this._lastLives) {
      this._livesEl.innerHTML = '';
      for (let i = 0; i < HW.PLAYER_LIVES; i++) {
        const icon = document.createElement('div');
        icon.className = 'life-icon' + (i >= state.lives ? ' lost' : '');
        this._livesEl.appendChild(icon);
      }
      this._lastLives = state.lives;
    }

    // Beat flash
    if (this._beatFlash > 0) {
      this._beatFlash -= 0.016;
      if (this._beatFlash <= 0) {
        this._beatEl.classList.remove('pulse');
        this._beatFlash = 0;
      }
    }
  }
}
