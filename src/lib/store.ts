import { browser } from 'wxt/browser';
import {
  DEFAULT_EFFECT,
  type Effect,
  migrateLegacyLevels,
  originFromKey,
  PREFS_KEY,
  parseEffect,
  SCHEMA_KEY,
  SCHEMA_VERSION,
  siteKey,
} from './settings';

const local = () => browser.storage.local;

export async function getSiteEffect(origin: string): Promise<Effect | null> {
  const key = siteKey(origin);
  const stored = await local().get(key);
  return parseEffect(stored[key]);
}

export async function setSiteEffect(
  origin: string,
  effect: Effect | null,
): Promise<void> {
  const key = siteKey(origin);
  if (effect) await local().set({ [key]: effect, [PREFS_KEY]: effect });
  else await local().remove(key);
}

/** Last-used effect; what "turn on" restores on a site with no setting. */
export async function getPrefs(): Promise<Effect> {
  const stored = await local().get(PREFS_KEY);
  return parseEffect(stored[PREFS_KEY]) ?? DEFAULT_EFFECT;
}

export async function setPrefs(effect: Effect): Promise<void> {
  await local().set({ [PREFS_KEY]: effect });
}

export async function listSites(): Promise<
  Array<{ origin: string; effect: Effect }>
> {
  const all = await local().get(null);
  const sites: Array<{ origin: string; effect: Effect }> = [];
  for (const [key, value] of Object.entries(all)) {
    const origin = originFromKey(key);
    const effect = parseEffect(value);
    if (origin && effect) sites.push({ origin, effect });
  }
  return sites.sort((a, b) => a.origin.localeCompare(b.origin));
}

export async function forgetSites(origins: string[]): Promise<void> {
  await local().remove(origins.map(siteKey));
}

/** One-time upgrade from the prototype's `levels` object. Idempotent. */
export async function migrateStorage(): Promise<void> {
  const stored = await local().get([SCHEMA_KEY, 'levels']);
  if (stored[SCHEMA_KEY] === SCHEMA_VERSION) return;
  const migrated = migrateLegacyLevels(stored.levels);
  await local().set({ ...migrated, [SCHEMA_KEY]: SCHEMA_VERSION });
  await local().remove('levels');
}
