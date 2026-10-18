// Arcade settings — the final proxy path (Cloudflare Worker).
// proxyBase: the permanent proxy address that serves games and injects the shim.
// Worker account: 92153073c9d7da3ed773791463e5c244 (workers.dev subdomain: arcade22cf2)
// Cloud Play: the same worker exposes /cloud/* which launches an isolated
// browser.lol session. Its API key lives only as the worker secret
// BROWSER_LOL_API_KEY (set with: wrangler secret put BROWSER_LOL_API_KEY).
//
// CLOUD_BOT_URL: URL of the local/remote cloud-bot relay server.
// Set this to 'http://localhost:3456' (or a deployed URL) to enable
// the Puppeteer screenshot relay (Turnstile shown to user for human solving).
// Leave empty '' to skip bot relay and fall back to the iframe method.
window.ARCADE = {
  proxyBase: 'https://gateway.arcade22cf2.workers.dev'
};
// Set your relay bot URL here (or inject it at deploy time):
window.CLOUD_BOT_URL = 'https://hannicall-google-gemma-4-31b-it.hf.space';

