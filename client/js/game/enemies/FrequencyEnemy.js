/* game/enemies/FrequencyEnemy.js — envelope-following enemy */

class FrequencyEnemy extends BaseEnemy {
  constructor(x, y, opts = {}) {
    super(x, y, 'frequency');
    const event = opts.event || {};
    this._angle = 0;
    this._radius = 0;
    this._radiusTarget = 34 + (event.power || 0.5) * 60;
    this._orbitSpeed = ((event.pan || 0) >= 0 ? 1 : -1) * (0.8 + (event.roll || 0.5));
    this._centerX = x;
    this._centerY = y + 40;
    this._shootCooldown = 0.3 + (event.roll2 || 0.5) * 0.4;
  }

  update(dt, beatTracker, freqFrame, playerX, playerY) {
    super.update(dt, beatTracker, freqFrame, playerX, playerY);

    const mid = freqFrame ? ((freqFrame.mid + freqFrame.highMid) * 0.5) : 0.5;
    const high = freqFrame ? ((freqFrame.presence + freqFrame.brilliance + freqFrame.air) / 3) : 0.5;

    this._angle += this._orbitSpeed * (1 + mid * 2.5) * dt;
    this._radius += (this._radiusTarget - this._radius) * 0.06;
    this._centerY += this.speed * 0.36 * (1 + mid);
    this._centerX += (freqFrame ? freqFrame.pan : 0) * 0.9;

    this.x = this._centerX + Math.cos(this._angle) * this._radius;
    this.y = this._centerY + Math.sin(this._angle) * this._radius * (0.3 + high * 0.5);

    this._shootCooldown -= dt;
    if ((high > 0.7 || (freqFrame && (freqFrame.events || []).includes('hat'))) && this._shootCooldown <= 0) {
      this._shootCooldown = 0.55;
      const ang = Math.atan2(playerY - this.y, playerX - this.x);
      this._fireBullet(Math.cos(ang) * 3.4, Math.sin(ang) * 3.4, '#44ff88');
    }
  }

  _drawShape(ctx) {
    const s = this.size;
    const a = this._angle;
    ctx.beginPath();
    ctx.moveTo(this.x + Math.cos(a) * s, this.y + Math.sin(a) * s);
    ctx.lineTo(this.x + Math.cos(a + 2.4) * s, this.y + Math.sin(a + 2.4) * s);
    ctx.lineTo(this.x + Math.cos(a - 2.4) * s, this.y + Math.sin(a - 2.4) * s);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#88ff88';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}
