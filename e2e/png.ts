import { inflateSync } from 'node:zlib';

/**
 * Reads the single pixel of a 1×1 PNG (as produced by a 1×1 screenshot
 * clip). For a one-pixel row every PNG filter reduces to the raw bytes, so
 * no unfiltering is needed.
 */
export function onePixel(png: Buffer): [number, number, number] {
  let offset = 8; // signature
  let colorType = 0;
  const idat: Buffer[] = [];
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString('ascii', offset + 4, offset + 8);
    const data = png.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') colorType = data[9]!;
    if (type === 'IDAT') idat.push(data);
    offset += 12 + length;
  }
  if (colorType !== 2 && colorType !== 6) {
    throw new Error(`Unsupported PNG color type ${colorType}`);
  }
  const raw = inflateSync(Buffer.concat(idat));
  return [raw[1]!, raw[2]!, raw[3]!];
}
