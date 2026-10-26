/**
 * Firefox smoke test. Loads the E2E build into a real Firefox over
 * WebDriver BiDi (puppeteer-core) and checks rendered pixels / hit testing.
 *
 *   pnpm test:e2e:firefox
 *   FIREFOX_BIN=/path/to/firefox pnpm test:e2e:firefox
 *
 * Firefox automation quirks this works around:
 * - it can't navigate to moz-extension:// URLs, so the E2E build opens its
 *   options page itself (see background.ts) and we drive that tab;
 * - extension pages need MOZ_REMOTE_ALLOW_SYSTEM_ACCESS=1 to be scriptable;
 * - screenshot clips are document-relative, so scroll checks use
 *   elementFromPoint instead.
 */
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { inflateSync } from 'node:zlib';
import puppeteer from 'puppeteer-core';

const EXT = new URL('../.output/firefox-mv3-e2e', import.meta.url).pathname;
const FIREFOX =
  process.env.FIREFOX_BIN ??
  [
    '/Applications/Firefox.app/Contents/MacOS/firefox',
    '/Applications/Firefox Developer Edition.app/Contents/MacOS/firefox',
    '/Applications/Firefox Nightly.app/Contents/MacOS/firefox',
  ].find(existsSync) ??
  'firefox';
const UUID = '0b7c1d7e-6a51-4d1f-9a43-2f6f0e3c9a11';
const ID = 'prime-tools@prime0x2';

const HTML = `<!doctype html><html><head><style>
html,body{margin:0;background:#fff}.tall{height:3000px}
dialog{border:0;padding:0;width:200px;height:120px;background:#fff}
dialog::backdrop{background:transparent}</style></head>
<body><div class="tall"></div><dialog id="d">x</dialog></body></html>`;
const server = createServer((_, res) => {
  res.setHeader('content-type', 'text/html');
  res.end(HTML);
}).listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
const SITE = `http://127.0.0.1:${server.address().port}`;

function onePixel(png) {
  let o = 8;
  const idat = [];
  while (o < png.length) {
    const len = png.readUInt32BE(o),
      type = png.toString('ascii', o + 4, o + 8);
    const d = png.subarray(o + 8, o + 8 + len);
    if (type === 'IDAT') idat.push(d);
    o += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  return [raw[1], raw[2], raw[3]].join(',');
}
const px = async (page, x, y) =>
  onePixel(
    Buffer.from(await page.screenshot({ clip: { x, y, width: 1, height: 1 } })),
  );

const results = [];
const check = (name, ok, detail = '') => {
  results.push(
    `${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`,
  );
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  browser: 'firefox',
  executablePath: FIREFOX,
  headless: true,
  args: ['--new-instance', '-no-remote'],
  env: { ...process.env, MOZ_REMOTE_ALLOW_SYSTEM_ACCESS: '1' },
  defaultViewport: { width: 1000, height: 700, deviceScaleFactor: 1 },
  extraPrefsFirefox: {
    'extensions.webextensions.uuids': JSON.stringify({ [ID]: UUID }),
  },
});

try {
  await browser.installExtension(EXT);
  const base = `moz-extension://${UUID}`;

  // The E2E build opens its options page on install; that page gives us
  // the `browser` API for setup and inspection.
  const findPage = async (prefix) => {
    for (let i = 0; i < 50; i++) {
      for (const pg of await browser.pages()) {
        // BiDi reports extension tabs as about:blank; ask the page itself.
        const href = await pg.evaluate(() => location.href).catch(() => '');
        if (href.startsWith(prefix)) return pg;
      }
      await sleep(100);
    }
    throw new Error(`no page ${prefix}`);
  };
  const ext = await findPage(`${base}/options.html`);
  const run = (fn, ...args) => ext.evaluate(fn, ...args);

  // Wait for the background to register the page script.
  let registered = 0;
  for (let i = 0; i < 50 && !registered; i++) {
    registered = await run(
      async () =>
        (await browser.scripting.getRegisteredContentScripts()).length,
    );
    if (!registered) await sleep(100);
  }
  check('background registers page script', registered > 0);

  // 1. Saved effect applies on load
  await run(
    (k) => browser.storage.local.set({ [k]: { mode: 'dim', strength: 100 } }),
    `site:${SITE}`,
  );
  const site = await browser.newPage();
  await site.goto(`${SITE}/`);
  await sleep(500);
  check(
    'auto-applies saved dim on load',
    (await px(site, 500, 350)) === '0,0,0',
    await px(site, 500, 350),
  );
  const inTop = await site.evaluate(() =>
    document
      .querySelector('[data-prime-tools="shade"]')
      ?.matches(':popover-open'),
  );
  check('overlay is in the top layer', inTop === true);

  // 2. Above a modal dialog
  await site.evaluate(() => document.getElementById('d').showModal());
  await sleep(300);
  check(
    'stays above modal dialog',
    (await px(site, 500, 350)) === '0,0,0',
    await px(site, 500, 350),
  );
  await site.evaluate(() => document.getElementById('d').close());

  // 3. Live update via storage → blur
  await run(
    (k) => browser.storage.local.set({ [k]: { mode: 'blur', strength: 50 } }),
    `site:${SITE}`,
  );
  await sleep(300);
  const bf = await site.evaluate(
    () =>
      getComputedStyle(document.querySelector('[data-prime-tools="shade"]'))
        .backdropFilter,
  );
  check('live switch to blur', bf === 'blur(12px)', bf);
  await run((k) => browser.storage.local.remove(k), `site:${SITE}`);
  await sleep(300);
  check(
    'turning off removes overlay',
    (await px(site, 500, 350)) === '255,255,255',
  );

  // 4. Popup drives the page (popup opened as a tab, targeted with ?tab=)
  const tabId = await run(
    async (u) =>
      (await browser.tabs.query({})).find((t) => t.url?.startsWith(u))?.id,
    SITE,
  );
  await run(
    (id) =>
      browser.tabs.create({
        url: browser.runtime.getURL(`/popup.html?tab=${id}`),
      }),
    tabId,
  );
  const popup = await findPage(`${base}/popup.html`);
  await popup.waitForSelector('#app:not([hidden])', { timeout: 5000 });
  const host = await popup.$eval('#host', (e) => e.textContent);
  check('popup connects to the page', host === new URL(SITE).host, host);
  await popup.click('.switch');
  await sleep(400);
  const saved = await run(
    (k) => browser.storage.local.get(k).then((s) => s[k]),
    `site:${SITE}`,
  );
  check(
    'popup switch saves per site',
    saved?.mode === 'dim',
    JSON.stringify(saved),
  );
  await site.bringToFront();
  const dimPx = await px(site, 500, 350);
  check('popup switch dims the page', dimPx !== '255,255,255', dimPx);
  await popup.evaluate(() => document.querySelector('#enabled').click());
  await sleep(300);

  // 5. Hide an area via popup, then drag on the page
  await popup
    .evaluate(() => document.querySelector('#hide-area').click())
    .catch(() => {}); // popup closes itself
  await site.bringToFront();
  await sleep(200);
  await site.mouse.move(100, 100);
  await site.mouse.down();
  await site.mouse.move(200, 150, { steps: 3 });
  await site.mouse.move(300, 200, { steps: 3 });
  await site.mouse.up();
  await sleep(200);
  check(
    'hide area covers region',
    (await px(site, 200, 150)) === '0,0,0',
    await px(site, 200, 150),
  );
  check(
    'hide area leaves rest visible',
    (await px(site, 600, 400)) === '255,255,255',
  );
  await site.evaluate(() => scrollTo(0, 80));
  await sleep(200);
  // elementFromPoint takes viewport coordinates (screenshot clips in
  // Firefox BiDi are document-relative, so they can't test this).
  const at = (x, y) =>
    site.evaluate(
      (a, b) => document.elementFromPoint(a, b)?.dataset?.primeTools ?? 'page',
      x,
      y,
    );
  check(
    'hide area scrolls with page',
    (await at(200, 75)) === 'areas',
    await at(200, 75),
  );
  check(
    'area moved off old spot',
    (await at(200, 190)) === 'page',
    await at(200, 190),
  );

  // 6. Clear areas via messaging (same path as the popup button)
  const cleared = await run(
    (id) => browser.tabs.sendMessage(id, { type: 'areas:clear' }),
    tabId,
  );
  await sleep(200);
  check(
    'clear areas',
    cleared?.areas === 0 && (await px(site, 200, 75)) === '255,255,255',
  );

  // 6b. Areas over a page's modal dialog; Esc must not close the page's dialog
  await site.evaluate(() => {
    scrollTo(0, 0);
    document.getElementById('d').showModal();
  });
  await run(
    (id) =>
      browser.tabs.sendMessage(id, {
        type: 'areas:start',
        inverted: false,
        mode: 'dim',
      }),
    tabId,
  );
  await sleep(200);
  await site.mouse.move(420, 300);
  await site.mouse.down();
  await site.mouse.move(500, 350, { steps: 3 });
  await site.mouse.move(580, 400, { steps: 3 });
  await site.mouse.up();
  await sleep(200);
  // Scrolled to top, so document-relative clips equal the viewport here.
  check(
    'area drawn over a modal dialog',
    (await px(site, 500, 350)) === '0,0,0',
    await px(site, 500, 350),
  );
  await run(
    (id) =>
      browser.tabs.sendMessage(id, {
        type: 'areas:start',
        inverted: false,
        mode: 'dim',
      }),
    tabId,
  );
  await sleep(200);
  await site.keyboard.press('Escape');
  await sleep(200);
  check(
    'Esc keeps the page dialog open',
    await site.evaluate(() => document.getElementById('d').open),
  );
  await site.evaluate(() => document.getElementById('d').close());
  await run(
    (id) => browser.tabs.sendMessage(id, { type: 'areas:clear' }),
    tabId,
  );

  // 7. Re-injection is a no-op (popup injects on every open)
  await run(
    (id) =>
      browser.scripting.executeScript({
        target: { tabId: id },
        files: ['/page.js'],
      }),
    tabId,
  );
  const shades = await site.evaluate(
    () => document.querySelectorAll('[data-prime-tools]').length,
  );
  check('re-injection does not duplicate', shades === 0, `${shades} nodes`);

  // 8. Options page lists sites
  await run(
    (k) => browser.storage.local.set({ [k]: { mode: 'blur', strength: 40 } }),
    `site:${SITE}`,
  );
  await ext.evaluate(() => location.reload());
  await sleep(500);
  await ext.waitForSelector('.sites li', { timeout: 5000 });
  const row = await ext.$eval('.sites li', (e) => e.textContent);
  check(
    'options lists remembered site',
    row.includes('Blur 40%'),
    row.trim().replace(/\s+/g, ' '),
  );

  // 9. Shortcuts are registered
  const cmds = await run(async () =>
    (await browser.commands.getAll()).map((c) => `${c.name}=${c.shortcut}`),
  );
  check('commands registered', cmds.length === 2, cmds.join(' '));
} catch (err) {
  check('script error', false, String(err?.stack ?? err));
} finally {
  await browser.close();
  server.close();
}
console.log(results.join('\n'));
process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
