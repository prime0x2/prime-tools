import { describe, expect, it } from 'vitest';
import { MAX_BLUR_PX, paintStyle } from '../src/lib/effect';

describe('paintStyle', () => {
  it('dims with a black overlay proportional to strength', () => {
    expect(paintStyle('dim', 40)).toEqual({
      background: 'rgba(0, 0, 0, 0.4)',
      backdropFilter: 'none',
    });
  });

  it('blurs up to the maximum radius', () => {
    expect(paintStyle('blur', 100).backdropFilter).toBe(
      `blur(${MAX_BLUR_PX}px)`,
    );
    expect(paintStyle('blur', 50)).toEqual({
      background: 'transparent',
      backdropFilter: 'blur(12px)',
    });
  });

  it('clamps out-of-range input', () => {
    expect(paintStyle('dim', 250).background).toBe('rgba(0, 0, 0, 1)');
    expect(paintStyle('dim', -1).background).toBe('rgba(0, 0, 0, 0)');
  });
});
