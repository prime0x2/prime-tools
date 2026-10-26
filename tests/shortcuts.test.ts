import { describe, expect, it } from 'vitest';
import { prettyShortcut } from '../src/lib/shortcuts';

describe('prettyShortcut', () => {
  it('uses macOS symbols for Firefox-style shortcuts', () => {
    expect(prettyShortcut('Alt+Shift+S', true)).toBe('⌥⇧S');
    expect(prettyShortcut('MacCtrl+Shift+S', true)).toBe('⌃⇧S');
  });

  it('leaves Chrome-on-mac and other platforms alone', () => {
    expect(prettyShortcut('⌥⇧S', true)).toBe('⌥⇧S');
    expect(prettyShortcut('Alt+Shift+S', false)).toBe('Alt+Shift+S');
  });
});
