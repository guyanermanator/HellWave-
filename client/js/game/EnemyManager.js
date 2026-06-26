/* game/EnemyManager.js — deterministic music-reactive enemy scheduling */

class EnemyManager {
  constructor(canvas) {
    this._canvas = canvas;
    this._enemies = [];
    this._currentFreq = { bass: 0.5, mid: 0.5, highMid: 0.5, presence: 0.5, pan: 0, onset: 0 };
    this._spawnPlan = [];
    this._nextSpawnIdx = 0;
    this._seed = 1;
  }

  get enemies() { return this._enemies; }

  loadTrack(analysis) {
    this.clear();
    this._seed = (analysis && analysis.seed) || 1;
    this._spawnPlan = this._buildSpawnPlan(analysis || { frequencyFrames: [] });
    this._nextSpawnIdx = 0;
  }

  _buildSpawnPlan(analysis) {
    const frames = analysis.frequencyFrames || [];
    const plan = [];
    let rngState = (this._seed >>> 0) || 1;
    const rand = () => {
      rngState = (1664525 * rngState + 1013904223) >>> 0;
      return rngState / 0xFFFFFFFF;
    };

    let lastSpawn = -Infinity;
    let cooldownUntil = -Infinity;
    const laneCount = Math.max(4, HW.GRID_COLS);
    for (const frame of frames) {
      if (frame.t < 1 || frame.t < cooldownUntil) continue;
      const high = ((frame.highMid || 0) + (frame.presence || 0) + (frame.brilliance || 0)) / 3;
      const low = ((frame.sub || 0) + (frame.bass || 0) + (frame.lowMid || 0)) / 3;
      const density = Math.min(1, low * 0.45 + (frame.mid || 0) * 0.3 + high * 0.25 + (frame.onset || 0) * 0.35);
      const importantEvent = (frame.events || []).length > 0 || density > 0.62;
      if (!importantEvent) continue;
      if (frame.t - lastSpawn < HW.SPAWN_MIN_GAP_SEC) continue;

      const lane = Math.max(0, Math.min(laneCount - 1,
        Math.round((((frame.pan || 0) + 1) * 0.5) * (laneCount - 1) + (rand() - 0.5))
      ));

      const labels = frame.events || [];
      let type = 'basic';
      if (labels.includes('kick') || labels.includes('snare') || labels.includes('hat') || low > 0.72) type = 'rhythm';
      else if (labels.includes('vocal') || labels.includes('slide') || labels.includes('chord') || high > 0.65) type = 'glide';
      else if (high > 0.56 || labels.includes('instrument')) type = 'frequency';

      plan.push({
        t: frame.t,
        type,
        lane,
        power: density,
        pan: frame.pan || 0,
        centroid: frame.centroid || 0.5,
        pitch: frame.pitch || 0.5,
        pitchDelta: frame.pitchDelta || 0,
        labels,
        frame,
        roll: rand(),
        roll2: rand(),
      });
      lastSpawn = frame.t;

      if (density > 0.9) cooldownUntil = frame.t + HW.SPAWN_COOLDOWN_SEC;
    }

    const duration = analysis.duration || 0;
    if (duration > 120) {
      plan.push({ t: Math.max(30, duration * 0.72), type: 'boss', lane: Math.floor(laneCount / 2), power: 1, pan: 0, centroid: 0.4, frame: {} });
    }

    plan.sort((a, b) => a.t - b.t);
    return plan;
  }

  onFreqFrame(frame) {
    this._currentFreq = frame;
  }

  onBeat(beatIdx) {
    for (const enemy of this._enemies) {
      if (typeof enemy.onBeat === 'function') enemy.onBeat(beatIdx);
    }
  }

  update(dt, beatTracker, player, currentTime) {
    const freq = this._currentFreq;
    while (this._nextSpawnIdx < this._spawnPlan.length && this._spawnPlan[this._nextSpawnIdx].t <= currentTime + 0.02) {
      if (this._enemies.length < HW.SPAWN_MAX_ACTIVE) {
        this._spawnEnemy(this._spawnPlan[this._nextSpawnIdx]);
      }
      this._nextSpawnIdx++;
    }

    const px = player ? player.x : this._canvas.width / 2;
    const py = player ? player.y : this._canvas.height - 80;
    for (const enemy of this._enemies) {
      if (!enemy.active) continue;
      enemy.update(dt, beatTracker, freq, px, py);
    }
    this._enemies = this._enemies.filter((enemy) => enemy.active && !enemy.isOffScreen(this._canvas.height));
  }

  _spawnEnemy(event) {
    const laneWidth = this._canvas.width / HW.GRID_COLS;
    const laneCenter = laneWidth * event.lane + laneWidth * 0.5;
    const x = Math.max(30, Math.min(this._canvas.width - 30, laneCenter + (event.roll - 0.5) * laneWidth * 0.35));
    const y = -20 - event.power * 30;
    const opts = { event };

    if ((event.labels || []).includes('chord') && event.type !== 'boss') {
      const cascade = [-1, 0, 1];
      for (const offset of cascade) {
        const nx = Math.max(20, Math.min(this._canvas.width - 20, x + offset * laneWidth * 0.55));
        const ny = y - Math.abs(offset) * 22;
        this._enemies.push(new GlideEnemy(nx, ny, { event: { ...event, pitchDelta: event.pitchDelta + offset * 0.08 } }));
      }
      return;
    }

    let enemy;
    switch (event.type) {
      case 'rhythm':
        enemy = new RhythmEnemy(x, y, opts);
        break;
      case 'glide':
        enemy = new GlideEnemy(x, y, opts);
        break;
      case 'beat':
        enemy = new BeatEnemy(x, y, opts);
        break;
      case 'frequency':
        enemy = new FrequencyEnemy(x, y, opts);
        break;
      case 'boss':
        enemy = new BossEnemy(this._canvas.width / 2, -80, opts);
        break;
      default:
        enemy = new BasicEnemy(x, y, opts);
        break;
    }
    this._enemies.push(enemy);
  }

  collectBullets() {
    const bullets = [];
    for (const enemy of this._enemies) bullets.push(...enemy.getBullets());
    return bullets.slice(0, HW.SPAWN_MAX_BULLETS);
  }

  draw(ctx) {
    for (const enemy of this._enemies) enemy.draw(ctx);
  }

  clear() {
    this._enemies = [];
    this._spawnPlan = [];
    this._nextSpawnIdx = 0;
  }
}
