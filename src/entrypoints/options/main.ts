import { browser } from 'wxt/browser';
import { formatEffect } from '../../lib/settings';
import { openShortcutSettings, prettyShortcut } from '../../lib/shortcuts';
import { forgetSites, listSites } from '../../lib/store';
import { classifyUrl, isHostPattern, patternCovers } from '../../lib/url';

const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;

const COMMAND_LABELS: Record<string, string> = {
  _execute_action: 'Open the Prime Tools popup',
  'toggle-page': 'Turn the whole-page effect on or off for this site',
};

function button(label: string, onClick: () => void, cls = 'btn') {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = cls;
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

function pill(text: string, cls = 'pill', title = ''): HTMLElement {
  const span = document.createElement('span');
  span.className = cls;
  span.textContent = text;
  if (title) span.title = title;
  return span;
}

const revoke = (pattern: string) =>
  browser.permissions.remove({ origins: [pattern] }).catch(() => false);

function row(name: string, title: string, ...cells: HTMLElement[]) {
  const li = document.createElement('li');
  const label = pill(name, 'site-name', title);
  li.append(label, ...cells);
  return li;
}

async function renderSites(): Promise<void> {
  const [sites, { origins = [] }] = await Promise.all([
    listSites(),
    browser.permissions.getAll(),
  ]);
  const rows: HTMLElement[] = [];

  for (const { origin, effect } of sites) {
    const support = classifyUrl(origin);
    const site = support.ok ? support.site : null;
    const exact = !!site && origins.includes(site.pattern);
    const broad =
      !!site && !exact && origins.some((o) => patternCovers(o, site));

    let status: HTMLElement = document.createElement('span');
    if (site && exact) {
      status = button(
        'Auto-apply on',
        () => revoke(site.pattern).then(renderSites),
        'pill on btn',
      );
      status.title = 'Click to stop applying automatically';
    } else if (site && broad) {
      status = pill(
        'On for all sites',
        'pill on',
        'Granted in your browser’s extension settings',
      );
    } else if (site) {
      status = button(
        'Allow auto-apply',
        () => {
          // Must be called directly in the click handler (user gesture).
          browser.permissions
            .request({ origins: [site.pattern] })
            .then(renderSites);
        },
        'pill btn',
      );
      status.title = 'Apply this automatically every time the page loads';
    }

    const forget = button(
      'Forget',
      async () => {
        await forgetSites([origin]);
        if (site && exact) await revoke(site.pattern);
        renderSites();
      },
      'btn ghost danger',
    );
    forget.setAttribute('aria-label', `Forget ${site?.host ?? origin}`);
    rows.push(
      row(
        site?.host ?? origin,
        origin,
        pill(formatEffect(effect)),
        status,
        forget,
      ),
    );
  }

  // Auto-apply grants for sites whose effect was turned off. Listed so they
  // can still be revoked from here.
  const used = new Set(
    sites.map((s) => {
      const support = classifyUrl(s.origin);
      return support.ok ? support.site.pattern : '';
    }),
  );
  for (const pattern of origins) {
    if (!isHostPattern(pattern) || used.has(pattern)) continue;
    const host = new URL(pattern.replace('/*', '/')).host;
    const remove = button(
      'Revoke',
      () => revoke(pattern).then(renderSites),
      'btn ghost danger',
    );
    remove.setAttribute('aria-label', `Revoke auto-apply for ${host}`);
    rows.push(
      row(
        host,
        pattern,
        pill('Effect off'),
        pill('Auto-apply on', 'pill on'),
        remove,
      ),
    );
  }

  const list = $('sites');
  list.replaceChildren(...rows);
  list.hidden = rows.length === 0;
  $('sites-empty').hidden = rows.length > 0;
  $('forget-all').hidden = rows.length === 0;
}

async function renderKeys(): Promise<void> {
  const commands = await browser.commands.getAll();
  const dl = $('keys');
  dl.replaceChildren();
  for (const c of commands) {
    if (!c.name) continue;
    const dt = document.createElement('dt');
    dt.textContent = COMMAND_LABELS[c.name] ?? c.description ?? c.name;
    const dd = document.createElement('dd');
    if (c.shortcut) {
      const kbd = document.createElement('kbd');
      kbd.textContent = prettyShortcut(c.shortcut);
      dd.append(kbd);
    } else {
      dd.textContent = 'Not set';
      dd.className = 'muted';
    }
    dl.append(dt, dd);
  }
}

$('forget-all').addEventListener('click', async () => {
  const sites = await listSites();
  await forgetSites(sites.map((s) => s.origin));
  const { origins = [] } = await browser.permissions.getAll();
  // Required (non-optional) origins can't be removed; ignore that case.
  if (origins.length) {
    await browser.permissions.remove({ origins }).catch(() => {});
  }
  renderSites();
});
$('edit-shortcuts').addEventListener('click', () => {
  openShortcutSettings().catch(console.error);
});
$('version').textContent = browser.runtime.getManifest().version;

// Re-render only for site changes, and not on every slider tick: a popup
// drag writes many times a second and re-rendering steals keyboard focus.
let pending: ReturnType<typeof setTimeout> | undefined;
browser.storage.onChanged.addListener((changes) => {
  if (!Object.keys(changes).some((k) => k.startsWith('site:'))) return;
  clearTimeout(pending);
  pending = setTimeout(renderSites, 250);
});
browser.permissions.onAdded.addListener(() => {
  renderSites();
});
browser.permissions.onRemoved.addListener(() => {
  renderSites();
});
// Shortcut changes happen in another tab; refresh when we come back.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) renderKeys();
});

renderSites();
renderKeys();
