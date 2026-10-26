import { browser } from 'wxt/browser';
import {
  connect,
  sendToPage,
  setEffect,
  type TabRef,
} from '../../lib/controller';
import { DEFAULT_EFFECT, type Effect, type Mode } from '../../lib/settings';
import { shortcutFor } from '../../lib/shortcuts';
import { getPrefs, setPrefs } from '../../lib/store';
import { classifyUrl, type Site, UNSUPPORTED_MESSAGE } from '../../lib/url';

const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;

const els = {
  app: $('app'),
  host: $('host'),
  unsupported: $('unsupported'),
  enabled: $<HTMLInputElement>('enabled'),
  strength: $<HTMLInputElement>('strength'),
  strengthValue: $<HTMLOutputElement>('strength-value'),
  autoRow: $('auto-row'),
  auto: $<HTMLInputElement>('auto'),
  autoHelp: $('auto-help'),
  privateNote: $('private-note'),
  hideArea: $<HTMLButtonElement>('hide-area'),
  showArea: $<HTMLButtonElement>('show-area'),
  clearAreas: $<HTMLButtonElement>('clear-areas'),
  settings: $<HTMLButtonElement>('settings'),
  shortcut: $('shortcut'),
};
const modeInputs = [
  ...document.querySelectorAll<HTMLInputElement>('input[name="mode"]'),
];

/** The tab the popup acts on. E2E builds can target one via `?tab=<id>`. */
async function targetTab() {
  const forced =
    import.meta.env.WXT_E2E === '1'
      ? new URLSearchParams(location.search).get('tab')
      : null;
  if (forced) return browser.tabs.get(Number(forced));
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function showUnsupported(text: string): void {
  els.app.hidden = true;
  els.unsupported.textContent = text;
  els.unsupported.hidden = false;
}

/** Coalesces slider drags into at most one write per frame-ish. */
function coalesce(fn: () => void, ms = 40) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    schedule() {
      clearTimeout(timer);
      timer = setTimeout(fn, ms);
    },
    flush() {
      clearTimeout(timer);
      fn();
    },
  };
}

async function main(): Promise<void> {
  els.settings.addEventListener('click', () => {
    browser.runtime.openOptionsPage();
    window.close();
  });
  shortcutFor('toggle-page').then((keys) => {
    if (!keys) return;
    const kbd = document.createElement('kbd');
    kbd.textContent = keys;
    els.shortcut.append(kbd, ' turns this page on or off');
  });

  const tab = await targetTab();
  const support = classifyUrl(tab?.url);
  if (!tab?.id) return showUnsupported(UNSUPPORTED_MESSAGE.internal);
  if (!support.ok) return showUnsupported(UNSUPPORTED_MESSAGE[support.reason]);
  const site: Site = support.site;
  els.host.textContent = site.host;

  const page = await connect(tab.id);
  if (!page) return showUnsupported(UNSUPPORTED_MESSAGE.blocked);
  if (page.origin === 'null') {
    return showUnsupported(UNSUPPORTED_MESSAGE.sandboxed);
  }

  const ref: TabRef = { id: tab.id, incognito: tab.incognito };
  // What the controls show. When off, they preview what "on" will apply.
  let shown: Effect =
    page.effect ?? (await getPrefs().catch(() => DEFAULT_EFFECT));
  let on = page.effect !== null;
  let areaCount = page.areas;

  const render = () => {
    els.enabled.checked = on;
    els.app.classList.toggle('off', !on);
    for (const input of modeInputs) input.checked = input.value === shown.mode;
    els.strength.value = String(shown.strength);
    els.strengthValue.textContent = `${shown.strength}%`;
    els.clearAreas.disabled = areaCount === 0;
    els.clearAreas.textContent =
      areaCount > 1 ? `Clear ${areaCount} areas` : 'Clear areas';
  };

  const commit = coalesce(() => {
    setEffect(ref, page.origin, on ? shown : null).catch(console.error);
    // Private windows still remember the last-used look, but not the site.
    if (on && ref.incognito) setPrefs(shown).catch(() => {});
  });

  const change = (next: Partial<Effect>, immediate = true) => {
    shown = { ...shown, ...next };
    on = true;
    render();
    if (immediate) commit.flush();
    else commit.schedule();
  };

  els.enabled.addEventListener('change', () => {
    on = els.enabled.checked;
    render();
    commit.flush();
  });
  for (const input of modeInputs) {
    input.addEventListener('change', () =>
      change({ mode: input.value as Mode }),
    );
  }
  els.strength.addEventListener('input', () =>
    change({ strength: Number(els.strength.value) }, false),
  );
  els.strength.addEventListener('change', () => commit.flush());

  // Auto-apply = host permission for this site, so the page script can run
  // at document_start. Private windows never save, so it's hidden there.
  if (ref.incognito) {
    els.autoRow.hidden = true;
    els.privateNote.hidden = false;
  } else {
    const origins = [site.pattern];
    els.autoHelp.textContent = `Applies your setting on ${site.host} as soon as the page starts loading.`;
    els.auto.checked = await browser.permissions.contains({ origins });
    els.auto.addEventListener('change', () => {
      // permissions.request must run synchronously inside the user gesture.
      const wanted = els.auto.checked;
      const result = wanted
        ? browser.permissions.request({ origins })
        : browser.permissions.remove({ origins }).then((removed) => !removed);
      result
        .then((granted) => {
          els.auto.checked = granted;
        })
        .catch(() => {
          els.auto.checked = !wanted;
        });
    });
  }

  const startArea = async (inverted: boolean) => {
    await sendToPage(ref.id, {
      type: 'areas:start',
      inverted,
      mode: shown.mode,
    });
    window.close(); // get out of the way so you can drag
  };
  els.hideArea.addEventListener('click', () => startArea(false));
  els.showArea.addEventListener('click', () => startArea(true));
  els.clearAreas.addEventListener('click', async () => {
    areaCount = (await sendToPage(ref.id, { type: 'areas:clear' })).areas;
    render();
  });

  render();
  els.app.hidden = false;
}

main().catch((err) => {
  console.error('[Prime Tools]', err);
  showUnsupported('Something went wrong. Reload the page and try again.');
});
