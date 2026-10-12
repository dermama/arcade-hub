# arcade-gateway (Cloudflare Worker)

بروكسي دائم يخدم ألعاب المتصفح المُقيَّدة: يحقن شيم `__shim.js`، ويعترض `capabilities.js`، ويصحّح الرؤوس (CORS / رؤوس ISO للـSharedArrayBuffer).

## ما يفعله
- `GET /__shim.js` → يخدم شيم التمويه (سطح مكتب + ترميز WebGL).
- `GET /__capabilities.js` و`GET /games.json` → يخدمان الموارد.
- `GET /play/<key>/<...>` أو `/s/<key>/<...>` → بروكسي إلى مضيف اللعبة `key`.
- `/<root_mount>/...` (مثل `/bo1z/...`) → بروكسي عبر جذر ثابت.
- HTML المُعاد يُحقن فيه `<script src="/__shim.js"></script>`.
- إن كانت اللعبة ضمن `iso` يُضاف `COOP: same-origin` و`COEP: require-corp` (لـSharedArrayBuffer).

البيانات (القوائم/الجذور) تُقرأ من `src/games.json`.

## النشر
```bash
npm i -g wrangler
export CLOUDFLARE_API_TOKEN=...        # Workers Scripts: Edit
export CLOUDFLARE_ACCOUNT_ID=...
wrangler deploy                        # ينتج https://<worker>.<subdomain>.workers.dev
```

## ربط الواجهة
ضع رابط الـWorker في `arcade-site/config.js`:
```js
window.ARCADE = { proxyBase: 'https://gateway.<subdomain>.workers.dev' };
```
