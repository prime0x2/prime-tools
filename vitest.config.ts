import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

export default defineConfig({
  // Swaps `wxt/browser` for an in-memory fake (storage, permissions, …).
  plugins: [WxtVitest()],
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'happy-dom',
    restoreMocks: true,
  },
});
