/* ui/MainMenu.js — handles the main menu: user setup, track loading */

class MainMenu {
  constructor(onStartGame) {
    this._onStartGame = onStartGame;
    this._videoId = null;
    this._trackData = null;
    this._analysisPolling = null;
    this._user = this._loadUser();

    this._bindAll();
    this._refreshUserPanel();
  }

  // ── Persistence ────────────────────────────────────────────────────────────

  _loadUser() {
    try {
      const raw = localStorage.getItem('hw_user');
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  }

  _saveUser(user) {
    this._user = user;
    localStorage.setItem('hw_user', JSON.stringify(user));
  }

  get user() { return this._user; }

  // ── DOM helpers ────────────────────────────────────────────────────────────

  _refreshUserPanel() {
    const display = document.getElementById('user-display');
    const create  = document.getElementById('user-create');
    const track   = document.getElementById('track-panel');

    if (this._user) {
      display.classList.remove('hidden');
      create.classList.add('hidden');
      const el = document.getElementById('user-name-display');
      el.textContent = this._user.username;
      el.style.color = this._user.color || '#ffffff';
      track.classList.remove('hidden');
    } else {
      display.classList.add('hidden');
      create.classList.remove('hidden');
      track.classList.add('hidden');
    }
  }

  // ── Event binding ──────────────────────────────────────────────────────────

  _bindAll() {
    // Set username
    document.getElementById('btn-set-user').addEventListener('click', () => this._setUsername());
    document.getElementById('input-username').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._setUsername();
    });

    // Change user
    document.getElementById('btn-change-user').addEventListener('click', () => {
      this._user = null;
      localStorage.removeItem('hw_user');
      this._refreshUserPanel();
    });

    // Color picker
    document.getElementById('btn-color-user').addEventListener('click', () => {
      document.getElementById('color-panel').classList.remove('hidden');
    });
    document.getElementById('btn-cancel-color').addEventListener('click', () => {
      document.getElementById('color-panel').classList.add('hidden');
    });
    document.getElementById('btn-save-color').addEventListener('click', () => this._saveColor());

    document.querySelectorAll('.color-swatch').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.color-swatch').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        document.getElementById('color-custom').value = btn.dataset.color;
      });
    });

    // Load track
    document.getElementById('btn-load-track').addEventListener('click', () => this._loadTrack());
    document.getElementById('input-url').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._loadTrack();
    });

    // Start game
    document.getElementById('btn-start-game').addEventListener('click', () => {
      if (this._trackData) this._onStartGame(this._trackData, this._user, false);
    });

    // Demo mode
    document.getElementById('btn-demo-mode').addEventListener('click', () => {
      this._onStartGame(null, this._user, true);
    });

    // View leaderboard
    document.getElementById('btn-view-leaderboard').addEventListener('click', () => {
      if (this._videoId) {
        window.leaderboardUI.show(this._videoId, this._trackData && this._trackData.title);
      }
    });
  }

  // ── User registration ──────────────────────────────────────────────────────

  async _setUsername() {
    const input = document.getElementById('input-username');
    const name = input.value.trim();
    if (!name) return;

    try {
      const user = await APIClient.registerUser(name, '#ffffff');
      this._saveUser(user);
      this._refreshUserPanel();
    } catch (err) {
      if (err.message === 'Username already taken') {
        // Try to recover by checking localStorage for a matching ID
        const cached = this._loadUser();
        if (cached && cached.username.toLowerCase() === name.toLowerCase()) {
          this._saveUser(cached);
          this._refreshUserPanel();
          return;
        }
        alert('Username is already taken. Please choose another.');
      } else {
        // Offline fallback: store locally without server ID
        const localUser = { id: null, username: name, color: '#ffffff', offline: true };
        this._saveUser(localUser);
        this._refreshUserPanel();
      }
    }
  }

  // ── Color ──────────────────────────────────────────────────────────────────

  async _saveColor() {
    const color = document.getElementById('color-custom').value;
    if (this._user) {
      this._user.color = color;
      this._saveUser(this._user);
      if (this._user.id) {
        try { await APIClient.updateColor(this._user.id, color); } catch (_) {}
      }
    }
    document.getElementById('color-panel').classList.add('hidden');
    this._refreshUserPanel();
  }

  // ── Track loading ──────────────────────────────────────────────────────────

  async _loadTrack() {
    const url = document.getElementById('input-url').value.trim();
    if (!url) return;

    const statusEl = document.getElementById('track-status');
    const statusText = document.getElementById('track-status-text');
    const infoEl = document.getElementById('track-info');
    const fill = document.getElementById('progress-fill');

    statusEl.classList.remove('hidden');
    infoEl.classList.add('hidden');
    statusText.textContent = 'Analysing audio…';
    fill.style.width = '10%';

    try {
      // Animate progress bar while waiting
      let prog = 10;
      const progInterval = setInterval(() => {
        prog = Math.min(90, prog + 3);
        fill.style.width = prog + '%';
      }, 800);

      const data = await APIClient.analyzeTrack(url);
      clearInterval(progInterval);
      fill.style.width = '100%';

      this._videoId = data.videoId;
      this._trackData = data;

      document.getElementById('track-title').textContent = data.title || data.videoId;
      document.getElementById('track-bpm').textContent = `BPM: ${Math.round(data.bpm || 0)}`;

      setTimeout(() => {
        statusEl.classList.add('hidden');
        infoEl.classList.remove('hidden');
      }, 400);

    } catch (err) {
      statusText.textContent = 'Analysis failed: ' + err.message;
      fill.style.width = '0%';
    }
  }
}
