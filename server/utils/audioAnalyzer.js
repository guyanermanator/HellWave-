'use strict';

/**
 * audioAnalyzer.js
 *
 * Analyses raw PCM audio data to produce:
 *   - BPM (tempo)
 *   - beat timestamps (array of seconds)
 *   - per-frame frequency band energies (bass / mid / high)
 *
 * All maths operates on Float32 mono PCM at any sample-rate.
 */

/**
 * FFT_SIZE: number of samples per analysis frame.
 *   Larger = finer frequency resolution but coarser time resolution.
 *   Must be a power of 2. 2048 gives ~11Hz/bin at 22050Hz sample rate.
 *
 * HOP_SIZE: sample advance between consecutive frames.
 *   Smaller = finer temporal resolution but more computation.
 *   512 gives ~23ms between frames at 22050Hz.
 */
const FFT_SIZE = 2048;
const HOP_SIZE = 512;

// ─────────────────────────────────────────────────────────────────────────────
// Tiny in-process FFT (radix-2 DIT Cooley–Tukey)
// ─────────────────────────────────────────────────────────────────────────────
function fft(re, im) {
  const n = re.length;
  // Bit-reversal permutation
  let j = 0;
  for (let i = 1; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  // Butterfly passes
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wRe = Math.cos(ang);
    const wIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let curRe = 1, curIm = 0;
      for (let k = 0; k < len / 2; k++) {
        const uRe = re[i + k];
        const uIm = im[i + k];
        const vRe = re[i + k + len / 2] * curRe - im[i + k + len / 2] * curIm;
        const vIm = re[i + k + len / 2] * curIm + im[i + k + len / 2] * curRe;
        re[i + k] = uRe + vRe;
        im[i + k] = uIm + vIm;
        re[i + k + len / 2] = uRe - vRe;
        im[i + k + len / 2] = uIm - vIm;
        const newCurRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = newCurRe;
      }
    }
  }
}

/** Hann window for a block of `n` samples */
function hannWindow(n) {
  const w = new Float32Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
  return w;
}

/**
 * Compute magnitude spectrum for one windowed frame.
 * Returns Float32Array of length FFT_SIZE/2.
 */
function spectrum(samples, window) {
  const n = FFT_SIZE;
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let i = 0; i < n && i < samples.length; i++) {
    re[i] = samples[i] * window[i];
  }
  fft(re, im);
  const mag = new Float32Array(n / 2);
  for (let i = 0; i < n / 2; i++) mag[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]);
  return mag;
}

/**
 * Map FFT bin index → Hz given sample rate.
 */
function binToHz(bin, sampleRate) {
  return (bin * sampleRate) / FFT_SIZE;
}

/**
 * Sum magnitude energy in [loHz, hiHz].
 */
function bandEnergy(mag, sampleRate, loHz, hiHz) {
  let lo = Math.floor((loHz * FFT_SIZE) / sampleRate);
  let hi = Math.ceil((hiHz * FFT_SIZE) / sampleRate);
  lo = Math.max(0, lo);
  hi = Math.min(mag.length - 1, hi);
  let e = 0;
  for (let i = lo; i <= hi; i++) e += mag[i];
  return e;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main analysis function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * analyzeAudio(pcm, sampleRate)
 *
 * @param {Float32Array} pcm   Mono float32 PCM in [-1, 1]
 * @param {number}       sampleRate
 * @returns {object}   { bpm, beatTimestamps, frequencyFrames }
 */
function analyzeAudio(pcm, sampleRate) {
  const window = hannWindow(FFT_SIZE);
  const totalFrames = Math.floor((pcm.length - FFT_SIZE) / HOP_SIZE);
  const frameTime = HOP_SIZE / sampleRate;

  // Per-frame spectral data
  const spectralFlux = new Float32Array(totalFrames);
  const bassArr = new Float32Array(totalFrames);
  const midArr = new Float32Array(totalFrames);
  const highArr = new Float32Array(totalFrames);

  let prevMag = null;

  for (let f = 0; f < totalFrames; f++) {
    const start = f * HOP_SIZE;
    const frame = pcm.subarray(start, start + FFT_SIZE);
    const mag = spectrum(frame, window);

    // Spectral flux (onset detection)
    if (prevMag) {
      let flux = 0;
      for (let b = 0; b < mag.length; b++) {
        const diff = mag[b] - prevMag[b];
        if (diff > 0) flux += diff;
      }
      spectralFlux[f] = flux;
    }
    prevMag = mag;

    // Frequency band energies — normalised by band width
    bassArr[f] = bandEnergy(mag, sampleRate, 20, 300) / 280;
    midArr[f] = bandEnergy(mag, sampleRate, 300, 3000) / 2700;
    highArr[f] = bandEnergy(mag, sampleRate, 3000, 20000) / 17000;
  }

  // Adaptive peak picking for onset detection
  const PEAK_WINDOW = 10; // frames
  const PEAK_THRESHOLD = 0.5;
  const peaks = [];
  for (let f = PEAK_WINDOW; f < totalFrames - PEAK_WINDOW; f++) {
    let isMax = true;
    let localMax = 0;
    for (let k = f - PEAK_WINDOW; k <= f + PEAK_WINDOW; k++) {
      if (spectralFlux[k] > spectralFlux[f]) { isMax = false; break; }
      if (spectralFlux[k] > localMax) localMax = spectralFlux[k];
    }
    if (isMax && spectralFlux[f] > PEAK_THRESHOLD) {
      peaks.push(f);
    }
  }

  // BPM via inter-onset autocorrelation
  const MIN_BPM = 60;
  const MAX_BPM = 200;
  const minIOI = Math.round((60 / MAX_BPM) / frameTime); // frames
  const maxIOI = Math.round((60 / MIN_BPM) / frameTime);

  const histogram = new Float32Array(maxIOI + 1);
  for (let i = 0; i < peaks.length; i++) {
    for (let j = i + 1; j < peaks.length; j++) {
      const ioi = peaks[j] - peaks[i];
      if (ioi < minIOI) continue;
      if (ioi > maxIOI) break;
      // Weight by proximity — closer pairs are more reliable
      histogram[ioi] += 1 / (j - i);
    }
  }

  // Find dominant IOI (allow harmonics — pick lowest with high energy)
  let bestIOI = minIOI;
  let bestScore = 0;
  for (let ioi = minIOI; ioi <= maxIOI; ioi++) {
    // Sum fundamental + harmonics (1x, 2x, 3x)
    let score = histogram[ioi];
    if (ioi * 2 <= maxIOI) score += histogram[ioi * 2] * 0.5;
    if (ioi * 3 <= maxIOI) score += histogram[ioi * 3] * 0.25;
    if (score > bestScore) {
      bestScore = score;
      bestIOI = ioi;
    }
  }

  const bpm = Math.round(60 / (bestIOI * frameTime));

  // Generate beat timestamps from peaks using phase estimation
  const beatInterval = bestIOI;
  const beatTimestamps = [];

  // Seed from strongest peak and propagate
  let seedFrame = peaks[0] || 0;
  let maxFlux = 0;
  for (const p of peaks) {
    if (spectralFlux[p] > maxFlux) { maxFlux = spectralFlux[p]; seedFrame = p; }
  }

  // Walk backwards and forwards from seed
  for (let f = seedFrame; f >= 0; f -= beatInterval) {
    beatTimestamps.push(f * frameTime);
  }
  beatTimestamps.reverse();
  for (let f = seedFrame + beatInterval; f < totalFrames; f += beatInterval) {
    beatTimestamps.push(f * frameTime);
  }

  // Normalise frequency data (max-normalise per band)
  let maxBass = 1e-9, maxMid = 1e-9, maxHigh = 1e-9;
  for (let i = 0; i < totalFrames; i++) {
    if (bassArr[i] > maxBass) maxBass = bassArr[i];
    if (midArr[i] > maxMid) maxMid = midArr[i];
    if (highArr[i] > maxHigh) maxHigh = highArr[i];
  }

  // Downsample frequency frames to ~10fps for compact storage
  // FREQ_HOP: how many audio frames correspond to one output frame
  // = (audio frames/sec) / (desired output frames/sec)
  // = (sampleRate / HOP_SIZE) / FREQ_SAMPLE_RATE
  const FREQ_SAMPLE_RATE = 10; // desired output frames per second
  const FREQ_HOP = Math.max(1, Math.round((sampleRate / HOP_SIZE) / FREQ_SAMPLE_RATE));
  const frequencyFrames = [];
  for (let i = 0; i < totalFrames; i += FREQ_HOP) {
    frequencyFrames.push({
      t: parseFloat((i * frameTime).toFixed(3)),
      bass: parseFloat((bassArr[i] / maxBass).toFixed(3)),
      mid: parseFloat((midArr[i] / maxMid).toFixed(3)),
      high: parseFloat((highArr[i] / maxHigh).toFixed(3))
    });
  }

  return {
    bpm,
    beatTimestamps: beatTimestamps.map(t => parseFloat(t.toFixed(3))),
    frequencyFrames
  };
}

module.exports = { analyzeAudio };
