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

## Cloud Play (Browser.lol)
Runs a game inside an isolated cloud browser on [browser.lol](https://browser.lol)
and streams its viewer back into the game page. Useful for games that refuse to
embed and for weak devices. The API key stays on the edge — it is never sent to
the browser.

Set the secret once (never commit it):
```bash
wrangler secret put BROWSER_LOL_API_KEY     # from the Browser.lol "Agents / API keys" page
wrangler secret put CLOUD_CALLBACK          # optional: URL the viewer returns to when leaving
```

Routes — every route degrades safely to `{"status":"unconfigured"}` when the key
is absent, so the site keeps working without the feature:
- `POST /cloud/start  {key, path}` → creates a session, returns `{status, vmId, shareUrl}`.
- `GET  /cloud/status?id=<vmId>` → session state.
- `POST /cloud/stop   {id}` → ends the session.
- `GET  /cloud/quota` → account session quota.

Only games present in `src/games.json` (matched by `key` + `path`) may be
launched, and a per-IP throttle caps rapid launches, so the route can never be
used as an open web proxy. The hard cap remains Browser.lol's own running-session
limit.
