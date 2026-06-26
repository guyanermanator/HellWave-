/* game/enemies/BasicEnemy.js — simple downward-moving enemy */

class BasicEnemy extends BaseEnemy {
  constructor(x, y, opts = {}) {
    super(x, y, 'basic');
    const event = opts.event || {};
    this._waveOffset = (event.roll || 0.5) * Math.PI * 2;
    this._waveAmplitude = 16 + (event.power || 0.4) * 36;
    this._waveFreq = 0.5 + (event.roll2 || 0.5) * 1.2;
    this._startX = x;
    this._shootTimer = 1.6 + (event.roll || 0.5) * 1.4;
  }

  update(dt, beatTracker, freqFrame, playerX, playerY) {
    super.update(dt, beatTracker, freqFrame, playerX, playerY);
    const bass = (freqFrame && freqFrame.bass) || 0.5;
    this.y += this.speed * (1 + bass * 1.2);
    this.x = this._startX + Math.sin(this.age * this._waveFreq + this._waveOffset) * this._waveAmplitude;

    this._shootTimer -= dt;
    if (this._shootTimer <= 0) {
      this._shootTimer = 2.1;
      const ang = Math.atan2(playerY - this.y, playerX - this.x);
      this._fireBullet(Math.cos(ang) * 2.4, Math.sin(ang) * 2.4);
    }
  }

  _drawShape(ctx) {
    const s = this.size;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y - s);
    ctx.lineTo(this.x + s, this.y);
    ctx.lineTo(this.x, this.y + s);
    ctx.lineTo(this.x - s, this.y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ff8888';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}
