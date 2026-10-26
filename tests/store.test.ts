import { beforeEach, describe, expect, it } from 'vitest';
import { browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { DEFAULT_EFFECT, SCHEMA_VERSION } from '../src/lib/settings';
import {
  forgetSites,
  getPrefs,
  getSiteEffect,
  listSites,
  migrateStorage,
  setSiteEffect,
} from '../src/lib/store';

beforeEach(() => fakeBrowser.reset());

describe('site effects', () => {
  it('saves per origin and remembers the last-used look', async () => {
    await setSiteEffect('https://a.com', { mode: 'blur', strength: 30 });
    expect(await getSiteEffect('https://a.com')).toEqual({
      mode: 'blur',
      strength: 30,
    });
    expect(await getSiteEffect('https://b.com')).toBeNull();
    expect(await getPrefs()).toEqual({ mode: 'blur', strength: 30 });
  });

  it('turning off removes the site but keeps prefs', async () => {
    await setSiteEffect('https://a.com', { mode: 'dim', strength: 70 });
    await setSiteEffect('https://a.com', null);
    expect(await getSiteEffect('https://a.com')).toBeNull();
    expect(await getPrefs()).toEqual({ mode: 'dim', strength: 70 });
  });

  it('falls back to defaults when prefs are missing or corrupt', async () => {
    expect(await getPrefs()).toEqual(DEFAULT_EFFECT);
    await browser.storage.local.set({ prefs: { mode: 'x' } });
    expect(await getPrefs()).toEqual(DEFAULT_EFFECT);
  });

  it('lists only valid site entries, sorted', async () => {
    await browser.storage.local.set({
      'site:https://b.com': { mode: 'dim', strength: 20 },
      'site:https://a.com': { mode: 'blur', strength: 90 },
      'site:https://bad.com': { mode: 'dim', strength: 0 },
      prefs: { mode: 'dim', strength: 50 },
    });
    expect(await listSites()).toEqual([
      { origin: 'https://a.com', effect: { mode: 'blur', strength: 90 } },
      { origin: 'https://b.com', effect: { mode: 'dim', strength: 20 } },
    ]);
    await forgetSites(['https://a.com']);
    expect((await listSites()).map((s) => s.origin)).toEqual(['https://b.com']);
  });
});

describe('migrateStorage', () => {
  it('upgrades the prototype layout once', async () => {
    await browser.storage.local.set({
      levels: {
        'https://a.com': 5,
        'https://b.com': { level: 1, mode: 'blur' },
      },
    });
    await migrateStorage();
    const all = await browser.storage.local.get(null);
    expect(all).toEqual({
      schema: SCHEMA_VERSION,
      'site:https://a.com': { mode: 'dim', strength: 50 },
      'site:https://b.com': { mode: 'blur', strength: 90 },
    });
  });

  it('is a no-op on current storage', async () => {
    await browser.storage.local.set({
      schema: SCHEMA_VERSION,
      'site:https://a.com': { mode: 'dim', strength: 10 },
    });
    await migrateStorage();
    expect(await getSiteEffect('https://a.com')).toEqual({
      mode: 'dim',
      strength: 10,
    });
  });
});
