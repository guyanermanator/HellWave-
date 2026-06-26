/* network/APIClient.js — thin wrapper around fetch() for HellWave REST API */

const APIClient = (() => {
  const BASE = HW.API_BASE;

  async function request(method, path, body) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(BASE + path, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }

  return {
    /* ── Audio analysis ── */
    analyzeTrack:  (url)      => request('GET', `/audio/analyze?url=${encodeURIComponent(url)}`),
    trackStatus:   (videoId)  => request('GET', `/audio/status/${videoId}`),

    /* ── Leaderboard ── */
    getLeaderboard: (videoId, limit = 10) =>
      request('GET', `/leaderboard/${videoId}?limit=${limit}`),
    submitScore: (videoId, userId, score, maxCombo, comboRank) =>
      request('POST', `/leaderboard/${videoId}`, { userId, score, maxCombo, comboRank }),

    /* ── Users ── */
    registerUser:  (username, color) => request('POST', '/users/register', { username, color }),
    checkUsername: (username)        => request('GET', `/users/check/${encodeURIComponent(username)}`),
    getUser:       (id)              => request('GET', `/users/${id}`),
    updateColor:   (id, color)       => request('PATCH', `/users/${id}/color`, { color }),

    /* ── Health ── */
    health: () => request('GET', '/health')
  };
})();
