from flask import Blueprint, jsonify, request

from db import get_db
from limiter import limiter

leaderboard_bp = Blueprint('leaderboard', __name__)


@leaderboard_bp.get('/<video_id>')
@limiter.limit('120 per minute')
def get_leaderboard(video_id):
    """GET /api/leaderboard/<videoId>?limit=10&offset=0"""
    conn = get_db()
    try:
        limit = min(int(request.args.get('limit', 10)), 100)
    except (ValueError, TypeError):
        limit = 10
    try:
        offset = int(request.args.get('offset', 0))
    except (ValueError, TypeError):
        offset = 0

    rows = conn.execute(
        '''SELECT username, score, max_combo, combo_rank, created_at
           FROM scores
           WHERE video_id = ?
           ORDER BY score DESC
           LIMIT ? OFFSET ?''',
        (video_id, limit, offset)
    ).fetchall()

    total = conn.execute(
        'SELECT COUNT(*) as c FROM scores WHERE video_id = ?', (video_id,)
    ).fetchone()['c']

    return jsonify({'videoId': video_id, 'total': total, 'offset': offset,
                    'limit': limit, 'scores': rows})


@leaderboard_bp.post('/<video_id>')
@limiter.limit('20 per minute')
def submit_score(video_id):
    """POST /api/leaderboard/<videoId> — submit a score."""
    conn = get_db()
    data = request.get_json(silent=True) or {}
    user_id = data.get('userId')
    score = data.get('score')
    max_combo = data.get('maxCombo', 0)
    combo_rank = data.get('comboRank', 'E')

    if not user_id or score is None:
        return jsonify({'error': 'userId and score required'}), 400

    user = conn.execute(
        'SELECT id, username FROM users WHERE id = ?', (user_id,)
    ).fetchone()
    if not user:
        return jsonify({'error': 'User not found'}), 404

    conn.execute(
        '''INSERT INTO scores (user_id, username, video_id, score, max_combo, combo_rank)
           VALUES (?, ?, ?, ?, ?, ?)''',
        (user['id'], user['username'], video_id, score, max_combo, combo_rank)
    )
    conn.commit()

    rank = conn.execute(
        'SELECT COUNT(*) + 1 as rank FROM scores WHERE video_id = ? AND score > ?',
        (video_id, score)
    ).fetchone()['rank']

    return jsonify({'success': True, 'rank': rank})
