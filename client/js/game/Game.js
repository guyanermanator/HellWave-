/* game/Game.js — main game loop and orchestration */

class Game {
  constructor(canvas, audioEngine, beatTracker, trackData, user, onGameOver) {
    this._canvas = canvas;
    this._ctx = canvas.getContext('2d');
    this._audio = audioEngine;
    this._beatTracker = beatTracker;
    this._trackData = trackData || {};
    this._user = user || null;
    this._onGameOver = onGameOver;

    this._state = new GameState();
    this._bg = new Background(canvas);
    this._grid = new Grid(canvas);
    this._particles = new ParticleSystem();
    this._player = new Player(canvas, user && user.color);
    this._bullets = new BulletManager(canvas);
    this._enemies = new EnemyManager(canvas);
    this._comboMeter = new ComboMeter();
    this._hud = new HUD(canvas);
    this._mobileControls = null;

    this._running = false;
    this._rafId = null;
    this._lastTime = 0;
    this._paused = false;
    this._popups = [];
    this._demoElapsed = 0;
    this._ended = false;
    this._currentFreq = { bass: 0, mid: 0, highMid: 0 };
    this._duration = Number(this._trackData.duration) || 0;

    this._enemies.loadTrack(this._trackData);
    this._hud.configureTrack(this._trackData);

    if (beatTracker) {
      beatTracker.onBeat = (idx) => this._onBeat(idx);
      beatTracker.onFreqFrame = (frame) => this._onFreqFrame(frame);
    }

    this._keydownHandler = (e) => {
      if (e.code === 'KeyP') this.togglePause();
    };
    window.addEventListener('keydown', this._keydownHandler);
  }

  setMobileControls(mc) {
    this._mobileControls = mc;
  }

  start(startTimeSec = 0) {
    this._state.reset();
    this._bullets.clear();
    this._enemies.loadTrack(this._trackData);
    this._popups = [];
    this._paused = false;
    this._running = true;
    this._ended = false;
    this._demoElapsed = 0;
    this._lastTime = performance.now();
    this._beatTracker.seek(startTimeSec);
    this._beatTracker.start();
    this._player.primePointerTarget();
    this._loop(performance.now());
  }

  stop() {
    this._running = false;
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    this._beatTracker.stop();
    if (this._audio) this._audio.pause();
    if (this._mobileControls) this._mobileControls.hide();
    window.removeEventListener('keydown', this._keydownHandler);
  }

  togglePause() {
    this._paused = !this._paused;
    if (this._paused) {
      this._audio && this._audio.pause();
      document.getElementById('pause-overlay').classList.remove('hidden');
    } else {
      this._audio && this._audio.play().catch(() => {});
      document.getElementById('pause-overlay').classList.add('hidden');
    }
  }

  finishTrack() {
    if (!this._ended) this._endGame(true);
  }

  _loop(ts) {
    if (!this._running) return;
    this._rafId = requestAnimationFrame((t) => this._loop(t));

    const dt = Math.min((ts - this._lastTime) / 1000, 0.05);
    this._lastTime = ts;

    if (!this._paused) this._update(dt);
    this._draw();
  }

  _getCurrentTime(dt = 0) {
    if (this._audio) return this._audio.getCurrentTime();
    if (this._beatTracker && typeof this._beatTracker._getTime === 'function') {
      return this._beatTracker._getTime();
    }
    this._demoElapsed += dt;
    return this._demoElapsed;
  }

  _update(dt) {
    const currentTime = this._getCurrentTime(dt);
    if (this._duration > 0 && currentTime >= this._duration) {
      this._endGame(true);
      return;
    }

    this._mobileControls && this._mobileControls.update();
    this._bg.update(dt);
    this._grid.update(dt);
    this._particles.update(dt);
    this._player.update(dt, this._grid);
    this._enemies.update(dt, this._beatTracker, this._player, currentTime);

    const enemyBullets = this._enemies.collectBullets();
    this._bullets.addEnemyBullets(enemyBullets);
    this._bullets.addPlayerBullets(this._player.getNewBullets());
    this._bullets.update(dt);

    const hits = this._bullets.checkPlayerVsEnemies(this._enemies.enemies, this._beatTracker, currentTime);
    for (const { enemy, onBeat } of hits) {
      const died = enemy.hit(1);
      this._particles.spark(enemy.x, enemy.y, enemy.color);
      if (died) {
        const pts = this._state.onEnemyKill(enemy, onBeat);
        this._particles.burst(enemy.x, enemy.y, enemy.color, 20);
        this._addPopup(enemy.x, enemy.y, pts, onBeat ? '#ffffaa' : '#ffffff');
      }
    }

    if (this._bullets.checkEnemyVsPlayer(this._player, this._beatTracker, currentTime)) {
      this._state.onPlayerHit();
      this._particles.burst(this._player.x, this._player.y, '#ff4488', 12, 3);
      if (this._state.gameOver) {
        this._endGame(false);
        return;
      }
    }

    this._popups = this._popups.filter((popup) => { popup.life -= dt; return popup.life > 0; });
    for (const popup of this._popups) popup.y -= 40 * dt;

    this._comboMeter.update(this._state, dt);
    this._hud.update(this._state, this._beatTracker, currentTime, this._duration, this._currentFreq);
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
    for (const popup of this._popups) {
      ctx.globalAlpha = popup.life;
      ctx.fillStyle = popup.color;
      ctx.fillText(popup.text, popup.x, popup.y);
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
    this._currentFreq = frame;
    this._bg.onFreqFrame(frame);
    this._enemies.onFreqFrame(frame);
  }

  _endGame(completed) {
    if (this._ended) return;
    this._ended = true;
    this._running = false;
    this._beatTracker.stop();
    if (this._audio) this._audio.pause();
    if (typeof this._onGameOver === 'function') {
      this._onGameOver({
        score: this._state.score,
        comboRank: this._state.maxComboRank.rank,
        maxComboPoints: this._state.comboPoints,
        completed,
        duration: this._duration,
      });
    }
  }

  get player() { return this._player; }
  get state() { return this._state; }
}
