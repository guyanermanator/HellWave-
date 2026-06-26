/* main.js — HellWave entry point */

'use strict';

// ── Globals referenced throughout ──────────────────────────────────────────
let audioEngine;
let beatTracker;
let currentGame = null;
let leaderboardUI;

// ── Screen management ───────────────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.toggle('active', s.id === id);
    s.classList.toggle('hidden', s.id !== id);
  });
}

// ── Canvas sizing ───────────────────────────────────────────────────────────
function resizeCanvas(canvas) {
  const maxH = window.innerHeight;
  const maxW = window.innerWidth;
  const aspect = HW.CANVAS_W / HW.CANVAS_H;
  let h = maxH;
  let w = h * aspect;
  if (w > maxW) { w = maxW; h = w / aspect; }
  canvas.style.width  = Math.round(w) + 'px';
  canvas.style.height = Math.round(h) + 'px';
  canvas.width  = HW.CANVAS_W;
  canvas.height = HW.CANVAS_H;
}

// ── Demo analysis (no track) ─────────────────────────────────────────────────
function buildDemoAnalysis() {
  const bpm = 128;
  const interval = 60 / bpm;
  const duration = 600;
  const beatTimestamps = [];
  for (let t = 0; t < duration; t += interval) {
    beatTimestamps.push(parseFloat(t.toFixed(3)));
  }
  const frequencyFrames = [];
  for (let t = 0; t < duration; t += 0.1) {
    frequencyFrames.push({
      t: parseFloat(t.toFixed(1)),
      bass: parseFloat((0.5 + 0.5 * Math.sin(t * 1.5)).toFixed(3)),
      mid:  parseFloat((0.5 + 0.5 * Math.sin(t * 2.3 + 1)).toFixed(3)),
      high: parseFloat((0.5 + 0.5 * Math.sin(t * 3.7 + 2)).toFixed(3))
    });
  }
  return { videoId: 'demo', title: 'Demo Mode', bpm, duration, beatTimestamps, frequencyFrames };
}

// ── Game lifecycle ───────────────────────────────────────────────────────────
function startGame(trackData, user, isDemo) {
  const canvas = document.getElementById('game-canvas');
  resizeCanvas(canvas);
  showScreen('screen-game');

  const analysis = isDemo ? buildDemoAnalysis() : trackData;

  // Setup beat tracker
  beatTracker.load(analysis, () => {
    return isDemo
      ? (performance.now() / 1000)
      : audioEngine.getCurrentTime();
  });

  // Load YouTube video (if not demo)
  if (!isDemo && trackData && trackData.videoId) {
    audioEngine.load(trackData.videoId);
  }

  // Setup HUD track info directly
  document.getElementById('bpm-value').textContent = Math.round(analysis.bpm || 0) || '--';
  document.getElementById('hud-track-name').textContent = analysis.title || 'Unknown Track';

  // Stop previous game
  if (currentGame) currentGame.stop();

  currentGame = new Game(canvas, isDemo ? null : audioEngine, beatTracker, (result) => {
    handleGameOver(result, trackData, user);
  });

  // Mobile controls
  if (isTouchDevice()) {
    const mc = new MobileControls(currentGame.player);
    mc.show();
    currentGame.setMobileControls(mc);
  }

  // Gamepad support (polls in the game loop via Player)
  setupGamepad(currentGame.player);

  currentGame.start();

  // Pause/resume/quit buttons
  document.getElementById('btn-resume').onclick = () => currentGame.togglePause();
  document.getElementById('btn-quit-game').onclick = () => {
    if (currentGame) currentGame.stop();
    document.getElementById('pause-overlay').classList.add('hidden');
    showScreen('screen-menu');
  };
}

function handleGameOver(result, trackData, user) {
  document.getElementById('go-score').textContent = result.score.toLocaleString();
  document.getElementById('go-rank').textContent  = result.comboRank;
  document.getElementById('gameover-overlay').classList.remove('hidden');

  // Submit score if user and online track
  if (user && user.id && trackData && trackData.videoId) {
    APIClient.submitScore(
      trackData.videoId, user.id, result.score, result.maxComboPoints, result.comboRank
    ).catch(() => {});
  }

  document.getElementById('btn-retry').onclick = () => {
    document.getElementById('gameover-overlay').classList.add('hidden');
    const isDemo = !trackData || trackData.videoId === 'demo';
    startGame(trackData, user, isDemo);
  };

  document.getElementById('btn-go-menu').onclick = () => {
    document.getElementById('gameover-overlay').classList.add('hidden');
    if (currentGame) { currentGame.stop(); currentGame = null; }
    showScreen('screen-menu');
  };
}

// ── Gamepad support ──────────────────────────────────────────────────────────
let _gamepadPlayer = null;
function setupGamepad(player) {
  _gamepadPlayer = player;
}

function pollGamepad() {
  // Guard: ensure the referenced player still belongs to the active game
  if (!currentGame || !_gamepadPlayer || currentGame.player !== _gamepadPlayer) return;
  const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const gp of gamepads) {
    if (!gp) continue;
    // Left stick axes 0 (X) and 1 (Y)
    const dx = Math.abs(gp.axes[0]) > 0.1 ? gp.axes[0] : 0;
    const dy = Math.abs(gp.axes[1]) > 0.1 ? gp.axes[1] : 0;
    if (dx !== 0 || dy !== 0) _gamepadPlayer.setJoystickInput(dx, dy);
    // Button 0 (A/Cross) = shoot
    _gamepadPlayer.shooting = !!(gp.buttons[0] && gp.buttons[0].pressed);
    // Button 9 (Start) = pause/resume
    if (gp.buttons[9] && gp.buttons[9].pressed) {
      currentGame.togglePause();
    }
    break;
  }
}
setInterval(pollGamepad, 16);

// ── Init ─────────────────────────────────────────────────────────────────────
function init() {
  audioEngine = new AudioEngine();
  beatTracker = new BeatTracker();
  leaderboardUI = new LeaderboardUI();

  const canvas = document.getElementById('game-canvas');
  resizeCanvas(canvas);
  window.addEventListener('resize', () => resizeCanvas(canvas));

  new MainMenu((trackData, user, isDemo) => {
    startGame(trackData, user, isDemo);
  });

  showScreen('screen-menu');
}

// Defer init until DOM + scripts are ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
