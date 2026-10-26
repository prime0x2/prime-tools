/**
 * Temporary areas: "hide an area" and "show only an area".
 * Nothing here is saved; everything disappears on reload.
 */
import { paintStyle } from '../lib/effect';
import {
  boxToCss,
  isTooSmall,
  type Rect,
  rectFromPoints,
  spotlightBarTop,
  spotlightPanes,
} from '../lib/geometry';
import type { Mode } from '../lib/settings';
import { RESET_STYLES, setImportant, type TopLayer } from './top-layer';

export interface Areas {
  start(opts: { inverted: boolean; mode: Mode }): void;
  clear(): void;
  count(): number;
}

/** New areas start fully opaque: the safe default for hiding things. */
const DEFAULT_STRENGTH = 100;

const CSS = `
  * { box-sizing: border-box; }
  .select { position: fixed; inset: 0; cursor: crosshair; user-select: none;
    touch-action: none; background: rgba(0,0,0,.25); }
  .hint { position: fixed; top: 16px; left: 50%; transform: translateX(-50%);
    padding: 8px 14px; border-radius: 999px; background: #141414; color: #eee;
    font: 500 13px/1.3 system-ui, -apple-system, "Segoe UI", sans-serif;
    box-shadow: 0 4px 16px rgba(0,0,0,.35); pointer-events: none;
    white-space: nowrap; }
  .hint kbd { font: inherit; padding: 1px 6px; margin: 0 2px; border-radius: 4px;
    background: #2a2a2a; border: 1px solid #444; }
  .box { position: fixed; border: 1.5px solid #e8673f;
    background: rgba(232,103,63,.15); }
  .area { position: absolute; outline: 1px dashed rgba(128,128,128,.7);
    outline-offset: -1px; }
  .pane { position: fixed; }
  .bar { position: absolute; top: 4px; right: 4px; display: flex;
    align-items: center; gap: 2px; padding: 3px 4px; background: #141414;
    border: 1px solid #444; border-radius: 8px; color: #bbb;
    font: 12px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif;
    box-shadow: 0 2px 10px rgba(0,0,0,.3); opacity: 0;
    transition: opacity .15s; }
  .area:hover .bar, .bar:focus-within { opacity: 1; }
  .bar.spot { position: fixed; right: auto; opacity: .6; }
  .bar.spot:hover, .bar.spot:focus-within { opacity: 1; }
  .bar button { all: unset; padding: 2px 8px; border-radius: 5px;
    cursor: pointer; }
  .bar button:hover { color: #fff; }
  .bar button:focus-visible { outline: 2px solid #e8673f; }
  .bar button[aria-pressed="true"] { background: #333; color: #fff; }
  .bar input { width: 84px; margin: 0 6px; accent-color: #e8673f; }
  @media (prefers-reduced-motion: reduce) { .bar { transition: none; } }
`;

interface AreaState {
  mode: Mode;
  strength: number;
}

const h = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string) => {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  return el;
};

function place(el: HTMLElement, r: Rect): void {
  Object.assign(el.style, {
    left: `${r.x}px`,
    top: `${r.y}px`,
    width: `${r.w}px`,
    height: `${r.h}px`,
  });
}

function paint(el: HTMLElement, s: AreaState): void {
  const style = paintStyle(s.mode, s.strength);
  el.style.background = style.background;
  el.style.backdropFilter = style.backdropFilter;
  el.style.setProperty('-webkit-backdrop-filter', style.backdropFilter);
}

/** Dim | Blur | strength | remove */
function makeBar(
  state: AreaState,
  targets: HTMLElement[],
  onRemove: () => void,
): HTMLElement {
  const bar = h('div', 'bar');
  const button = (label: string, title: string) => {
    const b = h('button');
    b.type = 'button';
    b.textContent = label;
    b.title = title;
    return b;
  };
  const dim = button('Dim', 'Dim this area');
  const blur = button('Blur', 'Blur this area');
  const range = h('input');
  Object.assign(range, {
    type: 'range',
    min: '5',
    max: '100',
    step: '1',
    value: String(state.strength),
    title: 'Strength',
  });
  range.setAttribute('aria-label', 'Strength');
  const close = button('✕', 'Remove this area');
  close.setAttribute('aria-label', 'Remove this area');
  bar.append(dim, blur, range, close);

  const update = () => {
    for (const t of targets) paint(t, state);
    dim.setAttribute('aria-pressed', String(state.mode === 'dim'));
    blur.setAttribute('aria-pressed', String(state.mode === 'blur'));
  };
  dim.addEventListener('click', () => {
    state.mode = 'dim';
    update();
  });
  blur.addEventListener('click', () => {
    state.mode = 'blur';
    update();
  });
  range.addEventListener('input', () => {
    state.strength = Number(range.value);
    update();
  });
  close.addEventListener('click', onRemove);
  // Keep the page from reacting to clicks on our controls.
  for (const type of ['pointerdown', 'mousedown', 'click']) {
    bar.addEventListener(type, (e) => e.stopPropagation());
  }

  update();
  return bar;
}

export function createAreas(layer: TopLayer): Areas {
  const host = h('div');
  host.dataset.primeTools = 'areas';
  setImportant(host, {
    ...RESET_STYLES,
    position: 'absolute',
    inset: 'auto',
    top: '0',
    left: '0',
    width: '0',
    height: '0',
    overflow: 'visible',
  });
  // Closed shadow root: page CSS and scripts can't reach our controls.
  const root = host.attachShadow({ mode: 'closed' });
  const style = h('style');
  style.textContent = CSS;
  root.append(style);

  const hidden = new Set<HTMLElement>();
  let spot: HTMLElement | null = null;
  let cancelSelection: (() => void) | null = null;

  const sync = () => {
    if (hidden.size || spot) layer.add(host, 1);
    else layer.remove(host);
  };

  // Hide an area: attached to the page, scrolls with it.
  function hide(r: Rect, mode: Mode): void {
    const area = h('div', 'area');
    place(area, { ...r, x: r.x + scrollX, y: r.y + scrollY });
    const remove = () => {
      area.remove();
      hidden.delete(area);
      sync();
    };
    area.append(makeBar({ mode, strength: DEFAULT_STRENGTH }, [area], remove));
    root.append(area);
    hidden.add(area);
  }

  // Show only an area: a fixed window on the screen, everything else covered.
  function showOnly(r: Rect, mode: Mode): void {
    spot?.remove();
    const wrap = h('div');
    const panes = spotlightPanes(r).map((box) => {
      const pane = h('div', 'pane');
      pane.style.cssText = boxToCss(box);
      return pane;
    });
    const remove = () => {
      wrap.remove();
      spot = null;
      sync();
    };
    const bar = makeBar({ mode, strength: DEFAULT_STRENGTH }, panes, remove);
    bar.classList.add('spot');
    bar.style.left = `${Math.max(8, r.x)}px`;
    bar.style.top = `${spotlightBarTop(r)}px`;
    wrap.append(...panes, bar);
    root.append(wrap);
    spot = wrap;
  }

  /**
   * The selection layer lives in its own modal <dialog>. While a page's
   * modal dialog is open, everything outside it is inert, including
   * popovers. Being the newest modal makes ours the live one, and Esc then
   * closes our selection instead of the page's dialog.
   */
  function start({ inverted, mode }: { inverted: boolean; mode: Mode }) {
    cancelSelection?.();
    const dialog = h('dialog');
    dialog.dataset.primeTools = 'select';
    setImportant(dialog, {
      ...RESET_STYLES,
      position: 'fixed',
      inset: '0',
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      background: 'transparent',
    });
    const dialogRoot = h('div');
    setImportant(dialogRoot, {
      ...RESET_STYLES,
      width: '100%',
      height: '100%',
    });
    const shadow = dialogRoot.attachShadow({ mode: 'closed' });
    const style = h('style');
    style.textContent = CSS;
    shadow.append(style);
    dialog.append(dialogRoot);

    const layerEl = h('div', 'select');
    const box = h('div', 'box');
    const hint = h('div', 'hint');
    const kbd = h('kbd');
    kbd.textContent = 'Esc';
    hint.append(
      `Drag over the part you want to ${inverted ? 'keep visible' : 'hide'} · `,
      kbd,
      ' to cancel',
    );
    layerEl.append(hint);
    shadow.append(layerEl);

    let sx = 0;
    let sy = 0;
    let pointerId: number | null = null;

    layerEl.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || pointerId !== null) return;
      e.preventDefault();
      pointerId = e.pointerId;
      layerEl.setPointerCapture(e.pointerId);
      sx = e.clientX;
      sy = e.clientY;
      place(box, rectFromPoints(sx, sy, sx, sy));
      hint.remove();
      layerEl.append(box);
    });
    layerEl.addEventListener('pointermove', (e) => {
      if (e.pointerId === pointerId) {
        place(box, rectFromPoints(sx, sy, e.clientX, e.clientY));
      }
    });
    layerEl.addEventListener('pointerup', (e) => {
      if (e.pointerId !== pointerId) return;
      const r = rectFromPoints(sx, sy, e.clientX, e.clientY);
      stop();
      if (isTooSmall(r)) return;
      if (inverted) showOnly(r, mode);
      else hide(r, mode);
      sync();
    });
    layerEl.addEventListener('pointercancel', () => stop());
    layerEl.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      stop();
    });

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      stop();
    };
    // Esc on a modal dialog arrives as a `cancel` event.
    dialog.addEventListener('cancel', (e) => {
      e.preventDefault();
      stop();
    });
    function stop(): void {
      if (dialog.open) dialog.close();
      dialog.remove();
      document.removeEventListener('keydown', onKey, true);
      cancelSelection = null;
      sync();
    }

    document.addEventListener('keydown', onKey, true);
    document.documentElement.append(dialog);
    try {
      dialog.showModal();
    } catch {
      dialog.setAttribute('open', ''); // not modal, but still usable
    }
    cancelSelection = stop;
  }

  function clear(): void {
    cancelSelection?.();
    for (const area of hidden) area.remove();
    hidden.clear();
    spot?.remove();
    spot = null;
    sync();
  }

  return {
    start,
    clear,
    count: () => hidden.size + (spot ? 1 : 0),
  };
}
