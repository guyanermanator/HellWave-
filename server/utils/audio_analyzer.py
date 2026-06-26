"""
audio_analyzer.py

Analyses raw PCM audio data to produce:
  - BPM (tempo)
  - beat timestamps (array of seconds)
  - per-frame frequency band energies (bass / mid / high)

Operates on float32 mono PCM at any sample rate.
Uses numpy for efficient FFT computation.
"""

import numpy as np

FFT_SIZE = 2048
HOP_SIZE = 512


def _hann_window(n):
    return 0.5 * (1 - np.cos(2 * np.pi * np.arange(n) / (n - 1)))


def _spectrum(samples, window):
    """Compute magnitude spectrum for one windowed frame. Returns array of length FFT_SIZE//2."""
    frame = np.zeros(FFT_SIZE, dtype=np.float32)
    length = min(len(samples), FFT_SIZE)
    frame[:length] = samples[:length]
    frame *= window
    mag = np.abs(np.fft.rfft(frame))[:FFT_SIZE // 2]
    return mag.astype(np.float32)


def _band_energy(mag, sample_rate, lo_hz, hi_hz):
    """Sum magnitude energy in [lo_hz, hi_hz]."""
    lo = max(0, int(lo_hz * FFT_SIZE / sample_rate))
    hi = min(len(mag) - 1, int(hi_hz * FFT_SIZE / sample_rate))
    return float(np.sum(mag[lo:hi + 1]))


def analyze_audio(pcm, sample_rate):
    """
    analyze_audio(pcm, sample_rate)

    pcm        — 1-D numpy float32 array of mono PCM in [-1, 1]
    sample_rate — int

    Returns dict with keys: bpm, beatTimestamps, frequencyFrames
    """
    pcm = np.asarray(pcm, dtype=np.float32)
    window = _hann_window(FFT_SIZE).astype(np.float32)
    total_frames = (len(pcm) - FFT_SIZE) // HOP_SIZE
    frame_time = HOP_SIZE / sample_rate

    spectral_flux = np.zeros(total_frames, dtype=np.float32)
    bass_arr = np.zeros(total_frames, dtype=np.float32)
    mid_arr = np.zeros(total_frames, dtype=np.float32)
    high_arr = np.zeros(total_frames, dtype=np.float32)

    prev_mag = None
    for f in range(total_frames):
        start = f * HOP_SIZE
        mag = _spectrum(pcm[start:start + FFT_SIZE], window)
        if prev_mag is not None:
            diff = mag - prev_mag
            spectral_flux[f] = float(np.sum(np.maximum(diff, 0)))
        prev_mag = mag
        bass_arr[f] = _band_energy(mag, sample_rate, 20, 300) / 280
        mid_arr[f] = _band_energy(mag, sample_rate, 300, 3000) / 2700
        high_arr[f] = _band_energy(mag, sample_rate, 3000, 20000) / 17000

    # Adaptive peak picking for onset detection
    PEAK_WINDOW = 10
    PEAK_THRESHOLD = 0.5
    peaks = []
    for f in range(PEAK_WINDOW, total_frames - PEAK_WINDOW):
        local = spectral_flux[f - PEAK_WINDOW:f + PEAK_WINDOW + 1]
        if spectral_flux[f] == float(np.max(local)) and spectral_flux[f] > PEAK_THRESHOLD:
            peaks.append(f)

    # BPM via inter-onset autocorrelation histogram
    MIN_BPM, MAX_BPM = 60, 200
    min_ioi = round((60 / MAX_BPM) / frame_time)
    max_ioi = round((60 / MIN_BPM) / frame_time)

    histogram = np.zeros(max_ioi + 1, dtype=np.float32)
    for i in range(len(peaks)):
        for j in range(i + 1, len(peaks)):
            ioi = peaks[j] - peaks[i]
            if ioi < min_ioi:
                continue
            if ioi > max_ioi:
                break
            histogram[ioi] += 1.0 / (j - i)

    best_ioi = min_ioi
    best_score = 0.0
    for ioi in range(min_ioi, max_ioi + 1):
        score = histogram[ioi]
        if ioi * 2 <= max_ioi:
            score += histogram[ioi * 2] * 0.5
        if ioi * 3 <= max_ioi:
            score += histogram[ioi * 3] * 0.25
        if score > best_score:
            best_score = score
            best_ioi = ioi

    bpm = round(60 / (best_ioi * frame_time))

    # Generate beat timestamps from strongest peak
    seed_frame = peaks[0] if peaks else 0
    max_flux = 0.0
    for p in peaks:
        if spectral_flux[p] > max_flux:
            max_flux = float(spectral_flux[p])
            seed_frame = p

    beat_timestamps = []
    f = seed_frame
    backwards = []
    while f >= 0:
        backwards.append(f * frame_time)
        f -= best_ioi
    backwards.reverse()
    beat_timestamps.extend(backwards)
    f = seed_frame + best_ioi
    while f < total_frames:
        beat_timestamps.append(f * frame_time)
        f += best_ioi

    # Normalise frequency data
    max_bass = max(float(np.max(bass_arr)), 1e-9)
    max_mid = max(float(np.max(mid_arr)), 1e-9)
    max_high = max(float(np.max(high_arr)), 1e-9)

    # Downsample to ~10 fps
    FREQ_SAMPLE_RATE = 10
    freq_hop = max(1, round((sample_rate / HOP_SIZE) / FREQ_SAMPLE_RATE))
    frequency_frames = []
    for i in range(0, total_frames, freq_hop):
        frequency_frames.append({
            't': round(i * frame_time, 3),
            'bass': round(float(bass_arr[i]) / max_bass, 3),
            'mid': round(float(mid_arr[i]) / max_mid, 3),
            'high': round(float(high_arr[i]) / max_high, 3),
        })

    return {
        'bpm': bpm,
        'beatTimestamps': [round(t, 3) for t in beat_timestamps],
        'frequencyFrames': frequency_frames,
    }
