# arcade-hub

بوابة ألعاب متصفح مستقلة — **مجانية بالكامل، بلا أي نطاق مخصّص**.
- **الواجهة** (`arcade-site/`) تُنشر على **Vercel** عبر استيراد هذا المستودع (Root Directory = `arcade-site`).
- **البروكسي** (`cloudflare-worker/`) يُنشر على **Cloudflare Workers** (`*.workers.dev`).

## البنية
```
arcade-site/          # موقع Vercel الثابت
  index.html
  styles.css
  app.js              # تجربة اللاعب: هوية، مفضّلة، متابعة، رابط شخصي ?p=PID
  config.js           # يحدّد proxyBase = رابط الـWorker
  games.json
  __shim.js  __capabilities.js
  vercel.json
cloudflare-worker/    # Worker البروكسي
  src/worker.js  src/shim.txt  src/capabilities.txt  src/games.json
  wrangler.toml
```

## النشر
1. **Cloudflare Worker** (مجاني):
   ```bash
   cd cloudflare-worker
   npm i -g wrangler
   export CLOUDFLARE_API_TOKEN=...   # صلاحية Workers Scripts: Edit
   export CLOUDFLARE_ACCOUNT_ID=...
   wrangler deploy
   ```
2. **اربط الواجهة**: ضع رابط الـWorker في `arcade-site/config.js` (`proxyBase`).
3. **Vercel** (مجاني): New Project → import this repo → **Root Directory = `arcade-site`** → Deploy.

## ملاحظات
- لا يعتمد على أي نطاق مخصّص (كل شيء على `vercel.app` + `workers.dev`).
- الحدود المجانية: Workers ~100k طلب/يوم، Vercel Hobby — بلا مصاريف.

## تنبيه قانوني
بعض الألعاب المُفهرسة محمية بحقوق نشر. تحقّق من الحقوق قبل أي نشر عام.
