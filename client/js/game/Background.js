/* game/Background.js — scrolling starfield + beat-reactive nebula */

class Background {
  constructor(canvas) {
    this._canvas = canvas;
    this._stars = [];
    this._bassEnergy = 0;
    this._beatFlash = 0;
    this._init();
  }

  _init() {
    const w = this._canvas.width;
    const h = this._canvas.height;
    for (let i = 0; i < HW.STAR_COUNT; i++) {
      this._stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        speed: 0.3 + Math.random() * 1.5,
        size: Math.random() < 0.1 ? 2 : 1,
        brightness: 0.3 + Math.random() * 0.7,
        twinkle: Math.random() * Math.PI * 2
      });
    }
  }

  onFreqFrame(frame) {
    this._bassEnergy = frame.bass;
  }

  onBeat() {
    this._beatFlash = 1;
  }

  update(dt) {
    const h = this._canvas.height;
    for (const s of this._stars) {
      s.y += s.speed * (1 + this._bassEnergy * 2) * dt * 60;
      s.twinkle += 0.05;
      if (s.y > h) {
        s.y = 0;
        s.x = Math.random() * this._canvas.width;
      }
    }
    this._beatFlash = Math.max(0, this._beatFlash - dt * 8);
    this._bassEnergy *= 0.9; // smooth decay
  }

  draw(ctx) {
    const w = this._canvas.width;
    const h = this._canvas.height;

    // Deep background
    ctx.fillStyle = '#000008';
    ctx.fillRect(0, 0, w, h);

    // Nebula glow on beat
    if (this._beatFlash > 0.01) {
      const alpha = this._beatFlash * 0.08;
      const grd = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.8);
      grd.addColorStop(0, `rgba(150,0,255,${alpha})`);
      grd.addColorStop(0.5, `rgba(80,0,180,${alpha * 0.5})`);
      grd.addColorStop(1, 'transparent');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, w, h);
    }

    // Bass energy glow at bottom
    if (this._bassEnergy > 0.1) {
      const alpha = this._bassEnergy * 0.15;
      const grd = ctx.createLinearGradient(0, h * 0.7, 0, h);
      grd.addColorStop(0, 'transparent');
      grd.addColorStop(1, `rgba(255,0,100,${alpha})`);
      ctx.fillStyle = grd;
      ctx.fillRect(0, h * 0.7, w, h * 0.3);
    }

    // Stars
    for (const s of this._stars) {
      const twinkle = 0.5 + 0.5 * Math.sin(s.twinkle);
      const alpha = s.brightness * twinkle;
      ctx.fillStyle = `rgba(200,200,255,${alpha})`;
      ctx.fillRect(Math.round(s.x), Math.round(s.y), s.size, s.size);
    }
  }
}
