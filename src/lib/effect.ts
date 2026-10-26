import type { Effect, Mode } from './settings';

/** Blur radius at 100% strength. Enough to make body text unreadable. */
export const MAX_BLUR_PX = 24;

export interface PaintStyle {
  background: string;
  backdropFilter: string;
}

/** CSS for an overlay that dims or blurs whatever is behind it. */
export function paintStyle(mode: Mode, strength: number): PaintStyle {
  const amount = Math.min(100, Math.max(0, strength)) / 100;
  if (mode === 'blur') {
    const px = Math.round(amount * MAX_BLUR_PX * 10) / 10;
    return { background: 'transparent', backdropFilter: `blur(${px}px)` };
  }
  return {
    background: `rgba(0, 0, 0, ${Math.round(amount * 1000) / 1000})`,
    backdropFilter: 'none',
  };
}

export const effectStyle = (effect: Effect): PaintStyle =>
  paintStyle(effect.mode, effect.strength);
