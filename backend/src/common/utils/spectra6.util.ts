/**
 * Spectra 6 (6-colour e-ink: black, white, yellow, red, blue, green) colour quantization.
 *
 * TRMNL firmware decodes every PNG on a Spectra panel through `png_draw_6clr`, which maps each
 * pixel to the nearest of its 6 colours via an RGB333 lookup — with NO dithering and NO inversion
 * on the device. So the server does the colour work: Floyd–Steinberg error diffusion in RGB,
 * choosing colours against a PERCEPTUAL palette that approximates what the real inks look like
 * (the panel's "white" is a light grey, its "red" a dark crimson, …). Matching against measured ink
 * colours keeps the diffused error honest, so photos keep their tones instead of drifting.
 *
 * The output, however, is written with CANONICAL colours (pure #000/#fff/#ff0/#f00/#00f/#0f0) so
 * each pixel maps unambiguously through the firmware's nearest-colour table.
 */

import { crc32, deflateSync } from 'zlib';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Render palette descriptor carried on device render URLs (`palette=spectra6`). */
export type ColorPalette = 'spectra6';

/** Whitelist a raw query value: only `spectra6` is accepted, anything else is ignored. */
export function parsePalette(raw: unknown): ColorPalette | undefined {
  return raw === 'spectra6' ? 'spectra6' : undefined;
}

/**
 * Render palette for a device model: 6-colour PNG panels (Spectra 6) render in colour; BMP
 * containers are 1-bit only, so they and every other model keep the default monochrome path.
 */
export function paletteForModel(
  model: { colors?: number | null; mimeType?: string | null } | null | undefined,
): ColorPalette | undefined {
  return model?.colors === 6 && model.mimeType !== 'image/bmp' ? 'spectra6' : undefined;
}

export type Rgb = readonly [number, number, number];

/** Index order shared by both palettes: black, white, yellow, red, blue, green. */
export const SPECTRA6_PERCEPTUAL: readonly Rgb[] = [
  [25, 30, 33], // black
  [232, 232, 232], // white
  [239, 222, 68], // yellow
  [178, 19, 24], // red
  [33, 87, 186], // blue
  [18, 95, 32], // green
];

export const SPECTRA6_CANONICAL: readonly Rgb[] = [
  [0, 0, 0], // black
  [255, 255, 255], // white
  [255, 255, 0], // yellow
  [255, 0, 0], // red
  [0, 0, 255], // blue
  [0, 255, 0], // green
];

/**
 * Mild pre-dither boost applied by the renderer (sharp `modulate` + `linear`): Spectra inks are
 * duller and lower-contrast than a monitor, so a little extra saturation and contrast keeps
 * photos from looking washed out. Pure colours are unaffected (they are already at the extremes).
 */
export const SPECTRA6_SATURATION = 1.2;
export const SPECTRA6_CONTRAST = 1.1;

function nearestPerceptual(r: number, g: number, b: number): number {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < SPECTRA6_PERCEPTUAL.length; i++) {
    const p = SPECTRA6_PERCEPTUAL[i];
    const dr = r - p[0];
    const dg = g - p[1];
    const db = b - p[2];
    const d = dr * dr + dg * dg + db * db;
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

/**
 * Floyd–Steinberg (serpentine) error diffusion of packed RGB pixels to Spectra 6 palette indices.
 *
 * @param rgb - packed 3-channel RGB, `width * height * 3` bytes
 * @returns one palette index (0–5, see SPECTRA6_CANONICAL) per pixel
 */
export function ditherSpectra6(rgb: Uint8Array, width: number, height: number): Uint8Array {
  const pixelCount = width * height;
  if (rgb.length !== pixelCount * 3) {
    throw new Error(`ditherSpectra6: expected ${pixelCount * 3} RGB bytes, got ${rgb.length}`);
  }
  const work = Float32Array.from(rgb);
  const indices = new Uint8Array(pixelCount);

  const spread = (x: number, y: number, er: number, eg: number, eb: number, weight: number) => {
    if (x < 0 || x >= width || y >= height) return;
    const o = (y * width + x) * 3;
    work[o] += er * weight;
    work[o + 1] += eg * weight;
    work[o + 2] += eb * weight;
  };

  for (let y = 0; y < height; y++) {
    // Serpentine scan: alternate direction every row to avoid directional "worm" artefacts.
    const leftToRight = (y & 1) === 0;
    const dir = leftToRight ? 1 : -1;
    for (let step = 0; step < width; step++) {
      const x = leftToRight ? step : width - 1 - step;
      const o = (y * width + x) * 3;
      // Clamp the accumulated value so error cannot run away (keeps pure colours pure).
      const r = Math.min(255, Math.max(0, work[o]));
      const g = Math.min(255, Math.max(0, work[o + 1]));
      const b = Math.min(255, Math.max(0, work[o + 2]));

      const idx = nearestPerceptual(r, g, b);
      indices[y * width + x] = idx;

      const p = SPECTRA6_PERCEPTUAL[idx];
      const er = r - p[0];
      const eg = g - p[1];
      const eb = b - p[2];

      spread(x + dir, y, er, eg, eb, 7 / 16);
      spread(x - dir, y + 1, er, eg, eb, 3 / 16);
      spread(x, y + 1, er, eg, eb, 5 / 16);
      spread(x + dir, y + 1, er, eg, eb, 1 / 16);
    }
  }

  return indices;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  chunk.write(type, 4, 'ascii');
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(chunk.subarray(4, 8 + data.length)), 8 + data.length);
  return chunk;
}

/**
 * Encode Spectra 6 palette indices as a 4-bit indexed PNG whose PLTE holds exactly the 6
 * canonical colours (index order = SPECTRA6_CANONICAL).
 *
 * Hand-encoded rather than via sharp: sharp's palette output goes through libimagequant, which
 * with `colours: 6` re-quantizes an already-6-colour image into fewer, shifted colours (verified:
 * pure yellow came back as (255,255,144) and black/white entries were dropped). The firmware's
 * `png_draw_6clr` accepts 1/2/4/8-bit indexed PNGs, so a deterministic 4-bit encoder is exact and
 * small (an 800x480 frame is at most 192 KB before deflate, far under the 750 KB PSRAM limit).
 */
export function encodeSpectra6Png(indices: Uint8Array, width: number, height: number): Buffer {
  if (indices.length !== width * height) {
    throw new Error(`encodeSpectra6Png: expected ${width * height} indices, got ${indices.length}`);
  }
  const rowBytes = Math.ceil(width / 2);
  const raw = Buffer.alloc((rowBytes + 1) * height); // +1: per-row filter byte (0 = None)
  for (let y = 0; y < height; y++) {
    const rowStart = y * (rowBytes + 1) + 1;
    for (let x = 0; x < width; x++) {
      const value = indices[y * width + x];
      if (value >= SPECTRA6_CANONICAL.length) {
        throw new Error(`encodeSpectra6Png: palette index ${value} out of range`);
      }
      // 4-bit samples, high nibble first
      raw[rowStart + (x >> 1)] |= (x & 1) === 0 ? value << 4 : value;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 4; // bit depth
  ihdr[9] = 3; // colour type: indexed
  // compression, filter, interlace: 0

  const plte = Buffer.from(SPECTRA6_CANONICAL.flat());

  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk('IHDR', ihdr),
    pngChunk('PLTE', plte),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}
