/* game/enemies/BeatEnemy.js — beat-anchored enemy */

class BeatEnemy extends BaseEnemy {
  constructor(x, y, opts = {}) {
    super(x, y, 'beat');
    const event = opts.event || {};
    this._beatCount = 0;
    this._hoverTarget = y;
    this._sideDir = (event.pan || 0) >= 0 ? 1 : -1;
    this._lastBeat = -1;
  }

  update(dt, beatTracker, freqFrame) {
    super.update(dt, beatTracker, freqFrame);
    this.y += (this._hoverTarget - this.y) * 0.04 + this.speed * 0.22;
    this.x += this._sideDir * (0.35 + ((freqFrame && freqFrame.beatConfidence) || 0.5));
    const canvasW = HW.CANVAS_W;
    if (this.x < this.size || this.x > canvasW - this.size) this._sideDir *= -1;
  }

  onBeat(beatIdx) {
    if (beatIdx === this._lastBeat) return;
    this._lastBeat = beatIdx;
    this._beatCount++;
    this._hoverTarget += this._sideDir * 24;
    this._sideDir *= -1;

    if (this._beatCount % 2 === 0) {
      for (let a = -1; a <= 1; a++) {
        const angle = Math.PI / 2 + a * 0.32;
        this._fireBullet(Math.cos(angle) * 2.8, Math.sin(angle) * 2.8, '#4488ff');
      }
    }
  }

  _drawShape(ctx) {
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
