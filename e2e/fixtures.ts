/**
 * Fixtures: a fresh Chromium profile per test with the E2E build loaded,
 * a fake site at http://prime.test, and helpers to drive the popup.
 */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type BrowserContext,
  test as base,
  chromium,
  type Page,
  type Worker,
} from '@playwright/test';
import { onePixel } from './png';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXTENSION_DIR = resolve(__dirname, '../.output/chrome-mv3-e2e');

export const SITE = 'http://prime.test';

/** White, tall page with a modal dialog, so scrolling and top layer matter. */
const HTML = `<!doctype html>
<html><head><style>
  html, body { margin: 0; background: #fff; }
  .tall { height: 3000px; }
  dialog { border: 0; padding: 0; width: 200px; height: 120px; background: #fff; }
  dialog::backdrop { background: transparent; }
</style></head>
<body><div class="tall"></div><dialog id="d">secret</dialog></body></html>`;

const HOSTILE_CSS = `
  div:empty { display: none !important; }
  div, dialog { contain: paint !important; opacity: .01 !important;
    transform: scale(0) !important; mix-blend-mode: difference !important; }
  [popover] { display: none !important; }`;

type Fixtures = {
  context: BrowserContext;
  worker: Worker;
  extensionId: string;
  site: Page;
  openPopup: (target: Page) => Promise<Page>;
  pixel: (
    page: Page,
    x: number,
    y: number,
  ) => Promise<[number, number, number]>;
};

export const test = base.extend<Fixtures>({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright fixture signature.
  context: async ({}, use) => {
    const profile = await mkdtemp(join(tmpdir(), 'prime-tools-e2e-'));
    const context = await chromium.launchPersistentContext(profile, {
      channel: 'chromium',
      viewport: { width: 1000, height: 700 },
      deviceScaleFactor: 1,
      args: [
        `--disable-extensions-except=${EXTENSION_DIR}`,
        `--load-extension=${EXTENSION_DIR}`,
      ],
    });
    await context.route(`${SITE}/**`, (route) => {
      // /hostile adds page CSS that tries to hide or clip our overlays.
      const hostile = new URL(route.request().url()).pathname === '/hostile';
      const body = hostile
        ? HTML.replace('</style>', `${HOSTILE_CSS}</style>`)
        : HTML;
      return route.fulfill({ contentType: 'text/html', body });
    });
    await use(context);
    await context.close();
    await rm(profile, { recursive: true, force: true });
  },

  worker: async ({ context }, use) => {
    const worker =
      context.serviceWorkers()[0] ??
      (await context.waitForEvent('serviceworker'));
    // Wait for onInstalled to register the page script on <all_urls>.
    await worker.evaluate(async () => {
      for (let i = 0; i < 50; i++) {
        const scripts = await chrome.scripting.getRegisteredContentScripts();
        if (scripts.length) return;
        await new Promise((r) => setTimeout(r, 100));
      }
      throw new Error('page script never registered');
    });
    await use(worker);
  },

  extensionId: async ({ worker }, use) => {
    await use(new URL(worker.url()).host);
  },

  site: async ({ context, worker }, use) => {
    void worker;
    const page = await context.newPage();
    await page.goto(`${SITE}/`);
    await use(page);
  },

  openPopup: async ({ context, worker, extensionId }, use) => {
    await use(async (target) => {
      const url = target.url();
      const tabId = await worker.evaluate(async (u) => {
        const tabs = await chrome.tabs.query({});
        // Pages we have no host access to (about:blank) report no URL;
        // fall back to the newest tab, which is the one just opened.
        const match = tabs.find((t) => t.url === u);
        return match?.id ?? Math.max(...tabs.map((t) => t.id ?? 0));
      }, url);
      const popup = await context.newPage();
      await popup.goto(
        `chrome-extension://${extensionId}/popup.html?tab=${tabId}`,
      );
      return popup;
    });
  },

  // biome-ignore lint/correctness/noEmptyPattern: Playwright fixture signature.
  pixel: async ({}, use) => {
    await use(async (page, x, y) =>
      onePixel(await page.screenshot({ clip: { x, y, width: 1, height: 1 } })),
    );
  },
});

export { expect } from '@playwright/test';
