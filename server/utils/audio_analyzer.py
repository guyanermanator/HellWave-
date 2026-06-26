"""
audio_analyzer.py

Analyses PCM audio to produce BPM, beat timestamps, waveform samples, and
music-reactive frame data used by HellWave.
"""

import numpy as np

FFT_SIZE = 2048
HOP_SIZE = 512
WAVEFORM_POINTS = 96
BANDS = [
    ('sub', 20, 60),
    ('bass', 60, 180),
    ('lowMid', 180, 500),
    ('mid', 500, 1200),
    ('highMid', 1200, 3000),
    ('presence', 3000, 6000),
    ('brilliance', 6000, 12000),
    ('air', 12000, 20000),
]



def _hann_window(n):
    return 0.5 * (1 - np.cos(2 * np.pi * np.arange(n) / (n - 1)))



def _pad_frame(samples):
    frame = np.zeros(FFT_SIZE, dtype=np.float32)
    length = min(len(samples), FFT_SIZE)
    if length:
        frame[:length] = samples[:length]
    return frame



def _spectrum(samples, window):
    frame = _pad_frame(samples)
    frame *= window
    return np.abs(np.fft.rfft(frame)).astype(np.float32)



def _band_energy(mag, sample_rate, lo_hz, hi_hz):
    lo = max(0, int(lo_hz * FFT_SIZE / sample_rate))
    hi = min(len(mag) - 1, int(hi_hz * FFT_SIZE / sample_rate))
    if hi <= lo:
        return 0.0
    return float(np.mean(mag[lo:hi + 1]))



def _normalise(arr):
    arr = np.asarray(arr, dtype=np.float32)
    if arr.size == 0:
        return arr
    max_val = float(np.max(arr))
    if max_val <= 1e-9:
        return np.zeros_like(arr)
    return arr / max_val



def _seed_waveform(mono, points):
    if len(mono) == 0:
        return [0.0] * points
    chunk = max(1, len(mono) // points)
    values = []
    for start in range(0, len(mono), chunk):
        values.append(float(np.mean(np.abs(mono[start:start + chunk]))))
    values = np.asarray(values[:points], dtype=np.float32)
    if len(values) < points:
        values = np.pad(values, (0, points - len(values)))
    return [round(v, 4) for v in _normalise(values)]



def _nearest_beat_confidence(time_sec, beat_timestamps, beat_interval):
    if not beat_timestamps:
        return 0.0
    idx = np.searchsorted(beat_timestamps, time_sec)
    candidates = []
    if idx < len(beat_timestamps):
        candidates.append(abs(beat_timestamps[idx] - time_sec))
    if idx > 0:
        candidates.append(abs(beat_timestamps[idx - 1] - time_sec))
    nearest = min(candidates) if candidates else beat_interval
    return max(0.0, 1.0 - (nearest / max(beat_interval * 0.5, 1e-6)))



def _event_labels(frame):
    labels = []
    if frame['bass'] > 0.68 and frame['onset'] > 0.42:
        labels.append('kick')
    if (frame['lowMid'] + frame['mid']) * 0.5 > 0.62 and frame['onset'] > 0.38:
        labels.append('snare')
    if (frame['presence'] + frame['brilliance'] + frame['air']) / 3 > 0.64 and frame['onset'] > 0.3:
        labels.append('hat')
    if (frame['highMid'] + frame['presence']) * 0.5 > 0.58 and frame['centroid'] > 0.38:
        labels.append('vocal')
    if frame.get('chord', 0) > 0.58:
        labels.append('chord')
    if abs(frame.get('pitchDelta', 0)) > 0.16 and frame['onset'] > 0.2:
        labels.append('slide')
    if (frame['mid'] + frame['highMid']) * 0.5 > 0.55:
        labels.append('instrument')
    return labels



def analyze_audio(pcm, sample_rate):
    pcm = np.asarray(pcm, dtype=np.float32)
    if pcm.ndim == 1:
        pcm = pcm.reshape(-1, 1)
    if pcm.shape[1] == 1:
        stereo = np.repeat(pcm, 2, axis=1)
    else:
        stereo = pcm[:, :2]

    mono = np.mean(stereo, axis=1).astype(np.float32)
    window = _hann_window(FFT_SIZE).astype(np.float32)
    total_frames = max(1, int(np.ceil(max(1, len(mono) - FFT_SIZE) / HOP_SIZE)) + 1)
    frame_time = HOP_SIZE / sample_rate
    freqs = np.fft.rfftfreq(FFT_SIZE, d=1 / sample_rate).astype(np.float32)
    nyquist = max(float(sample_rate) / 2.0, 1.0)

    spectral_flux = np.zeros(total_frames, dtype=np.float32)
    band_arrays = {name: np.zeros(total_frames, dtype=np.float32) for name, _, _ in BANDS}
    pan_arr = np.zeros(total_frames, dtype=np.float32)
    centroid_arr = np.zeros(total_frames, dtype=np.float32)
    pitch_arr = np.zeros(total_frames, dtype=np.float32)
    chord_arr = np.zeros(total_frames, dtype=np.float32)

    prev_mag = None
    for f in range(total_frames):
        start = f * HOP_SIZE
        mono_mag = _spectrum(mono[start:start + FFT_SIZE], window)
        left_mag = _spectrum(stereo[start:start + FFT_SIZE, 0], window)
        right_mag = _spectrum(stereo[start:start + FFT_SIZE, 1], window)

        if prev_mag is not None:
            diff = mono_mag - prev_mag
            spectral_flux[f] = float(np.sum(np.maximum(diff, 0)))
        prev_mag = mono_mag

        for name, lo, hi in BANDS:
            band_arrays[name][f] = _band_energy(mono_mag, sample_rate, lo, hi)

        left_energy = float(np.sum(left_mag))
        right_energy = float(np.sum(right_mag))
        total_energy = left_energy + right_energy
        pan_arr[f] = 0.0 if total_energy <= 1e-9 else (right_energy - left_energy) / total_energy

        mag_sum = float(np.sum(mono_mag))
        centroid_hz = float(np.sum(freqs * mono_mag) / mag_sum) if mag_sum > 1e-9 else 0.0
        centroid_arr[f] = centroid_hz / nyquist

        peak_idx = int(np.argmax(mono_mag[1:]) + 1) if len(mono_mag) > 1 else 0
        peak_hz = float(freqs[peak_idx]) if peak_idx < len(freqs) else 0.0
        pitch_arr[f] = np.clip((np.log2(max(55.0, peak_hz) / 55.0) / 5.0), 0.0, 1.0)

        if mag_sum > 1e-9:
            norm_mag = mono_mag / (np.max(mono_mag) + 1e-9)
            useful = np.where((freqs >= 90) & (freqs <= 5000) & (norm_mag > 0.45))[0]
            chord_arr[f] = min(1.0, len(useful) / 14.0)

    flux_norm = _normalise(spectral_flux)
    band_norm = {name: _normalise(values) for name, values in band_arrays.items()}
    centroid_norm = np.clip(centroid_arr, 0, 1)
    pitch_norm = np.clip(pitch_arr, 0, 1)
    chord_norm = _normalise(chord_arr)

    peak_window = 10
    peak_threshold = 0.28
    peaks = []
    for f in range(peak_window, total_frames - peak_window):
        local = flux_norm[f - peak_window:f + peak_window + 1]
        if flux_norm[f] == float(np.max(local)) and flux_norm[f] > peak_threshold:
            peaks.append(f)

    min_bpm, max_bpm = 60, 200
    min_ioi = max(1, round((60 / max_bpm) / frame_time))
    max_ioi = max(min_ioi + 1, round((60 / min_bpm) / frame_time))
    histogram = np.zeros(max_ioi + 1, dtype=np.float32)
    for i in range(len(peaks)):
        for j in range(i + 1, len(peaks)):
            ioi = peaks[j] - peaks[i]
            if ioi < min_ioi:
                continue
            if ioi > max_ioi:
                break
            histogram[ioi] += 1.0 / max(1, (j - i))

    best_ioi = min_ioi
    best_score = 0.0
    for ioi in range(min_ioi, max_ioi + 1):
        score = histogram[ioi]
        if ioi * 2 <= max_ioi:
            score += histogram[ioi * 2] * 0.5
        if ioi * 3 <= max_ioi:
            score += histogram[ioi * 3] * 0.25
        if score > best_score:
            best_score = float(score)
            best_ioi = ioi

    bpm = round(60 / max(best_ioi * frame_time, 1e-6))
    beat_interval = 60 / max(bpm, 1)

    seed_frame = peaks[0] if peaks else 0
    max_flux = 0.0
    for peak in peaks:
        if flux_norm[peak] > max_flux:
            max_flux = float(flux_norm[peak])
            seed_frame = peak

    beat_timestamps = []
    frame_idx = seed_frame
    backwards = []
    while frame_idx >= 0:
        backwards.append(frame_idx * frame_time)
        frame_idx -= best_ioi
    backwards.reverse()
    beat_timestamps.extend(backwards)
    frame_idx = seed_frame + best_ioi
    while frame_idx < total_frames:
        beat_timestamps.append(frame_idx * frame_time)
        frame_idx += best_ioi

    beat_timestamps = [round(t, 3) for t in beat_timestamps]
    sample_rate_frames = 10
    freq_hop = max(1, round((sample_rate / HOP_SIZE) / sample_rate_frames))
    frequency_frames = []
    for i in range(0, total_frames, freq_hop):
        prev_i = max(0, i - freq_hop)
        pitch_delta = float(pitch_norm[i] - pitch_norm[prev_i])
        bands = {name: round(float(band_norm[name][i]), 3) for name, _, _ in BANDS}
        frame = {
            't': round(i * frame_time, 3),
            'sub': bands['sub'],
            'bass': bands['bass'],
            'lowMid': bands['lowMid'],
            'mid': bands['mid'],
            'highMid': bands['highMid'],
            'presence': bands['presence'],
            'brilliance': bands['brilliance'],
            'air': bands['air'],
            'onset': round(float(flux_norm[i]), 3),
            'beatConfidence': round(_nearest_beat_confidence(i * frame_time, beat_timestamps, beat_interval), 3),
            'pan': round(float(np.clip(pan_arr[i], -1, 1)), 3),
            'centroid': round(float(np.clip(centroid_norm[i], 0, 1)), 3),
            'pitch': round(float(np.clip(pitch_norm[i], 0, 1)), 3),
            'pitchDelta': round(float(np.clip(pitch_delta, -1, 1)), 3),
            'chord': round(float(np.clip(chord_norm[i], 0, 1)), 3),
        }
        frame['events'] = _event_labels(frame)
        frequency_frames.append(frame)

    return {
        'bpm': bpm,
        'beatTimestamps': beat_timestamps,
        'frequencyFrames': frequency_frames,
        'waveform': _seed_waveform(mono, WAVEFORM_POINTS),
    }
