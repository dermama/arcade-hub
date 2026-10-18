// ==UserScript==
// @name         Arcade Cloud Auto-Launcher for Browser.lol
// @namespace    https://arcade.games
// @version      1.1.0
// @description  يقرأ رابط اللعبة من الـ hash ويحقنه تلقائياً في Browser.lol ثم يضغط Start Session — نقرة صفرية
// @author       Arcade Hub
// @match        https://browser.lol/*
// @match        https://*.browser.lol/*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  var BANNER_ID = 'arcade-auto-banner';
  var MAX_ATTEMPTS = 60;      // 60 × 500ms = 30s ceiling
  var POLL_MS = 500;

  /* 1. Pull the game URL out of the hash: /en/create#https%3A%2F%2F... */
  function getTargetUrl() {
    if (!location.hash || location.hash.length < 2) return null;
    try {
      var decoded = decodeURIComponent(location.hash.substring(1));
      if (decoded.indexOf('https://') === 0 || decoded.indexOf('http://') === 0) {
        return decoded;
      }
    } catch (e) { }
    return null;
  }

  var targetUrl = getTargetUrl();
  if (!targetUrl) {
    console.log('[Arcade Helper] لا يوجد رابط في الـ hash — وضع التلقائي خامل.');
    return;
  }

  console.log('[Arcade Helper] رُصد رابط اللعبة، جاري الحقن والتشغيل:', targetUrl);

  /* 2. Floating status banner */
  function showBanner(text, isDone, isError) {
    var b = document.getElementById(BANNER_ID);
    if (!b) {
      b = document.createElement('div');
      b.id = BANNER_ID;
      b.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:999999;' +
        'color:#fff;border-radius:12px;padding:12px 24px;font-family:sans-serif;font-size:14px;' +
        'font-weight:bold;box-shadow:0 12px 30px rgba(0,0,0,.5);display:flex;align-items:center;' +
        'gap:10px;animation:arcade-fade-in .3s ease;max-width:92vw;text-align:center;';
      document.body.appendChild(b);
    }
    b.style.background = isError
      ? 'linear-gradient(135deg,#7f1d1d,#991b1b)'
      : 'linear-gradient(135deg,#1e1b4b,#312e81)';
    b.style.border = '2px solid ' + (isError ? '#f87171' : '#818cf8');
    b.innerHTML = (isDone ? '⚡ ' : isError ? '✖ ' : '⏳ ') + text;
    if (isDone || isError) {
      setTimeout(function () { if (b) b.style.opacity = '0'; }, 4000);
      setTimeout(function () { if (b && b.parentNode) b.remove(); }, 4500);
    }
  }

  /* 3. Best-effort consent/cookie banner dismissal (never blocks the loop) */
  function dismissOverlays() {
    var texts = ['accept', 'agree', 'got it', 'consent', 'إغلاق', 'موافق'];
    var nodes = document.querySelectorAll('button, a');
    for (var i = 0; i < nodes.length && i < 80; i++) {
      var n = nodes[i];
      var t = (n.textContent || '').trim().toLowerCase();
      if (t && t.length <= 12 && texts.some(function (x) { return t.indexOf(x) !== -1; })) {
        try { n.click(); } catch (e) { }
        break;
      }
    }
  }

  showBanner('جاري حقن رابط اللعبة وبدء السحابة تلقائياً…', false);

  /* 4. Poll: fill the URL field, then press Start */
  var attempts = 0;
  var injected = false;

  var timer = setInterval(function () {
    attempts++;
    dismissOverlays();

    var input = document.getElementById('url') ||
      document.querySelector('input[name="url"], input[type="url"], input[type="text"]');

    if (input && !injected) {
      try {
        var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(input, targetUrl);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        injected = true;
        showBanner('تم حقن الرابط ✓ — جاري بدء الجلسة…', false);
      } catch (e) {
        console.error('[Arcade Helper] فشل الحقن:', e);
      }
    }

    if (injected) {
      var btn = document.getElementById('start') ||
        document.querySelector('button[type="submit"], #create, .create-btn, form button');
      if (!btn) {
        var btns = document.querySelectorAll('button');
        for (var i = 0; i < btns.length; i++) {
          var label = (btns[i].textContent || '').trim().toLowerCase();
          if (label.indexOf('start') !== -1 || label.indexOf('create') !== -1 || label.indexOf('session') !== -1) {
            btn = btns[i];
            break;
          }
        }
      }
      if (btn && !btn.disabled) {
        clearInterval(timer);
        try { btn.click(); } catch (e) { }
        showBanner('انطلقت الجلسة السحابية! استمتع باللعب 🎮', true);
        return;
      }
    }

    if (attempts >= MAX_ATTEMPTS) {
      clearInterval(timer);
      showBanner('انتهت المهلة — الصق الرابط يدوياً واضغط Start.', false, true);
    }
  }, POLL_MS);
})();
