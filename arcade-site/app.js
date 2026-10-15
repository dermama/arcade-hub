/* ================================================================
   Arcade Games Hub — app.js
   Homepage logic: render game grid, filter, search
   Game pages are separate (game.html?g=key::path)
   ================================================================ */

const PALETTES = [
  ['#7c5cff','#22d3ee'], ['#ff6b9d','#7c5cff'], ['#22d3ee','#0ea5e9'],
  ['#f59e0b','#ef4444'], ['#10b981','#22d3ee'], ['#8b5cf6','#ec4899'],
  ['#f43f5e','#fb923c'], ['#0ea5e9','#6366f1'], ['#14b8a6','#84cc16'],
  ['#a855f7','#22d3ee'], ['#ef4444','#f97316'], ['#3b82f6','#06b6d4']
];

const TAG_LABELS = { mobile: 'Phone', multi: 'Multiplayer', heavy: 'Heavy' };

const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hash = s => { let h=0; for(let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))|0; return Math.abs(h); };
const gid = g => g.key + '::' + g.path;

let GAMES = [], filter = 'all', query = '';

/* ── game page URL ── */
function gamePageUrl(g) {
  return '/game.html?g=' + encodeURIComponent(gid(g));
}

/* ── render single card ── */
function card(g, i) {
  const [c1, c2] = PALETTES[hash(g.key + g.name) % PALETTES.length];
  const tags = (g.tags || []).map(t =>
    `<span class="tag ${t}">${TAG_LABELS[t] || t}</span>`
  ).join('');
  const init = esc((g.name || '?').trim().charAt(0).toUpperCase());
  const href = gamePageUrl(g);

  return `<a class="card" href="${href}" style="animation-delay:${Math.min(i*18,480)}ms;opacity:0;transform:translateY(16px);animation:card-rise .45s cubic-bezier(.2,.8,.2,1) forwards">
    <div class="card-thumb">
      <div class="card-thumb-bg" style="background:linear-gradient(135deg,${c1},${c2})">
        <span class="card-init">${init}</span>
      </div>
      <div class="card-play-overlay">
        <div class="play-ring">
          <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
        </div>
      </div>
    </div>
    <div class="card-body">
      <div class="card-name">${esc(g.name)}</div>
      <div class="card-tags">${tags}</div>
      <div class="card-host">${esc(g.key)}</div>
    </div>
  </a>`;
}

/* ── inject card rise animation ── */
(function injectAnim() {
  const s = document.createElement('style');
  s.textContent = '@keyframes card-rise{to{opacity:1;transform:none}}';
  document.head.appendChild(s);
})();

/* ── render grid ── */
function render() {
  const grid = document.getElementById('grid');
  const status = document.getElementById('status');
  const q = query.trim().toLowerCase();

  let list = GAMES.filter(g =>
    !q || g.name.toLowerCase().includes(q) || (g.tags || []).join(' ').toLowerCase().includes(q)
  );
  if (filter !== 'all') {
    list = list.filter(g => (g.tags || []).includes(filter));
  }

  if (!list.length) {
    grid.innerHTML = '';
    status.className = 'status-msg';
    status.textContent = filter !== 'all' ? `No games tagged "${filter}".` : 'No results.';
    return;
  }

  status.textContent = '';
  document.getElementById('count').textContent = list.length + (list.length === 1 ? ' game' : ' games');
  grid.innerHTML = list.map(card).join('');
}

/* ── filter chips ── */
document.addEventListener('click', e => {
  const chip = e.target.closest('.chip[data-f]');
  if (!chip) return;
  document.querySelectorAll('.chip[data-f]').forEach(c => c.classList.toggle('on', c === chip));
  filter = chip.dataset.f;
  render();
});

/* ── search ── */
document.getElementById('q').addEventListener('input', e => {
  query = e.target.value;
  render();
});

/* ── boot ── */
fetch('/games.json')
  .then(r => r.json())
  .then(d => {
    GAMES = d.games || [];
    const countEl = document.getElementById('game-count');
    if (countEl) countEl.textContent = GAMES.length;
    document.getElementById('count').textContent = GAMES.length + ' games';
    render();
  })
  .catch(() => {
    const s = document.getElementById('status');
    s.className = 'status-msg err';
    s.textContent = 'Could not load the games list.';
  });
