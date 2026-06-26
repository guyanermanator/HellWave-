'use strict';

const express = require('express');
const router = express.Router();
const { getDb } = require('../db');

/** GET /api/leaderboard/:videoId?limit=10&offset=0 */
router.get('/:videoId', (req, res) => {
  const db = getDb();
  const { videoId } = req.params;
  const limit = Math.min(parseInt(req.query.limit) || 10, 100);
  const offset = parseInt(req.query.offset) || 0;

  const rows = db.prepare(`
    SELECT username, score, max_combo, combo_rank, created_at
    FROM scores
    WHERE video_id = ?
    ORDER BY score DESC
    LIMIT ? OFFSET ?
  `).all(videoId, limit, offset);

  const total = db.prepare('SELECT COUNT(*) as c FROM scores WHERE video_id = ?').get(videoId).c;

  return res.json({ videoId, total, offset, limit, scores: rows });
});

/** POST /api/leaderboard/:videoId — submit a score */
router.post('/:videoId', (req, res) => {
  const db = getDb();
  const { videoId } = req.params;
  const { userId, score, maxCombo, comboRank } = req.body;

  if (!userId || score === undefined) {
    return res.status(400).json({ error: 'userId and score required' });
  }

  const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  db.prepare(`
    INSERT INTO scores (user_id, username, video_id, score, max_combo, combo_rank)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(user.id, user.username, videoId, score, maxCombo || 0, comboRank || 'E');

  // Return player's rank
  const rank = db.prepare(`
    SELECT COUNT(*) + 1 as rank FROM scores
    WHERE video_id = ? AND score > ?
  `).get(videoId, score).rank;

  return res.json({ success: true, rank });
});

module.exports = router;
