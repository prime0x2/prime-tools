import { effectStyle } from '../lib/effect';
import type { Effect } from '../lib/settings';
import { RESET_STYLES, setImportant, type TopLayer } from './top-layer';

export interface Shade {
  get(): Effect | null;
  apply(effect: Effect | null): void;
}

/** The whole-page dim/blur overlay. Never intercepts clicks. */
export function createShade(layer: TopLayer): Shade {
  const el = document.createElement('div');
  el.dataset.primeTools = 'shade';
  el.setAttribute('aria-hidden', 'true');
  setImportant(el, {
    ...RESET_STYLES,
    position: 'fixed',
    inset: '0',
    width: 'auto',
    height: 'auto',
    overflow: 'hidden',
    'pointer-events': 'none',
    'z-index': '2147483646',
  });

  let current: Effect | null = null;

  return {
    get: () => current,
    apply(effect) {
      current = effect;
      if (!effect) {
        layer.remove(el);
        return;
      }
      const style = effectStyle(effect);
      setImportant(el, {
        background: style.background,
        'backdrop-filter': style.backdropFilter,
        '-webkit-backdrop-filter': style.backdropFilter,
      });
      layer.add(el, 0);
    },
  };
}
