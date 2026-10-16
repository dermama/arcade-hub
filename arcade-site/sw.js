/* ================================================================
   ARCADE HUB — Service Worker
   Tiered caching strategy optimised for browser-game platform
   ================================================================ */
const VERSION = 'v37';
const SHELL_CACHE = `arcade-shell-${VERSION}`;
const GAME_CACHE = `arcade-games-${VERSION}`;
const IMG_CACHE = `arcade-images-${VERSION}`;
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

/* ── ACTIVATE ── wipe stale caches */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => !ACTIVE_CACHES.includes(k)).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
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

  /* 2. App Shell Assets (CSS, JS) → Cache-First with ignoreSearch (Solves R4) */
  if (isShellAsset(url)) {
    event.respondWith(cacheFirst(event.request, SHELL_CACHE));
    return;
  }

  /* 3. Thumbnails & images → Stale-While-Revalidate */
  if (isImageAsset(url)) {
    event.respondWith(staleWhileRevalidate(event.request, IMG_CACHE));
    return;
  }

  /* 4. Heavy game assets (wasm, data, unityweb, bin...) → Cache-First runtime cache (Solves R5/R6) */
  if (isGameAsset(url)) {
    event.respondWith(cacheFirst(event.request, GAME_CACHE));
    return;
  }

  /* 5. Everything else → Network with cache fallback */
  event.respondWith(networkFirst(event.request, SHELL_CACHE));
});

/* ── Classifiers ── */
function isHtmlRequest(request, url) {
  return request.mode === 'navigate' ||
         url.pathname === '/' ||
         /\.html?$/i.test(url.pathname) ||
         (request.headers.get('accept') && request.headers.get('accept').includes('text/html'));
}

function isShellAsset(url) {
  const p = url.pathname;
  return SHELL_URLS.includes(p) || /\.(css|js|json|woff2?|ttf|otf)$/i.test(p);
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
    const response = await fetch(request);
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
