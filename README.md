# arcade-hub

A standalone browser games gateway — **completely free, no custom domain required**.
- The **frontend** (`arcade-site/`) is deployed to **Vercel** by importing this repository (Root Directory = `arcade-site`).
- The **proxy** (`cloudflare-worker/`) is deployed to **Cloudflare Workers** (`*.workers.dev`).

## Structure
```
arcade-site/          # static Vercel site
  index.html
  styles.css
  app.js              # player experience: identity, favorites, continue, personal link ?p=PID
  config.js           # sets proxyBase = the Worker URL
  games.json
  __shim.js  __capabilities.js
  vercel.json
cloudflare-worker/    # proxy Worker
  src/worker.js  src/shim.txt  src/capabilities.txt  src/games.json
  wrangler.toml
```

## Deploy
1. **Cloudflare Worker** (free):
   ```bash
   cd cloudflare-worker
   npm i -g wrangler
   export CLOUDFLARE_API_TOKEN=...   # Workers Scripts: Edit permission
   export CLOUDFLARE_ACCOUNT_ID=...
   wrangler deploy
   ```
2. **Wire the frontend**: put the Worker URL in `arcade-site/config.js` (`proxyBase`).
3. **Vercel** (free): New Project → import this repo → **Root Directory = `arcade-site`** → Deploy.

## Notes
- No custom domain required (everything runs on `vercel.app` + `workers.dev`).
- Free tiers: Workers ~100k requests/day, Vercel Hobby — no cost.

## Legal notice
Some indexed games are protected by copyright. Verify rights before any public deployment.
