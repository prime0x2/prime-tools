export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Selections smaller than this on either side are treated as stray clicks. */
export const MIN_AREA_PX = 6;

export const rectFromPoints = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): Rect => ({
  x: Math.min(x1, x2),
  y: Math.min(y1, y2),
  w: Math.abs(x2 - x1),
  h: Math.abs(y2 - y1),
});

export const isTooSmall = (r: Rect): boolean =>
  r.w < MIN_AREA_PX || r.h < MIN_AREA_PX;

export type Box = Partial<
  Record<'top' | 'left' | 'right' | 'bottom' | 'width' | 'height', number>
>;

/**
 * The four viewport-fixed panes that cover everything except `r`.
 * Panes use right/bottom = 0 so they keep covering the edges when the
 * window is resized.
 */
export function spotlightPanes(r: Rect): Box[] {
  const bottom = r.y + r.h;
  const right = r.x + r.w;
  return [
    { top: 0, left: 0, right: 0, height: r.y },
    { top: bottom, left: 0, right: 0, bottom: 0 },
    { top: r.y, left: 0, width: r.x, height: r.h },
    { top: r.y, left: right, right: 0, height: r.h },
  ];
}

export function boxToCss(box: Box): string {
  return Object.entries(box)
    .map(([k, v]) => `${k}:${v}px`)
    .join(';');
}

/** Where the spotlight's toolbar goes: above the hole if there's room. */
export function spotlightBarTop(r: Rect, barHeight = 34, gap = 6): number {
  return r.y >= barHeight + gap ? r.y - barHeight - gap : r.y + r.h + gap;
}
