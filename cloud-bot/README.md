# Cloud Bot — Puppeteer Screenshot Relay

يعمل هذا السيرفر كوسيط بين صفحة الألعاب والمتصفح السحابي (Browser.lol).
يفتح نافذة Chromium على السيرفر، يبث صور الشاشة عبر WebSocket للمستخدم،
ويُعيد توجيه نقرات المستخدم للمتصفح — مما يمكّن المستخدم من حل Cloudflare Turnstile بنفسه.

## كيف يعمل

```
المستخدم (هاتف/كمبيوتر)              السيرفر (cloud-bot)
        │                                    │
        │  POST /session/create              │
        │─────────────────────────────────→  │  يفتح Chromium (Puppeteer)
        │  { sessionId: "abc123" }           │  يفتح browser.lol/en/create
        │←─────────────────────────────────  │  يملأ رابط اللعبة تلقائياً
        │                                    │
        │  WS /session/abc123/stream         │
        │─────────────────────────────────→  │
        │  ← { type:"frame", data:base64 }  │  يبث صور JPEG (~8fps)
        │  [المستخدم يرى شاشة Turnstile]    │
        │  → { type:"click", x:0.5, y:0.7 } │  المستخدم ينقر
        │                                    │  الخادم ينقر في Puppeteer
        │  ← { type:"ready",                 │  
        │       shareUrl:"https://..." }     │  بعد نجاح Turnstile
        │  [يفتح البث السحابي مباشرة]       │
```

## تشغيل السيرفر

```bash
cd cloud-bot
npm install
npm start
# يستمع على http://localhost:3456
```

## ربط الموقع بالسيرفر

في ملف `arcade-site/config.js`:
```js
window.CLOUD_BOT_URL = 'http://localhost:3456';
```

للنشر على سيرفر خارجي:
```js
window.CLOUD_BOT_URL = 'https://your-server.com:3456';
```

> ⚠️ إذا كان السيرفر يستخدم HTTPS، يجب أن يدعم WSS أيضاً (ضع Nginx/Caddy أمامه).

## متغيرات البيئة

| المتغير | الافتراضي | الوصف |
|---|---|---|
| `PORT` | `3456` | رقم البورت |
| `CHROMIUM_PATH` | تلقائي | مسار Chrome/Chromium |
| `ALLOWED_ORIGINS` | `*` | مصادر CORS المسموح بها |

## API

| الطريقة | المسار | الوصف |
|---|---|---|
| `POST` | `/session/create` | إنشاء جلسة جديدة |
| `GET` | `/session/:id/status` | حالة الجلسة |
| `POST` | `/session/:id/stop` | إيقاف الجلسة |
| `WS` | `/session/:id/stream` | بث الشاشة + استقبال الأحداث |
