/**
 * Renders the extension icons from one SVG template.
 *
 * The mark sits on the same rounded ember tile as PrimeVault's icon so the
 * two read as one family in the toolbar: a ring with its left half filled
 * (a "shade" dial), plus a small knob at 12 o'clock.
 *
 *   pnpm build:icons   →   public/icon/{16,32,48,96,128}.png
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../public/icon');
const SIZES = [16, 32, 48, 96, 128];
const EMBER = '#db5c39';
const INK = '#ffffff';

function svg(size) {
  const small = size < 48;
  // Work in a 32-unit grid; the tile's corner radius matches PrimeVault.
  const radius = small ? (size <= 16 ? 6 : 5.8) : 5.76;
  const r = small ? 10.5 : 9.5;
  const stroke = small ? 2.6 : 1.8;
  const knob = small
    ? ''
    : `<line x1="16" y1="3.6" x2="16" y2="6.2" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="${radius}" fill="${EMBER}"/>
  <circle cx="16" cy="16" r="${r}" fill="none" stroke="${INK}" stroke-width="${stroke}"/>
  <path d="M16 ${16 - r} A ${r} ${r} 0 0 0 16 ${16 + r} Z" fill="${INK}"/>
  ${knob}
</svg>`;
}

await mkdir(OUT, { recursive: true });
for (const size of SIZES) {
  const png = new Resvg(svg(size), { fitTo: { mode: 'width', value: size } })
    .render()
    .asPng();
  await writeFile(resolve(OUT, `${size}.png`), png);
  console.log(`icon/${size}.png`);
}
await writeFile(resolve(OUT, '../../docs/icon.svg'), svg(128));
