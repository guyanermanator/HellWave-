"""
youtube_utils.py

Utilities for extracting YouTube video IDs from URLs and
downloading audio streams for server-side analysis.

Uses yt-dlp (via subprocess) for audio download.
Falls back to synthetic analysis in routes/audio.py when yt-dlp is unavailable
(e.g. Render.com free tier without yt-dlp installed).
"""

import json
import os
import re
import subprocess
import tempfile
import urllib.request
import wave

import numpy as np


def extract_video_id(url):
    """Extract the 11-character video ID from any YouTube URL format."""
    patterns = [
        r'(?:v=|/embed/|/shorts/|youtu\.be/)([A-Za-z0-9_-]{11})',
        r'^([A-Za-z0-9_-]{11})$',
    ]
    for pattern in patterns:
        m = re.search(pattern, url)
        if m:
            return m.group(1)
    return None


def download_audio_pcm(video_id):
    """
    Download YouTube audio and convert to float32 mono PCM.
    Returns (pcm_array, sample_rate).
    Raises an exception if yt-dlp / ffmpeg are unavailable or download fails.
    """
    url = f'https://www.youtube.com/watch?v={video_id}'
    with tempfile.TemporaryDirectory(prefix='hellwave-') as tmp_dir:
        out_path = os.path.join(tmp_dir, 'audio.wav')
        subprocess.run(
            [
                'yt-dlp',
                '-x',
                '--audio-format', 'wav',
                '--audio-quality', '5',
                '--postprocessor-args', '-ar 22050 -ac 1',
                '-o', out_path,
                '--no-playlist',
                url,
            ],
            check=True,
            timeout=120,
        )
        with wave.open(out_path, 'rb') as wf:
            n_channels = wf.getnchannels()
            sample_width = wf.getsampwidth()
            sample_rate = wf.getframerate()
            raw = wf.readframes(wf.getnframes())

    if sample_width == 2:
        samples = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
    elif sample_width == 4:
        samples = np.frombuffer(raw, dtype=np.int32).astype(np.float32) / 2147483648.0
    else:
        raise ValueError(f'Unsupported WAV sample width: {sample_width}')

    if n_channels > 1:
        samples = samples.reshape(-1, n_channels).mean(axis=1)

    return samples, sample_rate


def fetch_video_title(video_id):
    """Fetch YouTube video title via oEmbed (no API key required)."""
    try:
        oembed_url = (
            f'https://www.youtube.com/oembed'
            f'?url=https://www.youtube.com/watch?v={video_id}&format=json'
        )
        with urllib.request.urlopen(oembed_url, timeout=10) as resp:
            data = json.loads(resp.read())
            return data.get('title', video_id)
    except Exception:
        return video_id
