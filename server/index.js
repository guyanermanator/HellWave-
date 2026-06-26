'use strict';

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { initDb } = require('./db');

const audioRoutes = require('./routes/audio');
const leaderboardRoutes = require('./routes/leaderboard');
const usersRoutes = require('./routes/users');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Rate limiters ────────────────────────────────────────────────────────────

/** General API limit: 120 requests per minute per IP */
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' }
});

/** Strict limit for write/expensive operations: 20 per minute per IP */
const strictLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' }
});

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve client static files
app.use(express.static(path.join(__dirname, '..', 'client')));

// ── API routes ───────────────────────────────────────────────────────────────
app.use('/api/audio', strictLimiter, audioRoutes);
app.use('/api/leaderboard', generalLimiter, leaderboardRoutes);
app.use('/api/users', generalLimiter, usersRoutes);

// Health check (no rate limit — used by Render.com monitoring)
app.get('/api/health', (_req, res) => res.json({ status: 'ok', ts: Date.now() }));

// SPA fallback — serve index.html for any non-API route
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'index.html'));
});

// Initialize DB then start
initDb();
app.listen(PORT, () => {
  console.log(`HellWave server running on port ${PORT}`);
});

module.exports = app;
