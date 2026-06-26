/* game/enemies/RhythmEnemy.js — stompers that move and shoot on rhythm */

class RhythmEnemy extends BaseEnemy {
  constructor(x, y, opts = {}) {
    super(x, y, 'rhythm');
    const event = opts.event || {};
    this._labels = event.labels || event.frame?.events || [];
    this._step = 0;
    this._baseX = x;
    this._stepSize = 20 + (event.power || 0.5) * 22;
    this._moveDir = (event.pan || 0) >= 0 ? 1 : -1;
    this._lastBeat = -1;
    this._shootOnBeat = this._labels.includes('kick') || this._labels.includes('snare');
    this._swing = 0;
    this._cadence = this._labels.includes('hat') ? 1 : 2;

    if (this._labels.includes('kick')) this.color = '#ff9d4d';
    else if (this._labels.includes('snare')) this.color = '#ffe36a';
    else this.color = '#89ffef';
  }

  update(dt, beatTracker, freqFrame, playerX, playerY) {
    super.update(dt, beatTracker, freqFrame, playerX, playerY);
    const onset = (freqFrame && freqFrame.onset) || 0;
    this.y += this.speed * (0.35 + onset * 0.9);
    this._swing += dt * (3.2 + onset * 4);
    this.x = this._baseX + Math.sin(this._swing) * 10;
    this._playerX = playerX;
    this._playerY = playerY;
  }

  onBeat(beatIdx) {
    if (beatIdx === this._lastBeat) return;
    this._lastBeat = beatIdx;
    this._step += 1;
    this._baseX += this._moveDir * this._stepSize;
    if (this._baseX < this.size + 8 || this._baseX > HW.CANVAS_W - this.size - 8) {
      this._moveDir *= -1;
      this._baseX = Math.max(this.size + 8, Math.min(HW.CANVAS_W - this.size - 8, this._baseX));
    }

    if (!this._shootOnBeat || this._step % this._cadence !== 0) return;
    const ang = Math.atan2((this._playerY || HW.CANVAS_H) - this.y, (this._playerX || HW.CANVAS_W / 2) - this.x);
    const speedMult = HW.RHYTHM_BULLET_SPEED_MULT || 1;
    if (this._labels.includes('kick')) {
      for (let i = -1; i <= 1; i++) {
        const a = ang + i * 0.18;
        this._fireBullet(Math.cos(a) * 2.8 * speedMult, Math.sin(a) * 2.8 * speedMult, '#ffb56b', { kind: 'spread', radius: 4 });
      }
    } else if (this._labels.includes('snare')) {
      this._fireBullet(Math.cos(ang) * 4.6 * speedMult, Math.sin(ang) * 4.6 * speedMult, '#fff08f', { kind: 'laser', width: 6, length: 32, radius: 4 });
    } else {
      this._fireBullet(Math.cos(ang) * 3.2 * speedMult, Math.sin(ang) * 3.2 * speedMult, '#8afdf1', {
        kind: 'wave',
        radius: 3,
        swayAmp: 1.8,
        swayFreq: 0.35,
      });
    }
  }

  _drawShape(ctx) {
    const s = this.size;
    ctx.beginPath();
    ctx.rect(this.x - s, this.y - s * 0.8, s * 2, s * 1.6);
    ctx.fill();
    ctx.strokeStyle = '#1d2b3a';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}
