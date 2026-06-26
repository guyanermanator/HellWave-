/* game/enemies/BaseEnemy.js — abstract base for all enemy types */

class BaseEnemy {
  constructor(x, y, type) {
    const def = HW.ENEMY_DEFS[type] || HW.ENEMY_DEFS.basic;
    this.x = x;
    this.y = y;
    this.type = type;
    this.hp = def.hp;
    this.maxHp = def.hp;
    this.score = def.score;
    this.speed = def.speed;
    this.color = def.color;
    this.size = def.size;
    this.active = true;
    this.age = 0;          // seconds alive
    this.flash = 0;        // hit flash timer
    this._bullets = [];    // bullets this enemy is allowed to fire
  }

  /** Override in subclasses */
  update(dt, beatTracker, freqFrame, playerX, playerY) {
    this.age += dt;
    this.flash = Math.max(0, this.flash - dt * 10);
  }

  hit(damage = 1) {
    this.hp -= damage;
    this.flash = 1;
    if (this.hp <= 0) this.active = false;
    return this.hp <= 0;
  }

  /** Returns array of new enemy bullets fired this frame */
  getBullets() {
    const b = this._bullets.slice();
    this._bullets.length = 0;
    return b;
  }

  _fireBullet(vx, vy, color = '#ffff88', opts = {}) {
    this._bullets.push({
      x: this.x,
      y: this.y + this.size,
      vx,
      vy,
      color,
      fromEnemy: true,
      radius: opts.radius || 4,
      kind: opts.kind || 'orb',
      width: opts.width || 5,
      length: opts.length || 22,
      trail: !!opts.trail,
      swayAmp: opts.swayAmp || 0,
      swayFreq: opts.swayFreq || 0,
      age: 0,
    });
  }

  draw(ctx) {
    ctx.save();

    // Hit flash
    if (this.flash > 0) {
      ctx.globalAlpha = 0.4 + this.flash * 0.6;
      ctx.fillStyle = '#ffffff';
    } else {
      ctx.fillStyle = this.color;
    }

    this._drawShape(ctx);

    // HP bar (if maxHp > 1)
    if (this.maxHp > 1) {
      const bw = this.size * 2;
      const bx = this.x - bw / 2;
      const by = this.y + this.size + 3;
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = '#333';
      ctx.fillRect(bx, by, bw, 3);
      ctx.fillStyle = this.color;
      ctx.fillRect(bx, by, bw * (this.hp / this.maxHp), 3);
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /** Override to customise shape */
  _drawShape(ctx) {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
  }

  isOffScreen(canvasH) {
    return this.y > canvasH + this.size * 2;
  }
}
