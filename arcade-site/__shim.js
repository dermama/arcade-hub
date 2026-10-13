(function () {
  try {
    var RH = window.__realHardware;
    if (!RH || !RH.shimmed) {
      RH = { cores: 0, memory: 0, touch: 0, platform: "", ua: "", coarse: false, mobile: false, shimmed: true };
      try {
        RH.cores = navigator.hardwareConcurrency || 0;
        RH.memory = navigator.deviceMemory || 0;
        RH.touch = navigator.maxTouchPoints || 0;
        RH.platform = navigator.platform || "";
        RH.ua = navigator.userAgent || "";
        try { RH.coarse = !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches); } catch (e) {}
        RH.mobile = /Mobi|Android|iPhone|iPad|Tablet/i.test(RH.ua + " " + RH.platform);
      } catch (e) {}
      window.__realHardware = RH;
    }
    var DESKTOP = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36";
    var d = function (o, k, v) { try { Object.defineProperty(o, k, { get: function () { return v; }, configurable: true }); } catch (e) {} };
    d(navigator, "userAgent", DESKTOP);
    d(navigator, "appVersion", DESKTOP.replace("Mozilla/", ""));
    d(navigator, "platform", "Win32");
    d(navigator, "vendor", "Google Inc.");
    d(navigator, "maxTouchPoints", 0);
    d(navigator, "hardwareConcurrency", 12);
    d(navigator, "deviceMemory", 16);

    var FLOOR = { 0x8DFB: 8192, 0x8DFD: 8192, 0x0D33: 16384, 0x8073: 4096, 0x8872: 32, 0x8869: 16, 0x8B4A: 32 };
    function patch(proto) {
      if (!proto || proto.__shim) return;
      proto.__shim = true;
      var orig = proto.getParameter;
      proto.getParameter = function (p) {
        var v = orig.call(this, p);
        if (Object.prototype.hasOwnProperty.call(FLOOR, p) && typeof v === "number" && v < FLOOR[p]) return FLOOR[p];
        return v;
      };
    }
    patch(window.WebGLRenderingContext && window.WebGLRenderingContext.prototype);
    patch(window.WebGL2RenderingContext && window.WebGL2RenderingContext.prototype);

    // hide cosmetic mobile warnings (non-blocking overlays)
    var CSS = "#unity-mobile-warning,#mobile-warning,.mobile-warning,#unity-warning{display:none!important}";
    try { var s = document.createElement("style"); s.textContent = CSS; (document.head || document.documentElement).appendChild(s); } catch (e) {}
  } catch (e) {}
})();
