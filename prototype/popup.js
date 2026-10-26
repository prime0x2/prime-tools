const $ = (id) => document.getElementById(id);
let tab, origin, levels = {};
let state = { level: 10, mode: "dim" };

// v1 stored plain numbers; v2 stores { level, mode }.
function normalize(v) {
  if (v == null) return null;
  return typeof v === "number" ? { level: v, mode: "dim" } : v;
}

function render() {
  $("level").value = state.level;
  $("value").textContent = state.level.toFixed(1);
  $("modeDim").classList.toggle("on", state.mode === "dim");
  $("modeBlur").classList.toggle("on", state.mode === "blur");
}

function save() {
  if (state.level >= 10) delete levels[origin];
  else levels[origin] = { ...state };
  chrome.storage.local.set({ levels });
}

function disable(text) {
  document.querySelectorAll("input, button").forEach((el) => (el.disabled = true));
  $("msg").textContent = text;
  $("msg").hidden = false;
}

function run(opts) {
  return chrome.scripting.executeScript({ target: { tabId: tab.id }, ...opts });
}

(async () => {
  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  let url;
  try { url = new URL(tab.url); } catch {}
  if (!url || !/^https?:$/.test(url.protocol)) return disable("This page can't be dimmed.");

  origin = url.origin;                                  // e.g. http://localhost:3000
  const pattern = `${url.protocol}//${url.hostname}/*`; // permission pattern (no port)

  try { await run({ files: ["dim.js"] }); }
  catch { return disable("This page can't be dimmed."); }

  ({ levels = {} } = await chrome.storage.local.get("levels"));
  state = normalize(levels[origin]) ?? state;
  render();

  // Whole page
  $("level").addEventListener("input", () => { state.level = Number($("level").value); render(); save(); });
  $("modeDim").addEventListener("click", () => { state.mode = "dim"; render(); save(); });
  $("modeBlur").addEventListener("click", () => { state.mode = "blur"; render(); save(); });

  $("keep").hidden = await chrome.permissions.contains({ origins: [pattern] });
  $("keep").addEventListener("click", async () => {
    if (await chrome.permissions.request({ origins: [pattern] })) $("keep").hidden = true;
  });

  // Areas (temporary)
  async function startArea(inverted) {
    await run({ files: ["area.js"] });
    await run({ func: (o) => window.__pageDimmerAreas.start(o), args: [{ inverted, mode: state.mode }] });
    window.close(); // get the popup out of the way so you can drag
  }
  $("hideArea").addEventListener("click", () => startArea(false));
  $("showArea").addEventListener("click", () => startArea(true));
  $("clearAreas").addEventListener("click", () => run({ func: () => window.__pageDimmerAreas?.clear() }));
})();