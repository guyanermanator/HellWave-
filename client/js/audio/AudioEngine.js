/* audio/AudioEngine.js — YouTube playback wrapper with readiness + start sync */

class AudioEngine {
  constructor() {
    this._player = null;
    this._ready = false;
    this._apiReady = false;
    this._currentVideoId = null;
    this._pendingVideoId = null;
    this._volume = HW.DEFAULT_SETTINGS.musicVolume * HW.DEFAULT_SETTINGS.masterVolume;
    this._stateWaiters = [];
    this._playIntent = null;

    this.onReady = null;
    this.onEnded = null;
    this.onError = null;

    this._readyPromise = new Promise((resolve) => {
      this._resolveReady = resolve;
    });

    const prevCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prevCallback === 'function') prevCallback();
      this._onApiReady();
    };

    if (window.YT && window.YT.Player) this._onApiReady();
  }

  _onApiReady() {
    if (this._apiReady) return;
    this._apiReady = true;
    this._createPlayer();
  }

  _createPlayer() {
    const container = document.getElementById('yt-player-wrap');
    if (!container) return;
    let div = document.getElementById('yt-iframe');
    if (!div) {
      div = document.createElement('div');
      div.id = 'yt-iframe';
      container.appendChild(div);
    }

    this._player = new YT.Player('yt-iframe', {
      width: 1,
      height: 1,
      playerVars: {
        autoplay: 0,
        controls: 0,
        disablekb: 1,
        fs: 0,
        rel: 0,
        modestbranding: 1,
        origin: window.location.origin,
        playsinline: 1,
      },
      events: {
        onReady: () => {
          this._ready = true;
          this._applyVolume();
          this._resolveReady();
          if (typeof this.onReady === 'function') this.onReady();
          if (this._pendingVideoId) {
            const pending = this._pendingVideoId;
            this._pendingVideoId = null;
            this.load(pending).catch(() => {});
          }
        },
        onStateChange: (evt) => this._handleStateChange(evt.data),
        onError: (evt) => {
          const error = new Error(`Player error: ${evt.data}`);
          error.code = 'PLAYER_ERROR';
          if (typeof this.onError === 'function') this.onError(error);
          this._flushWaiters(evt.data, error);
        },
      },
    });
  }

  _handleStateChange(state) {
    this._flushWaiters(state, null);
    if (state === YT.PlayerState.PLAYING) {
      this._playIntent = 'playing';
    }
    if (state === YT.PlayerState.ENDED && typeof this.onEnded === 'function') {
      this.onEnded();
    }
  }

  _flushWaiters(state, error) {
    const pending = this._stateWaiters.slice();
    this._stateWaiters = this._stateWaiters.filter((waiter) => !waiter.done);
    for (const waiter of pending) {
      if (waiter.done) continue;
      if (error) {
        waiter.done = true;
        clearTimeout(waiter.timeoutId);
        waiter.reject(error);
        continue;
      }

      _clearWaiters() {
        for (const waiter of this._stateWaiters) {
          waiter.done = true;
          clearTimeout(waiter.timeoutId);
        }
        this._stateWaiters = [];
      }
      if (waiter.acceptStates.includes(state)) {
        waiter.done = true;
        clearTimeout(waiter.timeoutId);
        waiter.resolve(state);
      }
    }
  }

  async whenReady() {
    if (!this._apiReady && window.YT && window.YT.Player) this._onApiReady();
    await this._readyPromise;
    return this._player;
  }

  _waitForState(acceptStates, timeoutMs, code, message) {
    return new Promise((resolve, reject) => {
      const waiter = {
        acceptStates,
        resolve,
        reject,
        done: false,
        timeoutId: window.setTimeout(() => {
          waiter.done = true;
          this._stateWaiters = this._stateWaiters.filter((entry) => entry !== waiter);
          const error = new Error(message);
          error.code = code;
          reject(error);
        }, timeoutMs),
      };
      this._stateWaiters.push(waiter);
    });
  }

  async load(videoId) {
    this._currentVideoId = videoId;
    if (!videoId) return;
    await this.whenReady();
    this._clearWaiters();

    this._player.stopVideo();
    this._player.cueVideoById({ videoId, startSeconds: 0, suggestedQuality: 'small' });
    await this._waitForState(
      [YT.PlayerState.CUED, YT.PlayerState.UNSTARTED],
      HW.TRACK_LOAD_TIMEOUT_MS,
      'PLAYER_NOT_READY',
      'Player did not finish preparing the song in time.'
    );
    this.seek(0);
  }

  async play() {
    await this.whenReady();
    this._playIntent = 'requested';
    this._player.playVideo();
    try {
      await this._waitForState(
        [YT.PlayerState.PLAYING],
        HW.TRACK_START_TIMEOUT_MS,
        'AUTOPLAY_BLOCKED',
        'Browser blocked playback. Tap START again to continue.'
      );
    } catch (error) {
      if (this.getCurrentTime() > 0.05) return;
      throw error;
    }
  }

  pause() {
    if (this._ready && this._player) this._player.pauseVideo();
  }

  stop() {
    if (this._ready && this._player) {
      this._clearWaiters();
      this._player.stopVideo();
      this.seek(0);
    }
  }

  seek(sec) {
    if (this._ready && this._player) this._player.seekTo(sec, true);
  }

  setVolume(volume) {
    this._volume = Math.max(0, Math.min(1, volume || 0));
    this._applyVolume();
  }

  _applyVolume() {
    if (this._ready && this._player) {
      this._player.setVolume(Math.round(this._volume * 100));
    }
  }

  getCurrentTime() {
    if (!this._ready || !this._player) return 0;
    try { return this._player.getCurrentTime() || 0; }
    catch (_) { return 0; }
  }

  getDuration() {
    if (!this._ready || !this._player) return 0;
    try { return this._player.getDuration() || 0; }
    catch (_) { return 0; }
  }

  getState() {
    if (!this._ready || !this._player) return null;
    try { return this._player.getPlayerState(); }
    catch (_) { return null; }
  }

  get currentVideoId() { return this._currentVideoId; }
  get isApiReady() { return this._apiReady; }
  get isPlayerReady() { return this._ready; }
}
