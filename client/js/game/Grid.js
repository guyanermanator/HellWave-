/* game/Grid.js
 *
 * Draws the beat-movement grid and provides snap-to-cell helpers.
 * The player gets movement bonus when staying within a cell across a beat.
 */

class Grid {
  constructor(canvas) {
    this._canvas = canvas;
    this._cols = HW.GRID_COLS;
    this._rows = HW.GRID_ROWS;
    this._alpha = 0.08;       // baseline opacity
    this._pulseAlpha = 0;     // extra alpha on beat
  }

  get cellW() { return this._canvas.width / this._cols; }
  get cellH() { return this._canvas.height / this._rows; }

  /** Which column (0-based) contains x? */
  colOf(x) { return Math.max(0, Math.min(this._cols - 1, Math.floor(x / this.cellW))); }
  rowOf(y) { return Math.max(0, Math.min(this._rows - 1, Math.floor(y / this.cellH))); }

  onBeat() { this._pulseAlpha = 0.18; }

  update(dt) {
    this._pulseAlpha = Math.max(0, this._pulseAlpha - dt * 5);
  }

  draw(ctx) {
    const alpha = this._alpha + this._pulseAlpha;
    const cw = this.cellW;
    const ch = this.cellH;
    const w = this._canvas.width;
    const h = this._canvas.height;

    ctx.save();
    ctx.strokeStyle = `rgba(150,80,255,${alpha})`;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);

    // Vertical lines
    for (let c = 1; c < this._cols; c++) {
      ctx.beginPath();
      ctx.moveTo(c * cw, 0);
      ctx.lineTo(c * cw, h);
      ctx.stroke();
    }
    // Horizontal lines
    for (let r = 1; r < this._rows; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * ch);
      ctx.lineTo(w, r * ch);
      ctx.stroke();
    }

    ctx.setLineDash([]);
    ctx.restore();
  }
}
