'use strict';

const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { extractVideoId, downloadAudioPCM, fetchVideoTitle } = require('../utils/youtubeUtils');
const { analyzeAudio } = require('../utils/audioAnalyzer');

/**
 * GET /api/audio/analyze?url=<youtubeUrl>
 *
 * Returns cached or freshly computed analysis for a YouTube video.
 * Analysis includes: bpm, beatTimestamps[], frequencyFrames[], title, duration.
 *
 * If yt-dlp is unavailable, returns a synthetic analysis seeded from the
 * video ID so the game is still playable.
 */
router.get('/analyze', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url query param required' });

  const videoId = extractVideoId(url);
  if (!videoId) return res.status(400).json({ error: 'Could not extract video ID from URL' });

  const db = getDb();

  // Return cached analysis if available
  const cached = db.prepare('SELECT * FROM tracks WHERE video_id = ?').get(videoId);
  if (cached) {
    return res.json({
      videoId: cached.video_id,
      title: cached.title,
      bpm: cached.bpm,
      duration: cached.duration,
      ...JSON.parse(cached.analysis_json)
    });
  }

  // Trigger analysis (may take up to ~2 min on large tracks)
  try {
    const title = await fetchVideoTitle(videoId);
    let analysis;
    let duration = 0;

    try {
      const { pcm, sampleRate } = await downloadAudioPCM(videoId);
      duration = pcm.length / sampleRate;
      analysis = analyzeAudio(pcm, sampleRate);
    } catch (dlErr) {
      console.warn(`yt-dlp unavailable (${dlErr.message}) — using seeded synthetic analysis`);
      analysis = syntheticAnalysis(videoId);
    }

    // Persist
    db.prepare(`
      INSERT OR REPLACE INTO tracks (video_id, title, duration, bpm, analysis_json)
      VALUES (?, ?, ?, ?, ?)
    `).run(videoId, title, duration, analysis.bpm, JSON.stringify({
      beatTimestamps: analysis.beatTimestamps,
      frequencyFrames: analysis.frequencyFrames
    }));

    return res.json({ videoId, title, bpm: analysis.bpm, duration, ...analysis });

  } catch (err) {
    console.error('Audio analysis error:', err);
    return res.status(500).json({ error: 'Analysis failed', detail: err.message });
  }
});

/**
 * GET /api/audio/status/:videoId
 * Quick check — is this video already analysed?
 */
router.get('/status/:videoId', (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT video_id, title, bpm, duration FROM tracks WHERE video_id = ?')
    .get(req.params.videoId);
  if (row) return res.json({ analyzed: true, ...row });
  return res.json({ analyzed: false });
});

// ─────────────────────────────────────────────────────────────────────────────
// Synthetic analysis: deterministic BPM + beats seeded from videoId
// Used as fallback when yt-dlp is not installed.
// ─────────────────────────────────────────────────────────────────────────────
function syntheticAnalysis(videoId) {
  // Hash videoId to a stable BPM in [80, 180]
  let hash = 0;
  for (const c of videoId) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  const bpm = 80 + (hash % 101); // 80–180
  const beatInterval = 60 / bpm;
  // Synthetic analysis assumes a 210-second (3.5 min) track
  const duration = 210;
  const beatTimestamps = [];
  for (let t = 0; t < duration; t += beatInterval) {
    beatTimestamps.push(parseFloat(t.toFixed(3)));
  }

  // Simple sine-wave frequency frames
  const frequencyFrames = [];
  for (let t = 0; t < duration; t += 0.1) {
    frequencyFrames.push({
      t: parseFloat(t.toFixed(1)),
      bass: parseFloat((0.5 + 0.5 * Math.sin((t / beatInterval) * Math.PI)).toFixed(3)),
      mid: parseFloat((0.5 + 0.5 * Math.sin((t / beatInterval) * Math.PI * 2 + 1)).toFixed(3)),
      high: parseFloat((0.5 + 0.5 * Math.sin((t / beatInterval) * Math.PI * 3 + 2)).toFixed(3))
    });
  }

  return { bpm, beatTimestamps, frequencyFrames };
}

module.exports = router;
