/* game/Player.js — cursor-following ship with mobile joystick support */

class Player {
  static _installPointerTracker() {
    if (Player._pointerTrackerInstalled) return;
    Player._pointerTrackerInstalled = true;
    Player._lastPointer = { x: window.innerWidth / 2, y: window.innerHeight / 2, active: false };

    const update = (x, y) => {
      Player._lastPointer = { x, y, active: true };
    };

    window.addEventListener('mousemove', (e) => update(e.clientX, e.clientY));
    window.addEventListener('pointermove', (e) => update(e.clientX, e.clientY));
    window.addEventListener('pointerdown', (e) => update(e.clientX, e.clientY));
  }

  constructor(canvas, color = '#ffffff') {
    Player._installPointerTracker();

    this._canvas = canvas;
    this.x = canvas.width / 2;
    this.y = canvas.height - 80;
    this.size = 14;
    this.lives = HW.PLAYER_LIVES;
    this.active = true;
    this.color = color;

    this._targetX = this.x;
    this._targetY = this.y;
    this._invincible = 0;
    this._flashTimer = 0;
    this._lastGridCol = -1;
    this._lastGridRow = -1;
    this._gridMovedOnBeat = false;
    this._shootCooldown = 0;
    this.shooting = false;
    this._newBullets = [];
    this._angle = -Math.PI / 2;
    this._lastDx = 0;
    this._lastDy = -1;

    this._bindInput();
  }

  _bindInput() {
    const canvas = this._canvas;

    const updateTarget = (clientX, clientY) => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      this._targetX = (clientX - rect.left) * scaleX;
      this._targetY = (clientY - rect.top) * scaleY;
    };

    this._syncPointerTarget = () => {
      if (Player._lastPointer && Player._lastPointer.active) {
        updateTarget(Player._lastPointer.x, Player._lastPointer.y);
      }
    };

    window.addEventListener('mousemove', (e) => updateTarget(e.clientX, e.clientY));
    window.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'touch') updateTarget(e.clientX, e.clientY);
    });

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') { e.preventDefault(); this.shooting = true; }
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') this.shooting = false;
    });
  }

  primePointerTarget() {
    if (typeof this._syncPointerTarget === 'function') this._syncPointerTarget();
  }

  setAccentColor(color) {
    this.color = color || '#ffffff';
  }

  setJoystickInput(dx, dy) {
    const speed = HW.PLAYER_SPEED * 8;
    this._targetX = Math.max(this.size, Math.min(this._canvas.width - this.size, this.x + dx * speed));
    this._targetY = Math.max(this.size, Math.min(this._canvas.height - this.size, this.y + dy * speed));
  }

  update(dt, grid) {
    this._gridMovedOnBeat = false;

    const speed = HW.PLAYER_SPEED * dt * 60;
    const prevX = this.x;
    const prevY = this.y;
    this.x += (this._targetX - this.x) * Math.min(1, speed / 15);
    this.y += (this._targetY - this.y) * Math.min(1, speed / 15);

    this.x = Math.max(this.size, Math.min(this._canvas.width - this.size, this.x));
    this.y = Math.max(this.size, Math.min(this._canvas.height - this.size, this.y));

    const dx = this.x - prevX;
    const dy = this.y - prevY;
    if (Math.abs(dx) + Math.abs(dy) > 0.05) {
      this._lastDx = dx;
      this._lastDy = dy;
      this._angle = Math.atan2(dy, dx);
    }

    this._invincible = Math.max(0, this._invincible - dt);
    this._flashTimer = Math.max(0, this._flashTimer - dt * 8);
    this._shootCooldown = Math.max(0, this._shootCooldown - dt);

    if (this.shooting && this._shootCooldown <= 0) {
      this._shootCooldown = HW.BULLET_RATE_MS / 1000;
      this._newBullets.push({ x: this.x, y: this.y - this.size, vx: 0, vy: -HW.BULLET_SPEED });
    }

    if (grid) {
      const col = grid.colOf(this.x);
      const row = grid.rowOf(this.y);
      this._gridMovedOnBeat = (col !== this._lastGridCol || row !== this._lastGridRow);
      this._lastGridCol = col;
      this._lastGridRow = row;
    }
  }

  getNewBullets() {
    return this._newBullets.splice(0);
  }

  get gridMovedOnBeat() { return this._gridMovedOnBeat; }

  takeDamage() {
    if (this._invincible > 0) return false;
    this.lives--;
    this._invincible = HW.PLAYER_INVINCIBLE_MS / 1000;
    this._flashTimer = 1;
    if (this.lives <= 0) this.active = false;
    return true;
  }

  get isInvincible() { return this._invincible > 0; }

  draw(ctx) {
    if (!this.active) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this._angle + Math.PI / 2);

    if (this._invincible > 0 && Math.floor(this._invincible * 10) % 2 === 0) ctx.globalAlpha = 0.45;

    if (this._invincible > 0) {
      ctx.strokeStyle = 'rgba(255,200,255,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, this.size + 8, 0, Math.PI * 2);
      ctx.stroke();
    }

    const s = this.size;
    const accent = this.color || '#ffffff';
    ctx.fillStyle = this._flashTimer > 0
      ? `rgba(255,150,150,${0.5 + this._flashTimer * 0.5})`
      : '#e0e0ff';
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.7;

    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.lineTo(s * 0.9, s * 0.7);
    ctx.lineTo(0, s * 0.15);
    ctx.lineTo(-s * 0.9, s * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.arc(0, s * 0.45, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
