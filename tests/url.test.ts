import { describe, expect, it } from 'vitest';
import { classifyUrl, isHostPattern, patternCovers } from '../src/lib/url';

describe('classifyUrl', () => {
  it('derives origin, host and a port-less permission pattern', () => {
    expect(classifyUrl('http://localhost:3000/a?b#c')).toEqual({
      ok: true,
      site: {
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
        pattern: 'http://localhost/*',
      },
    });
  });

  it.each([
    ['chrome://extensions', 'internal'],
    ['about:addons', 'internal'],
    ['moz-extension://abc/popup.html', 'internal'],
    ['view-source:https://example.com', 'internal'],
    ['', 'internal'],
    [undefined, 'internal'],
    ['file:///Users/me/a.html', 'file'],
    ['https://chromewebstore.google.com/detail/x', 'store'],
    ['https://chrome.google.com/webstore/detail/x', 'store'],
    ['https://addons.mozilla.org/en-US/firefox/', 'store'],
    ['https://microsoftedge.microsoft.com/addons/', 'store'],
  ])('rejects %s as %s', (url, reason) => {
    expect(classifyUrl(url)).toEqual({ ok: false, reason });
  });

  it('allows the rest of google.com', () => {
    expect(classifyUrl('https://chrome.google.com/other').ok).toBe(true);
  });
});

describe('patternCovers', () => {
  const site = {
    origin: 'https://a.com',
    host: 'a.com',
    pattern: 'https://a.com/*',
  };
  it('matches the exact pattern or <all_urls>', () => {
    expect(patternCovers('https://a.com/*', site)).toBe(true);
    expect(patternCovers('<all_urls>', site)).toBe(true);
    expect(patternCovers('http://a.com/*', site)).toBe(false);
    expect(patternCovers('https://b.com/*', site)).toBe(false);
  });
});

describe('patternCovers with broad grants', () => {
  const site = {
    origin: 'https://app.example.com:8443',
    host: 'app.example.com:8443',
    pattern: 'https://app.example.com/*',
  };
  it.each([
    ['https://*/*', true],
    ['*://*/*', true],
    ['http://*/*', false],
    ['*://app.example.com/*', true],
    ['https://*.example.com/*', true],
    ['https://*.other.com/*', false],
    ['https://example.com/*', false],
    ['not a pattern', false],
  ])('%s → %s', (pattern, expected) => {
    expect(patternCovers(pattern, site)).toBe(expected);
  });
});

describe('isHostPattern', () => {
  it('is true only for single-host grants', () => {
    expect(isHostPattern('https://a.com/*')).toBe(true);
    expect(isHostPattern('http://localhost/*')).toBe(true);
    expect(isHostPattern('https://*/*')).toBe(false);
    expect(isHostPattern('https://*.a.com/*')).toBe(false);
    expect(isHostPattern('<all_urls>')).toBe(false);
  });
});
