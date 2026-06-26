/* ui/MobileControls.js — virtual joystick + shoot button for touch devices */

class MobileControls {
  constructor(player) {
    this._player = player;
    this._controlsEl = document.getElementById('mobile-controls');
    this._joystickEl = document.getElementById('joystick-zone');
    this._shootBtn   = document.getElementById('shoot-btn');

    this._joystickActive = false;
    this._joystickOrigin = { x: 0, y: 0 };
    this._joystickDx = 0;
    this._joystickDy = 0;

    this._visible = false;
  }

  show() {
    if (this._visible) return;
    this._visible = true;
    this._controlsEl.classList.remove('hidden');
    this._bindEvents();
  }

  hide() {
    this._visible = false;
    this._controlsEl.classList.add('hidden');
  }

  _bindEvents() {
    // Joystick touch
    this._joystickEl.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      const rect = this._joystickEl.getBoundingClientRect();
      this._joystickOrigin = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      };
      this._joystickActive = true;
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
      if (!this._joystickActive) return;
      e.preventDefault();
      const t = e.changedTouches[0];
      const dx = t.clientX - this._joystickOrigin.x;
      const dy = t.clientY - this._joystickOrigin.y;
      const maxR = 50;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const scale = dist > maxR ? maxR / dist : 1;
      this._joystickDx = (dx * scale) / maxR;
      this._joystickDy = (dy * scale) / maxR;
    }, { passive: false });

    window.addEventListener('touchend', (e) => {
      this._joystickActive = false;
      this._joystickDx = 0;
      this._joystickDy = 0;
    });

    // Shoot button
    this._shootBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (this._player) this._player.shooting = true;
    }, { passive: false });

    this._shootBtn.addEventListener('touchend', () => {
      if (this._player) this._player.shooting = false;
    });
  }

  update() {
    if (!this._joystickActive || !this._player) return;
    this._player.setJoystickInput(this._joystickDx, this._joystickDy);
  }
}

/** Detect touch device */
function isTouchDevice() {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}
