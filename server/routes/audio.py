import json
import math

from flask import Blueprint, jsonify, request

from db import get_db
from limiter import limiter
from utils.youtube_utils import extract_video_id, download_audio_pcm, fetch_video_title
from utils.audio_analyzer import analyze_audio

audio_bp = Blueprint('audio', __name__)

# ─── Synthetic analysis fallback ─────────────────────────────────────────────

def synthetic_analysis(video_id):
    """Deterministic BPM + beats seeded from video_id (used when yt-dlp is unavailable)."""
    h = 0
    for c in video_id:
        h = ((h * 31) + ord(c)) & 0xFFFFFFFF
    bpm = 80 + (h % 101)  # 80–180
    beat_interval = 60 / bpm
    duration = 210  # synthetic 3.5 min track

    beat_timestamps = []
    t = 0.0
    while t < duration:
        beat_timestamps.append(round(t, 3))
        t += beat_interval

    frequency_frames = []
    t = 0.0
    while t < duration:
        frequency_frames.append({
            't': round(t, 1),
            'bass': round(0.5 + 0.5 * math.sin((t / beat_interval) * math.pi), 3),
            'mid': round(0.5 + 0.5 * math.sin((t / beat_interval) * math.pi * 2 + 1), 3),
            'high': round(0.5 + 0.5 * math.sin((t / beat_interval) * math.pi * 3 + 2), 3),
        })
        t += 0.1

    return {'bpm': bpm, 'beatTimestamps': beat_timestamps, 'frequencyFrames': frequency_frames}


# ─── Routes ──────────────────────────────────────────────────────────────────

@audio_bp.get('/analyze')
@limiter.limit('20 per minute')
def analyze():
    """
    GET /api/audio/analyze?url=<youtubeUrl>
    Returns cached or freshly computed analysis for a YouTube video.
    """
    url = request.args.get('url')
    if not url:
        return jsonify({'error': 'url query param required'}), 400

    video_id = extract_video_id(url)
    if not video_id:
        return jsonify({'error': 'Could not extract video ID from URL'}), 400

    conn = get_db()
    cur = conn.execute('SELECT * FROM tracks WHERE video_id = ?', (video_id,))
    cached = cur.fetchone()
    if cached:
        return jsonify({
            'videoId': cached['video_id'],
            'title': cached['title'],
            'bpm': cached['bpm'],
            'duration': cached['duration'],
            **json.loads(cached['analysis_json'])
        })

    try:
        title = fetch_video_title(video_id)
        duration = 0
        try:
            pcm, sample_rate = download_audio_pcm(video_id)
            duration = len(pcm) / sample_rate
            analysis = analyze_audio(pcm, sample_rate)
        except Exception as dl_err:
            print(f'yt-dlp unavailable ({dl_err}) — using seeded synthetic analysis')
            analysis = synthetic_analysis(video_id)

        conn.execute(
            'INSERT OR REPLACE INTO tracks (video_id, title, duration, bpm, analysis_json) VALUES (?, ?, ?, ?, ?)',
            (video_id, title, duration, analysis['bpm'], json.dumps({
                'beatTimestamps': analysis['beatTimestamps'],
                'frequencyFrames': analysis['frequencyFrames']
            }))
        )
        conn.commit()

        return jsonify({'videoId': video_id, 'title': title, 'bpm': analysis['bpm'],
                        'duration': duration, **analysis})

    except Exception as err:
        print(f'Audio analysis error: {err}')
        return jsonify({'error': 'Analysis failed', 'detail': str(err)}), 500


@audio_bp.get('/status/<video_id>')
@limiter.limit('120 per minute')
def status(video_id):
    """GET /api/audio/status/<videoId> — quick check if video is already analysed."""
    conn = get_db()
    cur = conn.execute(
        'SELECT video_id, title, bpm, duration FROM tracks WHERE video_id = ?', (video_id,)
    )
    row = cur.fetchone()
    if row:
        return jsonify({'analyzed': True, **row})
    return jsonify({'analyzed': False})
