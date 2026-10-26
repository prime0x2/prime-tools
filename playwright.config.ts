/**
 * E2E tests load the real built extension (WXT_E2E=1 build, see
 * wxt.config.ts) into Chromium and assert on rendered pixels, so a
 * regression caught here is one a user would see.
 *
 * Run: `pnpm test:e2e` (builds first).
 */
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Each test gets its own browser profile; one at a time keeps it simple.
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    viewport: { width: 1000, height: 700 },
    actionTimeout: 5_000,
    trace: 'retain-on-failure',
  },
});
