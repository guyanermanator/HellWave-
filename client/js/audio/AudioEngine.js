/* audio/AudioEngine.js
 *
 * Manages the YouTube IFrame player and exposes a clean interface:
 *   - load(videoId)
 *   - play() / pause() / seek(sec)
 *   - getCurrentTime() → seconds
 *   - onReady / onEnded callbacks
 *
 * The YouTube IFrame API is loaded globally (via the <script> tag in index.html).
 * window.onYouTubeIframeAPIReady is called by YouTube when the API is ready.
 */

class AudioEngine {
  constructor() {
    this._player = null;
    this._ready = false;
    this._pendingVideoId = null;
    this._apiReady = false;

    this.onReady = null;
    this.onEnded = null;
    this.onError = null;

    // Hook into YouTube API ready callback
    const prevCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (prevCallback) prevCallback();
      this._onApiReady();
    };

    // If API is already loaded (cached)
    if (window.YT && window.YT.Player) {
      this._onApiReady();
    }
  }

  _onApiReady() {
    if (this._apiReady) return;
    this._apiReady = true;
    this._createPlayer();
  }

  _createPlayer() {
    const container = document.getElementById('yt-player-wrap');
    const div = document.createElement('div');
    div.id = 'yt-iframe';
    container.appendChild(div);

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
        origin: window.location.origin
      },
      events: {
        onReady: () => {
          this._ready = true;
          if (this._pendingVideoId) {
            this._player.loadVideoById(this._pendingVideoId);
            this._pendingVideoId = null;
          }
        },
        onStateChange: (evt) => {
          if (evt.data === YT.PlayerState.ENDED && this.onEnded) this.onEnded();
        },
        onError: (evt) => {
          if (this.onError) this.onError(evt.data);
        }
      }
    });
  }

  load(videoId) {
    if (!this._ready) {
      this._pendingVideoId = videoId;
      return;
    }
    this._player.loadVideoById({ videoId, startSeconds: 0 });
    this._player.pauseVideo();
  }

  play() {
    if (this._ready && this._player) this._player.playVideo();
  }

  pause() {
    if (this._ready && this._player) this._player.pauseVideo();
  }

  seek(sec) {
    if (this._ready && this._player) this._player.seekTo(sec, true);
  }

  setVolume(v) {
    if (this._ready && this._player) this._player.setVolume(Math.round(v * 100));
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

  get isApiReady() { return this._apiReady; }
  get isPlayerReady() { return this._ready; }
}
