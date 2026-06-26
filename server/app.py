import os
import time

from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS

from db import init_db
from limiter import limiter
from routes.audio import audio_bp
from routes.leaderboard import leaderboard_bp
from routes.users import users_bp

app = Flask(__name__, static_folder=None)
CORS(app)
limiter.init_app(app)

CLIENT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'client')

app.register_blueprint(audio_bp, url_prefix='/api/audio')
app.register_blueprint(leaderboard_bp, url_prefix='/api/leaderboard')
app.register_blueprint(users_bp, url_prefix='/api/users')


@app.get('/api/health')
def health():
    return jsonify({'status': 'ok', 'ts': int(time.time() * 1000)})


@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_client(path):
    # Don't intercept unmatched API routes
    if path.startswith('api/'):
        return jsonify({'error': 'Not found'}), 404
    full_path = os.path.join(CLIENT_DIR, path)
    if path and os.path.isfile(full_path):
        return send_from_directory(CLIENT_DIR, path)
    return send_from_directory(CLIENT_DIR, 'index.html')


# Initialise database on startup (runs when gunicorn imports the module)
init_db()

if __name__ == '__main__':
    PORT = int(os.environ.get('PORT', 3000))
    app.run(host='0.0.0.0', port=PORT, debug=False)
