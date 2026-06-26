/* game/enemies/BeatEnemy.js — only fires bullets exactly on beat */

class BeatEnemy extends BaseEnemy {
  constructor(x, y) {
    super(x, y, 'beat');
    this._beatCount = 0;
    this._hoverY = y;
    this._hoverTarget = y;
    this._sideDir = Math.random() < 0.5 ? 1 : -1;
    this._lastBeat = -1;
  }

  update(dt, beatTracker, freqFrame, playerX, playerY) {
    super.update(dt, beatTracker, freqFrame, playerX, playerY);
    // Hover in place, drift slightly sideways on beat
    this.y += (this._hoverTarget - this.y) * 0.02 + this.speed * 0.3;
    this.x += this._sideDir * 0.8;

    const canvasW = 480;
    if (this.x < this.size || this.x > canvasW - this.size) this._sideDir *= -1;
  }

  onBeat(beatIdx) {
    if (beatIdx === this._lastBeat) return;
    this._lastBeat = beatIdx;
    this._beatCount++;

    // Strafe on beat
    this._hoverTarget += this._sideDir * 30;
    this._sideDir *= -1;

    // Fire 3-way spread every 2 beats
    if (this._beatCount % 2 === 0) {
      for (let a = -1; a <= 1; a++) {
        const angle = Math.PI / 2 + a * 0.35; // downward spread
        this._fireBullet(Math.cos(angle) * 3, Math.sin(angle) * 3, '#4488ff');
      }
    }
  }

  _drawShape(ctx) {
    // Pentagon
    const s = this.size;
    const sides = 5;
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const angle = (i / sides) * Math.PI * 2 - Math.PI / 2 + this.age * 0.5;
      const px = this.x + Math.cos(angle) * s;
      const py = this.y + Math.sin(angle) * s;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#8888ff';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}
