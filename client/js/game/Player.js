/* game/Player.js
 * Isometric upward-pointing triangle controlled via mouse / touch joystick.
 */

class Player {
  constructor(canvas) {
    this._canvas = canvas;
    this.x = canvas.width / 2;
    this.y = canvas.height - 80;
    this.size = 14;
    this.lives = HW.PLAYER_LIVES;
    this.active = true;

    this._targetX = this.x;
    this._targetY = this.y;

    this._invincible = 0;    // seconds of remaining invincibility
    this._flashTimer = 0;

    // Grid tracking for beat movement bonus
    this._lastGridCol = -1;
    this._lastGridRow = -1;
    this._gridMovedOnBeat = false;

    // Shoot state
    this._shootCooldown = 0;
    this.shooting = false;   // set by input handler
    this._newBullets = [];

    // Input
    this._bindInput();
  }

  _bindInput() {
    const canvas = this._canvas;

    // Mouse move → set target
    window.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      this._targetX = (e.clientX - rect.left) * scaleX;
      this._targetY = (e.clientY - rect.top) * scaleY;
    });

    // Space bar → shoot
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') { e.preventDefault(); this.shooting = true; }
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') this.shooting = false;
    });
  }

  /** Called by MobileControls with joystick dx/dy (-1..1) */
  setJoystickInput(dx, dy) {
    const speed = HW.PLAYER_SPEED * 8;
    this._targetX = Math.max(this.size, Math.min(this._canvas.width - this.size,
      this.x + dx * speed));
    this._targetY = Math.max(this.size, Math.min(this._canvas.height - this.size,
      this.y + dy * speed));
  }

  update(dt, grid) {
    // Reset per-frame movement flag at start of update
    this._gridMovedOnBeat = false;

    // Smooth follow
    const speed = HW.PLAYER_SPEED * dt * 60;
    this.x += (this._targetX - this.x) * Math.min(1, speed / 15);
    this.y += (this._targetY - this.y) * Math.min(1, speed / 15);

    // Clamp
    this.x = Math.max(this.size, Math.min(this._canvas.width - this.size, this.x));
    this.y = Math.max(this.size, Math.min(this._canvas.height - this.size, this.y));

    this._invincible = Math.max(0, this._invincible - dt);
    this._flashTimer = Math.max(0, this._flashTimer - dt * 8);
    this._shootCooldown = Math.max(0, this._shootCooldown - dt);

    // Shoot
    if (this.shooting && this._shootCooldown <= 0) {
      this._shootCooldown = HW.BULLET_RATE_MS / 1000;
      this._newBullets.push({ x: this.x, y: this.y - this.size, vx: 0, vy: -HW.BULLET_SPEED });
    }

    // Track grid position
    if (grid) {
      const col = grid.colOf(this.x);
      const row = grid.rowOf(this.y);
      this._gridMovedOnBeat = (col !== this._lastGridCol || row !== this._lastGridRow);
      this._lastGridCol = col;
      this._lastGridRow = row;
    }
  }

  getNewBullets() {
    const b = this._newBullets.splice(0);
    return b;
  }

  /** Returns true if player actually moved to a new grid cell this frame */
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

    // Invincibility flicker
    if (this._invincible > 0 && Math.floor(this._invincible * 10) % 2 === 0) {
      ctx.globalAlpha = 0.4;
    }

    // Invincibility aura
    if (this._invincible > 0) {
      ctx.strokeStyle = 'rgba(255,200,255,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size + 8, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Ship body — upward isometric triangle
    const s = this.size;
    ctx.fillStyle = this._flashTimer > 0
      ? `rgba(255,150,150,${0.5 + this._flashTimer * 0.5})`
      : '#e0e0ff';
    ctx.strokeStyle = '#aa88ff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(this.x,         this.y - s);       // tip
    ctx.lineTo(this.x + s,     this.y + s * 0.6); // bottom-right
    ctx.lineTo(this.x,         this.y + s * 0.2); // inner notch
    ctx.lineTo(this.x - s,     this.y + s * 0.6); // bottom-left
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Engine glow
    ctx.fillStyle = `rgba(150,50,255,0.7)`;
    ctx.beginPath();
    ctx.arc(this.x, this.y + s * 0.5, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
