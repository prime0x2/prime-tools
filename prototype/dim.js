// Whole-page dim/blur. Runs automatically on approved sites,
// or when injected by the popup.
if (!window.__pageDimmerLoaded) {
  window.__pageDimmerLoaded = true;

  const key = location.origin;
  let overlay = null;

  function normalize(v) {
    if (v == null) return null;
    return typeof v === "number" ? { level: v, mode: "dim" } : v;
  }

  function apply(raw) {
    const s = normalize(raw);
    if (!s || s.level >= 10) {
      overlay?.remove();
      overlay = null;
      return;
    }
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.style.cssText =
        "position:fixed !important; inset:0 !important; margin:0 !important;" +
        "pointer-events:none !important; z-index:2147483646 !important;";
    }
    const amount = 1 - s.level / 10; // 0 = nothing, 1 = maximum
    if (s.mode === "blur") {
      overlay.style.setProperty("background", "transparent", "important");
      overlay.style.setProperty("backdrop-filter", `blur(${amount * 25}px)`, "important");
    } else {
      overlay.style.setProperty("background", `rgba(0,0,0,${amount})`, "important");
      overlay.style.setProperty("backdrop-filter", "none", "important");
    }
    if (!overlay.isConnected) document.documentElement.appendChild(overlay);
  }

  chrome.storage.local.get("levels").then(({ levels = {} }) => apply(levels[key]));

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.levels) {
      apply((changes.levels.newValue || {})[key]);
    }
  });
}