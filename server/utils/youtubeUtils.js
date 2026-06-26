'use strict';

/**
 * youtubeUtils.js
 *
 * Utilities for extracting YouTube video IDs from URLs and
 * downloading audio streams for server-side analysis.
 *
 * Uses yt-dlp-wrap which shells out to a local yt-dlp binary.
 * Falls back to a "no analysis" placeholder when yt-dlp is unavailable
 * (e.g. Render.com free tier without yt-dlp installed).
 */

const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);
const path = require('path');
const fs = require('fs');
const os = require('os');

/** Extract the 11-character video ID from any YouTube URL format. */
function extractVideoId(url) {
  const patterns = [
    /(?:v=|\/embed\/|\/shorts\/|youtu\.be\/)([A-Za-z0-9_-]{11})/,
    /^([A-Za-z0-9_-]{11})$/
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

/**
 * Attempt to download and convert YouTube audio to raw 16-bit LE mono PCM.
 * Returns a Buffer of Int16 samples, and the sample rate (22050).
 * Throws if yt-dlp / ffmpeg are unavailable or download fails.
 */
async function downloadAudioPCM(videoId) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hellwave-'));
  const outPath = path.join(tmpDir, 'audio.wav');
  const url = `https://www.youtube.com/watch?v=${videoId}`;

  try {
    // yt-dlp -x --audio-format wav --audio-quality 5 -o <path> <url>
    await execFileAsync('yt-dlp', [
      '-x',
      '--audio-format', 'wav',
      '--audio-quality', '5',
      '--postprocessor-args', '-ar 22050 -ac 1',
      '-o', outPath,
      '--no-playlist',
      url
    ], { timeout: 120_000 });

    const buf = fs.readFileSync(outPath);
    // Parse WAV: skip 44-byte header, rest is 16-bit signed LE PCM
    const samples = new Float32Array((buf.length - 44) / 2);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = buf.readInt16LE(44 + i * 2) / 32768;
    }
    return { pcm: samples, sampleRate: 22050 };
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true }); } catch (_) {}
  }
}

/**
 * Fetch YouTube video title via oEmbed (no API key needed).
 */
async function fetchVideoTitle(videoId) {
  try {
    const https = require('https');
    return await new Promise((resolve, reject) => {
      const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
      https.get(oembedUrl, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            resolve(json.title || videoId);
          } catch (_) { resolve(videoId); }
        });
      }).on('error', () => resolve(videoId));
    });
  } catch (_) {
    return videoId;
  }
}

module.exports = { extractVideoId, downloadAudioPCM, fetchVideoTitle };
