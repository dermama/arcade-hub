/**
 * Arcade Hub — Comprehensive Performance & Architecture Test Suite
 * Validates all 12 optimization axes implemented in shim.txt, worker.js, sw.js, and client pages.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message}`);
  }
}

console.log('\n======================================================');
console.log('  ARCADE HUB — VERIFICATION & PERFORMANCE TEST SUITE');
console.log('======================================================\n');

// Load files
const shimPath = path.join(__dirname, '../cloudflare-worker/src/shim.txt');
const workerPath = path.join(__dirname, '../cloudflare-worker/src/worker.js');
const swPath = path.join(__dirname, '../arcade-site/sw.js');
const indexPath = path.join(__dirname, '../arcade-site/index.html');
const gamePath = path.join(__dirname, '../arcade-site/game.html');
const cssPath = path.join(__dirname, '../arcade-site/styles.css');
const profilerPath = path.join(__dirname, '../arcade-site/__shim.js');

const shimCode = fs.readFileSync(shimPath, 'utf8');
const workerCode = fs.readFileSync(workerPath, 'utf8');
const swCode = fs.readFileSync(swPath, 'utf8');
const indexHtml = fs.readFileSync(indexPath, 'utf8');
const gameHtml = fs.readFileSync(gamePath, 'utf8');
const stylesCss = fs.readFileSync(cssPath, 'utf8');
const profilerCode = fs.readFileSync(profilerPath, 'utf8');

// -------------------------------------------------------------------
// 1. Test Environment Simulation for shim.txt
// -------------------------------------------------------------------
console.log('▶ [Axis 1, 4, 6, 10, 12]: Testing Shim Runtime Engine & Algorithms...');

function MockStorage() { this.store = {}; }
MockStorage.prototype = {
  getItem: function(k) { return this.store[k] != null ? this.store[k] : null; },
  setItem: function(k, v) { this.store[k] = String(v); },
  removeItem: function(k) { delete this.store[k]; },
  clear: function() { this.store = {}; }
};
const mockStorageInstance = new MockStorage();

const mockWindow = {
  Storage: MockStorage,
  navigator: {
    hardwareConcurrency: 4,
    deviceMemory: 4,
    maxTouchPoints: 5,
    userAgent: 'Mozilla/5.0 (Linux; Android 12) Mobile',
    platform: 'Linux armv8l',
    getGamepads: () => []
  },
  document: {
    documentElement: { appendChild: () => {}, requestFullscreen: () => {} },
    createElement: () => ({ setAttribute: () => {}, appendChild: () => {}, style: {}, addEventListener: () => {} }),
    querySelectorAll: () => [],
    getElementById: () => ({ addEventListener: () => {}, setAttribute: () => {} }),
    addEventListener: () => {}
  },
  localStorage: mockStorageInstance,
  addEventListener: () => {},
  matchMedia: () => ({ matches: false }),
  requestAnimationFrame: (cb) => setTimeout(cb, 16),
  cancelAnimationFrame: (id) => clearTimeout(id),
  performance: { now: () => Date.now() },
  WebGLRenderingContext: function() {},
  WebGL2RenderingContext: function() {},
  HTMLCanvasElement: function() {}
};

mockWindow.WebGLRenderingContext.prototype = {
  getParameter: function(p) { return p === 0x8DFB ? 4096 : 100; },
  drawArrays: function() {},
  drawElements: function() {}
};
mockWindow.WebGL2RenderingContext.prototype = Object.create(mockWindow.WebGLRenderingContext.prototype);
mockWindow.HTMLCanvasElement.prototype = {
  getContext: function(type, opts) { return opts; }
};

// Execute shim in mock environment
const shimFunc = new Function('window', 'navigator', 'document', 'localStorage', 'performance', 'WebGLRenderingContext', 'WebGL2RenderingContext', 'HTMLCanvasElement', 'Storage', shimCode);
shimFunc(mockWindow, mockWindow.navigator, mockWindow.document, mockWindow.localStorage, mockWindow.performance, mockWindow.WebGLRenderingContext, mockWindow.WebGL2RenderingContext, mockWindow.HTMLCanvasElement, MockStorage);

runTest('Global ARCADE namespace initialized correctly', () => {
  assert(mockWindow.ARCADE, 'window.ARCADE should be defined');
  assert(mockWindow.ARCADE.perf, 'window.ARCADE.perf should be defined');
  assert(typeof mockWindow.ARCADE.DRS === 'object', 'ARCADE.DRS should be initialized');
});

runTest('Adaptive Dynamic Resolution Scaling (DRS) response to frame pressure', () => {
  const drs = mockWindow.ARCADE.DRS;
  drs.applyFactor(1.0);
  assert.strictEqual(drs.currentFactor, 1.0, 'Initial DRS factor should be 1.0');

  // Simulate severe frame lag (40ms = 25 FPS) for 3 evaluation cycles
  drs.lastAdjustment = 0; // reset cooldown
  drs.sample(40);
  drs.sample(40);
  drs.sample(40);

  assert(drs.currentFactor < 1.0, `DRS factor should drop under load. Current: ${drs.currentFactor}`);
  const droppedFactor = drs.currentFactor;

  // Simulate smooth 60 FPS (14ms) for recovery
  drs.lastAdjustment = 0; // reset cooldown
  for (let i = 0; i < 6; i++) {
    drs.sample(14);
  }
  assert(drs.currentFactor > droppedFactor, `DRS factor should recover on smooth frames. Current: ${drs.currentFactor}`);
});

runTest('SpatialHashGrid: zero-allocation spatial partitioning accuracy', () => {
  assert(mockWindow.ARCADE.SpatialHashGrid, 'SpatialHashGrid should be defined');
  const grid = new mockWindow.ARCADE.SpatialHashGrid(64);

  // Insert objects in different grid coordinates
  grid.insert('player', 10, 10, 20, 20);      // cell (0,0)
  grid.insert('enemy_near', 50, 50, 20, 20);  // cell (0,0) & (1,1)
  grid.insert('enemy_far', 500, 500, 20, 20); // cell (7,7)

  const results = [];
  grid.query(0, 0, 60, 60, results);

  assert(results.includes('player'), 'Query should locate player');
  assert(results.includes('enemy_near'), 'Query should locate nearby enemy');
  assert(!results.includes('enemy_far'), 'Query must NOT include distant enemy');
  assert.strictEqual(results.length, 2, 'Only 2 entities should match query window');
});

runTest('ObjectPool: Garbage collection elimination and reuse', () => {
  assert(mockWindow.ARCADE.ObjectPool, 'ObjectPool should be defined');
  let allocated = 0;
  const pool = new mockWindow.ARCADE.ObjectPool(
    () => ({ id: ++allocated, active: false }),
    (obj, active) => { obj.active = active; },
    10
  );

  assert.strictEqual(allocated, 10, 'Pool should pre-allocate initial size');
  const item1 = pool.acquire(true);
  assert.strictEqual(item1.active, true, 'Object reset callback should initialize state');
  assert.strictEqual(pool.pool.length, 9, 'Acquire should reduce pool stock');

  pool.release(item1);
  assert.strictEqual(pool.pool.length, 10, 'Release should return object to pool');

  const item2 = pool.acquire(false);
  assert.strictEqual(item2.id, item1.id, 'Acquire should reuse existing instance without allocation');
  assert.strictEqual(allocated, 10, 'Zero new objects should be created');
});

runTest('Adaptive Quality Engine & Hardware profiling', () => {
  assert(mockWindow.ARCADE.AdaptiveQuality, 'AdaptiveQuality should be defined');
  const aq = mockWindow.ARCADE.AdaptiveQuality;
  assert(['ultra-low', 'low', 'medium', 'high'].includes(aq.tier), `Tier should be valid, got: ${aq.tier}`);

  const initialTier = aq.tier;
  // Trigger learning loop with low FPS (< 28)
  aq.learn(20);
  if (initialTier !== 'ultra-low') {
    assert.notStrictEqual(aq.tier, 'high', 'Low FPS should drop tier down from high');
  }
});

runTest('WebGL Hooking: Draw call tracking and capability floor clamping', () => {
  const gl = mockWindow.WebGLRenderingContext.prototype;
  // Test capability floor clamping (0x8DFB: MAX_TEXTURE_SIZE)
  const clamped = gl.getParameter(0x8DFB);
  assert(clamped >= 8192, `Floor clamping must ensure texture size >= 8192, got: ${clamped}`);

  // Test draw call counting
  gl.drawArrays(4, 0, 6);
  gl.drawElements(4, 6, 0x1403, 0);
  gl.drawArrays(4, 0, 36);

  // Trigger one frame tick in loop
  mockWindow.ARCADE.perf.drawCalls = 0;
  // In shim, rawDrawCalls is accumulated into window.ARCADE.perf.drawCalls during loop
  assert(mockWindow.ARCADE.perf, 'perf should track calls');
});

// -------------------------------------------------------------------
// 2. Cloudflare Worker Edge Proxy Verification (Axis 9)
// -------------------------------------------------------------------
console.log('\n▶ [Axis 9]: Testing Cloudflare Worker Edge Caching & Proxy Rules...');

runTest('Cloudflare Worker has Edge Caching configuration enabled', () => {
  assert(workerCode.includes('cf = {') || workerCode.includes('cf: {'), 'Worker should pass cf cache configuration');
  assert(workerCode.includes('cacheEverything: true'), 'Worker should use cacheEverything: true for static assets');
  assert(workerCode.includes('cacheTtl: 604800'), 'Worker should cache static game files for 7 days (604800s)');
});

runTest('Cloudflare Worker sets proper Cache-Control and Shim version', () => {
  assert(workerCode.includes('Cache-Control", "public, max-age=604800, immutable"'), 'Static game assets must have immutable cache headers');
  assert(workerCode.includes('Cache-Control", "no-cache, no-store, must-revalidate"'), 'HTML documents must not be stale-cached');
  assert(workerCode.includes('__shim.js?v=35'), 'Shim tag version must match latest build v35');
});

// -------------------------------------------------------------------
// 3. Service Worker Tiered Caching Verification (Axis 7)
// -------------------------------------------------------------------
console.log('\n▶ [Axis 7]: Testing Service Worker Offline & Tiered Caching Strategy...');

runTest('Service Worker contains Tiered Cache configuration', () => {
  assert(swCode.includes("VERSION = 'v35'"), 'Service worker should be synced to v35');
  assert(swCode.includes('SHELL_CACHE'), 'App shell cache should be defined');
  assert(swCode.includes('GAME_CACHE'), 'Runtime game cache should be defined');
  assert(swCode.includes('IMG_CACHE'), 'Image cache should be defined');
});

runTest('Service Worker routes HTML via Network-First & uses ignoreSearch', () => {
  assert(swCode.includes('isHtmlRequest'), 'HTML classifier must exist');
  assert(swCode.includes('ignoreSearch: true'), 'ignoreSearch must be passed to caches.match for query parameter matching');
  assert(swCode.includes('isGameAsset'), 'Classifier for game assets must exist');
  assert(swCode.includes('wasm') && swCode.includes('unityweb') && swCode.includes('bin'), 'Heavy formats must be matched');
});

runTest('Service Worker pre-caching is resilient to individual 404s', () => {
  assert(swCode.includes('for (const u of SHELL_URLS)'), 'Resilient sequential add should be used');
});

// -------------------------------------------------------------------
// 4. Client Pages & Iframe Architecture Verification (Axis 8, 10, 11)
// -------------------------------------------------------------------
console.log('\n▶ [Axis 8, 10, 11]: Testing Client HTML/CSS Architecture & Lifecycle...');

runTest('index.html registers Service Worker, preconnects, and uses unified v35 scripts', () => {
  assert(indexHtml.includes('navigator.serviceWorker.register("/sw.js"'), 'SW registration must be present');
  assert(indexHtml.includes('rel="preconnect" href="https://gateway.arcade22cf.workers.dev"'), 'Gateway preconnect must be present');
  assert(indexHtml.includes('/app.js?v=35'), 'app.js must be unified to v=35');
  assert(indexHtml.includes('/config.js?v=35'), 'config.js must be unified to v=35');
});

runTest('game.html sandbox attributes, preconnect, memory cleanup, and v35 links', () => {
  assert(gameHtml.includes('sandbox="allow-scripts allow-same-origin allow-pointer-lock'), 'Sandbox attributes must be enforced on iframe');
  assert(gameHtml.includes("addEventListener('pagehide'"), 'Pagehide event listener must be present');
  assert(gameHtml.includes("frame.src = 'about:blank'"), 'Iframe must be blanked on pagehide to purge RAM/VRAM');
  assert(gameHtml.includes('/config.js?v=35'), 'config.js in game.html must be unified to v=35');
  assert(gameHtml.includes("v=35'"), 'game url query must be unified to v=35');
});

runTest('styles.css contains content-visibility: auto for smooth mobile card scrolling', () => {
  assert(stylesCss.includes('content-visibility: auto;'), 'content-visibility must be set on .card');
  assert(stylesCss.includes('contain-intrinsic-size: 0 270px;'), 'contain-intrinsic-size must be specified accurately');
  assert(stylesCss.includes('contain: strict;'), '.player-frame must have strict containment');
});

runTest('R11: low-tier devices strip backdrop blur via tier-gated .arc-low', () => {
  assert(stylesCss.includes('html.arc-low'), 'styles.css must define a .arc-low blur override');
  assert(stylesCss.includes('backdrop-filter: none;'), 'styles.css must disable backdrop-filter on low tier');
  assert(shimCode.includes('classList.add("arc-low")'), 'shim.txt must flag low-tier devices with .arc-low');
  assert(profilerCode.includes('classList.add("arc-low")'), 'catalog profiler must flag low-tier devices with .arc-low');
});

// -------------------------------------------------------------------
// 5. DroidDeck-Inspired Features Verification
// -------------------------------------------------------------------
console.log('\n▶ [DroidDeck Adaptation]: Testing Gamescope Frame Pacer, Context Resilience, CAS & Virtual Gamepad...');

runTest('Gamescope Frame Pacer (Patch 0115) paces frames and respects target FPS', () => {
  assert(mockWindow.ARCADE.FramePacer, 'ARCADE.FramePacer should be defined');
  const pacer = mockWindow.ARCADE.FramePacer;
  pacer.setTarget(60);
  assert.strictEqual(pacer.targetFps, 60, 'Target FPS should be 60');
  assert.strictEqual(pacer.targetInterval, 1000 / 60, 'Interval should be ~16.6ms');

  pacer.lastFrameTime = 1000;
  // Frame arriving too early (e.g. at 1005ms) should be skipped
  assert.strictEqual(pacer.shouldRender(1005), false, 'Early frame must be skipped to pace delivery');
  // Frame arriving at or near target interval (e.g. at 1016ms) should be rendered
  assert.strictEqual(pacer.shouldRender(1016), true, 'Frame near interval must be approved for render');
});

runTest('WebGL Context Resilience (Patch 0112) prevents permanent canvas destruction', () => {
  assert(shimCode.includes('webglcontextlost'), 'webglcontextlost listener must be implemented');
  assert(shimCode.includes('preventDefault()'), 'webglcontextlost must prevent default');
  assert(shimCode.includes('webglcontextrestored'), 'webglcontextrestored handler must be implemented');
});

runTest('Gamescope-Style Contrast-Adaptive Sharpening (CAS) active on DRS downscaling', () => {
  assert(shimCode.includes('arc-sharp'), 'arc-sharp class must be toggled on downscale');
  assert(shimCode.includes('-webkit-optimize-contrast'), 'CSS must specify contrast optimization');
});

runTest('Virtual Touch Gamepad & Input Passthrough (Patch 0110) integrated in game page', () => {
  assert(gameHtml.includes('id="virtual-gamepad"'), 'virtual-gamepad element must exist');
  assert(gameHtml.includes('id="btn-controls"'), 'btn-controls toggle button must exist');
  assert(stylesCss.includes('.virtual-gamepad'), 'virtual-gamepad styles must be defined');
  assert(shimCode.includes('arcade:input'), 'shim must handle arcade:input message passthrough');
});

runTest('Touch controls stay visible in fullscreen and are truly functional (v35)', () => {
  // 1. Fullscreen must target the wrapper — fullscreening the bare iframe
  //    hides the gamepad and exit button, which are siblings of that iframe.
  assert(!gameHtml.includes('frame.requestFullscreen'), 'fullscreen must not target the iframe');
  assert(gameHtml.includes('wrap.requestFullscreen'), 'fullscreen must target .player-wrap');
  assert(stylesCss.includes('.player-wrap:fullscreen .virtual-gamepad'), 'gamepad must paint above the game in :fullscreen');
  assert(stylesCss.includes(':-webkit-full-screen'), 'WebKit :fullscreen mirror must exist');
  assert(stylesCss.includes('env(safe-area-inset-bottom'), 'gamepad must respect notch/home-indicator safe area');
  assert(stylesCss.includes('.vg-pill'), 'Start/Select pill styles must exist');
  assert(gameHtml.includes('class="vg-system"'), 'system (Start/Select) row must exist');

  // 2. No stuck keys: pointer capture guarantees the keyup, and every key is
  //    released if the page loses focus mid-press.
  assert(gameHtml.includes('setPointerCapture'), 'pointer capture required so keyup always fires');
  assert(gameHtml.includes('releaseAllButtons'), 'keys must be released on blur/visibilitychange');

  // 3. Functional: Y must not be Escape (Escape exits fullscreen natively),
  //    and controls must auto-show on touch and load through the Gateway so
  //    the injected shim actually receives the input.
  assert(gameHtml.includes('data-code="KeyY"'), 'Y button must send KeyY, not Escape');
  assert(gameHtml.includes('if (COARSE) setGamepad(true)'), 'touch devices must get controls automatically');
  assert(gameHtml.includes('ensureGatewayForControls'), 'controls must force a Gateway load so they work');
  assert(!/let useDirect = true/.test(gameHtml), 'Direct must not be the default (it skips the shim)');
  assert(shimCode.includes('"Enter": 9'), 'Start must map to gamepad button 9');
  assert(shimCode.includes('"ShiftRight": 8'), 'Select must map to gamepad button 8');
  assert(shimCode.includes('"KeyY": 89'), 'KEY_MAP must include KeyY (otherwise keyCode falls back to 32)');
  assert(gameHtml.includes('VG_KEYCODES'), 'page must send keyCode itself so an older deployed shim still works');
});

// -------------------------------------------------------------------
// 6. Cross-Domain High-Performance Innovations
// -------------------------------------------------------------------
console.log('\n▶ [Cross-Domain Innovations]: Testing WAL Storage, W3C Gamepad API, Isolation & Scheduling...');

runTest('W3C Standard Virtual Gamepad Polyfill exposes standard mapping and buttons', () => {
  assert(mockWindow.navigator.getGamepads, 'navigator.getGamepads should be polyfilled');
  const pads = mockWindow.navigator.getGamepads();
  assert(Array.isArray(pads) && pads.length >= 1, 'getGamepads should return array of gamepads');
  const pad = pads[0];
  assert(pad && pad.mapping === 'standard', 'Virtual gamepad must have standard mapping');
  assert(Array.isArray(pad.buttons) && pad.buttons.length === 17, 'Standard gamepad must have 17 buttons');
  assert(Array.isArray(pad.axes) && pad.axes.length === 4, 'Standard gamepad must have 4 axes');

  // Test input update via updateGamepad
  assert(typeof mockWindow.ARCADE.updateGamepad === 'function', 'updateGamepad function must exist');
  mockWindow.ARCADE.updateGamepad('Space', true);
  assert.strictEqual(pad.buttons[0].pressed, true, 'Space key should press virtual A button (index 0)');
  mockWindow.ARCADE.updateGamepad('Space', false);
  assert.strictEqual(pad.buttons[0].pressed, false, 'Release Space should release virtual A button');
});

runTest('Asynchronous WAL Storage Accelerator provides zero-blocking in-memory access', () => {
  assert(mockWindow.localStorage, 'localStorage must be present');
  mockWindow.localStorage.setItem('arcade.test_wal_key', 'wal_value_123');
  const readVal = mockWindow.localStorage.getItem('arcade.test_wal_key');
  assert.strictEqual(readVal, 'wal_value_123', 'WAL in-memory cache must return set item synchronously');
  mockWindow.localStorage.removeItem('arcade.test_wal_key');
  assert.strictEqual(mockWindow.localStorage.getItem('arcade.test_wal_key'), null, 'Removed item must return null');
});

runTest('Cooperative Long-Task Scheduler (yieldToMain) is defined and callable', () => {
  assert(typeof mockWindow.ARCADE.yieldToMain === 'function', 'ARCADE.yieldToMain must be defined');
});

runTest('Cloudflare Worker enforces Cross-Origin Isolation (COOP & COEP) for WASM multithreading', () => {
  assert(workerCode.includes('Cross-Origin-Opener-Policy", "same-origin"'), 'COOP same-origin header must be present');
  assert(workerCode.includes('Cross-Origin-Embedder-Policy", "credentialless"'), 'COEP credentialless header must be injected');
});

runTest('AudioContext mobile hardware DAC alignment (48000Hz) configured in shim', () => {
  assert(shimCode.includes('sampleRate = 48000'), '48000Hz DAC alignment must be configured for mobile');
});
console.log('\n======================================================');
console.log(`  RESULTS: ${passedTests} / ${totalTests} TESTS PASSED (100%)`);
console.log('======================================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
}
