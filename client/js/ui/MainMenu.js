/* ui/MainMenu.js — user setup, menus, settings, recent songs, track loading */

class MainMenu {
  constructor(onStartGame, uiAudio) {
    this._onStartGame = onStartGame;
    this._uiAudio = uiAudio;
    this._videoId = null;
    this._trackData = null;
    this._songCache = this._loadSongCache();
    this._user = this._loadUser();
    this._settings = this._loadSettings();
    this._recentSongs = this._loadRecentSongs();

    this._bindAll();
    this._applySettingsToUI();
    this._refreshUserPanel();
    this._renderRecentSongs();
  }

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

  _loadSettings() {
    try {
      const raw = JSON.parse(localStorage.getItem('hw_settings') || 'null');
      return { ...HW.DEFAULT_SETTINGS, ...(raw || {}) };
    } catch (_) {
      return { ...HW.DEFAULT_SETTINGS };
    }
  }

  _saveSettings() {
    localStorage.setItem('hw_settings', JSON.stringify(this._settings));
    window.dispatchEvent(new CustomEvent('hw:settings-changed', { detail: { ...this._settings } }));
  }

  _loadRecentSongs() {
    try {
      const raw = JSON.parse(localStorage.getItem('hw_recent_songs') || '[]');
      if (!Array.isArray(raw)) return [];
      return raw
        .map((song) => this._resolveCachedTrack(song))
        .filter((song) => song && song.videoId);
    } catch (_) {
      return [];
    }
  }

  _saveRecentSongs() {
    localStorage.setItem('hw_recent_songs', JSON.stringify(this._recentSongs.slice(0, 8)));
  }

  _loadSongCache() {
    try {
      const raw = JSON.parse(localStorage.getItem('hw_song_cache') || '{}');
      return raw && typeof raw === 'object' ? raw : {};
    } catch (_) {
      return {};
    }
  }

  _saveSongCache() {
    const entries = Object.values(this._songCache || {})
      .filter((song) => song && song.videoId)
      .sort((a, b) => (b.cachedAt || 0) - (a.cachedAt || 0))
      .slice(0, 24);
    const compact = {};
    for (const song of entries) compact[song.videoId] = song;
    this._songCache = compact;
    try {
      localStorage.setItem('hw_song_cache', JSON.stringify(compact));
    } catch (_) {}
  }

  _extractVideoId(url) {
    if (!url || typeof url !== 'string') return null;
    try {
      const parsed = new URL(url);
      const fromQuery = parsed.searchParams.get('v');
      if (fromQuery) return fromQuery;
      const parts = parsed.pathname.split('/').filter(Boolean);
      if ((parsed.hostname.includes('youtu.be') || parsed.pathname.includes('/shorts/')) && parts.length) {
        return parts[parts.length - 1];
      }
    } catch (_) {
      const match = url.match(/(?:v=|youtu\.be\/|shorts\/)([a-zA-Z0-9_-]{6,})/);
      if (match) return match[1];
    }
    return null;
  }

  _compactTrack(trackData) {
    if (!trackData) return null;
    const videoId = trackData.videoId || this._extractVideoId(trackData.sourceUrl);
    if (!videoId) return null;
    return {
      videoId,
      title: trackData.title,
      artist: trackData.artist,
      thumbnail: trackData.thumbnail,
      bpm: trackData.bpm,
      duration: trackData.duration,
      analysisKey: trackData.analysisKey,
      seed: trackData.seed,
      sourceUrl: trackData.sourceUrl || `https://www.youtube.com/watch?v=${videoId}`,
      waveform: Array.isArray(trackData.waveform) ? trackData.waveform.slice(0, 1200) : [],
      beatTimestamps: Array.isArray(trackData.beatTimestamps) ? trackData.beatTimestamps.slice(0, 3000) : [],
      frequencyFrames: Array.isArray(trackData.frequencyFrames) ? trackData.frequencyFrames.slice(0, 2200) : [],
      cachedAt: Date.now(),
    };
  }

  _resolveCachedTrack(trackData) {
    const compact = this._compactTrack(trackData);
    if (!compact) return null;
    const cached = this._songCache[compact.videoId];
    if (!cached) return compact;
    return {
      ...cached,
      ...compact,
      beatTimestamps: (cached.beatTimestamps && cached.beatTimestamps.length >= compact.beatTimestamps.length)
        ? cached.beatTimestamps
        : compact.beatTimestamps,
      frequencyFrames: (cached.frequencyFrames && cached.frequencyFrames.length >= compact.frequencyFrames.length)
        ? cached.frequencyFrames
        : compact.frequencyFrames,
      waveform: (cached.waveform && cached.waveform.length >= compact.waveform.length) ? cached.waveform : compact.waveform,
      sourceUrl: compact.sourceUrl || cached.sourceUrl,
    };
  }

  _cacheTrack(trackData) {
    const compact = this._compactTrack(trackData);
    if (!compact) return null;
    this._songCache[compact.videoId] = {
      ...(this._songCache[compact.videoId] || {}),
      ...compact,
    };
    this._saveSongCache();
    return this._songCache[compact.videoId];
  }

  _refreshUserPanel() {
    const display = document.getElementById('user-display');
    const create = document.getElementById('user-create');
    const actions = document.getElementById('menu-actions');
    const play = document.getElementById('play-panel');
    const settings = document.getElementById('settings-panel');

    if (this._user) {
      display.classList.remove('hidden');
      create.classList.add('hidden');
      actions.classList.remove('hidden');
      document.getElementById('user-name-display').textContent = this._user.username;
      document.getElementById('user-name-display').style.color = this._user.color || '#ffffff';
    } else {
      display.classList.add('hidden');
      create.classList.remove('hidden');
      actions.classList.add('hidden');
      play.classList.add('hidden');
      settings.classList.add('hidden');
    }
  }

  _showPanel(panelName) {
    document.getElementById('play-panel').classList.toggle('hidden', panelName !== 'play');
    document.getElementById('settings-panel').classList.toggle('hidden', panelName !== 'settings');
  }

  _showMessage(text, type = 'info') {
    const panel = document.getElementById('menu-message');
    panel.textContent = text;
    panel.className = `panel message-panel ${type}`;
    panel.classList.remove('hidden');
  }

  _clearMessage() {
    document.getElementById('menu-message').classList.add('hidden');
  }

  _bindAll() {
    document.querySelectorAll('button').forEach((button) => {
      button.addEventListener('click', () => {
        const type = button.classList.contains('btn-secondary') ? 'back' : 'confirm';
        this._uiAudio && this._uiAudio.blip(type);
      });
    });

    document.getElementById('btn-set-user').addEventListener('click', () => this._setUsername());
    document.getElementById('input-username').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._setUsername();
    });

    document.getElementById('btn-change-user').addEventListener('click', () => {
      this._user = null;
      localStorage.removeItem('hw_user');
      this._refreshUserPanel();
      this._showMessage('Set a player name for this playtest build.', 'info');
    });

    document.getElementById('btn-color-user').addEventListener('click', () => this._changeExistingUserColor());
    document.getElementById('btn-open-play').addEventListener('click', () => this._showPanel('play'));
    document.getElementById('btn-close-play').addEventListener('click', () => this._showPanel(null));
    document.getElementById('btn-open-settings').addEventListener('click', () => this._showPanel('settings'));
    document.getElementById('btn-close-settings').addEventListener('click', () => this._showPanel(null));

    document.querySelectorAll('.color-swatch').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.color-swatch').forEach((el) => el.classList.remove('selected'));
        btn.classList.add('selected');
        document.getElementById('color-custom').value = btn.dataset.color;
      });
    });

    document.getElementById('color-custom').addEventListener('input', (e) => {
      document.querySelectorAll('.color-swatch').forEach((el) => {
        el.classList.toggle('selected', el.dataset.color.toLowerCase() === e.target.value.toLowerCase());
      });
    });

    document.getElementById('btn-load-track').addEventListener('click', () => this._loadTrack());
    document.getElementById('input-url').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._loadTrack();
    });

    document.getElementById('btn-start-game').addEventListener('click', async () => {
      if (!this._trackData) return;
      this._clearMessage();
      try {
        this._trackData = this._resolveCachedTrack(this._trackData);
        if (!this._trackData || !this._trackData.videoId) {
          throw new Error('Selected song is missing a valid video ID.');
        }
        if (!this._hasPlayableAnalysis(this._trackData)) {
          await this._hydrateSongAnalysis(this._trackData.sourceUrl || `https://www.youtube.com/watch?v=${this._trackData.videoId}`);
        }
        this._cacheTrack(this._trackData);
        if (this._settings.fullscreen && !document.fullscreenElement) {
          try { await document.documentElement.requestFullscreen(); } catch (_) {}
        }
        await this._onStartGame(this._trackData, this._user, false);
      } catch (err) {
        this._showMessage(this._friendlyStartError(err), 'error');
      }
    });

    document.getElementById('btn-demo-mode').addEventListener('click', async () => {
      this._clearMessage();
      try {
        await this._onStartGame(null, this._user, true);
      } catch (err) {
        this._showMessage(this._friendlyStartError(err), 'error');
      }
    });

    document.getElementById('btn-view-leaderboard').addEventListener('click', () => {
      if (this._videoId) window.leaderboardUI.show(this._videoId, this._trackData && this._trackData.title);
    });

    ['master', 'music', 'sfx'].forEach((key) => {
      document.getElementById(`setting-${key}`).addEventListener('input', (e) => {
        const map = { master: 'masterVolume', music: 'musicVolume', sfx: 'sfxVolume' };
        this._settings[map[key]] = Number(e.target.value) / 100;
        this._saveSettings();
      });
    });

    const fullscreenToggle = document.getElementById('setting-fullscreen');
    if (fullscreenToggle) {
      fullscreenToggle.addEventListener('change', (e) => {
        this._settings.fullscreen = !!e.target.checked;
        this._saveSettings();
      });
    }

    const fullscreenBtn = document.getElementById('btn-toggle-fullscreen');
    if (fullscreenBtn) {
      fullscreenBtn.addEventListener('click', async () => {
        try {
          if (document.fullscreenElement) await document.exitFullscreen();
          else await document.documentElement.requestFullscreen();
        } catch (_) {}
      });
    }
  }

  _applySettingsToUI() {
    document.getElementById('setting-master').value = Math.round(this._settings.masterVolume * 100);
    document.getElementById('setting-music').value = Math.round(this._settings.musicVolume * 100);
    document.getElementById('setting-sfx').value = Math.round(this._settings.sfxVolume * 100);
    const fullscreenToggle = document.getElementById('setting-fullscreen');
    if (fullscreenToggle) fullscreenToggle.checked = !!this._settings.fullscreen;
    this._saveSettings();
  }

  async _setUsername() {
    const input = document.getElementById('input-username');
    const name = input.value.trim();
    const color = document.getElementById('color-custom').value || '#ffffff';
    if (!name) return;

    try {
      const user = await APIClient.registerUser(name, color);
      this._saveUser(user);
      this._refreshUserPanel();
      this._showMessage(`Player ready: ${user.username}`, 'success');
    } catch (err) {
      if (err.message === 'Username already taken') {
        const cached = this._loadUser();
        if (cached && cached.username.toLowerCase() === name.toLowerCase()) {
          this._saveUser({ ...cached, color });
          this._refreshUserPanel();
          return;
        }
        this._showMessage('Username is already taken. Please choose another.', 'error');
      } else {
        const localUser = { id: null, username: name, color, offline: true };
        this._saveUser(localUser);
        this._refreshUserPanel();
        this._showMessage('Offline profile created locally.', 'info');
      }
    }
  }

  _changeExistingUserColor() {
    if (!this._user) return;
    const picker = document.createElement('input');
    picker.type = 'color';
    picker.value = this._user.color || '#ffffff';
    picker.style.position = 'fixed';
    picker.style.left = '-999px';
    document.body.appendChild(picker);
    picker.addEventListener('input', async () => {
      this._user.color = picker.value;
      this._saveUser(this._user);
      this._refreshUserPanel();
      if (this._user.id) {
        try { await APIClient.updateColor(this._user.id, picker.value); } catch (_) {}
      }
      picker.remove();
    }, { once: true });
    picker.click();
  }

  async _loadTrack() {
    const url = document.getElementById('input-url').value.trim();
    if (!url) {
      this._showMessage('Paste a YouTube or YouTube Music link first.', 'error');
      return;
    }

    const statusEl = document.getElementById('track-status');
    const statusText = document.getElementById('track-status-text');
    const infoEl = document.getElementById('track-info');
    const fill = document.getElementById('progress-fill');

    this._clearMessage();
    statusEl.classList.remove('hidden');
    infoEl.classList.add('hidden');
    statusText.textContent = 'Preprocessing song for sync…';
    fill.style.width = '10%';

    let prog = 10;
    const progInterval = setInterval(() => {
      prog = Math.min(90, prog + 3);
      fill.style.width = `${prog}%`;
    }, 500);

    try {
      const data = await APIClient.analyzeTrack(url);
      clearInterval(progInterval);
      fill.style.width = '100%';
      this._videoId = data.videoId;
      this._trackData = this._resolveCachedTrack({ ...data, sourceUrl: url });
      this._renderTrackInfo(this._trackData);
      this._rememberTrack(this._trackData);
      setTimeout(() => {
        statusEl.classList.add('hidden');
        infoEl.classList.remove('hidden');
      }, 250);
    } catch (err) {
      clearInterval(progInterval);
      fill.style.width = '0%';
      infoEl.classList.add('hidden');
      statusText.textContent = this._friendlyLoadError(err.message);
      this._showMessage(this._friendlyLoadError(err.message), 'error');
    }
  }

  _renderTrackInfo(data) {
    document.getElementById('track-title').textContent = data.title || data.videoId;
    document.getElementById('track-artist').textContent = data.artist || 'YouTube';
    document.getElementById('track-bpm').textContent = `BPM: ${Math.round(data.bpm || 0)}`;
    document.getElementById('track-duration').textContent = `Length: ${this._formatTime(data.duration || 0)}`;
    document.getElementById('track-thumb').src = data.thumbnail || `https://i.ytimg.com/vi/${data.videoId}/hqdefault.jpg`;
    document.getElementById('track-analysis-pill').textContent = data.analysisKey
      ? `Seed ${data.seed} · cache ${data.analysisKey}`
      : 'Demo track';
  }

  _rememberTrack(trackData) {
    const compact = this._cacheTrack(trackData);
    if (!compact) return;
    this._recentSongs = [compact, ...this._recentSongs.filter((song) => song.videoId !== compact.videoId)].slice(0, 8);
    this._saveRecentSongs();
    this._renderRecentSongs();
  }

  _renderRecentSongs() {
    const root = document.getElementById('recent-songs');
    root.innerHTML = '';
    if (!this._recentSongs.length) {
      root.innerHTML = '<p class="input-hint">Your last loaded songs appear here.</p>';
      return;
    }

    this._recentSongs.forEach((song) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'recent-song-item';
      btn.innerHTML = `
        <img src="${song.thumbnail || `https://i.ytimg.com/vi/${song.videoId}/hqdefault.jpg`}" alt="${song.title || song.videoId}" />
        <span class="recent-song-copy">
          <strong>${song.title || song.videoId}</strong>
          <span>${song.artist || 'YouTube'}</span>
          <span>${this._formatTime(song.duration || 0)} · BPM ${Math.round(song.bpm || 0)}</span>
        </span>
        <span class="recent-song-badge">DDR</span>
      `;
      btn.addEventListener('click', () => {
        const selected = this._resolveCachedTrack(song);
        if (!selected || !selected.videoId) {
          this._showMessage('Could not load that recent song. Please reload it from URL.', 'error');
          return;
        }
        this._trackData = selected;
        this._videoId = selected.videoId;
        document.getElementById('input-url').value = selected.sourceUrl || `https://www.youtube.com/watch?v=${selected.videoId}`;
        document.getElementById('track-status').classList.add('hidden');
        document.getElementById('track-info').classList.remove('hidden');
        this._renderTrackInfo(this._trackData);
        if (!this._hasPlayableAnalysis(selected)) {
          this._hydrateSongAnalysis(selected.sourceUrl || `https://www.youtube.com/watch?v=${selected.videoId}`).catch(() => {});
        }
      });
      root.appendChild(btn);
    });
  }

  _hasPlayableAnalysis(trackData) {
    return !!(trackData && Array.isArray(trackData.frequencyFrames) && trackData.frequencyFrames.length);
  }

  async _hydrateSongAnalysis(url) {
    if (!url) return;
    const statusText = document.getElementById('track-status-text');
    const statusEl = document.getElementById('track-status');
    const fill = document.getElementById('progress-fill');
    statusEl.classList.remove('hidden');
    statusText.textContent = 'Refreshing synced analysis…';
    fill.style.width = '30%';
    const fullTrack = await APIClient.analyzeTrack(url);
    fill.style.width = '100%';
    this._videoId = fullTrack.videoId;
    this._trackData = this._resolveCachedTrack({ ...fullTrack, sourceUrl: url });
    this._rememberTrack(this._trackData);
    this._renderTrackInfo(this._trackData);
    setTimeout(() => statusEl.classList.add('hidden'), 250);
  }

  _friendlyLoadError(message) {
    if (/Unsupported/.test(message)) return 'Unsupported link. Use a YouTube or YouTube Music track URL.';
    if (/Analysis unavailable/.test(message)) return 'Analysis unavailable. Try again or use Demo Mode.';
    return `Load failed: ${message}`;
  }

  _friendlyStartError(error) {
    const code = error && error.code;
    if (code === 'PLAYER_NOT_READY') return 'Player is still loading the song. Try START again in a moment.';
    if (code === 'AUTOPLAY_BLOCKED') return 'Playback was blocked by the browser. Press START again.';
    return (error && error.message) || 'Could not start the song.';
  }

  _formatTime(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    const mins = Math.floor(sec / 60);
    const secs = String(sec % 60).padStart(2, '0');
    return `${mins}:${secs}`;
  }
}
