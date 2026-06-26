"""
youtube_utils.py

Utilities for extracting YouTube video IDs from URLs, fetching public
video metadata, and downloading audio streams for server-side analysis.
"""

import json
import os
import re
import subprocess
import tempfile
import urllib.parse
import urllib.request
import wave

import numpy as np


YOUTUBE_PATTERNS = [
    r'(?:v=|/embed/|/shorts/|youtu\.be/)([A-Za-z0-9_-]{11})',
    r'^([A-Za-z0-9_-]{11})$',
]



def extract_video_id(url):
    """Extract the 11-character video ID from supported YouTube URLs."""
    if not url or not isinstance(url, str):
        return None
    decoded = urllib.parse.unquote(url.strip())
    for pattern in YOUTUBE_PATTERNS:
        match = re.search(pattern, decoded)
        if match:
            return match.group(1)
    return None



def download_audio_pcm(video_id):
    """
    Download YouTube audio and convert to float32 PCM.
    Returns (samples, sample_rate) where samples is mono or stereo float32.
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
                '--postprocessor-args', '-ar 22050 -ac 2',
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
        samples = samples.reshape(-1, n_channels)
    else:
        samples = samples.reshape(-1, 1)

    return samples, sample_rate



def fetch_video_metadata(video_id):
    """Fetch public YouTube metadata via oEmbed without an API key."""
    fallback = {
        'title': video_id,
        'artist': 'YouTube',
        'thumbnail': f'https://i.ytimg.com/vi/{video_id}/hqdefault.jpg',
    }
    try:
        oembed_url = (
            'https://www.youtube.com/oembed'
            f'?url=https://www.youtube.com/watch?v={video_id}&format=json'
        )
        with urllib.request.urlopen(oembed_url, timeout=10) as resp:
            data = json.loads(resp.read())
            return {
                'title': data.get('title', fallback['title']),
                'artist': data.get('author_name', fallback['artist']),
                'thumbnail': data.get('thumbnail_url', fallback['thumbnail']),
            }
    except Exception:
        return fallback
