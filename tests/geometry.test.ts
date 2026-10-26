import { describe, expect, it } from 'vitest';
import {
  boxToCss,
  isTooSmall,
  rectFromPoints,
  spotlightBarTop,
  spotlightPanes,
} from '../src/lib/geometry';

describe('rectFromPoints', () => {
  it('normalises drags in any direction', () => {
    expect(rectFromPoints(50, 80, 10, 20)).toEqual({
      x: 10,
      y: 20,
      w: 40,
      h: 60,
    });
  });
});

describe('isTooSmall', () => {
  it('ignores stray clicks', () => {
    expect(isTooSmall({ x: 0, y: 0, w: 3, h: 200 })).toBe(true);
    expect(isTooSmall({ x: 0, y: 0, w: 20, h: 20 })).toBe(false);
  });
});

describe('spotlightPanes', () => {
  it('covers everything around the hole', () => {
    const panes = spotlightPanes({ x: 100, y: 50, w: 200, h: 80 });
    expect(panes).toEqual([
      { top: 0, left: 0, right: 0, height: 50 },
      { top: 130, left: 0, right: 0, bottom: 0 },
      { top: 50, left: 0, width: 100, height: 80 },
      { top: 50, left: 300, right: 0, height: 80 },
    ]);
    expect(boxToCss(panes[0]!)).toBe('top:0px;left:0px;right:0px;height:50px');
  });
});

describe('spotlightBarTop', () => {
  it('sits above the hole when there is room, else below', () => {
    expect(spotlightBarTop({ x: 0, y: 200, w: 10, h: 10 })).toBe(160);
    expect(spotlightBarTop({ x: 0, y: 10, w: 10, h: 50 })).toBe(66);
  });
});
