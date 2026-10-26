import { expect, SITE, test } from './fixtures';

const BLACK: [number, number, number] = [0, 0, 0];
const WHITE: [number, number, number] = [255, 255, 255];

const shade = (page: import('@playwright/test').Page) =>
  page.locator('[data-prime-tools="shade"]');

test('auto-applies a saved effect as the page loads', async ({
  worker,
  site,
  pixel,
}) => {
  await worker.evaluate(
    (key) =>
      chrome.storage.local.set({ [key]: { mode: 'dim', strength: 100 } }),
    `site:${SITE}`,
  );
  await site.reload();
  await expect(shade(site)).toHaveCount(1);
  expect(await pixel(site, 500, 350)).toEqual(BLACK);
  // In the top layer, not just a high z-index.
  expect(await shade(site).evaluate((el) => el.matches(':popover-open'))).toBe(
    true,
  );
});

test('stays above a modal dialog opened later', async ({
  worker,
  site,
  pixel,
}) => {
  await worker.evaluate(
    (key) =>
      chrome.storage.local.set({ [key]: { mode: 'dim', strength: 100 } }),
    `site:${SITE}`,
  );
  await site.reload();
  await expect(shade(site)).toHaveCount(1);
  await site.evaluate(() =>
    (document.getElementById('d') as HTMLDialogElement).showModal(),
  );
  // The dialog is white and centred; it must still be covered.
  await expect.poll(() => pixel(site, 500, 350)).toEqual(BLACK);
});

test('popup turns the effect on, switches mode and saves per site', async ({
  worker,
  site,
  openPopup,
}) => {
  const popup = await openPopup(site);
  await expect(popup.locator('#host')).toHaveText('prime.test');
  await expect(popup.locator('#enabled')).not.toBeChecked();

  await popup.locator('.switch').click();
  await expect(shade(site)).toHaveCount(1);

  await popup.locator('label', { hasText: 'Blur' }).click();
  await popup.locator('#strength').fill('75');
  await expect(popup.locator('#strength-value')).toHaveText('75%');
  await expect
    .poll(() =>
      worker.evaluate(
        (key) => chrome.storage.local.get(key).then((s) => s[key]),
        `site:${SITE}`,
      ),
    )
    .toEqual({ mode: 'blur', strength: 75 });
  await expect(shade(site)).toHaveCSS('backdrop-filter', 'blur(18px)');

  await popup.locator('.switch').click();
  await expect(shade(site)).toHaveCount(0);
});

test('hide an area covers it and scrolls with the page', async ({
  site,
  openPopup,
  pixel,
}) => {
  const popup = await openPopup(site);
  await popup.locator('#hide-area').click();
  await site.bringToFront();

  await site.mouse.move(100, 100);
  await site.mouse.down();
  await site.mouse.move(300, 200, { steps: 5 });
  await site.mouse.up();

  expect(await pixel(site, 200, 150)).toEqual(BLACK);
  expect(await pixel(site, 600, 400)).toEqual(WHITE);

  await site.mouse.wheel(0, 80);
  await expect.poll(() => site.evaluate(() => scrollY)).toBe(80);
  expect(await pixel(site, 200, 150 - 80 + 5)).toEqual(BLACK);
  expect(await pixel(site, 200, 190)).toEqual(WHITE);
});

test('show only an area covers everything else, Escape cancels', async ({
  site,
  openPopup,
  pixel,
}) => {
  let popup = await openPopup(site);
  await popup.locator('#show-area').click();
  await site.bringToFront();
  await site.keyboard.press('Escape');
  expect(await pixel(site, 500, 350)).toEqual(WHITE);

  popup = await openPopup(site);
  await popup.locator('#show-area').click();
  await site.bringToFront();
  await site.mouse.move(400, 300);
  await site.mouse.down();
  await site.mouse.move(600, 400, { steps: 5 });
  await site.mouse.up();

  expect(await pixel(site, 500, 350)).toEqual(WHITE);
  expect(await pixel(site, 100, 100)).toEqual(BLACK);
  expect(await pixel(site, 900, 650)).toEqual(BLACK);

  popup = await openPopup(site);
  await expect(popup.locator('#clear-areas')).toBeEnabled();
  await popup.locator('#clear-areas').click();
  await expect(popup.locator('#clear-areas')).toBeDisabled();
  expect(await pixel(site, 100, 100)).toEqual(WHITE);
});

test('popup explains pages it cannot touch', async ({ context, openPopup }) => {
  const page = await context.newPage();
  await page.goto('about:blank');
  const popup = await openPopup(page);
  await expect(popup.locator('#unsupported')).toContainText("can't be dimmed");
  await expect(popup.locator('#app')).toBeHidden();
});

test('settings lists remembered sites and forgets them', async ({
  context,
  worker,
  extensionId,
}) => {
  await worker.evaluate(
    (key) =>
      chrome.storage.local.set({ [key]: { mode: 'blur', strength: 40 } }),
    `site:${SITE}`,
  );
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  const row = options.locator('.sites li');
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('prime.test');
  await expect(row).toContainText('Blur 40%');

  await row.getByRole('button', { name: 'Forget prime.test' }).click();
  await expect(row).toHaveCount(0);
  await expect(options.locator('#sites-empty')).toBeVisible();
});

test('page CSS cannot hide the overlays', async ({
  context,
  worker,
  openPopup,
  pixel,
}) => {
  await worker.evaluate(
    (key) =>
      chrome.storage.local.set({ [key]: { mode: 'dim', strength: 100 } }),
    `site:${SITE}`,
  );
  const page = await context.newPage();
  await page.goto(`${SITE}/hostile`);
  await expect.poll(() => pixel(page, 500, 350)).toEqual(BLACK);

  await worker.evaluate(
    (key) => chrome.storage.local.remove(key),
    `site:${SITE}`,
  );
  await expect.poll(() => pixel(page, 500, 350)).toEqual(WHITE);
  const popup = await openPopup(page);
  await popup.locator('#hide-area').click();
  await page.bringToFront();
  await page.mouse.move(100, 100);
  await page.mouse.down();
  await page.mouse.move(300, 200, { steps: 5 });
  await page.mouse.up();
  expect(await pixel(page, 200, 150)).toEqual(BLACK);
});

test('areas can be drawn while the page has a modal open', async ({
  site,
  openPopup,
  pixel,
}) => {
  await site.evaluate(() =>
    (document.getElementById('d') as HTMLDialogElement).showModal(),
  );
  const popup = await openPopup(site);
  await popup.locator('#hide-area').click();
  await site.bringToFront();
  // Over the page's dialog (200×120, centred at 500,350).
  await site.mouse.move(420, 300);
  await site.mouse.down();
  await site.mouse.move(580, 400, { steps: 5 });
  await site.mouse.up();
  expect(await pixel(site, 500, 350)).toEqual(BLACK);

  // Esc during a selection cancels ours and leaves the page's dialog open.
  const again = await openPopup(site);
  await again.locator('#hide-area').click();
  await site.bringToFront();
  await site.keyboard.press('Escape');
  expect(
    await site.evaluate(
      () => (document.getElementById('d') as HTMLDialogElement).open,
    ),
  ).toBe(true);
});

test('a dead copy left by an update is replaced', async ({ worker, site }) => {
  await worker.evaluate(
    (key) =>
      chrome.storage.local.set({ [key]: { mode: 'dim', strength: 100 } }),
    `site:${SITE}`,
  );
  await expect(shade(site)).toHaveCount(1);
  const tabId = await worker.evaluate(
    async (u) =>
      (await chrome.tabs.query({})).find((t) => t.url?.startsWith(u))?.id,
    SITE,
  );

  // After an update the old copy is still on the page but its runtime is
  // gone. Playwright can't update an extension, so mark the copy dead.
  const state = await worker.evaluate(async (id) => {
    await chrome.scripting.executeScript({
      target: { tabId: id! },
      func: () => {
        const g = globalThis as { __primeTools?: { alive: () => boolean } };
        if (g.__primeTools) g.__primeTools.alive = () => false;
      },
    });
    await chrome.scripting.executeScript({
      target: { tabId: id! },
      files: ['/page.js'],
    });
    return chrome.tabs.sendMessage(id!, { type: 'page:get' });
  }, tabId);

  // The new copy took over: one overlay, and turning off works again.
  expect(state.effect).toEqual({ mode: 'dim', strength: 100 });
  await expect(shade(site)).toHaveCount(1);
  await worker.evaluate(
    (key) => chrome.storage.local.remove(key),
    `site:${SITE}`,
  );
  await expect(shade(site)).toHaveCount(0);
});
