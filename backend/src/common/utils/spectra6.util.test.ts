import { describe, it, expect } from 'bun:test';
import sharp from 'sharp';
import {
  SPECTRA6_CANONICAL,
  ditherSpectra6,
  encodeSpectra6Png,
  paletteForModel,
  parsePalette,
} from './spectra6.util';

/** Packed RGB canvas filled with one colour. */
function solid(width: number, height: number, rgb: readonly number[]): Uint8Array {
  const out = new Uint8Array(width * height * 3);
  for (let i = 0; i < out.length; i += 3) out.set(rgb, i);
  return out;
}

/** Packed RGB "photo-like" test image: hue sweep horizontally, lightness vertically. */
function gradient(width: number, height: number): Uint8Array {
  const out = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 3;
      out[o] = Math.round((x / width) * 255);
      out[o + 1] = Math.round((y / height) * 255);
      out[o + 2] = Math.round(((x + y) / (width + height)) * 255);
    }
  }
  return out;
}

/** Read the PLTE entries of a PNG buffer. */
function readPlte(png: Buffer): number[][] {
  let p = 8;
  while (p < png.length) {
    const len = png.readUInt32BE(p);
    if (png.toString('ascii', p + 4, p + 8) === 'PLTE') {
      const entries: number[][] = [];
      for (let i = 0; i < len; i += 3) entries.push([png[p + 8 + i], png[p + 9 + i], png[p + 10 + i]]);
      return entries;
    }
    p += 12 + len;
  }
  return [];
}

describe('spectra6.util', () => {
  describe('parsePalette', () => {
    it('accepts only spectra6', () => {
      expect(parsePalette('spectra6')).toBe('spectra6');
      expect(parsePalette('SPECTRA6')).toBeUndefined();
      expect(parsePalette('acep7')).toBeUndefined();
      expect(parsePalette('')).toBeUndefined();
      expect(parsePalette(undefined)).toBeUndefined();
      expect(parsePalette(['spectra6'])).toBeUndefined();
    });
  });

  describe('paletteForModel', () => {
    it('selects spectra6 only for 6-colour PNG models', () => {
      expect(paletteForModel({ colors: 6, mimeType: 'image/png' })).toBe('spectra6');
      expect(paletteForModel({ colors: 6, mimeType: 'image/bmp' })).toBeUndefined();
      expect(paletteForModel({ colors: 2, mimeType: 'image/png' })).toBeUndefined();
      expect(paletteForModel(null)).toBeUndefined();
      expect(paletteForModel(undefined)).toBeUndefined();
    });
  });

  describe('ditherSpectra6', () => {
    it('maps each pure canonical colour to its own index', () => {
      SPECTRA6_CANONICAL.forEach((colour, index) => {
        const indices = ditherSpectra6(solid(40, 30, colour), 40, 30);
        expect(indices.every((v) => v === index)).toBe(true);
      });
    });

    it('only emits valid palette indices and uses several colours on a gradient', () => {
      const indices = ditherSpectra6(gradient(160, 96), 160, 96);
      expect(indices.every((v) => v < SPECTRA6_CANONICAL.length)).toBe(true);
      expect(new Set(indices).size).toBe(SPECTRA6_CANONICAL.length);
    });

    it('rejects a buffer that does not match the dimensions', () => {
      expect(() => ditherSpectra6(new Uint8Array(10), 4, 4)).toThrow();
    });
  });

  describe('encodeSpectra6Png', () => {
    it('writes a 4-bit indexed PNG whose palette is exactly the 6 canonical colours', async () => {
      const indices = ditherSpectra6(gradient(161, 97), 161, 97); // odd width exercises nibble packing
      const png = encodeSpectra6Png(indices, 161, 97);

      expect(png[24]).toBe(4); // IHDR bit depth
      expect(png[25]).toBe(3); // IHDR colour type: indexed
      expect(readPlte(png)).toEqual(SPECTRA6_CANONICAL.map((c) => [...c]));

      const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
      expect([info.width, info.height, info.channels]).toEqual([161, 97, 3]);
      // Every decoded pixel must be exactly the canonical colour of its palette index.
      const expected = Buffer.from(Array.from(indices).flatMap((i) => [...SPECTRA6_CANONICAL[i]]));
      expect(Buffer.compare(data, expected)).toBe(0);
    });

    it('rejects out-of-range indices', () => {
      expect(() => encodeSpectra6Png(new Uint8Array([0, 6]), 2, 1)).toThrow();
    });
  });
});
