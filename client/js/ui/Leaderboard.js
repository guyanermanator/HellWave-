/* ui/Leaderboard.js — fetch and display per-track leaderboards */

class LeaderboardUI {
  constructor() {
    this._screen = document.getElementById('screen-leaderboard');
    this._titleEl = document.getElementById('lb-track-name');
    this._bodyEl  = document.getElementById('lb-body');
    document.getElementById('btn-lb-back').addEventListener('click', () => this.hide());
  }

  async show(videoId, trackTitle) {
    this._titleEl.textContent = trackTitle || videoId;
    this._bodyEl.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#888">Loading…</td></tr>';
    showScreen('screen-leaderboard');

    try {
      const data = await APIClient.getLeaderboard(videoId, 20);
      this._render(data.scores);
    } catch (err) {
      this._bodyEl.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#f44">Failed to load</td></tr>';
    }
  }

  hide() {
    showScreen('screen-menu');
  }

  _render(scores) {
    if (!scores || scores.length === 0) {
      this._bodyEl.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#888">No scores yet. Be the first!</td></tr>';
      return;
    }
    this._bodyEl.innerHTML = scores.map((s, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(s.username)}</td>
        <td>${Number(s.score).toLocaleString()}</td>
        <td>${escapeHtml(s.combo_rank)}</td>
      </tr>
    `).join('');
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
