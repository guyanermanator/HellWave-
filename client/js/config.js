/* config.js — centralised game constants */

const HW = {
  /* ── Canvas / viewport ── */
  CANVAS_W: 480,
  CANVAS_H: 800,

  /* ── Gameplay ── */
  PLAYER_SPEED: 5,
  PLAYER_LIVES: 3,
  PLAYER_INVINCIBLE_MS: 1800,
  BULLET_SPEED: 12,
  BULLET_RATE_MS: 150,

  /* ── Beat / audio ── */
  BEAT_WINDOW_MS: 120,
  BEAT_MOVE_WINDOW_MS: 200,
  TRACK_START_TIMEOUT_MS: 7000,
  TRACK_LOAD_TIMEOUT_MS: 12000,
  UI_WAVEFORM_POINTS: 96,
  ANALYSIS_VERSION: 2,

  /* ── Combo system ── */
  COMBO_RANKS: [
    { rank: 'E',   min: 0,    color: '#888888', mult: 1.0,  text: null },
    { rank: 'D',   min: 50,   color: '#4488ff', mult: 1.5,  text: 'Nice' },
    { rank: 'C',   min: 150,  color: '#44ff88', mult: 2.0,  text: 'Good' },
    { rank: 'B',   min: 300,  color: '#ffff44', mult: 2.5,  text: 'Great!' },
    { rank: 'A',   min: 500,  color: '#ff8844', mult: 3.0,  text: 'Amazing!' },
    { rank: 'S',   min: 800,  color: '#ff4444', mult: 4.0,  text: 'Stylish!!' },
    { rank: 'SS',  min: 1200, color: '#ff44ff', mult: 5.0,  text: 'INSANE!!!' },
    { rank: 'SSS', min: 1800, color: null,      mult: 7.0,  text: 'HELL WAVE!!' }
  ],
  COMBO_ON_BEAT_KILL: 25,
  COMBO_ON_BEAT_SHOT: 10,
  COMBO_DAMAGE: -100,
  COMBO_OFF_BEAT: -20,
  COMBO_DECAY_RATE: 0,

  /* ── Grid ── */
  GRID_COLS: 6,
  GRID_ROWS: 10,

  /* ── Enemy types (base stats) ── */
  ENEMY_DEFS: {
    basic:     { hp: 1, score: 100, speed: 1.45, color: '#ff4444', size: 14 },
    beat:      { hp: 2, score: 250, speed: 1.1, color: '#4444ff', size: 16 },
    frequency: { hp: 3, score: 350, speed: 1.75, color: '#44ff44', size: 14 },
    boss:      { hp: 20, score: 5000, speed: 0.8, color: '#ff88ff', size: 32 }
  },

  /* ── Spawn fairness ── */
  SPAWN_MIN_GAP_SEC: 0.55,
  SPAWN_MAX_ACTIVE: 14,
  SPAWN_MAX_BULLETS: 36,
  SPAWN_COOLDOWN_SEC: 1.3,

  /* ── Background ── */
  STAR_COUNT: 120,

  /* ── Settings ── */
  DEFAULT_SETTINGS: {
    masterVolume: 0.9,
    musicVolume: 0.85,
    sfxVolume: 0.75
  },

  /* ── API ── */
  API_BASE: (() => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:3000/api';
    }
    return '/api';
  })()
};

Object.freeze(HW.DEFAULT_SETTINGS);
Object.freeze(HW.ENEMY_DEFS);
Object.freeze(HW.COMBO_RANKS);
Object.freeze(HW);
