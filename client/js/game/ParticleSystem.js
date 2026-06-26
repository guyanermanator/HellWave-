/* game/ParticleSystem.js — pooled particle effects */

class Particle {
  constructor() { this.active = false; }
  reset(x, y, vx, vy, color, life, size) {
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.color = color;
    this.life = life; this.maxLife = life;
    this.size = size;
    this.active = true;
  }
}

class ParticleSystem {
  constructor(maxParticles = 400) {
    this._pool = Array.from({ length: maxParticles }, () => new Particle());
  }

  _spawn(x, y, vx, vy, color, life, size) {
    const p = this._pool.find(p => !p.active);
    if (p) p.reset(x, y, vx, vy, color, life, size);
  }

  /** Explosion burst of `n` particles */
  burst(x, y, color, n = 16, speed = 4, life = 0.6) {
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * Math.PI * 2 + Math.random() * 0.5;
      const spd = speed * (0.4 + Math.random() * 0.8);
      this._spawn(x, y, Math.cos(angle) * spd, Math.sin(angle) * spd,
        color, life * (0.5 + Math.random() * 0.5), 2 + Math.random() * 3);
    }
  }

  /** Hit spark */
  spark(x, y, color) {
    for (let i = 0; i < 6; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = 2 + Math.random() * 5;
      this._spawn(x, y, Math.cos(angle) * spd, Math.sin(angle) * spd, color, 0.3, 2);
    }
  }

  /** On-beat ring expansion */
  beatRing(x, y) {
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      this._spawn(x, y, Math.cos(angle) * 3, Math.sin(angle) * 3,
        '#ffffaa', 0.4, 2);
    }
  }

  /** Score popup text simulation (simple upward particle) */
  scorePopup(x, y, color) {
    this._spawn(x, y, (Math.random() - 0.5) * 2, -3, color, 0.8, 4);
  }

  update(dt) {
    for (const p of this._pool) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.05; // slight gravity
      p.vx *= 0.97;
      p.vy *= 0.97;
    }
  }

  draw(ctx) {
    ctx.save();
    for (const p of this._pool) {
      if (!p.active) continue;
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x - p.size / 2), Math.round(p.y - p.size / 2),
        Math.round(p.size), Math.round(p.size));
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}
