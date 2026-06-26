/* main.js — HellWave entry point */

'use strict';

let audioEngine;
let uiAudio;
let beatTracker;
let currentGame = null;
let leaderboardUI;
let mainMenu;

function showScreen(id) {
  document.querySelectorAll('.screen').forEach((screen) => {
    screen.classList.toggle('active', screen.id === id);
    screen.classList.toggle('hidden', screen.id !== id);
  });
}

function resizeCanvas(canvas) {
  const maxH = window.innerHeight;
  const maxW = window.innerWidth;
  const aspect = HW.CANVAS_W / HW.CANVAS_H;
  let h = maxH;
  let w = h * aspect;
  if (w > maxW) { w = maxW; h = w / aspect; }
  canvas.style.width = `${Math.round(w)}px`;
  canvas.style.height = `${Math.round(h)}px`;
  canvas.width = HW.CANVAS_W;
  canvas.height = HW.CANVAS_H;
}

function showGameLoading(text, visible = true) {
  const overlay = document.getElementById('game-loading-overlay');
  document.getElementById('game-loading-text').textContent = text || 'Preparing playback…';
  overlay.classList.toggle('hidden', !visible);
}

function getStoredSettings() {
  try {
    return { ...HW.DEFAULT_SETTINGS, ...(JSON.parse(localStorage.getItem('hw_settings') || 'null') || {}) };
  } catch (_) {
    return { ...HW.DEFAULT_SETTINGS };
  }
}

function applySettings(settings) {
  const master = settings.masterVolume ?? HW.DEFAULT_SETTINGS.masterVolume;
  const music = settings.musicVolume ?? HW.DEFAULT_SETTINGS.musicVolume;
  const sfx = settings.sfxVolume ?? HW.DEFAULT_SETTINGS.sfxVolume;
  audioEngine.setVolume(master * music);
  uiAudio.setVolumes(master, sfx);
}

function buildDemoAnalysis() {
  const bpm = 128;
  const interval = 60 / bpm;
  const duration = 75;
  const beatTimestamps = [];
  const waveform = [];
  for (let t = 0; t < duration; t += interval) beatTimestamps.push(parseFloat(t.toFixed(3)));
  for (let i = 0; i < HW.UI_WAVEFORM_POINTS; i++) waveform.push(parseFloat((0.3 + 0.5 * Math.abs(Math.sin(i * 0.2))).toFixed(3)));

  const frequencyFrames = [];
  for (let t = 0; t < duration; t += 0.1) {
    const bass = 0.5 + 0.5 * Math.sin(t * 1.5);
    const mid = 0.5 + 0.5 * Math.sin(t * 2.3 + 1);
    const high = 0.5 + 0.5 * Math.sin(t * 3.7 + 2);
    const frame = {
      t: parseFloat(t.toFixed(1)),
      sub: parseFloat((bass * 0.9).toFixed(3)),
      bass: parseFloat(bass.toFixed(3)),
      lowMid: parseFloat(((bass + mid) * 0.5).toFixed(3)),
      mid: parseFloat(mid.toFixed(3)),
      highMid: parseFloat(((mid + high) * 0.5).toFixed(3)),
      presence: parseFloat(high.toFixed(3)),
      brilliance: parseFloat((high * 0.8).toFixed(3)),
      air: parseFloat((high * 0.6).toFixed(3)),
      onset: parseFloat(Math.abs(Math.sin(t * 4)).toFixed(3)),
      beatConfidence: 1,
      pan: parseFloat((Math.sin(t * 0.8) * 0.8).toFixed(3)),
      centroid: parseFloat((0.25 + high * 0.5).toFixed(3)),
      events: [],
    };
    if (frame.bass > 0.75) frame.events.push('kick');
    if (frame.mid > 0.68) frame.events.push('snare');
    if (frame.presence > 0.7) frame.events.push('hat');
    frequencyFrames.push(frame);
  }

  return {
    videoId: 'demo',
    title: 'Demo Mode',
    artist: 'HellWave',
    thumbnail: '',
    bpm,
    duration,
    seed: 424242,
    analysisKey: 'demo:v2',
    beatTimestamps,
    waveform,
    frequencyFrames,
  };
}

async function startGame(trackData, user, isDemo) {
  const canvas = document.getElementById('game-canvas');
  resizeCanvas(canvas);
  showScreen('screen-game');
  showGameLoading(isDemo ? 'Preparing demo level…' : 'Preparing synced song…', true);
  document.getElementById('pause-overlay').classList.add('hidden');
  document.getElementById('gameover-overlay').classList.add('hidden');

  if (currentGame) {
    currentGame.stop();
    currentGame = null;
  }

  const analysis = isDemo ? buildDemoAnalysis() : trackData;
  let demoStartMs = performance.now();
  beatTracker.load(analysis, () => {
    if (isDemo) return Math.max(0, (performance.now() - demoStartMs) / 1000);
    return audioEngine.getCurrentTime();
  });

  let game;
  try {
    if (!isDemo && (!analysis || !analysis.videoId)) {
      const error = new Error('Analysis data missing for selected song.');
      error.code = 'ANALYSIS_UNAVAILABLE';
      throw error;
    }

    game = new Game(canvas, isDemo ? null : audioEngine, beatTracker, analysis, user, (result) => {
      handleGameOver(result, trackData, user, isDemo);
    });

    if (isTouchDevice()) {
      const controls = new MobileControls(game.player);
      controls.show();
      game.setMobileControls(controls);
    }
    setupGamepad(game.player);

    currentGame = game;
    audioEngine.onEnded = () => {
      if (currentGame === game) game.finishTrack();
    };

    if (!isDemo) {
      showGameLoading('Preparing YouTube player…', true);
      await audioEngine.load(trackData.videoId);
      showGameLoading('Starting playback…', true);
      await audioEngine.play();
      game.start(audioEngine.getCurrentTime());
    } else {
      demoStartMs = performance.now();
      game.start(0);
    }

    showGameLoading('', false);
  } catch (error) {
    if (game) game.stop();
    currentGame = null;
    showGameLoading('', false);
    showScreen('screen-menu');
    throw error;
  }
}

function handleGameOver(result, trackData, user, isDemo) {
  document.getElementById('go-title').textContent = result.completed ? 'TRACK COMPLETE' : 'GAME OVER';
  document.getElementById('go-score').textContent = result.score.toLocaleString();
  document.getElementById('go-rank').textContent = result.comboRank;
  document.getElementById('gameover-overlay').classList.remove('hidden');

  if (user && user.id && trackData && trackData.videoId && !isDemo) {
    APIClient.submitScore(trackData.videoId, user.id, result.score, result.maxComboPoints, result.comboRank).catch(() => {});
  }

  document.getElementById('btn-retry').onclick = () => {
    document.getElementById('gameover-overlay').classList.add('hidden');
    startGame(trackData, user, isDemo).catch((err) => {
      showScreen('screen-menu');
      const message = err && err.message ? err.message : 'Could not restart the song.';
      document.getElementById('menu-message').textContent = message;
      document.getElementById('menu-message').className = 'panel message-panel error';
      document.getElementById('menu-message').classList.remove('hidden');
    });
  };

  document.getElementById('btn-go-menu').onclick = () => {
    document.getElementById('gameover-overlay').classList.add('hidden');
    if (currentGame) { currentGame.stop(); currentGame = null; }
    showScreen('screen-menu');
  };
}

let _gamepadPlayer = null;
function setupGamepad(player) {
  _gamepadPlayer = player;
}

function pollGamepad() {
  if (!currentGame || !_gamepadPlayer || currentGame.player !== _gamepadPlayer) return;
  const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const gp of gamepads) {
    if (!gp) continue;
    const dx = Math.abs(gp.axes[0]) > 0.1 ? gp.axes[0] : 0;
    const dy = Math.abs(gp.axes[1]) > 0.1 ? gp.axes[1] : 0;
    if (dx !== 0 || dy !== 0) _gamepadPlayer.setJoystickInput(dx, dy);
    _gamepadPlayer.shooting = !!(gp.buttons[0] && gp.buttons[0].pressed);
    if (gp.buttons[9] && gp.buttons[9].pressed) currentGame.togglePause();
    break;
  }
}
setInterval(pollGamepad, 16);

function init() {
  audioEngine = new AudioEngine();
  uiAudio = new UIAudio();
  beatTracker = new BeatTracker();
  leaderboardUI = new LeaderboardUI();
  window.leaderboardUI = leaderboardUI;

  const canvas = document.getElementById('game-canvas');
  resizeCanvas(canvas);
  window.addEventListener('resize', () => resizeCanvas(canvas));

  applySettings(getStoredSettings());
  window.addEventListener('hw:settings-changed', (evt) => applySettings(evt.detail || getStoredSettings()));

  mainMenu = new MainMenu(async (trackData, user, isDemo) => {
    await startGame(trackData, user, isDemo);
  }, uiAudio);

  document.getElementById('btn-resume').onclick = () => currentGame && currentGame.togglePause();
  document.getElementById('btn-quit-game').onclick = () => {
    if (currentGame) currentGame.stop();
    document.getElementById('pause-overlay').classList.add('hidden');
    showScreen('screen-menu');
  };

  showScreen('screen-menu');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
