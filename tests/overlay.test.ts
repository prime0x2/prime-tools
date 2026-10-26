import { afterEach, describe, expect, it } from 'vitest';
import { createAreas } from '../src/page/areas';
import { createShade } from '../src/page/shade';
import { createTopLayer } from '../src/page/top-layer';

const tick = () => new Promise((r) => setTimeout(r, 0));
const shadeEl = () =>
  document.querySelector<HTMLElement>('[data-prime-tools="shade"]');

afterEach(() => {
  for (const el of document.querySelectorAll('[data-prime-tools]')) el.remove();
});

describe('shade', () => {
  it('mounts, restyles and unmounts the overlay', () => {
    const shade = createShade(createTopLayer());
    shade.apply({ mode: 'dim', strength: 60 });
    const el = shadeEl()!;
    expect(el.style.getPropertyValue('background')).toContain('0.6');
    expect(el.style.getPropertyValue('pointer-events')).toBe('none');
    expect(el.style.getPropertyPriority('pointer-events')).toBe('important');

    shade.apply({ mode: 'blur', strength: 50 });
    expect(el.style.getPropertyValue('backdrop-filter')).toBe('blur(12px)');
    expect(shade.get()).toEqual({ mode: 'blur', strength: 50 });

    shade.apply(null);
    expect(shadeEl()).toBeNull();
    expect(shade.get()).toBeNull();
  });

  it('comes back if the page removes it', async () => {
    const shade = createShade(createTopLayer());
    shade.apply({ mode: 'dim', strength: 30 });
    shadeEl()!.remove();
    await tick();
    expect(shadeEl()).not.toBeNull();
    shade.apply(null);
  });
});

describe('areas', () => {
  const host = () => document.querySelector('[data-prime-tools="select"]');

  it('starts a selection and cancels it with Escape', () => {
    const areas = createAreas(createTopLayer());
    areas.start({ inverted: false, mode: 'dim' });
    expect(host()).not.toBeNull();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(host()).toBeNull();
    expect(areas.count()).toBe(0);
  });

  it('clear() removes everything', () => {
    const areas = createAreas(createTopLayer());
    areas.start({ inverted: true, mode: 'blur' });
    areas.clear();
    expect(areas.count()).toBe(0);
    expect(host()).toBeNull();
  });
});
