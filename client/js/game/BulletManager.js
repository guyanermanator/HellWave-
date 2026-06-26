/* game/BulletManager.js — manages both player and enemy bullets */

class BulletManager {
  constructor(canvas) {
    this._canvas = canvas;
    this._playerBullets = [];
    this._enemyBullets = [];
  }

  addPlayerBullets(bullets) {
    for (const b of bullets) {
      this._playerBullets.push({ ...b, active: true });
    }
  }

  addEnemyBullets(bullets) {
    for (const b of bullets) {
      this._enemyBullets.push({ ...b, active: true });
    }
  }

  update(dt) {
    const w = this._canvas.width;
    const h = this._canvas.height;

    for (const b of this._playerBullets) {
      if (!b.active) continue;
      b.x += b.vx;
      b.y += b.vy;
      if (b.y < -10 || b.x < -10 || b.x > w + 10) b.active = false;
    }

    for (const b of this._enemyBullets) {
      if (!b.active) continue;
      b.age = (b.age || 0) + dt;
      if (b.swayAmp && b.swayFreq) {
        b.x += Math.sin(b.age * (6 + b.swayFreq * 8)) * b.swayAmp;
      }
      b.x += b.vx;
      b.y += b.vy;
      if (b.y > h + 10 || b.x < -10 || b.x > w + 10 || b.y < -10) b.active = false;
    }

    // Prune inactive
    this._playerBullets = this._playerBullets.filter(b => b.active);
    this._enemyBullets  = this._enemyBullets.filter(b => b.active);
  }

  /** Check player bullets vs enemies. Returns array of {enemy, bullet, onBeat}. */
  checkPlayerVsEnemies(enemies, beatTracker, currentTime) {
    const hits = [];
    for (const b of this._playerBullets) {
      if (!b.active) continue;
      for (const e of enemies) {
        if (!e.active) continue;
        const dx = b.x - e.x;
        const dy = b.y - e.y;
        if (dx * dx + dy * dy < (e.size + 4) * (e.size + 4)) {
          b.active = false;
          const onBeat = beatTracker ? beatTracker.isOnBeat(currentTime) : false;
          hits.push({ enemy: e, bullet: b, onBeat });
          break;
        }
      }
    }
    return hits;
  }

  /** Check enemy bullets vs player. Returns true if player was hit. */
  checkEnemyVsPlayer(player, beatTracker, currentTime) {
    if (player.isInvincible) return false;
    for (const b of this._enemyBullets) {
      if (!b.active) continue;
      const dx = b.x - player.x;
      const dy = b.y - player.y;
      const radius = (b.radius || 4) + (b.kind === 'beam' ? 2 : 0);
      if (dx * dx + dy * dy < (player.size - 2 + radius) * (player.size - 2 + radius)) {
        b.active = false;
        return true;
      }
    }
    return false;
  }

  draw(ctx) {
    // Player bullets — bright upward streaks
    ctx.save();
    for (const b of this._playerBullets) {
      if (!b.active) continue;
      ctx.fillStyle = '#cc88ff';
      ctx.shadowColor = '#8844ff';
      ctx.shadowBlur = 6;
      ctx.fillRect(Math.round(b.x - 2), Math.round(b.y - 6), 4, 10);
    }

    // Enemy bullets
    for (const b of this._enemyBullets) {
      if (!b.active) continue;
      const color = b.color || '#ffff88';
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = b.kind === 'beam' ? 8 : 4;
      if (b.trail) {
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = color;
        ctx.fillRect(b.x - 1, b.y - (b.length || 16), 2, b.length || 16);
        ctx.globalAlpha = 1;
      }
      if (b.kind === 'laser' || b.kind === 'beam') {
        const width = b.width || (b.kind === 'beam' ? 8 : 5);
        const len = b.length || (b.kind === 'beam' ? 60 : 24);
        const ang = Math.atan2(b.vy, b.vx || 0.0001);
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(ang);
        ctx.fillRect(-2, -width / 2, len, width);
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius || 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.shadowBlur = 0;
    ctx.restore();
  }

  clear() {
    this._playerBullets.length = 0;
    this._enemyBullets.length = 0;
  }
}
