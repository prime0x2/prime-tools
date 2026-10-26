/**
 * Whole-page effect settings and their storage layout.
 *
 * Storage (browser.storage.local):
 *   `site:<origin>` → Effect   one key per site; present means "on"
 *   `prefs`         → Effect   last-used mode/strength, used when turning on
 *   `schema`        → number   storage layout version
 *
 * One key per site (instead of one big object) means two popups or a popup
 * plus the keyboard shortcut can never overwrite each other's sites.
 */

export type Mode = 'dim' | 'blur';

export interface Effect {
  mode: Mode;
  /** 1–100, percent of the maximum dim/blur. 0 is represented as "off". */
  strength: number;
}

export const SCHEMA_VERSION = 2;
export const PREFS_KEY = 'prefs';
export const SCHEMA_KEY = 'schema';
const SITE_PREFIX = 'site:';

export const DEFAULT_EFFECT: Effect = { mode: 'dim', strength: 50 };

export const siteKey = (origin: string): string => `${SITE_PREFIX}${origin}`;

export const originFromKey = (key: string): string | null =>
  key.startsWith(SITE_PREFIX) ? key.slice(SITE_PREFIX.length) : null;

export function clampStrength(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

const isMode = (value: unknown): value is Mode =>
  value === 'dim' || value === 'blur';

/** Validates a stored effect. Anything malformed or at 0% is "off" (null). */
export function parseEffect(raw: unknown): Effect | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { mode, strength } = raw as Record<string, unknown>;
  if (!isMode(mode) || typeof strength !== 'number') return null;
  const clamped = clampStrength(strength);
  return clamped > 0 ? { mode, strength: clamped } : null;
}

/**
 * The prototype stored `levels: { [origin]: number | { level, mode } }`
 * where level ran 0–10 and 10 meant "no effect".
 */
export function legacyLevelToStrength(level: number): number {
  return clampStrength((1 - level / 10) * 100);
}

export function migrateLegacyLevels(levels: unknown): Record<string, Effect> {
  const out: Record<string, Effect> = {};
  if (typeof levels !== 'object' || levels === null) return out;
  for (const [origin, value] of Object.entries(levels)) {
    let level: unknown;
    let mode: unknown = 'dim';
    if (typeof value === 'number') level = value;
    else if (typeof value === 'object' && value !== null) {
      ({ level, mode } = value as Record<string, unknown>);
    }
    if (typeof level !== 'number' || !isMode(mode)) continue;
    const effect = parseEffect({
      mode,
      strength: legacyLevelToStrength(level),
    });
    if (effect) out[siteKey(origin)] = effect;
  }
  return out;
}

export const formatEffect = (effect: Effect): string =>
  `${effect.mode === 'dim' ? 'Dim' : 'Blur'} ${effect.strength}%`;
