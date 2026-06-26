/* audio/BeatTracker.js
 *
 * Uses pre-computed beat timestamps from the server and the YouTube
 * player's getCurrentTime() to fire beat events in real-time.
 *
 * Events:
 *   onBeat(beatIndex)    — fired once per detected beat
 *   onFreqFrame(frame)   — fired with {bass, mid, high} per 100ms tick
 */

/** Cross-browser helper: find last index in arr satisfying predicate */
function _findLastIdxLE(arr, pred) {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (pred(arr[i])) return i;
  }
  return -1;
}

/**
 * BEAT_LOOKAHEAD_SEC: how far ahead of the clock to fire a beat event.
 * Keeps gameplay feeling tight without missing beats due to frame timing jitter.
 * Shared with HW.BEAT_WINDOW_MS / 2 in spirit — keep in sync if tuning.
 */
const BEAT_LOOKAHEAD_SEC = 0.05;

class BeatTracker {
  constructor() {
    this._beats = [];          // sorted array of beat timestamps (seconds)
    this._freqFrames = [];     // [{t, bass, mid, high}, ...]
    this._bpm = 120;
    this._lastBeatIdx = -1;
    this._lastFreqIdx = -1;
    this._getTime = null;      // () => currentTimeSec

    this.onBeat = null;
    this.onFreqFrame = null;

    this._tickId = null;
    this._active = false;
  }

  /** Load analysis data and a time-provider function */
  load(analysisData, timeFn) {
    this._beats = analysisData.beatTimestamps || [];
    this._freqFrames = analysisData.frequencyFrames || [];
    this._bpm = analysisData.bpm || 120;
    this._getTime = timeFn;
    this._lastBeatIdx = -1;
    this._lastFreqIdx = -1;
  }

  get bpm() { return this._bpm; }

  /** Beat interval in seconds */
  get beatInterval() { return 60 / this._bpm; }

  start() {
    if (this._active) return;
    this._active = true;
    this._tick();
  }

  stop() {
    this._active = false;
    if (this._tickId) { cancelAnimationFrame(this._tickId); this._tickId = null; }
  }

  _tick() {
    if (!this._active) return;
    this._tickId = requestAnimationFrame(() => this._tick());

    if (!this._getTime) return;
    const t = this._getTime();

    // Fire beat events
    for (let i = this._lastBeatIdx + 1; i < this._beats.length; i++) {
      if (this._beats[i] <= t + BEAT_LOOKAHEAD_SEC) {
        if (this.onBeat) this.onBeat(i);
        this._lastBeatIdx = i;
      } else break;
    }

    // Fire frequency frame events
    for (let i = this._lastFreqIdx + 1; i < this._freqFrames.length; i++) {
      if (this._freqFrames[i].t <= t + BEAT_LOOKAHEAD_SEC) {
        if (this.onFreqFrame) this.onFreqFrame(this._freqFrames[i]);
        this._lastFreqIdx = i;
      } else break;
    }
  }

  /**
   * Returns how close `timeSec` is to the nearest beat.
   * 0 = exactly on beat, 1 = furthest from beat.
   */
  beatProximity(timeSec) {
    if (!this._beats.length) {
      // Fallback: use BPM-derived interval
      const interval = this.beatInterval;
      const phase = (timeSec % interval) / interval;
      return Math.abs(phase - Math.round(phase)) * 2;
    }
    let minDist = Infinity;
    // Search nearby beats (±3)
    for (let i = Math.max(0, this._lastBeatIdx - 1);
         i < Math.min(this._beats.length, this._lastBeatIdx + 4); i++) {
      const d = Math.abs(this._beats[i] - timeSec);
      if (d < minDist) minDist = d;
    }
    return Math.min(1, minDist / (this.beatInterval * 0.5));
  }

  /** Returns true if timeSec is within the on-beat window */
  isOnBeat(timeSec) {
    return this.beatProximity(timeSec) < (HW.BEAT_WINDOW_MS / 1000) / (this.beatInterval * 0.5);
  }

  /** Get frequency data for a given time (nearest frame) */
  freqAt(timeSec) {
    if (!this._freqFrames.length) return { bass: 0.5, mid: 0.5, high: 0.5 };
    let best = this._freqFrames[0];
    let bestDist = Math.abs(best.t - timeSec);
    for (const f of this._freqFrames) {
      const d = Math.abs(f.t - timeSec);
      if (d < bestDist) { best = f; bestDist = d; }
      if (f.t > timeSec + 1) break;
    }
    return best;
  }

  /** Seek — reset indices so events don't get stuck */
  seek(timeSec) {
    this._lastBeatIdx = _findLastIdxLE(this._beats, t => t <= timeSec);
    this._lastFreqIdx = _findLastIdxLE(this._freqFrames, f => f.t <= timeSec);
  }
}
