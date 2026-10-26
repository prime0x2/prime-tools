/**
 * The in-page script. Runs automatically (at document_start) on sites where
 * the user allowed auto-apply, or is injected by the popup / shortcut.
 */
import { browser } from 'wxt/browser';
import { defineUnlistedScript } from 'wxt/utils/define-unlisted-script';
import type {
  BackgroundRequest,
  PageRequest,
  PageState,
} from '../lib/messages';
import { parseEffect, siteKey } from '../lib/settings';
import { createAreas } from '../page/areas';
import { createShade } from '../page/shade';
import { createTopLayer } from '../page/top-layer';

interface Instance {
  alive(): boolean;
  destroy(): void;
}

declare global {
  var __primeTools: Instance | undefined;
}

/** False once this copy's extension was updated, reloaded or removed. */
const alive = (): boolean => {
  try {
    return !!browser.runtime?.id;
  } catch {
    return false;
  }
};

export default defineUnlistedScript(() => {
  // SVG/XML documents can't host our HTML overlays.
  if (!(document.documentElement instanceof HTMLHtmlElement)) return;

  // The popup re-injects on every open; a live copy keeps running. A dead
  // copy (left on the page by an extension update) is replaced, along with
  // any overlays it left behind, so they can be turned off again.
  const previous = globalThis.__primeTools;
  if (previous) {
    let ok = false;
    try {
      ok = previous.alive();
    } catch {}
    if (ok) return;
    try {
      previous.destroy();
    } catch {}
  }
  for (const el of document.querySelectorAll('[data-prime-tools]')) {
    el.remove();
  }

  // Sandboxed pages all share the opaque origin "null"; never save for them.
  const saves = location.origin !== 'null';
  const key = siteKey(location.origin);
  const layer = createTopLayer(alive);
  const shade = createShade(layer);
  const areas = createAreas(layer);
  // A private-window override. While set, saved settings are ignored.
  let temporary = false;

  const reportBadge = () => {
    const msg: BackgroundRequest = { type: 'badge', on: shade.get() !== null };
    browser.runtime.sendMessage(msg).catch(() => {});
  };
  const apply = (raw: unknown) => {
    shade.apply(parseEffect(raw));
    reportBadge();
  };
  // The background clears the badge when a load starts, which can land after
  // our first report; report again once the page is shown.
  addEventListener('pageshow', reportBadge);

  const ready = saves
    ? browser.storage.local
        .get(key)
        .then((stored) => {
          if (!temporary) apply(stored[key]);
        })
        .catch(() => {})
    : Promise.resolve();

  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && saves && key in changes && !temporary) {
      apply(changes[key]?.newValue);
    }
  });

  const state = (): PageState => ({
    origin: location.origin,
    effect: shade.get(),
    temporary,
    areas: areas.count(),
  });

  const handle = async (msg: PageRequest): Promise<PageState> => {
    switch (msg.type) {
      case 'page:get':
        await ready;
        break;
      case 'page:set-temporary':
        temporary = true;
        apply(msg.effect);
        break;
      case 'areas:start':
        areas.start({ inverted: msg.inverted, mode: msg.mode });
        break;
      case 'areas:clear':
        areas.clear();
        break;
    }
    return state();
  };

  // sendResponse + `return true` rather than returning a Promise: Chrome
  // only learned promise-returning listeners recently.
  browser.runtime.onMessage.addListener((raw, _sender, sendResponse) => {
    const msg = raw as PageRequest;
    if (!msg?.type?.startsWith('page:') && !msg?.type?.startsWith('areas:')) {
      return false;
    }
    handle(msg).then(sendResponse);
    return true;
  });

  globalThis.__primeTools = {
    alive,
    destroy() {
      areas.clear();
      layer.destroy();
    },
  };
});
