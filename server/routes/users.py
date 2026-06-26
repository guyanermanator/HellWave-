import re
import uuid

from flask import Blueprint, jsonify, request

from db import get_db
from limiter import limiter

users_bp = Blueprint('users', __name__)


@users_bp.post('/register')
@limiter.limit('10 per 15 minutes')
def register():
    """
    POST /api/users/register
    Body: { username, color? }
    Creates a new user. Returns 409 if username is already taken.
    """
    conn = get_db()
    data = request.get_json(silent=True) or {}
    username = data.get('username')
    color = data.get('color', '#ffffff')

    if not username or not isinstance(username, str):
        return jsonify({'error': 'username required'}), 400

    # Normalise: trim edges, collapse consecutive spaces
    clean = re.sub(r'\s+', ' ', username.strip())[:24]
    if not re.match(r'^[A-Za-z0-9_\- ]{2,24}$', clean):
        return jsonify({
            'error': 'Username must be 2–24 characters using letters, numbers, spaces, hyphens, or underscores'
        }), 400

    existing = conn.execute('SELECT id FROM users WHERE username = ?', (clean,)).fetchone()
    if existing:
        return jsonify({'error': 'Username already taken'}), 409

    user_id = str(uuid.uuid4())
    user_color = color or '#ffffff'
    conn.execute(
        'INSERT INTO users (id, username, color) VALUES (?, ?, ?)',
        (user_id, clean, user_color)
    )
    conn.commit()

    return jsonify({'id': user_id, 'username': clean, 'color': user_color}), 201


@users_bp.get('/check/<username>')
@limiter.limit('120 per minute')
def check_username(username):
    """GET /api/users/check/<username> — returns { available: bool }"""
    conn = get_db()
    existing = conn.execute('SELECT id FROM users WHERE username = ?', (username,)).fetchone()
    return jsonify({'available': existing is None})


@users_bp.get('/<user_id>')
@limiter.limit('120 per minute')
def get_user(user_id):
    """GET /api/users/<id> — returns public profile."""
    conn = get_db()
    user = conn.execute(
        'SELECT id, username, color, created_at FROM users WHERE id = ?', (user_id,)
    ).fetchone()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    return jsonify(user)


@users_bp.patch('/<user_id>/color')
@limiter.limit('20 per minute')
def update_color(user_id):
    """PATCH /api/users/<id>/color — update display color."""
    conn = get_db()
    data = request.get_json(silent=True) or {}
    color = data.get('color')
    if not color:
        return jsonify({'error': 'color required'}), 400

    user = conn.execute('SELECT id FROM users WHERE id = ?', (user_id,)).fetchone()
    if not user:
        return jsonify({'error': 'User not found'}), 404

    conn.execute('UPDATE users SET color = ? WHERE id = ?', (color, user_id))
    conn.commit()
    return jsonify({'success': True})
