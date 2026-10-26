// Temporary areas: "hide an area" or "show only an area".
// Nothing here is ever saved; everything disappears on reload.
if (!window.__pageDimmerAreas) {
  const h = (tag, cls) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
  };

  // Shadow DOM keeps the page's CSS from messing with our controls.
  const host = h("div");
  host.style.cssText =
    "position:absolute !important; top:0 !important; left:0 !important;" +
    "width:0 !important; height:0 !important; overflow:visible !important;" +
    "margin:0 !important; padding:0 !important; border:0 !important;" +
    "z-index:2147483647 !important;";
  const root = host.attachShadow({ mode: "closed" });

  const style = h("style");
  style.textContent = `
    .select { position: fixed; inset: 0; cursor: crosshair; background: rgba(0,0,0,.2); user-select: none; }
    .box { position: fixed; box-sizing: border-box; border: 1px solid #4da3ff; background: rgba(77,163,255,.15); }
    .area { position: absolute; box-sizing: border-box; outline: 1px dashed rgba(128,128,128,.6); }
    .shade { position: fixed; }
    .bar { position: absolute; top: 4px; right: 4px; display: flex; align-items: center; gap: 2px;
           padding: 3px 5px; background: #1e1e1e; border: 1px solid #555; border-radius: 6px;
           font: 12px/1.4 system-ui, sans-serif; color: #bbb; opacity: 0; transition: opacity .15s; }
    .area:hover .bar { opacity: 1; }
    .bar.spot { position: fixed; right: auto; opacity: .5; }
    .bar.spot:hover { opacity: 1; }
    .bar button { all: unset; padding: 2px 6px; border-radius: 4px; cursor: pointer; }
    .bar button:hover { color: #fff; }
    .bar button.on { background: #3a3a3a; color: #fff; }
    .bar input { width: 80px; margin: 0 4px; }
  `;
  root.append(style);
  document.documentElement.append(host);

  let cancelSelection = null;
  let spot = null;

  function paint(el, mode, level) {
    const amount = 1 - level / 10;
    el.style.background = mode === "dim" ? `rgba(0,0,0,${amount})` : "transparent";
    el.style.backdropFilter = mode === "blur" ? `blur(${amount * 25}px)` : "none";
  }

  // Small control: Dim | Blur | strength slider | remove
  function makeBar(state, targets, onRemove) {
    const bar = h("div", "bar");
    const dim = h("button");   dim.textContent = "Dim";
    const blur = h("button");  blur.textContent = "Blur";
    const range = h("input");
    Object.assign(range, { type: "range", min: 0, max: 10, step: 0.1, value: state.level });
    const close = h("button"); close.textContent = "✕"; close.title = "Remove";
    bar.append(dim, blur, range, close);

    const update = () => {
      targets.forEach((t) => paint(t, state.mode, state.level));
      dim.classList.toggle("on", state.mode === "dim");
      blur.classList.toggle("on", state.mode === "blur");
    };
    dim.onclick = () => { state.mode = "dim"; update(); };
    blur.onclick = () => { state.mode = "blur"; update(); };
    range.oninput = () => { state.level = Number(range.value); update(); };
    close.onclick = onRemove;
    bar.addEventListener("mousedown", (e) => e.stopPropagation());

    update();
    return bar;
  }

  const rectFrom = (x1, y1, x2, y2) => ({
    x: Math.min(x1, x2), y: Math.min(y1, y2),
    w: Math.abs(x2 - x1), h: Math.abs(y2 - y1),
  });

  function place(el, r) {
    Object.assign(el.style, { left: r.x + "px", top: r.y + "px", width: r.w + "px", height: r.h + "px" });
  }

  // Hide an area: sticks to the page and scrolls with it.
  function hide(r, mode) {
    const area = h("div", "area");
    place(area, { ...r, x: r.x + scrollX, y: r.y + scrollY });
    area.append(makeBar({ mode, level: 1 }, [area], () => area.remove()));
    root.append(area);
  }

  // Show only an area: a fixed "window" on the screen, everything else covered.
  function showOnly(r, mode) {
    spot?.remove();
    const wrap = h("div");
    const top = r.y, bottom = r.y + r.h, left = r.x, right = r.x + r.w;

    const parts = [
      `top:0; left:0; right:0; height:${top}px`,
      `top:${bottom}px; left:0; right:0; bottom:0`,
      `top:${top}px; left:0; width:${left}px; height:${r.h}px`,
      `top:${top}px; left:${right}px; right:0; height:${r.h}px`,
    ].map((css) => {
      const p = h("div", "shade");
      p.style.cssText = css;
      return p;
    });

    const bar = makeBar({ mode, level: 1 }, parts, () => { wrap.remove(); spot = null; });
    bar.classList.add("spot");
    bar.style.left = left + "px";
    bar.style.top = (top >= 40 ? top - 36 : bottom + 6) + "px";

    wrap.append(...parts, bar);
    root.append(wrap);
    spot = wrap;
  }

  function start({ inverted, mode }) {
    cancelSelection?.();
    const layer = h("div", "select");
    const box = h("div", "box");
    let sx = 0, sy = 0, dragging = false;

    layer.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      sx = e.clientX; sy = e.clientY; dragging = true;
      place(box, rectFrom(sx, sy, sx, sy));
      layer.append(box);
    });
    layer.addEventListener("mousemove", (e) => {
      if (dragging) place(box, rectFrom(sx, sy, e.clientX, e.clientY));
    });
    layer.addEventListener("mouseup", (e) => {
      if (!dragging) return;
      const r = rectFrom(sx, sy, e.clientX, e.clientY);
      stop();
      if (r.w < 5 || r.h < 5) return; // ignore accidental clicks
      inverted ? showOnly(r, mode) : hide(r, mode);
    });

    const onKey = (e) => { if (e.key === "Escape") stop(); };
    function stop() {
      layer.remove();
      document.removeEventListener("keydown", onKey, true);
      cancelSelection = null;
    }

    document.addEventListener("keydown", onKey, true);
    root.append(layer);
    cancelSelection = stop;
  }

  function clear() {
    cancelSelection?.();
    spot = null;
    root.replaceChildren(style);
  }

  window.__pageDimmerAreas = { start, clear };
}