import { describe, expect, it } from 'vitest';
import {
  clampStrength,
  formatEffect,
  legacyLevelToStrength,
  migrateLegacyLevels,
  originFromKey,
  parseEffect,
  siteKey,
} from '../src/lib/settings';

describe('parseEffect', () => {
  it('accepts a valid effect', () => {
    expect(parseEffect({ mode: 'blur', strength: 40 })).toEqual({
      mode: 'blur',
      strength: 40,
    });
  });

  it('clamps and rounds strength', () => {
    expect(parseEffect({ mode: 'dim', strength: 140 })?.strength).toBe(100);
    expect(parseEffect({ mode: 'dim', strength: 33.6 })?.strength).toBe(34);
  });

  it('treats 0% as off', () => {
    expect(parseEffect({ mode: 'dim', strength: 0 })).toBeNull();
    expect(parseEffect({ mode: 'dim', strength: -5 })).toBeNull();
  });

  it.each([
    null,
    undefined,
    7,
    'dim',
    { mode: 'invert', strength: 50 },
    { mode: 'dim' },
    { mode: 'dim', strength: '50' },
    { mode: 'dim', strength: Number.NaN },
  ])('rejects malformed value %#', (raw) => {
    expect(parseEffect(raw)).toBeNull();
  });
});

describe('clampStrength', () => {
  it('maps non-finite values to 0', () => {
    expect(clampStrength(Number.POSITIVE_INFINITY)).toBe(0);
    expect(clampStrength(Number.NaN)).toBe(0);
  });
});

describe('site keys', () => {
  it('round-trips an origin, port included', () => {
    const key = siteKey('http://localhost:3000');
    expect(key).toBe('site:http://localhost:3000');
    expect(originFromKey(key)).toBe('http://localhost:3000');
  });

  it('ignores unrelated keys', () => {
    expect(originFromKey('prefs')).toBeNull();
  });
});

describe('legacy migration', () => {
  it('converts the 0–10 brightness scale to strength', () => {
    expect(legacyLevelToStrength(10)).toBe(0);
    expect(legacyLevelToStrength(0)).toBe(100);
    expect(legacyLevelToStrength(3.5)).toBe(65);
  });

  it('migrates v1 numbers and v2 objects, dropping "off" and junk', () => {
    expect(
      migrateLegacyLevels({
        'https://a.com': 4,
        'https://b.com': { level: 2, mode: 'blur' },
        'https://off.com': 10,
        'https://junk.com': { level: 'x' },
        'https://bad-mode.com': { level: 2, mode: 'sepia' },
      }),
    ).toEqual({
      'site:https://a.com': { mode: 'dim', strength: 60 },
      'site:https://b.com': { mode: 'blur', strength: 80 },
    });
  });

  it('tolerates a missing or malformed levels object', () => {
    expect(migrateLegacyLevels(undefined)).toEqual({});
    expect(migrateLegacyLevels('nope')).toEqual({});
  });
});

describe('formatEffect', () => {
  it('reads naturally', () => {
    expect(formatEffect({ mode: 'blur', strength: 70 })).toBe('Blur 70%');
  });
});
