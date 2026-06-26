/* ui/ComboMeter.js — DMC-style E→SSS combo display */

class ComboMeter {
  constructor() {
    this._rankEl   = document.getElementById('combo-rank-text');
    this._barFill  = document.getElementById('combo-bar-fill');
    this._ptsEl    = document.getElementById('combo-points-text');
    this._exciteEl = document.getElementById('combo-excited-text');
    this._lastRankIdx = 0;
    this._rainbowAngle = 0;
  }

  update(state, dt) {
    const rank = state.comboRank;
    const fill = state.comboBarFill;

    // Rank text
    this._rankEl.textContent = rank.rank;

    // SSS gets rainbow color
    if (rank.rank === 'SSS') {
      this._rainbowAngle = (this._rainbowAngle + dt * 180) % 360;
      const hue = this._rainbowAngle;
      const color = `hsl(${hue},100%,65%)`;
      this._rankEl.style.color = color;
      this._rankEl.style.textShadow = `0 0 16px hsl(${hue},100%,75%)`;
      this._barFill.style.background = color;
      this._barFill.style.color = color;
    } else {
      this._rankEl.style.color = rank.color;
      this._rankEl.style.textShadow = `0 0 12px ${rank.color}`;
      this._barFill.style.background = rank.color;
    }

    this._barFill.style.width = `${fill * 100}%`;
    this._ptsEl.textContent = state.comboPoints;

    // Excited text
    if (rank.text && state.comboRankIdx > 0) {
      this._exciteEl.textContent = rank.text;
      this._exciteEl.style.color = rank.rank === 'SSS'
        ? `hsl(${this._rainbowAngle},100%,70%)`
        : rank.color;
      this._exciteEl.classList.remove('hidden');
    } else {
      this._exciteEl.classList.add('hidden');
    }

    // Rank-up animation: briefly enlarge rank text
    if (state.comboRankIdx !== this._lastRankIdx) {
      this._rankEl.style.fontSize = state.comboRankIdx > this._lastRankIdx ? '2rem' : '1.4rem';
      setTimeout(() => { this._rankEl.style.fontSize = ''; }, 200);
      this._lastRankIdx = state.comboRankIdx;
    }
  }
}
