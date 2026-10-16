import SHIM from "./shim.txt";
import CAPS from "./capabilities.txt";
import CFG from "./games.json";

const HOSTS = CFG.hosts;
const ISO = new Set(CFG.iso || []);
const ROOT = CFG.root_mounts || {};
const SHIM_TAG = '<script src="/__shim.js?v=36"></script>';

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,HEAD,POST,PUT,OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

function isoHeaders(key) {
  const h = {
    "Cross-Origin-Resource-Policy": "cross-origin",
    "Access-Control-Allow-Origin": "*",
  };
  if (ISO.has(key)) {
    h["Cross-Origin-Opener-Policy"] = "same-origin";
    h["Cross-Origin-Embedder-Policy"] = "require-corp";
  }
  return h;
}

function escRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function rewriteRoot(html, mount) {
  const p = mount + "/";
  const skip = escRe(mount.slice(1)) + "/";
  const attr = new RegExp('\\b(href|src|action|poster|formaction)\\s*=\\s*(["\'])\\/(?!\\/|' + skip + ')', "gi");
  html = html.replace(attr, (m, a, q) => a + "=" + q + p);
  html = html.replace(/\b(srcset|imagesrcset)\s*=\s*(["'])([^"']*)\2/gi, (m, a, q, v) => {
    return a + "=" + q + v.replace(/(^|,)(\s*)\/(?!\/)/g, (mm, sep, sp) => sep + sp + p) + q;
  });
  html = html.replace(/url\(\s*(['"]?)\/(?!\/)/gi, (m, q) => "url(" + q + p);
  html = html.replace(/(@import\s+)(['"])\/(?!\/)/gi, (m, a, q) => a + q + p);
  return html;
}

function rewriteCss(css, mount) {
  const p = mount + "/";
  css = css.replace(/url\(\s*(['"]?)\/(?!\/)/gi, (m, q) => "url(" + q + p);
  css = css.replace(/(@import\s+)(['"])\/(?!\/)/gi, (m, a, q) => a + q + p);
  return css;
}

function inject(html) {
  const metaTag = '<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">';
  const fitStyle = '<style id="arcade-game-autofit">' +
    'html,body{margin:0!important;padding:0!important;width:100%!important;height:100%!important;height:100dvh!important;overflow:hidden!important;background:#000!important;display:flex!important;align-items:center!important;justify-content:center!important}' +
    '#unity-container,#unity-container.unity-desktop,.unity-desktop,.unity-mobile,#game-container,#canvas-container,.webgl-content,#app,#root{position:absolute!important;inset:0!important;top:0!important;left:0!important;width:100%!important;height:100%!important;transform:none!important;display:flex!important;align-items:center!important;justify-content:center!important;overflow:hidden!important;margin:0!important}' +
    '#unity-canvas,canvas{width:100%!important;height:100%!important;max-width:100vw!important;max-height:100dvh!important;object-fit:contain!important;display:block!important;margin:auto!important}' +
    '#unity-footer,#unity-warning,#unity-mobile-warning{display:none!important}' +
    '</style>';

  if (/<meta[^>]+name=["']?viewport[^>]*>/i.test(html)) {
    html = html.replace(/<meta[^>]+name=["']?viewport[^>]*>/i, metaTag);
  } else {
    html = metaTag + html;
  }

  const payload = SHIM_TAG + fitStyle;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (m) => m + payload);
  }
  return payload + html;
}

const STOP = new Set(["index", "files", "assets", "static", "public", "build", "css", "js", "data", "img", "images", "game", "games", "play", "web", "dist", "media", "content", "www", "com", "net", "org", "io", "app", "config", "scripts", "json"]);

function clearTokens(u) {
  const key = u.searchParams.get("key") || "";
  const host = (u.searchParams.get("host") || "").toLowerCase().replace(/:\d+$/, "");
  const path = u.searchParams.get("path") || "";
  const root = u.searchParams.get("root") || "";
  const toks = new Set();
  for (const s of [key, host, path, root]) {
    if (!s) continue;
    let seg = s.toLowerCase().split(/[/._\-:]+/);
    for (const raw of seg) {
      const x = raw.trim();
      if (!x || x.length < 3 || STOP.has(x)) continue;
      toks.add(x);
    }
  }
  if (host) {
    const parts = host.split(".");
    if (parts.length > 2) toks.add(parts[0]); // subdomain
  }
  return Array.from(toks);
}

function clearPage(u) {
  const tokens = clearTokens(u);
  const t = JSON.stringify(tokens);
  return `<!doctype html><html lang="en" dir="ltr"><head><meta charset="utf-8"><title>…</title><style>
body{background:transparent;color:#eef1f8;font-family:system-ui,sans-serif;margin:0;padding:14px}
</style></head><body><div id="msg">Clearing game data…</div>
<script>
(function(){
  var tokens=${t};
  var res={ok:false,caches:0,idb:0,ls:0,ss:0,opfs:0,error:"none"};
  function match(s){s=String(s).toLowerCase();for(var i=0;i<tokens.length;i++){if(s.indexOf(tokens[i])>-1)return true;}return false;}
  var msgs=[];
  function done(){try{parent.postMessage({type:"arcade:clear-result",result:res},"*");}catch(e){}try{window.opener&&window.opener.postMessage({type:"arcade:clear-result",result:res},"*");}catch(e){}try{var m=document.getElementById("msg");if(m){m.textContent=res.error==="none"?"Data cleared ✓":"Clear finished (with caveats).";}}catch(e){}setTimeout(function(){try{self.close();}catch(e){}},350);}
  function p1(next){try{caches.keys().then(function(ks){if(ks&&navigator.serviceWorker&&navigator.serviceWorker.controller&&false){}for(var i=0;i<ks.length;i++){if(match(ks[i])){caches.delete(ks[i]).then(function(){res.caches++;next();});return;}}next();}).catch(function(){next();});}catch(e){res.error="caches:"+e.message;next();}}
  function p2(next){try{var db2=indexedDB.databases;if(!db2){next();return;}db2.call(indexedDB).then(function(dbs){var i=0;function step(){if(i>=dbs.length){next();return;}var d=dbs[i++];if(d&&match(d.name||"")){try{indexedDB.deleteDatabase(d.name).onsuccess=function(){res.idb++;step();};indexedDB.deleteDatabase(d.name).onerror=step;indexedDB.deleteDatabase(d.name).onblocked=step;}catch(e){step();}}else{step();}}step();}).catch(function(){next();});}catch(e){res.error="idb:"+e.message;next();}}
  function p3(next){try{var L=[window.localStorage,window.sessionStorage];for(var s=0;s<L.length;s++){for(var i=L[s].length-1;i>=0;i--){var k=L[s].key(i);if(match(k)){$:s===0?res.ls++:res.ss++;try{L[s].removeItem(k);}catch(e){}}}}next();}catch(e){res.error="stores:"+e.message;next();}}
  function p4(next){try{var st=navigator.storage;if(!st||!st.getDirectory){next();return;}st.getDirectory().then(function(root){if(!root.entries||!root.removeEntry){next();return;}var walk=[];var it=root.entries();function loop(){it.next().then(function(r){if(r.done){next();return;}var n=r.value[0];if(match(n)){root.removeEntry(n,{recursive:true}).then(function(){res.opfs++;loop();}).catch(function(){loop();});}else{loop();}});}loop();}).catch(function(){next();});}catch(e){res.error="opfs:"+e.message;next();}}
  p1(function(){p2(function(){p3(function(){p4(function(){res.ok=true;done();});});});});
})();
</script></body></html>`;
}

export default {
  async fetch(request) {
    const u = new URL(request.url);
    const path = u.pathname;

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (path === "/__shim.js") {
      return new Response(SHIM, {
        headers: { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-store", ...CORS },
      });
    }

    if (path === "/__capabilities.js" || path === "/games.json") {
      const body = path === "/games.json" ? JSON.stringify(CFG) : CAPS;
      const type = path === "/games.json" ? "application/json; charset=utf-8" : "text/javascript; charset=utf-8";
      return new Response(body, { headers: { "Content-Type": type, ...CORS } });
    }

    if (path === "/__clear") {
      return new Response(clearPage(u), {
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", ...CORS },
      });
    }

    let key = null, tail = null, mount = null;

    for (const prefix of Object.keys(ROOT)) {
      if (path === prefix || path.startsWith(prefix + "/")) {
        key = ROOT[prefix];
        tail = path.slice(1);
        mount = prefix;
        break;
      }
    }

    if (key === null) {
      let rest = null, mp = null;
      if (path.startsWith("/play/")) { rest = path.slice(6); mp = "/play/"; }
      else if (path.startsWith("/s/")) { rest = path.slice(3); mp = "/s/"; }
      if (rest !== null) {
        const i = rest.indexOf("/");
        key = i < 0 ? rest : rest.slice(0, i);
        tail = i < 0 ? "" : rest.slice(i + 1);
        mount = mp + key;
      }
    }

    if (key === null) {
      return new Response("arcade gateway: use /play/<key>/<path> or /bo1z/", {
        status: 404,
        headers: { "Content-Type": "text/plain; charset=utf-8", ...CORS },
      });
    }

    const host = HOSTS[key];
    if (!host) {
      return new Response("unknown host key", { status: 404, headers: CORS });
    }

    if (key === "velgg" && tail.replace(/\/$/, "").endsWith("capabilities.js")) {
      return new Response(CAPS, {
        headers: { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-store", ...CORS },
      });
    }

    const target = "https://" + host + "/" + tail + (u.search || "");

    const fwd = new Headers();
    for (const [k, v] of request.headers) {
      const lk = k.toLowerCase();
      if (["host", "cf-connecting-ip", "cf-ipcountry", "cf-ray", "cf-visitor", "x-forwarded-proto", "x-real-ip", "accept-encoding"].includes(lk)) continue;
      fwd.set(k, v);
    }

    const isStatic = /\.(wasm|data|unityweb|mem|pck|bin|png|jpg|jpeg|webp|gif|svg|ico|mp3|ogg|wav|ttf|woff2|woff|br|gz|framework\.js|loader\.js)$/i.test(tail);

    const fetchOptions = {
      method: request.method,
      headers: fwd,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
      redirect: "follow",
    };

    if (isStatic && request.method === "GET") {
      fetchOptions.cf = {
        cacheEverything: true,
        cacheTtl: 604800,
      };
    }

    let up;
    try {
      up = await fetch(target, fetchOptions);
    } catch (e) {
      return new Response("upstream error: " + e.message, { status: 502, headers: CORS });
    }

    const ctype = up.headers.get("content-type") || "application/octet-stream";
    const out = new Headers(up.headers);
    for (const h of ["content-security-policy", "x-frame-options", "content-encoding", "content-length"]) out.delete(h);
    out.set("Access-Control-Allow-Origin", "*");
    out.set("Cross-Origin-Resource-Policy", "cross-origin");
    if (ISO.has(key)) {
      out.set("Cross-Origin-Opener-Policy", "same-origin");
      out.set("Cross-Origin-Embedder-Policy", "require-corp");
    } else {
      out.set("Cross-Origin-Opener-Policy", "same-origin");
      out.set("Cross-Origin-Embedder-Policy", "credentialless");
    }

    const lc = ctype.toLowerCase();
    const absBase = mount && (mount.startsWith("/play/") || mount.startsWith("/s/")) ? mount : null;

    if (lc.includes("text/html")) {
      let html = await up.text();
      if (absBase) html = rewriteRoot(html, absBase);
      out.set("Cache-Control", "no-cache, no-store, must-revalidate");
      return new Response(inject(html), { status: up.status, headers: out });
    }

    if (absBase && (lc.includes("text/css") || lc.includes("css"))) {
      const css = await up.text();
      out.set("Cache-Control", "public, max-age=86400");
      return new Response(rewriteCss(css, absBase), { status: up.status, headers: out });
    }

    if (isStatic) {
      out.set("Cache-Control", "public, max-age=604800, immutable");
    }

    return new Response(up.body, { status: up.status, headers: out });
  },
};
