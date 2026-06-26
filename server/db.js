'use strict';

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'hellwave.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function initDb() {
  const d = getDb();

  d.exec(`
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
  `);

  console.log('Database initialised at', DB_PATH);
}

module.exports = { getDb, initDb };
