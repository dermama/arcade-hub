// Arcade settings — the final proxy path (Cloudflare Worker).
// proxyBase: the permanent proxy address that serves games and injects the shim.
// Worker account: 92153073c9d7da3ed773791463e5c244 (workers.dev subdomain: arcade22cf2)
// Cloud Play: the same worker exposes /cloud/* which launches an isolated
// browser.lol session. Its API key lives only as the worker secret
// BROWSER_LOL_API_KEY (set with: wrangler secret put BROWSER_LOL_API_KEY).
window.ARCADE = {
  proxyBase: 'https://gateway.arcade22cf2.workers.dev'
};
