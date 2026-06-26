/* game/enemies/FrequencyEnemy.js
 * Movement and shoot rate driven by mid/high frequency band energy.
 */

class FrequencyEnemy extends BaseEnemy {
  constructor(x, y) {
    super(x, y, 'frequency');
    this._angle = 0;
    this._radius = 0;
    this._radiusTarget = 60 + Math.random() * 60;
    this._orbitSpeed = (Math.random() < 0.5 ? 1 : -1) * (1 + Math.random());
    this._centerX = x;
    this._centerY = y + 40;
    this._shootCooldown = 0;
  }

  update(dt, beatTracker, freqFrame, playerX, playerY) {
    super.update(dt, beatTracker, freqFrame, playerX, playerY);

    const mid  = freqFrame ? freqFrame.mid  : 0.5;
    const high = freqFrame ? freqFrame.high : 0.5;

    // Orbit speed scales with mid energy
    this._angle += this._orbitSpeed * (1 + mid * 3) * dt;
    this._radius += (this._radiusTarget - this._radius) * 0.05;

    // Centre drifts downward slowly
    this._centerY += this.speed * 0.4 * (1 + mid);

    this.x = this._centerX + Math.cos(this._angle) * this._radius;
    this.y = this._centerY + Math.sin(this._angle) * this._radius * 0.5;

    // Shoot when high energy spikes
    this._shootCooldown -= dt;
    if (high > 0.7 && this._shootCooldown <= 0) {
      this._shootCooldown = 0.5;
      const ang = Math.atan2(playerY - this.y, playerX - this.x);
      this._fireBullet(Math.cos(ang) * 3.5, Math.sin(ang) * 3.5, '#44ff88');
    }
  }

  _drawShape(ctx) {
    // Triangle pointing in direction of orbit
    const s = this.size;
    const a = this._angle;
    ctx.beginPath();
    ctx.moveTo(this.x + Math.cos(a) * s,       this.y + Math.sin(a) * s);
    ctx.lineTo(this.x + Math.cos(a + 2.4) * s, this.y + Math.sin(a + 2.4) * s);
    ctx.lineTo(this.x + Math.cos(a - 2.4) * s, this.y + Math.sin(a - 2.4) * s);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#88ff88';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}
