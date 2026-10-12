import SHIM from "./shim.txt";
import CAPS from "./capabilities.txt";
import CFG from "./games.json";

const HOSTS = CFG.hosts;
const ISO = new Set(CFG.iso || []);
const ROOT = CFG.root_mounts || {};
const SHIM_TAG = '<script src="/__shim.js"></script>';

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

function inject(html) {
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (m) => m + SHIM_TAG);
  }
  return SHIM_TAG + html;
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
        headers: { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "public, max-age=86400", ...CORS },
      });
    }

    if (path === "/__capabilities.js" || path === "/games.json") {
      const body = path === "/games.json" ? JSON.stringify(CFG) : CAPS;
      const type = path === "/games.json" ? "application/json; charset=utf-8" : "text/javascript; charset=utf-8";
      return new Response(body, { headers: { "Content-Type": type, ...CORS } });
    }

    let key = null, tail = null;

    for (const prefix of Object.keys(ROOT)) {
      if (path === prefix || path.startsWith(prefix + "/")) {
        key = ROOT[prefix];
        tail = path.slice(1);
        break;
      }
    }

    if (key === null) {
      let rest = null;
      if (path.startsWith("/play/")) rest = path.slice(6);
      else if (path.startsWith("/s/")) rest = path.slice(3);
      if (rest !== null) {
        const i = rest.indexOf("/");
        key = i < 0 ? rest : rest.slice(0, i);
        tail = i < 0 ? "" : rest.slice(i + 1);
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

    let up;
    try {
      up = await fetch(target, {
        method: request.method,
        headers: fwd,
        body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
        redirect: "follow",
      });
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
    }

    if (ctype.toLowerCase().includes("text/html")) {
      const html = await up.text();
      return new Response(inject(html), { status: up.status, headers: out });
    }

    return new Response(up.body, { status: up.status, headers: out });
  },
};
