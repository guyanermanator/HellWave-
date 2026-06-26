import os
import sqlite3
import threading

DB_PATH = os.environ.get(
    'DB_PATH',
    os.path.join(os.path.dirname(os.path.abspath(__file__)), 'hellwave.db')
)

_local = threading.local()


def get_db():
    if not hasattr(_local, 'conn') or _local.conn is None:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = lambda cur, row: {
            col[0]: row[idx] for idx, col in enumerate(cur.description)
        }
        conn.execute('PRAGMA journal_mode=WAL')
        conn.execute('PRAGMA foreign_keys=ON')
        _local.conn = conn
    return _local.conn


def init_db():
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id          TEXT PRIMARY KEY,
            username    TEXT UNIQUE NOT NULL,
            color       TEXT NOT NULL DEFAULT '#ffffff',
            created_at  INTEGER NOT NULL DEFAULT (strftime('%s','now'))
        );

        CREATE TABLE IF NOT EXISTS scores (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id     TEXT NOT NULL REFERENCES users(id),
            username    TEXT NOT NULL,
            video_id    TEXT NOT NULL,
            score       INTEGER NOT NULL DEFAULT 0,
            max_combo   INTEGER NOT NULL DEFAULT 0,
            combo_rank  TEXT NOT NULL DEFAULT 'E',
            created_at  INTEGER NOT NULL DEFAULT (strftime('%s','now'))
        );

        CREATE INDEX IF NOT EXISTS idx_scores_video ON scores(video_id, score DESC);

        CREATE TABLE IF NOT EXISTS tracks (
            video_id      TEXT PRIMARY KEY,
            title         TEXT,
            duration      REAL,
            bpm           REAL,
            analysis_json TEXT,
            analyzed_at   INTEGER NOT NULL DEFAULT (strftime('%s','now'))
        );
    """)
    conn.commit()
    print(f'Database initialised at {DB_PATH}')
