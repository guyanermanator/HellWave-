/* game/Game.js — main game loop and orchestration */

class Game {
  constructor(canvas, audioEngine, beatTracker, onGameOver) {
    this._canvas = canvas;
    this._ctx = canvas.getContext('2d');
    this._audio = audioEngine;
    this._beatTracker = beatTracker;
    this._onGameOver = onGameOver;

    this._state = new GameState();
    this._bg = new Background(canvas);
    this._grid = new Grid(canvas);
    this._particles = new ParticleSystem();
    this._player = new Player(canvas);
    this._bullets = new BulletManager(canvas);
    this._enemies = new EnemyManager(canvas);
    this._comboMeter = new ComboMeter();
    this._hud = new HUD(canvas);
    this._mobileControls = null;

    this._running = false;
    this._rafId = null;
    this._lastTime = 0;
    this._paused = false;

    // Score popup queue
    this._popups = [];

    // Beat listener
    if (beatTracker) {
      beatTracker.onBeat = (idx) => this._onBeat(idx);
      beatTracker.onFreqFrame = (frame) => this._onFreqFrame(frame);
    }

    // Keyboard: P = pause
    this._keydownHandler = (e) => {
      if (e.code === 'KeyP') this.togglePause();
    };
    window.addEventListener('keydown', this._keydownHandler);
  }

  /** Setup mobile controls after construction */
  setMobileControls(mc) {
    this._mobileControls = mc;
  }

  start() {
    this._state.reset();
    this._bullets.clear();
    this._enemies.clear();
    this._popups = [];
    this._paused = false;
    this._running = true;
    this._lastTime = performance.now();
    this._beatTracker.start();
    if (this._audio) this._audio.play();
    this._loop(performance.now());
  }

  stop() {
    this._running = false;
    if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
    this._beatTracker.stop();
    if (this._audio) this._audio.pause();
    window.removeEventListener('keydown', this._keydownHandler);
  }

  togglePause() {
    this._paused = !this._paused;
    if (this._paused) {
      this._audio && this._audio.pause();
      document.getElementById('pause-overlay').classList.remove('hidden');
    } else {
      this._audio && this._audio.play();
      document.getElementById('pause-overlay').classList.add('hidden');
    }
  }

  _loop(ts) {
    if (!this._running) return;
    this._rafId = requestAnimationFrame((t) => this._loop(t));

    const dt = Math.min((ts - this._lastTime) / 1000, 0.05);
    this._lastTime = ts;

    if (!this._paused) this._update(dt);
    this._draw();
  }

  _update(dt) {
    const currentTime = this._audio ? this._audio.getCurrentTime() : this._state.score / 1000;

    // Update subsystems
    this._bg.update(dt);
    this._grid.update(dt);
    this._particles.update(dt);
    this._player.update(dt, this._grid);
    this._enemies.update(dt, this._beatTracker, this._player);

    // Collect enemy bullets
    const enemyBullets = this._enemies.collectBullets();
    this._bullets.addEnemyBullets(enemyBullets);

    // Player new bullets
    const playerBullets = this._player.getNewBullets();
    this._bullets.addPlayerBullets(playerBullets);

    this._bullets.update(dt);

    // Player bullets vs enemies
    const hits = this._bullets.checkPlayerVsEnemies(
      this._enemies.enemies, this._beatTracker, currentTime);

    for (const { enemy, onBeat } of hits) {
      const died = enemy.hit(1);
      this._particles.spark(enemy.x, enemy.y, enemy.color);
      if (died) {
        const pts = this._state.onEnemyKill(enemy, onBeat);
        this._particles.burst(enemy.x, enemy.y, enemy.color, 20);
        this._addPopup(enemy.x, enemy.y, pts, onBeat ? '#ffffaa' : '#ffffff');
      }
    }

    // Enemy bullets vs player
    if (this._bullets.checkEnemyVsPlayer(this._player, this._beatTracker, currentTime)) {
      this._state.onPlayerHit();
      this._particles.burst(this._player.x, this._player.y, '#ff4488', 12, 3);
      if (this._state.gameOver) {
        this._endGame();
        return;
      }
    }

    // Update score popups
    this._popups = this._popups.filter(p => { p.life -= dt; return p.life > 0; });
    for (const p of this._popups) { p.y -= 40 * dt; }

    // Update UI
    this._comboMeter.update(this._state, dt);
    this._hud.update(this._state, this._beatTracker);
  }

  _draw() {
    const ctx = this._ctx;
    this._bg.draw(ctx);
    this._grid.draw(ctx);
    this._enemies.draw(ctx);
    this._bullets.draw(ctx);
    this._player.draw(ctx);
    this._particles.draw(ctx);
    this._drawPopups(ctx);
  }

  _drawPopups(ctx) {
    ctx.save();
    ctx.font = '700 11px "Share Tech Mono", monospace';
    ctx.textAlign = 'center';
    for (const p of this._popups) {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  _addPopup(x, y, score, color) {
    this._popups.push({ x, y, text: `+${score}`, color, life: 1.0 });
  }

  _onBeat(beatIdx) {
    if (this._paused) return;
    this._bg.onBeat();
    this._grid.onBeat();
    this._particles.beatRing(this._player.x, this._player.y);
    this._enemies.onBeat(beatIdx);
    this._hud.onBeat();
  }

  _onFreqFrame(frame) {
    this._bg.onFreqFrame(frame);
    this._enemies.onFreqFrame(frame);
  }

  _endGame() {
    this._running = false;
    this._beatTracker.stop();
    if (this._audio) this._audio.pause();
    if (this._onGameOver) {
      this._onGameOver({
        score: this._state.score,
        comboRank: this._state.maxComboRank.rank,
        maxComboPoints: this._state.comboPoints
      });
    }
  }

  get player() { return this._player; }
  get state()  { return this._state; }
}
