/**
 * Renders the store listing assets from the real extension:
 *   docs/store/01-dim.png … 04-settings.png   1280×800 screenshots
 *   docs/store/promo-440x280.png               Chrome small promo tile
 *   docs/store/marquee-1400x560.png            Chrome marquee (optional)
 *
 * Demo pages live in scripts/store/ (made-up content, no real brands).
 * The popup can't be captured in place (it's browser UI), so it's rendered
 * as a tab and composited where the real popup would open.
 *
 *   pnpm build:store
 */
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const EXT = join(ROOT, '.output/chrome-mv3-e2e');
const OUT = join(ROOT, 'docs/store');
const SITE = 'http://demo.test';
const W = 1280;
const H = 800;

const dataUrl = (buf) => `data:image/png;base64,${buf.toString('base64')}`;

const profile = await mkdtemp(join(tmpdir(), 'prime-tools-store-'));
const context = await chromium.launchPersistentContext(profile, {
  channel: 'chromium',
  viewport: { width: W, height: H },
  deviceScaleFactor: 1,
  colorScheme: 'light',
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
});
await context.route(`${SITE}/**`, async (route) => {
  const name = new URL(route.request().url()).pathname.slice(1) || 'article';
  const body = await readFile(join(ROOT, 'scripts/store', `${name}.html`));
  await route.fulfill({ contentType: 'text/html', body });
});

const worker =
  context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
const extId = new URL(worker.url()).host;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const setSite = (effect) =>
  worker.evaluate(
    ([key, value]) =>
      value
        ? chrome.storage.local.set({ [key]: value })
        : chrome.storage.local.remove(key),
    [`site:${SITE}`, effect],
  );

const tabIdOf = (page) =>
  worker.evaluate(
    async (u) => (await chrome.tabs.query({})).find((t) => t.url === u)?.id,
    page.url(),
  );

async function popupShot(page) {
  const popup = await context.newPage();
  await popup.setViewportSize({ width: 400, height: 700 });
  await popup.goto(
    `chrome-extension://${extId}/popup.html?tab=${await tabIdOf(page)}`,
  );
  await popup.waitForSelector('#app:not([hidden])');
  await sleep(200);
  // The real popup sizes to the body (300px + padding).
  const { width, height } = await popup.evaluate(() => {
    const r = document.body.getBoundingClientRect();
    return { width: Math.ceil(r.width), height: Math.ceil(r.height) };
  });
  const shot = await popup.screenshot({ clip: { x: 0, y: 0, width, height } });
  await popup.close();
  return shot;
}

async function drag(page, inverted, mode, r) {
  await worker.evaluate(
    ([id, msg]) => chrome.tabs.sendMessage(id, msg),
    [await tabIdOf(page), { type: 'areas:start', inverted, mode }],
  );
  await page.bringToFront();
  await page.mouse.move(r.x, r.y);
  await page.mouse.down();
  await page.mouse.move(r.x + r.w, r.y + r.h, { steps: 6 });
  await page.mouse.up();
}

/** Page shot + optional popup under a mock toolbar, at exactly W×H. */
async function compose(file, pageShot, popup) {
  const frame = await context.newPage();
  await frame.setViewportSize({ width: W, height: H });
  await frame.setContent(`<!doctype html><html><body style="margin:0;width:${W}px;height:${H}px;overflow:hidden;position:relative">
    <img src="${dataUrl(pageShot)}" style="position:absolute;inset:0;width:${W}px;height:${H}px">
    ${
      popup
        ? `<img src="${dataUrl(popup)}" style="position:absolute;top:10px;right:18px;border-radius:10px;
            box-shadow:0 12px 40px rgba(0,0,0,.28),0 0 0 1px rgba(0,0,0,.08)">`
        : ''
    }
  </body></html>`);
  await frame.screenshot({ path: join(OUT, file) });
  await frame.close();
  console.log(`docs/store/${file}`);
}

const page = await context.newPage();

// 1. Whole page dimmed, popup open
await setSite({ mode: 'dim', strength: 45 });
await page.goto(`${SITE}/article`);
await sleep(300);
await compose('01-dim.png', await page.screenshot(), await popupShot(page));

// 2. Dashboard with keys hidden
await setSite(null);
await page.goto(`${SITE}/dashboard`);
await sleep(300);
const cells = await page.evaluate(() =>
  [...document.querySelectorAll('td code')].map((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x - 4, y: r.y - 4, w: r.width + 8, h: r.height + 8 };
  }),
);
const keys = {
  x: cells[0].x,
  y: cells[0].y,
  w: Math.max(...cells.map((c) => c.w)),
  h: cells[2].y + cells[2].h - cells[0].y,
};
await drag(page, false, 'dim', keys);
const env = await page.evaluate(() => {
  const r = document.querySelector('.env').getBoundingClientRect();
  return { x: r.x + 160, y: r.y + 30, w: r.width - 180, h: r.height - 38 };
});
await drag(page, false, 'blur', env);
await page.mouse.move(keys.x + keys.w / 2, keys.y + keys.h / 2);
await sleep(400);
const dashShot = await page.screenshot();
await compose('02-hide-areas.png', dashShot, await popupShot(page));

// 3. Show only one paragraph
await worker.evaluate(
  ([id]) => chrome.tabs.sendMessage(id, { type: 'areas:clear' }),
  [await tabIdOf(page)],
);
await page.goto(`${SITE}/article`);
await sleep(300);
const para = await page.evaluate(() => {
  const r = document.querySelectorAll('article p')[1].getBoundingClientRect();
  return { x: r.x - 14, y: r.y - 10, w: r.width + 28, h: r.height + 20 };
});
await drag(page, true, 'dim', para);
await page.mouse.move(W - 40, H - 40);
await sleep(300);
await worker.evaluate(() => {}); // keep the worker warm
await compose('03-show-only.png', await page.screenshot());

// 4. Settings
await worker.evaluate(() =>
  chrome.storage.local.set({
    'site:https://news.example.com': { mode: 'dim', strength: 40 },
    'site:https://console.example.dev': { mode: 'blur', strength: 80 },
    'site:http://localhost:3000': { mode: 'dim', strength: 25 },
  }),
);
const options = await context.newPage();
await options.goto(`chrome-extension://${extId}/options.html`);
await sleep(400);
await compose('04-settings.png', await options.screenshot());

// Promo tiles
const icon = await readFile(join(ROOT, 'public/icon/128.png'));
for (const [w, h] of [
  [440, 280],
  [1400, 560],
]) {
  const tile = await context.newPage();
  await tile.setViewportSize({ width: w, height: h });
  const html = await readFile(join(ROOT, 'scripts/store/promo.html'), 'utf8');
  await tile.setContent(
    html.replace('<body>', `<body style="--w:${w}px;--h:${h}px">`),
  );
  await tile.evaluate((src) => {
    document.getElementById('icon').src = src;
  }, dataUrl(icon));
  await sleep(200);
  const name = w === 440 ? 'promo-440x280.png' : 'marquee-1400x560.png';
  await tile.screenshot({ path: join(OUT, name) });
  console.log(`docs/store/${name}`);
  await tile.close();
}

await context.close();
await rm(profile, { recursive: true, force: true });
