'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');

// Extra strict limit on registration to prevent username enumeration / abuse
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { error: 'Too many registration attempts, please try again later.' }
});

/**
 * POST /api/users/register
 * Body: { username, color? }
 * Creates a new user. Returns 409 if username is already taken.
 */
router.post('/register', registerLimiter, (req, res) => {
  const db = getDb();
  const { username, color } = req.body;

  if (!username || typeof username !== 'string') {
    return res.status(400).json({ error: 'username required' });
  }

  // Normalise: trim edges, collapse consecutive spaces to single space
  const clean = username.trim().replace(/\s+/g, ' ').substring(0, 24);
  if (!/^[A-Za-z0-9_\- ]{2,24}$/.test(clean)) {
    return res.status(400).json({
      error: 'Username must be 2–24 characters using letters, numbers, spaces, hyphens, or underscores'
    });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(clean);
  if (existing) {
    return res.status(409).json({ error: 'Username already taken' });
  }

  const id = uuidv4();
  const userColor = color || '#ffffff';
  db.prepare('INSERT INTO users (id, username, color) VALUES (?, ?, ?)').run(id, clean, userColor);

  return res.status(201).json({ id, username: clean, color: userColor });
});

/**
 * GET /api/users/check/:username
 * Returns { available: bool }
 */
router.get('/check/:username', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(req.params.username);
  return res.json({ available: !existing });
});

/**
 * GET /api/users/:id
 * Returns public profile.
 */
router.get('/:id', (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT id, username, color, created_at FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  return res.json(user);
});

/**
 * PATCH /api/users/:id/color
 * Body: { color }
 * Update name color for a user.
 */
router.patch('/:id/color', (req, res) => {
  const db = getDb();
  const { color } = req.body;
  if (!color) return res.status(400).json({ error: 'color required' });

  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  db.prepare('UPDATE users SET color = ? WHERE id = ?').run(color, req.params.id);
  return res.json({ success: true });
});

module.exports = router;
