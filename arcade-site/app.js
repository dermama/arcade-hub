const PALETTES = [
  ['#7c5cff','#22d3ee'], ['#ff6b9d','#7c5cff'], ['#22d3ee','#0ea5e9'],
  ['#f59e0b','#ef4444'], ['#10b981','#22d3ee'], ['#8b5cf6','#ec4899'],
  ['#f43f5e','#fb923c'], ['#0ea5e9','#6366f1'], ['#14b8a6','#84cc16'],
  ['#a855f7','#22d3ee'], ['#ef4444','#f97316'], ['#3b82f6','#06b6d4']
];
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hash = s => { let h = 0; for (let i=0;i<s.length;i++) h = (h*31 + s.charCodeAt(i))|0; return Math.abs(h); };
const gid = g => g.key + '::' + g.path;

const BASE = ((window.ARCADE && window.ARCADE.proxyBase) || '').replace(/\/$/,'');

function urlFor(g){
  const p = g.root
    ? '/' + g.path.replace(/\/$/,'') + '/'
    : '/play/' + g.key + '/' + g.path.replace(/^\//,'');
  return BASE + p;
}

/* ---- per-player profile (persisted locally) ---- */
const store = {
  get(k, d){ try { const v = JSON.parse(localStorage.getItem('arcade.'+k)); return v === null || v === undefined ? d : v; } catch { return d; } },
  set(k, v){ try { localStorage.setItem('arcade.'+k, JSON.stringify(v)); } catch {} }
};
let PID = store.get('pid', null);
if (!PID) { PID = (crypto.randomUUID ? crypto.randomUUID() : 'p' + Date.now() + Math.floor(Math.random()*1e6)); store.set('pid', PID); }
let NAME = store.get('name', '');
let FAV = store.get('fav', []);
let RECENT = store.get('recent', []);

function setFav(id, on){
  FAV = on ? Array.from(new Set(FAV.concat(id))) : FAV.filter(x => x !== id);
  store.set('fav', FAV);
}
function pushRecent(g){
  RECENT = [{ id: gid(g), key: g.key, name: g.name, path: g.path, root: !!g.root, ts: Date.now() }]
    .concat(RECENT.filter(r => r.id !== gid(g))).slice(0, 8);
  store.set('recent', RECENT);
}
function playerName(){ return NAME || 'لاعب'; }

let GAMES = [], filter = 'all', query = '';

function card(g, i){
  const [c1,c2] = PALETTES[hash(g.key + g.name) % PALETTES.length];
  const tags = (g.tags||[]).map(t => `<span class="tag ${t}">${ {mobile:'جوال',multi:'جماعية',heavy:'ثقيلة'}[t]||t }</span>`).join('');
  const init = esc((g.name||'?').trim().charAt(0).toUpperCase());
  const on = FAV.includes(gid(g));
  return `<div class="card" style="animation-delay:${Math.min(i*22,520)}ms">
    <a class="card-link" href="${urlFor(g)}" target="_blank" rel="noopener" data-id="${esc(gid(g))}"
       data-key="${esc(g.key)}" data-path="${esc(g.path)}" data-root="${g.root?1:0}" data-name="${esc(g.name)}">
      <div class="thumb" style="background:linear-gradient(135deg,${c1},${c2})">
        <span class="init">${init}</span>
        <span class="play"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span>
      </div>
      <div class="meta">
        <div>
          <div class="title">${esc(g.name)}</div>
          <div class="tags">${tags}</div>
        </div>
        <div class="host">${esc(g.key)}</div>
      </div>
    </a>
    <button class="fav${on?' is-on':''}" data-id="${esc(gid(g))}" aria-label="إضافة للمفضلة" title="المفضلة">
      <svg viewBox="0 0 24 24"><path d="M12 17.3l-5.4 3.1 1.4-6.1L3 9.9l6.2-.5L12 3.7l2.8 5.7 6.2.5-4.9 4.4 1.4 6.1z"/></svg>
    </button>
  </div>`;
}

function renderRecent(){
  const box = document.getElementById('recent');
  if (!RECENT.length){ box.hidden = true; box.innerHTML = ''; return; }
  box.hidden = false;
  box.innerHTML = `<div class="recent-h"><span>متابعة اللعب</span><span class="line"></span></div>
    <div class="recent-row">` + RECENT.map(r => {
      const g = { key:r.key, name:r.name, path:r.path, root:r.root };
      return `<a class="mini" href="${urlFor(g)}" target="_blank" rel="noopener">
        <span class="mini-dot"></span>${esc(r.name)}</a>`;
    }).join('') + `</div>`;
}

function render(){
  const grid = document.getElementById('grid');
  const status = document.getElementById('status');
  const q = query.trim().toLowerCase();
  let list = GAMES.filter(g =>
    (!q || g.name.toLowerCase().includes(q) || (g.tags||[]).join(' ').includes(q))
  );
  if (filter === 'fav') list = list.filter(g => FAV.includes(gid(g)));
  else if (filter !== 'all') list = list.filter(g => (g.tags||[]).includes(filter));

  renderRecent();

  if (!list.length){
    grid.innerHTML = '';
    status.className = 'status';
    status.textContent = filter === 'fav' ? 'لا مفضّلات بعد — اضغط ☆ على أي لعبة.' : 'لا نتائج مطابقة.';
    return;
  }
  status.textContent = '';
  grid.innerHTML = list.map(card).join('');
  document.getElementById('count').textContent = list.length + ' لعبة';
}

function renderPlayer(){
  document.getElementById('pname').textContent = playerName();
  document.getElementById('pav').textContent = playerName().trim().charAt(0).toUpperCase() || '؟';
  document.getElementById('favcount').textContent = FAV.length ? '(' + FAV.length + ')' : '';
}

/* ---- events ---- */
document.getElementById('filters').addEventListener('click', e => {
  const b = e.target.closest('.chip'); if (!b) return;
  document.querySelectorAll('.chip').forEach(c => c.classList.toggle('is-on', c === b));
  filter = b.dataset.f; render();
});
document.getElementById('q').addEventListener('input', e => { query = e.target.value; render(); });

document.getElementById('grid').addEventListener('click', e => {
  const f = e.target.closest('.fav');
  if (f){
    e.preventDefault();
    const id = f.dataset.id;
    const on = !FAV.includes(id);
    setFav(id, on);
    f.classList.toggle('is-on', on);
    renderPlayer();
    if (filter === 'fav') render();
    return;
  }
  const a = e.target.closest('.card-link');
  if (a){
    pushRecent({ key:a.dataset.key, name:a.dataset.name, path:a.dataset.path, root:a.dataset.root === '1' });
    renderRecent();
  }
});

document.getElementById('player').addEventListener('click', () => {
  const v = prompt('اسم اللاعب:', NAME || '');
  if (v === null) return;
  NAME = v.trim().slice(0, 24);
  store.set('name', NAME); renderPlayer();
});

document.getElementById('share').addEventListener('click', async () => {
  const url = location.origin + location.pathname + '?p=' + encodeURIComponent(PID);
  try { await navigator.clipboard.writeText(url); } catch {}
  const b = document.getElementById('share');
  b.classList.add('done'); setTimeout(() => b.classList.remove('done'), 1400);
});

/* ---- boot ---- */
renderPlayer();
fetch('/games.json').then(r => r.json()).then(d => {
  GAMES = d.games || [];
  render();
}).catch(() => {
  const s = document.getElementById('status');
  s.className = 'status err';
  s.textContent = 'تعذّر تحميل قائمة الألعاب.';
});
