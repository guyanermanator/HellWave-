/* game/Background.js — scrolling starfield + spectrum backdrop */

class Background {
  constructor(canvas) {
    this._canvas = canvas;
    this._stars = [];
    this._beatFlash = 0;
    this._freq = {
      sub: 0, bass: 0, lowMid: 0, mid: 0,
      highMid: 0, presence: 0, brilliance: 0, air: 0,
      pan: 0,
    };
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
        twinkle: Math.random() * Math.PI * 2,
      });
    }
  }

  onFreqFrame(frame) {
    this._freq = { ...this._freq, ...(frame || {}) };
  }

  onBeat() {
    this._beatFlash = 1;
  }

  update(dt) {
    const h = this._canvas.height;
    const bassBoost = (this._freq.sub + this._freq.bass) * 0.5;
    for (const star of this._stars) {
      star.y += star.speed * (1 + bassBoost * 2) * dt * 60;
      star.x += (this._freq.pan || 0) * 0.15;
      star.twinkle += 0.05;
      if (star.y > h) {
        star.y = 0;
        star.x = Math.random() * this._canvas.width;
      }
      if (star.x < 0) star.x = this._canvas.width;
      if (star.x > this._canvas.width) star.x = 0;
    }
    this._beatFlash = Math.max(0, this._beatFlash - dt * 8);
  }

  draw(ctx) {
    const w = this._canvas.width;
    const h = this._canvas.height;

    ctx.fillStyle = '#000008';
    ctx.fillRect(0, 0, w, h);

    if (this._beatFlash > 0.01) {
      const alpha = this._beatFlash * 0.08;
      const grd = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.8);
      grd.addColorStop(0, `rgba(150,0,255,${alpha})`);
      grd.addColorStop(0.5, `rgba(80,0,180,${alpha * 0.5})`);
      grd.addColorStop(1, 'transparent');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, w, h);
    }

    this._drawSpectrum(ctx, w, h);

    for (const star of this._stars) {
      const twinkle = 0.5 + 0.5 * Math.sin(star.twinkle);
      const alpha = star.brightness * twinkle;
      ctx.fillStyle = `rgba(200,200,255,${alpha})`;
      ctx.fillRect(Math.round(star.x), Math.round(star.y), star.size, star.size);
    }
  }

  _drawSpectrum(ctx, w, h) {
    const bands = [
      ['sub', '#ff4477'],
      ['bass', '#ff8844'],
      ['lowMid', '#ffcc44'],
      ['mid', '#88ff44'],
      ['highMid', '#44ffaa'],
      ['presence', '#44ccff'],
      ['brilliance', '#6688ff'],
      ['air', '#aa66ff'],
    ];
    const barWidth = w / bands.length;
    ctx.save();
    ctx.globalAlpha = 0.35;
    for (let i = 0; i < bands.length; i++) {
      const [key, color] = bands[i];
      const val = this._freq[key] || 0;
      const barH = Math.max(8, val * h * 0.16);
      ctx.fillStyle = color;
      ctx.fillRect(i * barWidth + 2, h - barH - 6, barWidth - 4, barH);
    }
    ctx.restore();
  }
}
