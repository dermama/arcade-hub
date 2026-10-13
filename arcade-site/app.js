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

let GAMES = [], HOSTS = {}, filter = 'all', query = '';

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
    <div class="acts">
      <button class="act chk" data-id="${esc(gid(g))}" aria-label="فحص توافق الجهاز" title="فحص توافق الجهاز">
        <svg viewBox="0 0 24 24"><path d="M13 2 3 14h7l-1 8L19 10h-7l1-8z"/></svg>
      </button>
      <button class="act del" data-id="${esc(gid(g))}" aria-label="مسح بيانات اللعبة" title="مسح بيانات اللعبة">
        <svg viewBox="0 0 24 24"><path d="M6 7h12v1H6V7zm2-2h8v2H8V5zm-1 3h10l-1 14H7L7 8zm3 3v9h2v-9h-2zm4 0v9h2v-9h-2z"/></svg>
      </button>
    </div>
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
  const act = e.target.closest('.act');
  if (act){
    e.preventDefault();
    const g = GAMES.find(x => gid(x) === act.dataset.id);
    if (!g) return;
    if (act.classList.contains('del')) clearGameData(g);
    else openDevice(g);
    return;
  }
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
  HOSTS = d.hosts || {};
  render();
}).catch(() => {
  const s = document.getElementById('status');
  s.className = 'status err';
  s.textContent = 'تعذّر تحميل قائمة الألعاب.';
});

/* ---- device profile & game rating ---- */
function realHW(){
  const w = window.__realHardware;
  if (w && w.shimmed === true) return w;
  return { cores: navigator.hardwareConcurrency||0, memory: navigator.deviceMemory||0, touch: navigator.maxTouchPoints||0, platform: navigator.platform||'', ua: navigator.userAgent||'' };
}
function gpuInfo(){
  let gl2 = false, renderer = '';
  try { gl2 = !!document.createElement('canvas').getContext('webgl2'); } catch(e){}
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (gl){
      renderer = String(gl.getParameter(gl.RENDERER) || '').trim();
      if (!renderer) renderer = String(gl.getParameter(gl.VENDOR) || '').trim();
      try { gl.getExtension('WEBGL_lose_context') && gl.getExtension('WEBGL_lose_context').loseContext(); } catch(e2){}
      c.width = c.height = 0;
    }
  } catch(e){}
  return { gl2, renderer };
}
function deviceKind(hw){
  const touch = hw.touch > 0 || hw.coarse === true || hw.mobile === true;
  if (touch) return (hw.cores > 8 && hw.memory >= 8) ? 'جهاز لوحي' : 'هاتف';
  return 'حاسوب';
}
function deviceScore(hw, gpu, tags){
  const kind = deviceKind(hw);
  let sc = 0;
  sc += Math.min(hw.cores || 0, 12) / 12 * 30;
  sc += Math.min(hw.memory || 0, 16) / 16 * 28;
  sc += kind === 'حاسوب' ? 18 : (kind === 'جهاز لوحي' ? 13 : 8);
  if (hw.touch > 0) sc -= 4;
  sc += gpu.gl2 ? 11 : 6;
  if (gpu.renderer) sc += 3;
  let adj = sc;
  for (const t of (tags || [])){
    if (t === 'heavy') adj -= 12;
    else if (t === 'mobile') adj += 8;
    else if (t === 'multi') adj -= 3;
  }
  return { raw: Math.max(0, Math.round(sc)), adj: Math.max(0, Math.round(adj)) };
}
function verdict(s){
  if (s >= 75) return { c: 'g', t: 'سلسة' };
  if (s >= 55) return { c: 'y', t: 'جيدة' };
  if (s >= 35) return { c: 'o', t: 'متوسطة' };
  return { c: 'r', t: 'ثقيلة' };
}
function closeModal(){
  const o = document.getElementById('dev-overlay');
  if (o) o.remove();
}
function openDevice(g){
  closeModal();
  const hw = realHW();
  const gpu = gpuInfo();
  const kind = deviceKind(hw);
  const sc = deviceScore(hw, gpu, g.tags || []);
  const v = verdict(sc.adj);
  const tips = [];
  if (hw.memory && hw.memory <= 4) tips.push('الذاكرة قليلة — تجنّب الألعاب الثقيلة وأغلق التطبيقات في الخلفية.');
  if (hw.cores && hw.cores <= 4) tips.push('المعالج محدود — شغّل وضع الأداء من السهم ⬆ داخل اللعبة، وجرّب «دقة الرسم مخفّضة».');
  if (hw.touch > 0) tips.push('أنت على شاشة لمس — أغلق علامات التبويب الأخرى وقلّل التطبيقات في الخلفية.');
  if ((g.tags || []).includes('heavy')) tips.push('هذه اللعبة مصنفة "ثقيلة" وقد لا تعمل بسلاسة على الجهاز.');
  if (!tips.length) tips.push('يبدو جهازك مناسبًا. إن أردت تجربة أقرب، استخدم وضع الأداء من الشاشة العائمة داخل اللعبة.');
  const rows = [
    ['الذاكرة (RAM)', (hw.memory || '—') + ' GB'],
    ['أنوية المعالج', hw.cores || '—'],
    ['نوع الجهاز', kind],
    ['المعالج الرسومي', gpu.renderer || 'غير مكشوف'],
    ['دقة الشاشة (DPR)', (window.devicePixelRatio || 1).toFixed(2)],
    ['WebGL2', gpu.gl2 ? 'مدعوم' : 'غير مدعوم']
  ];
  const o = document.createElement('div');
  o.className = 'overlay'; o.id = 'dev-overlay';
  o.innerHTML = `<div class="modal" role="dialog" aria-modal="true">
    <button class="m-close" aria-label="إغلاق">✕</button>
    <div class="m-title">توافق جهازك مع «${esc(g.name)}»</div>
    <div class="score ${v.c}"><b>${sc.adj}<span>/100</span></b>
      <div class="bar"><i style="width:${Math.min(sc.adj, 100)}%"></i></div>
      <span class="verdict">${v.t}</span></div>
    ${sc.adj !== sc.raw ? `<div class="m-note">نقاط الجهاز الخام ${sc.raw} ← معدّلة ${sc.adj} بعد وسوم اللعبة (${(g.tags||[]).join('، ') || 'بدون وسوم'}).</div>` : ''}
    <div class="m-rows">${rows.map(r => `<div class="m-row"><span>${r[0]}</span><b>${esc(String(r[1]))}</b></div>`).join('')}</div>
    <div class="m-tips">${tips.map(t => `<div>• ${t}</div>`).join('')}</div>
    <button class="m-ok">فهمت</button>
  </div>`;
  document.body.appendChild(o);
  const q = o.querySelector('.modal');
  o.querySelector('.m-close').addEventListener('click', closeModal);
  o.querySelector('.m-ok').addEventListener('click', closeModal);
  o.addEventListener('click', e => { if (e.target === o) closeModal(); });
  document.addEventListener('keydown', function hk(e){
    if (e.key === 'Escape'){ closeModal(); document.removeEventListener('keydown', hk); }
  });
  try {
    if (navigator.getBattery) navigator.getBattery().then(b => {
      const row = q.querySelector('.m-rows');
      if (row && !o.dataset.b){
        o.dataset.b = '1';
        row.insertAdjacentHTML('beforeend', `<div class="m-row"><span>البطارية</span><b>${Math.round((b.level||0)*100)}%${b.charging ? ' (شحن)' : ''}</b></div>`);
      }
    }).catch(() => {});
  } catch(e){}
}

/* ---- toast + per-game data clearing ---- */
function toast(msg, kind){
  let t = document.getElementById('toast');
  if (!t){ t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.className = 'toast show' + (kind ? ' ' + kind : '');
  t.textContent = msg;
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 3400);
}
function clearGameData(g){
  const sure = confirm(`مسح بيانات «${g.name}»؟\nسيُحذف كاش اللعبة وتخزينها المحلي (تقدم، ملفات مؤقتة) من البوابة.`);
  if (!sure) return;
  const host = HOSTS[g.key] || '';
  const root = g.root ? '/' + String(g.path).replace(/^\/+|\/+$/g, '') : '';
  const url = BASE + '/__clear?key=' + encodeURIComponent(g.key)
    + '&host=' + encodeURIComponent(host)
    + '&path=' + encodeURIComponent(g.path)
    + '&root=' + encodeURIComponent(root);
  const f = document.createElement('iframe');
  f.style.display = 'none';
  f.src = url;
  let done = false;
  function fin(msg, kind){
    if (done) return;
    done = true;
    try { document.body.removeChild(f); } catch(e){}
    toast(msg, kind);
  }
  window.addEventListener('message', function h(ev){
    if (ev.data && ev.data.type === 'arcade:clear-result'){
      window.removeEventListener('message', h);
      const r = ev.data.result || {};
      fin(r.error === 'none'
        ? `تم مسح بيانات «${g.name}» بنجاح ✓`
        : `اكتمل المسح جزئيًا — كاش: ${r.caches || 0}، تخزين محلي: ${r.ls || 0}، OPFS: ${r.opfs || 0}.`,
        r.error === 'none' ? '' : 'warn');
    }
  });
  f.addEventListener('load', () => setTimeout(() => fin(`انتهى مسح «${g.name}» (بدون تأكيد تام).`, 'warn'), 2000));
  setTimeout(() => fin(`انتهى مسح «${g.name}» بدون تأكيد من البوابة.`, 'warn'), 9000);
  document.body.appendChild(f);
}
