/* game/EnemyManager.js
 *
 * Spawns and manages all enemies. Spawn rate and enemy type are driven by
 * audio frequency data (bass → tanky enemies, mid → normal, high → fast ones).
 * Bosses spawn every N waves (configurable).
 */

class EnemyManager {
  constructor(canvas) {
    this._canvas = canvas;
    this._enemies = [];
    this._spawnTimer = 0;
    this._wave = 0;
    this._bossSpawnWave = 8;   // spawn a boss every N waves
    this._difficultyScale = 1;
    this._currentFreq = { bass: 0.5, mid: 0.5, high: 0.5 };
  }

  get enemies() { return this._enemies; }

  onFreqFrame(frame) {
    this._currentFreq = frame;
  }

  onBeat(beatIdx) {
    // Notify all BeatEnemies of the beat
    for (const e of this._enemies) {
      if (typeof e.onBeat === 'function') e.onBeat(beatIdx);
    }
  }

  update(dt, beatTracker, player) {
    const freq = this._currentFreq;

    // Dynamic spawn interval: shorter when music is intense
    const intensity = (freq.bass + freq.mid + freq.high) / 3;
    const spawnInterval = Math.max(0.4, 2.5 - intensity * 2 - this._difficultyScale * 0.05);

    this._spawnTimer -= dt;
    if (this._spawnTimer <= 0) {
      this._spawnTimer = spawnInterval;
      this._spawnWave(freq);
      this._wave++;
    }

    const px = player ? player.x : this._canvas.width / 2;
    const py = player ? player.y : this._canvas.height - 80;

    for (const e of this._enemies) {
      if (!e.active) continue;
      e.update(dt, beatTracker, freq, px, py);
    }

    // Remove off-screen and dead
    this._enemies = this._enemies.filter(e => e.active && !e.isOffScreen(this._canvas.height));
  }

  _spawnWave(freq) {
    // Boss wave
    if (this._wave > 0 && this._wave % this._bossSpawnWave === 0) {
      this._enemies.push(new BossEnemy(this._canvas.width / 2, -50));
      return;
    }

    // Decide enemy types based on frequency energies
    const count = Math.max(1, Math.round(1 + freq.mid * 3 + this._difficultyScale * 0.1));
    for (let i = 0; i < count; i++) {
      const x = 30 + Math.random() * (this._canvas.width - 60);
      const y = -20 - i * 20;

      let enemy;
      const roll = Math.random();
      if (freq.bass > 0.7 && roll < 0.4) {
        enemy = new BeatEnemy(x, y);
      } else if (freq.high > 0.6 && roll < 0.5) {
        enemy = new FrequencyEnemy(x, y);
      } else {
        enemy = new BasicEnemy(x, y);
      }
      this._enemies.push(enemy);
    }

    this._difficultyScale = Math.min(10, this._difficultyScale + 0.05);
  }

  /** Returns all enemy bullets from this frame */
  collectBullets() {
    const bullets = [];
    for (const e of this._enemies) {
      const eb = e.getBullets();
      bullets.push(...eb);
    }
    return bullets;
  }

  draw(ctx) {
    for (const e of this._enemies) e.draw(ctx);
  }

  clear() {
    this._enemies = [];
    this._wave = 0;
    this._difficultyScale = 1;
    this._spawnTimer = 0;
  }
}
