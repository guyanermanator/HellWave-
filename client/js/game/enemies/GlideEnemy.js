/* game/enemies/GlideEnemy.js — pitch and melody glide follower */

class GlideEnemy extends BaseEnemy {
  constructor(x, y, opts = {}) {
    super(x, y, 'glide');
    const event = opts.event || {};
    const labels = event.labels || event.frame?.events || [];
    this._pan = event.pan || 0;
    this._pitch = event.pitch ?? event.frame?.pitch ?? 0.5;
    this._pitchDelta = event.pitchDelta ?? event.frame?.pitchDelta ?? 0;
    this._trail = labels.includes('slide') || labels.includes('vocal');
    this._centerX = x;
    this._centerY = y;
    this._phase = (event.roll || 0.5) * Math.PI * 2;
    this._shootCd = 0.45 + (event.roll2 || 0.5) * 0.3;
    this._labels = labels;
    this._targetX = x + this._pitchDelta * HW.CANVAS_W * 0.45;
    this._targetY = 80 + (1 - this._pitch) * (HW.CANVAS_H * 0.62);

    if (labels.includes('vocal')) this.color = '#6effdd';
    else if (labels.includes('chord')) this.color = '#ae7fff';
    else this.color = '#7fb7ff';
  }

  update(dt, beatTracker, freqFrame, playerX, playerY) {
    super.update(dt, beatTracker, freqFrame, playerX, playerY);
    const pitch = (freqFrame && typeof freqFrame.pitch === 'number') ? freqFrame.pitch : this._pitch;
    const pan = (freqFrame && typeof freqFrame.pan === 'number') ? freqFrame.pan : this._pan;
    this._phase += dt * (2.4 + ((freqFrame && freqFrame.mid) || 0.4) * 3.4);

    this._targetX += pan * dt * 42;
    this._targetX = Math.max(this.size, Math.min(HW.CANVAS_W - this.size, this._targetX));
    this._targetY += ((80 + (1 - pitch) * (HW.CANVAS_H * 0.62)) - this._targetY) * 0.06;

    this._centerX += (this._targetX - this._centerX) * 0.05;
    this._centerY += (this._targetY - this._centerY) * 0.05 + this.speed * 0.28;

    this.x = this._centerX + Math.sin(this._phase) * (10 + Math.abs(this._pitchDelta) * 40);
    this.y = this._centerY;

    this._shootCd -= dt;
    const shouldShoot = this._labels.includes('vocal') || this._labels.includes('instrument') || this._labels.includes('chord');
    if (!shouldShoot || this._shootCd > 0) return;

    this._shootCd = this._labels.includes('chord') ? 0.8 : 0.58;
    const ang = Math.atan2(playerY - this.y, playerX - this.x);
    const speed = this._labels.includes('chord') ? 2.8 : 3.6;
    this._fireBullet(Math.cos(ang) * speed, Math.sin(ang) * speed, this.color, {
      kind: this._labels.includes('chord') ? 'beam' : 'laser',
      width: this._labels.includes('chord') ? 8 : 5,
      length: this._labels.includes('chord') ? 60 : 28,
      radius: this._labels.includes('chord') ? 6 : 4,
      trail: true,
    });
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
    ctx.strokeStyle = '#e7fff9';
    ctx.lineWidth = 1;
    ctx.stroke();

    if (this._trail) {
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = this.color;
      ctx.fillRect(this.x - 1, this.y + s, 2, 16);
      ctx.globalAlpha = 1;
    }
  }
}
