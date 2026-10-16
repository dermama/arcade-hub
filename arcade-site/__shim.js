// Arcade Site Hardware Profiler (for Catalog compatibility checks only)
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
    if ((RH.memory && RH.memory <= 4) || (RH.cores && RH.cores <= 4) || RH.mobile) {
      document.documentElement.classList.add("arc-low");
    }
  } catch (e) {}
})();
