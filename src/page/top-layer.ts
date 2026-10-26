/**
 * Keeps our overlays above everything on the page, including the browser's
 * "top layer" (modal <dialog>s, popovers and fullscreen elements), which
 * no z-index can beat.
 *
 * Each overlay is a manual popover. Whenever the page puts something new
 * into the top layer, we close and reopen ours so they're last (topmost)
 * again. If the browser lacks the Popover API, overlays fall back to the
 * maximum z-index.
 */

const canPopover =
  typeof HTMLElement !== 'undefined' &&
  typeof HTMLElement.prototype.showPopover === 'function';

export interface TopLayer {
  /** Mount `el` and keep it on top. Higher rank stacks above lower rank. */
  add(el: HTMLElement, rank: number): void;
  remove(el: HTMLElement): void;
  /** Unmount everything and stop watching the page. */
  destroy(): void;
}

/**
 * `alive` reports whether this copy of the script still belongs to a
 * running extension. After an update, Chrome leaves the old copy running on
 * open pages with a dead runtime; it must not fight the new copy over the
 * DOM, so it tears itself down the next time the page touches the top layer.
 */
export function createTopLayer(alive: () => boolean = () => true): TopLayer {
  const layers = new Map<HTMLElement, number>();
  let queued = false;

  const ours = (node: unknown): boolean =>
    node instanceof HTMLElement && layers.has(node);

  function raise(): void {
    const ordered = [...layers].sort((a, b) => a[1] - b[1]).map(([el]) => el);
    for (const el of ordered) {
      if (!el.isConnected) document.documentElement.append(el);
      if (!canPopover) continue;
      try {
        if (el.matches(':popover-open')) el.hidePopover();
        el.showPopover();
      } catch {
        // Not in a state that can show (e.g. mid-removal); z-index still applies.
      }
    }
  }

  function schedule(): void {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      if (!alive()) destroy();
      else if (layers.size) raise();
    });
  }

  // Something else entered the top layer, or the page removed our nodes.
  const observer = new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === 'attributes' && !ours(r.target)) return schedule();
      if (r.type === 'childList' && [...r.removedNodes].some(ours)) {
        return schedule();
      }
    }
  });
  const onToggle = (e: Event) => {
    if (!ours(e.target)) schedule();
  };

  function listen(on: boolean): void {
    if (on) {
      observer.observe(document.documentElement, { childList: true });
      observer.observe(document, {
        subtree: true,
        attributes: true,
        attributeFilter: ['open'],
      });
      document.addEventListener('toggle', onToggle, true);
      document.addEventListener('fullscreenchange', schedule, true);
    } else {
      observer.disconnect();
      document.removeEventListener('toggle', onToggle, true);
      document.removeEventListener('fullscreenchange', schedule, true);
    }
  }

  function destroy(): void {
    listen(false);
    for (const el of layers.keys()) el.remove();
    layers.clear();
  }

  return {
    destroy,
    add(el, rank) {
      const fresh = !layers.has(el);
      if (fresh) {
        if (canPopover) el.setAttribute('popover', 'manual');
        if (layers.size === 0) listen(true);
      }
      layers.set(el, rank);
      if (fresh) raise();
    },
    remove(el) {
      if (!layers.delete(el)) return;
      if (layers.size === 0) listen(false);
      el.remove();
    },
  };
}

/** Sets inline styles with !important so page CSS can't override them. */
export function setImportant(
  el: HTMLElement,
  styles: Record<string, string>,
): void {
  for (const [prop, value] of Object.entries(styles)) {
    el.style.setProperty(prop, value, 'important');
  }
}

/**
 * Neutralises the browser's default popover/dialog styling and any page CSS
 * that could hide, clip or distort an overlay (e.g. `div:empty {display:
 * none}` or `contain: paint`). Failing open here would reveal what the user
 * meant to hide.
 */
export const RESET_STYLES: Record<string, string> = {
  display: 'block',
  margin: '0',
  padding: '0',
  border: '0',
  'max-width': 'none',
  'max-height': 'none',
  'min-width': '0',
  'min-height': '0',
  background: 'transparent',
  color: 'inherit',
  opacity: '1',
  visibility: 'visible',
  transform: 'none',
  filter: 'none',
  'clip-path': 'none',
  mask: 'none',
  translate: 'none',
  scale: 'none',
  rotate: 'none',
  contain: 'none',
  'content-visibility': 'visible',
  'mix-blend-mode': 'normal',
  outline: 'none',
  'box-shadow': 'none',
  'z-index': '2147483647',
};
