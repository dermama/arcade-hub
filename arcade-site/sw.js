/* ================================================================
   ARCADE HUB — Service Worker
   Tiered caching strategy optimised for browser-game platform
   ================================================================ */
/* NOTE (v54): bump VERSION (and the B build marker in index.html/game.html)
   on every release. Tiered strategy:
   - HTML + JSON data (games.json/images.json) + CSS/JS → NETWORK-FIRST:
     catalog and updates always appear, cache is only an offline fallback.
   - Thumbnails → stale-while-revalidate; fonts + heavy game assets
     (wasm/data/pck/...) → CACHE-FIRST: the useful stuff stays cached for
     instant relaunches, so games never re-download on updates.
   - GAME/IMG caches use STABLE names: heavy game files survive every update,
     and legacy versioned game/image caches are migrated, never dropped. */
const VERSION = 'v55';
const SHELL_CACHE = `arcade-shell-${VERSION}`;
const GAME_CACHE = 'arcade-games-static';
const IMG_CACHE = 'arcade-images-static';
const ACTIVE_CACHES = [SHELL_CACHE, GAME_CACHE, IMG_CACHE];

/* App-shell URLs that must be available instantly / offline */
const SHELL_URLS = [
  '/',
  '/index.html',
  '/game.html',
  '/styles.css',
  '/app.js',
  '/config.js',
  '/games.json',
  '/images.json'
];

/* ── INSTALL ── pre-cache the shell resiliently ── */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(async (cache) => {
        for (const u of SHELL_URLS) {
          try {
            await cache.add(new Request(u, { cache: 'reload' }));
          } catch (e) {}
        }
      })
      .then(() => self.skipWaiting())
  );
});

/* ── ACTIVATE ── wipe stale SHELL caches; migrate legacy game caches ── */
const LEGACY_FAST_PREFIXES = ['arcade-games-', 'arcade-images-'];
function isLegacyFast(k) {
  return LEGACY_FAST_PREFIXES.some(p => k.startsWith(p)) && !ACTIVE_CACHES.includes(k);
}
async function migrateLegacyInto(cacheName, prefix) {
  try {
    const keys = await caches.keys();
    for (const k of keys) {
      if (k === cacheName || !k.startsWith(prefix)) continue;
      try {
        const old = await caches.open(k);
        const next = await caches.open(cacheName);
        for (const req of await old.keys()) {
          try {
            if (!(await next.match(req))) {
              const res = await old.match(req);
              if (res) await next.put(req, res);
            }
          } catch (e) {}
        }
        await caches.delete(k);
      } catch (e) {}
    }
  } catch (e) {}
}
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => !ACTIVE_CACHES.includes(k) && !isLegacyFast(k)).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
      .then(() => {
        /* Best-effort background migration of old versioned game/image caches
           into the stable ones — keeps heavy game files cached (no re-download).
           Runs detached so it never delays the takeover/auto-reload. */
        migrateLegacyInto(GAME_CACHE, 'arcade-games-');
        migrateLegacyInto(IMG_CACHE, 'arcade-images-');
      })
  );
});

/* ── FETCH ── tiered routing */
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  /* Only handle GET */
  if (event.request.method !== 'GET') return;

  /* Skip cross-origin requests to game origins — let them pass through directly */
  if (url.origin !== location.origin) return;

  /* 1. HTML Pages & Navigations → Network-First (Solves R3: guarantees fresh HTML from server/worker) */
  if (isHtmlRequest(event.request, url)) {
    event.respondWith(networkFirst(event.request, SHELL_CACHE));
    return;
  }

  /* 2. Heavy game assets (wasm, data, unityweb, bin...) → Cache-First runtime cache (Solves R5/R6)
     Kept BEFORE code assets so framework.js/loader.js always land in GAME_CACHE. */
  if (isGameAsset(url)) {
    event.respondWith(cacheFirst(event.request, GAME_CACHE));
    return;
  }

  /* 3. Code & data (CSS, JS, games.json, images.json) → NETWORK-FIRST (v54):
     fixes stale catalog / stale CSS-JS on returning devices — updates always
     appear; the cache is only used as an offline fallback. */
  if (isCodeAsset(url)) {
    event.respondWith(networkFirst(event.request, SHELL_CACHE));
    return;
  }

  /* 4. Fonts → Cache-First with ignoreSearch (static, rarely change) */
  if (isFontAsset(url)) {
    event.respondWith(cacheFirst(event.request, SHELL_CACHE));
    return;
  }

  /* 5. Thumbnails & images → Stale-While-Revalidate */
  if (isImageAsset(url)) {
    event.respondWith(staleWhileRevalidate(event.request, IMG_CACHE));
    return;
  }

  /* 6. Everything else → Network with cache fallback */
  event.respondWith(networkFirst(event.request, SHELL_CACHE));
});

/* ── Classifiers ── */
function isHtmlRequest(request, url) {
  return request.mode === 'navigate' ||
         url.pathname === '/' ||
         /\.html?$/i.test(url.pathname) ||
         (request.headers.get('accept') && request.headers.get('accept').includes('text/html'));
}

function isCodeAsset(url) {
  const p = url.pathname;
  return SHELL_URLS.includes(p) || /\.(css|js|json)$/i.test(p);
}
function isFontAsset(url) {
  return /\.(woff2?|ttf|otf)$/i.test(url.pathname);
}
function isImageAsset(url) {
  const p = url.pathname;
  return /\.(jpg|jpeg|png|webp|avif|gif|svg|ico)$/i.test(p) || p.includes('/thumbs/');
}
function isGameAsset(url) {
  return /\.(wasm|data|unityweb|mem|pck|bin|framework\.js|loader\.js|br|gz)$/i.test(url.pathname);
}

/* ── Strategies ── */
async function cacheFirst(request, cacheName) {
  // Solves R4: ignoreSearch ensures /app.js?v=35 matches cached /app.js
  const cached = await caches.match(request, { ignoreSearch: true });
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (e) {
    return new Response('Offline', { status: 503 });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request, { ignoreSearch: true });

  const fetchPromise = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => cached || new Response('Offline', { status: 503 }));

  return cached || fetchPromise;
}

async function networkFirst(request, fallbackCacheName) {
  try {
    /* cache:'no-cache' forces revalidation against the browser HTTP cache so
       data/code updates are detected immediately on every visit. */
    const response = await fetch(request, { cache: 'no-cache' });
    if (response.ok && fallbackCacheName) {
      const cache = await caches.open(fallbackCacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (e) {
    const cached = await caches.match(request, { ignoreSearch: true });
    return cached || new Response('Offline', { status: 503 });
  }
}

/* ── Message handler for cache management ── */
self.addEventListener('message', (event) => {
  if (event.data === 'arcade:clear-all') {
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
  }
  if (event.data === 'arcade:clear-games') {
    caches.delete(GAME_CACHE);
  }
});
