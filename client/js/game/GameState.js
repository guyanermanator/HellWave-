/* game/GameState.js — score, combo rank, lives tracking */

class GameState {
  constructor() {
    this.reset();
  }

  reset() {
    this.score = 0;
    this.comboPoints = 0;
    this.comboRankIdx = 0;
    this.maxComboRankIdx = 0;
    this.lives = HW.PLAYER_LIVES;
    this.paused = false;
    this.gameOver = false;
  }

  get comboRank() { return HW.COMBO_RANKS[this.comboRankIdx]; }
  get maxComboRank() { return HW.COMBO_RANKS[this.maxComboRankIdx]; }
  get scoreMultiplier() { return this.comboRank.mult; }

  /** Add raw points (before combo multiplier) */
  addScore(base, withComboMultiplier = true) {
    const mult = withComboMultiplier ? this.scoreMultiplier : 1;
    this.score = Math.max(0, this.score + Math.round(base * mult));
  }

  /** Modify combo meter */
  addCombo(delta) {
    this.comboPoints = Math.max(0, this.comboPoints + delta);
    this._updateRank();
  }

  _updateRank() {
    const ranks = HW.COMBO_RANKS;
    let newIdx = 0;
    for (let i = ranks.length - 1; i >= 0; i--) {
      if (this.comboPoints >= ranks[i].min) { newIdx = i; break; }
    }
    this.comboRankIdx = newIdx;
    if (newIdx > this.maxComboRankIdx) this.maxComboRankIdx = newIdx;
  }

  get comboBarFill() {
    const ranks = HW.COMBO_RANKS;
    const current = ranks[this.comboRankIdx];
    const next = ranks[Math.min(this.comboRankIdx + 1, ranks.length - 1)];
    if (this.comboRankIdx === ranks.length - 1) return 1; // SSS — full
    const range = next.min - current.min;
    return Math.min(1, (this.comboPoints - current.min) / range);
  }

  onPlayerHit() {
    this.lives--;
    this.addCombo(HW.COMBO_DAMAGE);
    if (this.lives <= 0) this.gameOver = true;
  }

  onEnemyKill(enemy, onBeat) {
    const base = enemy.score;
    this.addScore(base);
    if (onBeat) this.addCombo(HW.COMBO_ON_BEAT_KILL);
    return base;
  }

  onPlayerShot(hit, onBeat) {
    if (hit && onBeat) this.addCombo(HW.COMBO_ON_BEAT_SHOT);
    else if (!hit && !onBeat) this.addCombo(HW.COMBO_OFF_BEAT);
  }
}
