/**
 * cloud-bot/server.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Lightweight "Browser-in-Browser" relay server.
 *
 * Flow:
 *  1. Client (game.html) sends POST /session/create  {gameUrl, gameKey}
 *  2. Server opens a Puppeteer (Chromium) window, navigates to browser.lol/en/create,
 *     auto-types the game URL, and clicks Start.
 *  3. If Cloudflare Turnstile appears, the server streams JPEG screenshots of the
 *     page via WebSocket to the client so the *human* can see and interact.
 *  4. The client overlays the screenshots and forwards pointer/keyboard events back
 *     to the server, which replays them inside Puppeteer.
 *  5. Once browser.lol redirects to the viewer (shareUrl / vmId detected), the
 *     server sends {type:"ready", shareUrl, vmId} to the client and closes the relay.
 *
 * API:
 *   POST /session/create        { gameUrl, gameKey }  → { sessionId }
 *   GET  /session/:id/status    → { state, shareUrl?, vmId? }
 *   POST /session/:id/stop      → { ok }
 *   WS   /session/:id/stream    ← JPEG frames + ready/error events
 *                               → { type:"click"|"move"|"key", ... }
 *
 * Run:  node server.js  (or  PORT=3456 node server.js)
 */

'use strict';

const http    = require('http');
const express = require('express');
const { WebSocketServer } = require('ws');
const puppeteer = require('puppeteer-core');
const crypto  = require('crypto');
const path    = require('path');

const PORT = parseInt(process.env.PORT || '3456', 10);
const ORIGIN_WHITELIST = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map(s => s.trim()).filter(Boolean);

/* ── In-memory session store ─────────────────────────────────────────────── */
/** @type {Map<string, Session>} */
const sessions = new Map();

/** @typedef {{ id:string, state:'init'|'streaming'|'ready'|'error'|'stopped',
 *              browser:any, page:any, shareUrl?:string, vmId?:string,
 *              ws:Set<any>, frameLoop?:any, gameUrl:string }} Session */

/* ── Express app ─────────────────────────────────────────────────────────── */
const app = express();
app.use(express.json());
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

/* ── Decoy Public Dashboard & Health ─────────────────────────────────────── */
app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (req, res) => {
  res.json({ status: 'operational', uptime: Math.round(process.uptime()), load: 0.14 });
});

/* ── POST /session/create ───────────────────────────────────────────────── */
app.post('/session/create', async (req, res) => {
  const { gameUrl, gameKey } = req.body || {};
  if (!gameUrl) return res.status(400).json({ error: 'gameUrl required' });

  const id = crypto.randomBytes(8).toString('hex');
  /** @type {Session} */
  const session = {
    id, state: 'init',
    browser: null, page: null,
    ws: new Set(),
    gameUrl,
  };
  sessions.set(id, session);

  // Start Puppeteer in background
  _startSession(session).catch(err => {
    console.error('[session:%s] fatal:', id, err.message);
    session.state = 'error';
    session.errorMessage = err.message;
    _broadcast(session, { type: 'error', message: err.message });
  });

  res.json({ sessionId: id });
});

/* ── GET /session/:id/status ────────────────────────────────────────────── */
app.get('/session/:id/status', (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s) return res.status(404).json({ error: 'not found' });
  res.json({ state: s.state, shareUrl: s.shareUrl, vmId: s.vmId });
});

/* ── POST /session/:id/stop ─────────────────────────────────────────────── */
app.post('/session/:id/stop', async (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s) return res.status(404).json({ error: 'not found' });
  await _stopSession(s);
  res.json({ ok: true });
});

/* ── HTTP + WS server ────────────────────────────────────────────────────── */
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  // URL pattern: /session/<id>/stream
  const m = (req.url || '').match(/^\/session\/([^/]+)\/stream/);
  if (!m) { ws.close(1008, 'bad path'); return; }

  const s = sessions.get(m[1]);
  if (!s) { ws.close(1008, 'session not found'); return; }

  s.ws.add(ws);
  ws.on('close', () => s.ws.delete(ws));
  ws.on('error', () => s.ws.delete(ws));

  // Forward input events from client → Puppeteer
  ws.on('message', async (raw) => {
    try {
      const ev = JSON.parse(raw);
      await _handleInput(s, ev);
    } catch (e) { /* ignore */ }
  });

  // Immediately send current state
  ws.send(JSON.stringify({ type: 'state', state: s.state, shareUrl: s.shareUrl }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[relay] Service listening on 0.0.0.0:${PORT}`);
});

/* ═══════════════════════════════════════════════════════════════════════════
   Session lifecycle
   ═══════════════════════════════════════════════════════════════════════════ */

async function _startSession(session) {
  const { gameUrl } = session;

  /* Launch headless Chromium with stealth */
  session.browser = await puppeteer.launch({
    headless: true,
    executablePath: _findChromium(),
    args: [
      '--no-sandbox', '--disable-setuid-sandbox',
      '--disable-dev-shm-usage', '--disable-gpu',
      '--disable-extensions',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1280,800',
    ],
    defaultViewport: { width: 1280, height: 800 },
  });

  session.page = await session.browser.newPage();
  const page = session.page;

  // Intercept navigation to detect when Browser.lol creates the session
  page.on('response', async (resp) => {
    const url = resp.url();
    // browser.lol redirects to a share URL like https://browser.lol/en/share/<vmId>
    if (/browser\.lol\/(en\/)?share\/([a-z0-9-]+)/i.test(url) || url.includes('/vm/') ) {
      const shareMatch = url.match(/browser\.lol\/(?:en\/)?share\/([a-z0-9-]+)/i);
      if (shareMatch) {
        session.vmId = shareMatch[1];
        session.shareUrl = url;
        _sessionReady(session);
      }
    }
  });

  // Also watch page URL changes
  page.on('framenavigated', async (frame) => {
    if (frame !== page.mainFrame()) return;
    const current = frame.url();
    const m = current.match(/browser\.lol\/(?:en\/)?share\/([a-z0-9-]+)/i);
    if (m && !session.shareUrl) {
      session.vmId = m[1];
      session.shareUrl = current;
      _sessionReady(session);
    }
  });

  // Navigate to browser.lol create page
  await page.goto('https://browser.lol/en/create', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });

  // Try to auto-fill the URL field
  await _tryAutoFill(session, gameUrl);

  // Start screenshot streaming
  _startStreaming(session);
}

async function _tryAutoFill(session, gameUrl) {
  const page = session.page;
  try {
    // Wait for the URL input field (various selectors tried)
    const INPUT_SEL = [
      'input[type="url"]',
      'input[name="url"]',
      'input[placeholder*="url" i]',
      'input[placeholder*="http" i]',
      'input[placeholder*="website" i]',
      'input[placeholder*="enter" i]',
      'form input[type="text"]',
    ].join(', ');

    await page.waitForSelector(INPUT_SEL, { timeout: 8000 });
    await page.click(INPUT_SEL);
    // Clear then type
    await page.keyboard.down('Control');
    await page.keyboard.press('a');
    await page.keyboard.up('Control');
    await page.type(INPUT_SEL.split(',')[0], gameUrl, { delay: 30 });

    _broadcast(session, { type: 'status', message: 'URL filled in. Looking for Start button…' });

    // Wait a moment then try to click Start / Submit
    await _sleep(800);
    const BTN_SEL = [
      'button[type="submit"]',
      'button:has-text("Start")',
      'button:has-text("Launch")',
      'button:has-text("Open")',
      'input[type="submit"]',
    ].join(', ');

    const btn = await page.$(BTN_SEL).catch(() => null);
    if (btn) {
      await btn.click();
      _broadcast(session, { type: 'status', message: 'Clicked Start. Waiting for verification…' });
    }
  } catch (e) {
    // Auto-fill failed – user will interact manually via the stream
    _broadcast(session, { type: 'status', message: 'Please fill in the URL and press Start.' });
  }
}

function _startStreaming(session) {
  session.state = 'streaming';
  _broadcast(session, { type: 'state', state: 'streaming' });

  // Stream JPEG frames ~8 fps
  session.frameLoop = setInterval(async () => {
    if (!session.page || session.state === 'ready' || session.state === 'stopped') {
      clearInterval(session.frameLoop);
      return;
    }
    if (session.ws.size === 0) return; // nobody watching

    try {
      const jpeg = await session.page.screenshot({ type: 'jpeg', quality: 70 });
      const b64  = jpeg.toString('base64');
      const msg  = JSON.stringify({ type: 'frame', data: b64 });
      for (const ws of session.ws) {
        if (ws.readyState === 1 /* OPEN */) ws.send(msg);
      }
    } catch (e) { /* page may be navigating */ }
  }, 125); // ~8 fps
}

function _sessionReady(session) {
  if (session.state === 'ready') return;
  session.state = 'ready';
  clearInterval(session.frameLoop);
  _broadcast(session, {
    type: 'ready',
    shareUrl: session.shareUrl,
    vmId: session.vmId,
  });
  // Close browser after a short delay to free resources
  setTimeout(() => _stopSession(session), 5000);
}

async function _stopSession(session) {
  session.state = 'stopped';
  clearInterval(session.frameLoop);
  try { await session.browser.close(); } catch (e) {}
  for (const ws of session.ws) { try { ws.close(); } catch(e){} }
  session.ws.clear();
  // Remove from store after 30 s
  setTimeout(() => sessions.delete(session.id), 30000);
}

/* ── Input forwarding ────────────────────────────────────────────────────── */
async function _handleInput(session, ev) {
  if (!session.page || session.state !== 'streaming') return;
  const page = session.page;
  const vp   = { w: 1280, h: 800 }; // server viewport

  try {
    switch (ev.type) {
      case 'click': {
        // ev.x, ev.y are 0–1 ratios of the client display size
        const x = Math.round(ev.x * vp.w);
        const y = Math.round(ev.y * vp.h);
        await page.mouse.click(x, y);
        break;
      }
      case 'move': {
        const x = Math.round(ev.x * vp.w);
        const y = Math.round(ev.y * vp.h);
        await page.mouse.move(x, y);
        break;
      }
      case 'down': {
        const x = Math.round(ev.x * vp.w);
        const y = Math.round(ev.y * vp.h);
        await page.mouse.move(x, y);
        await page.mouse.down();
        break;
      }
      case 'up': {
        const x = Math.round(ev.x * vp.w);
        const y = Math.round(ev.y * vp.h);
        await page.mouse.move(x, y);
        await page.mouse.up();
        break;
      }
      case 'key': {
        if (ev.key) await page.keyboard.press(ev.key);
        break;
      }
      case 'type': {
        if (ev.text) await page.keyboard.type(ev.text);
        break;
      }
      case 'scroll': {
        const x = Math.round(ev.x * vp.w);
        const y = Math.round(ev.y * vp.h);
        await page.mouse.move(x, y);
        await page.evaluate((dx, dy) => window.scrollBy(dx, dy), ev.dx || 0, ev.dy || 0);
        break;
      }
    }
  } catch (e) { /* ignore stale page */ }
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function _broadcast(session, obj) {
  const msg = JSON.stringify(obj);
  for (const ws of session.ws) {
    if (ws.readyState === 1) ws.send(msg);
  }
}

function _sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function _findChromium() {
  // Try common paths; fall back to puppeteer-core bundled
  const candidates = [
    process.env.CHROMIUM_PATH,
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/snap/bin/chromium',
  ].filter(Boolean);
  const fs = require('fs');
  for (const c of candidates) {
    try { if (fs.existsSync(c)) return c; } catch (e) {}
  }
  // Let puppeteer-core figure it out (will use PUPPETEER_EXECUTABLE_PATH env)
  return undefined;
}
