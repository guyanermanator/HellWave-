/* game/enemies/BossEnemy.js
 * High-HP boss with phase-based attack patterns driven by audio data.
 */

class BossEnemy extends BaseEnemy {
  constructor(x, y) {
    super(x, y, 'boss');
    this._phase = 0;          // attack phase index
    this._phaseTimer = 0;
    this._shootTimer = 0;
    this._entryY = 100;       // boss hovers near top
    this._angle = 0;
    this._warnFlash = 0;
    this._ringRadius = 0;
    this._beatCount = 0;
  }

  update(dt, beatTracker, freqFrame, playerX, playerY) {
    super.update(dt, beatTracker, freqFrame, playerX, playerY);

    const bass = freqFrame ? freqFrame.bass : 0.5;
    const mid  = freqFrame ? freqFrame.mid  : 0.5;

    // Enter from top
    if (this.y < this._entryY) {
      this.y += this.speed * 2;
      return;
    }

    this._angle += 0.3 * dt;
    this._phaseTimer += dt;

    // Phase transitions based on HP threshold
    const hpRatio = this.hp / this.maxHp;
    const newPhase = hpRatio > 0.66 ? 0 : hpRatio > 0.33 ? 1 : 2;
    if (newPhase !== this._phase) {
      this._phase = newPhase;
      this._phaseTimer = 0;
      this._warnFlash = 1.5;
    }

    // Boss slowly tracks player horizontally
    const dx = playerX - this.x;
    this.x += dx * 0.01 * (1 + bass);

    // Clamp to canvas
    const margin = this.size + 10;
    this.x = Math.max(margin, Math.min(480 - margin, this.x));

    this._warnFlash = Math.max(0, this._warnFlash - dt * 3);

    this._shootTimer -= dt;
    if (this._shootTimer <= 0) {
      this._phaseAttack(playerX, playerY, mid);
    }
  }

  _phaseAttack(playerX, playerY, mid) {
    const firerate = 0.4 + this._phase * 0.2;

    switch (this._phase) {
      case 0: {
        // Aimed shots at player
        this._shootTimer = firerate;
        const ang = Math.atan2(playerY - this.y, playerX - this.x);
        this._fireBullet(Math.cos(ang) * 3, Math.sin(ang) * 3, '#ff88ff');
        break;
      }
      case 1: {
        // Radial burst
        this._shootTimer = firerate * 1.5;
        const count = 8;
        for (let i = 0; i < count; i++) {
          const a = (i / count) * Math.PI * 2 + this._angle;
          this._fireBullet(Math.cos(a) * 3.5, Math.sin(a) * 3.5, '#ffaa44');
        }
        break;
      }
      case 2: {
        // Spiral + aimed combo
        this._shootTimer = firerate * 0.6;
        const a = this._phaseTimer * 3;
        this._fireBullet(Math.cos(a) * 4, Math.sin(a) * 4, '#ff4444');
        this._fireBullet(Math.cos(a + Math.PI) * 4, Math.sin(a + Math.PI) * 4, '#ff4444');
        // Also aim at player every 2s
        if (this._phaseTimer % 2 < 0.1) {
          const ang = Math.atan2(playerY - this.y, playerX - this.x);
          this._fireBullet(Math.cos(ang) * 5, Math.sin(ang) * 5, '#ffffff');
        }
        break;
      }
    }
  }

  onBeat(beatIdx) {
    this._beatCount++;
    // Every 4 beats, do a special ring attack
    if (this._beatCount % 4 === 0) {
      const count = 12 + this._phase * 4;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        this._fireBullet(Math.cos(a) * 2.5, Math.sin(a) * 2.5, '#cc44ff');
      }
    }
  }

  _drawShape(ctx) {
    const s = this.size;

    // Outer ring
    ctx.strokeStyle = this._warnFlash > 0 ? '#ffffff' : '#ff88ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.x, this.y, s + 6 + Math.sin(this.age * 4) * 3, 0, Math.PI * 2);
    ctx.stroke();

    // Core octagon
    const sides = 8;
    ctx.fillStyle = ctx.fillStyle; // keep current fill (set by BaseEnemy)
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

    // Phase indicator dots
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
