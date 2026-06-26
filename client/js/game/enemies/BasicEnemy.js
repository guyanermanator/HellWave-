/* game/enemies/BasicEnemy.js — simple downward-moving enemy */

class BasicEnemy extends BaseEnemy {
  constructor(x, y) {
    super(x, y, 'basic');
    this._waveOffset = Math.random() * Math.PI * 2;
    this._waveAmplitude = 20 + Math.random() * 40;
    this._waveFreq = 0.5 + Math.random() * 1.5;
    this._startX = x;
    this._shootTimer = 2 + Math.random() * 3;
  }

  update(dt, beatTracker, freqFrame, playerX, playerY) {
    super.update(dt, beatTracker, freqFrame, playerX, playerY);
    this.y += this.speed * (1 + (freqFrame ? freqFrame.bass * 1.5 : 0));
    this.x = this._startX + Math.sin(this.age * this._waveFreq + this._waveOffset) * this._waveAmplitude;

    this._shootTimer -= dt;
    if (this._shootTimer <= 0) {
      this._shootTimer = 2.5 + Math.random() * 2;
      const ang = Math.atan2(playerY - this.y, playerX - this.x);
      this._fireBullet(Math.cos(ang) * 2.5, Math.sin(ang) * 2.5);
    }
  }

  _drawShape(ctx) {
    // Diamond
    const s = this.size;
    ctx.beginPath();
    ctx.moveTo(this.x,     this.y - s);
    ctx.lineTo(this.x + s, this.y);
    ctx.lineTo(this.x,     this.y + s);
    ctx.lineTo(this.x - s, this.y);
    ctx.closePath();
    ctx.fill();
    // Glow outline
    ctx.strokeStyle = '#ff8888';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}
