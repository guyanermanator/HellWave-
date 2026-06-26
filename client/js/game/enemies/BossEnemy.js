/* game/enemies/BossEnemy.js — audio-reactive boss */

class BossEnemy extends BaseEnemy {
  constructor(x, y) {
    super(x, y, 'boss');
    this._phase = 0;
    this._phaseTimer = 0;
    this._shootTimer = 0;
    this._entryY = 100;
    this._angle = 0;
    this._warnFlash = 0;
    this._beatCount = 0;
  }

  update(dt, beatTracker, freqFrame, playerX, playerY) {
    super.update(dt, beatTracker, freqFrame, playerX, playerY);

    const bass = freqFrame ? ((freqFrame.sub + freqFrame.bass) * 0.5) : 0.5;
    const mid = freqFrame ? ((freqFrame.mid + freqFrame.highMid) * 0.5) : 0.5;

    if (this.y < this._entryY) {
      this.y += this.speed * 2;
      return;
    }

    this._angle += 0.3 * dt;
    this._phaseTimer += dt;

    const hpRatio = this.hp / this.maxHp;
    const newPhase = hpRatio > 0.66 ? 0 : hpRatio > 0.33 ? 1 : 2;
    if (newPhase !== this._phase) {
      this._phase = newPhase;
      this._phaseTimer = 0;
      this._warnFlash = 1.5;
    }

    this.x += (playerX - this.x) * 0.01 * (1 + bass);
    const margin = this.size + 10;
    this.x = Math.max(margin, Math.min(HW.CANVAS_W - margin, this.x));

    this._warnFlash = Math.max(0, this._warnFlash - dt * 3);

    this._shootTimer -= dt;
    if (this._shootTimer <= 0) this._phaseAttack(playerX, playerY, mid);
  }

  _phaseAttack(playerX, playerY) {
    const firerate = 0.45 + this._phase * 0.2;
    switch (this._phase) {
      case 0: {
        this._shootTimer = firerate;
        const ang = Math.atan2(playerY - this.y, playerX - this.x);
        this._fireBullet(Math.cos(ang) * 3, Math.sin(ang) * 3, '#ff88ff');
        break;
      }
      case 1: {
        this._shootTimer = firerate * 1.5;
        const count = 8;
        for (let i = 0; i < count; i++) {
          const a = (i / count) * Math.PI * 2 + this._angle;
          this._fireBullet(Math.cos(a) * 3.4, Math.sin(a) * 3.4, '#ffaa44');
        }
        break;
      }
      default: {
        this._shootTimer = firerate * 0.6;
        const a = this._phaseTimer * 3;
        this._fireBullet(Math.cos(a) * 3.8, Math.sin(a) * 3.8, '#ff4444');
        this._fireBullet(Math.cos(a + Math.PI) * 3.8, Math.sin(a + Math.PI) * 3.8, '#ff4444');
        if (this._phaseTimer % 2 < 0.1) {
          const ang = Math.atan2(playerY - this.y, playerX - this.x);
          this._fireBullet(Math.cos(ang) * 4.8, Math.sin(ang) * 4.8, '#ffffff');
        }
      }
    }
  }

  onBeat() {
    this._beatCount++;
    if (this._beatCount % 4 === 0) {
      const count = 12 + this._phase * 4;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        this._fireBullet(Math.cos(a) * 2.4, Math.sin(a) * 2.4, '#cc44ff');
      }
    }
  }

  _drawShape(ctx) {
    const s = this.size;
    ctx.strokeStyle = this._warnFlash > 0 ? '#ffffff' : '#ff88ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.x, this.y, s + 6 + Math.sin(this.age * 4) * 3, 0, Math.PI * 2);
    ctx.stroke();

    const sides = 8;
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const angle = (i / sides) * Math.PI * 2 + this._angle;
      const px = this.x + Math.cos(angle) * s;
      const py = this.y + Math.sin(angle) * s;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
      const r = s + 14;
      ctx.fillStyle = i >= this._phase ? '#ff88ff' : '#333';
      ctx.beginPath();
      ctx.arc(this.x + Math.cos(a) * r, this.y + Math.sin(a) * r, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
