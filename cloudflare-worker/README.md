# arcade-gateway (Cloudflare Worker)

A permanent proxy that serves restricted browser games: it injects the `__shim.js` script, intercepts `capabilities.js`, and fixes headers (CORS / ISO headers for SharedArrayBuffer).

## What it does
- `GET /__shim.js` → serves the spoofing shim (desktop surface + WebGL encoding).
- `GET /__capabilities.js` and `GET /games.json` → serve the resources.
- `GET /play/<key>/<...>` or `/s/<key>/<...>` → proxies to the game host for `key`.
- `/<root_mount>/...` (e.g. `/bo1z/...`) → proxies through a fixed root.
- Returned HTML is injected with `<script src="/__shim.js"></script>`.
- If the game is in `iso`, `COOP: same-origin` and `COEP: require-corp` are added (for SharedArrayBuffer).

Data (lists/roots) is read from `src/games.json`.

## Deploy
```bash
npm i -g wrangler
export CLOUDFLARE_API_TOKEN=...        # Workers Scripts: Edit
export CLOUDFLARE_ACCOUNT_ID=...
wrangler deploy                        # produces https://<worker>.<subdomain>.workers.dev
```

## Wiring the frontend
Put the Worker URL in `arcade-site/config.js`:
```js
window.ARCADE = { proxyBase: 'https://gateway.<subdomain>.workers.dev' };
```
