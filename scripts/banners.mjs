/**
 * Renders the repo banners from scripts/store/banners.html (designed in
 * Claude Design), one PNG per artboard:
 *   docs/banners/hero-dark.png, hero-light.png       README hero, 2x
 *   docs/banners/social-dark.png, social-light.png   GitHub social preview,
 *                                                    1280×640 (must be < 1 MB)
 *
 * Fonts load from Google Fonts, so this needs a network connection.
 *
 *   pnpm build:banners
 */
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'docs/banners');
const SRC = join(ROOT, 'scripts/store/banners.html');

const { version } = JSON.parse(
  await readFile(join(ROOT, 'package.json'), 'utf8'),
);
const shortVersion = `v${version.split('.').slice(0, 2).join('.')}`;

const ARTBOARDS = {
  'Social dark': { file: 'social-dark.png', scale: 'css' },
  'Social light': { file: 'social-light.png', scale: 'css' },
  'Hero dark': { file: 'hero-dark.png', scale: 'device' },
  'Hero light': { file: 'hero-light.png', scale: 'device' },
};

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 2640, height: 1120 },
  deviceScaleFactor: 2,
});
await page.goto(pathToFileURL(SRC).href, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);

// Keep the version in the eyebrow in step with package.json.
await page.evaluate((v) => {
  for (const el of document.querySelectorAll('.eye span')) {
    el.textContent = el.textContent.replace(/v\d+\.\d+/, v);
  }
}, shortVersion);

const missing = await page.evaluate(() =>
  ['Geist', 'Geist Mono'].filter((f) => !document.fonts.check(`16px "${f}"`)),
);
if (missing.length) throw new Error(`Fonts not loaded: ${missing.join(', ')}`);

for (const [label, { file, scale }] of Object.entries(ARTBOARDS)) {
  await page
    .locator(`[data-screen-label="${label}"]`)
    .screenshot({ path: join(OUT, file), scale });
  console.log(`docs/banners/${file}`);
}

await browser.close();
