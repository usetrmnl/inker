import { describe, it, expect } from 'bun:test';
import sharp from 'sharp';
import { ScreenRendererService } from './screen-renderer.service';
import { SPECTRA6_CANONICAL } from '../../common/utils/spectra6.util';
import type { PrismaService } from '../../prisma/prisma.service';
import type { CustomWidgetsService } from '../../custom-widgets/custom-widgets.service';
import type { ConfigService } from '@nestjs/config';
import type { SettingsService } from '../../settings/settings.service';

// applyEinkProcessing is pure image processing: none of the injected services are touched.
const service = new ScreenRendererService(
  {} as unknown as PrismaService,
  {} as unknown as CustomWidgetsService,
  {} as unknown as ConfigService,
  {} as unknown as SettingsService,
);

const W = 80;
const H = 48;

function solidPng(rgb: readonly number[]): Promise<Buffer> {
  return sharp({ create: { width: W, height: H, channels: 3, background: { r: rgb[0], g: rgb[1], b: rgb[2] } } })
    .png()
    .toBuffer();
}

async function decodeRgb(png: Buffer) {
  return sharp(png).toColourspace('srgb').removeAlpha().raw().toBuffer({ resolveWithObject: true });
}

describe('ScreenRendererService.applyEinkProcessing — Spectra 6', () => {
  const names = ['black', 'white', 'yellow', 'red', 'blue', 'green'];

  SPECTRA6_CANONICAL.forEach((colour, i) => {
    it(`keeps a solid ${names[i]} canvas ${names[i]} in device mode (no negate, no grayscale)`, async () => {
      const out = await service.applyEinkProcessing(await solidPng(colour), W, H, true, 'png', 1, 'spectra6');
      expect(out[25]).toBe(3); // IHDR colour type: indexed
      const { data, info } = await decodeRgb(out);
      expect([info.width, info.height]).toEqual([W, H]);
      const expected = Buffer.alloc(W * H * 3);
      for (let p = 0; p < expected.length; p += 3) expected.set(colour, p);
      expect(Buffer.compare(data, expected)).toBe(0);
    });
  });

  it('maps every pixel of a colourful photo-like image to one of the 6 canonical colours, at full size', async () => {
    const width = 800;
    const height = 480;
    const raw = Buffer.alloc(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const o = (y * width + x) * 4;
        raw[o] = (x * 255) / width;
        raw[o + 1] = (y * 255) / height;
        raw[o + 2] = 255 - (x * 255) / width;
        raw[o + 3] = x < 40 ? 0 : 255; // transparent strip must flatten to white
      }
    }
    const input = await sharp(raw, { raw: { width, height, channels: 4 } }).png().toBuffer();

    const out = await service.applyEinkProcessing(input, width, height, false, 'png', 1, 'spectra6');
    const { data, info } = await decodeRgb(out);
    expect([info.width, info.height]).toEqual([width, height]);

    const allowed: Record<string, true> = {};
    for (const c of SPECTRA6_CANONICAL) allowed[c.join(',')] = true;
    const seen = new Set<string>();
    for (let p = 0; p < data.length; p += 3) {
      const key = `${data[p]},${data[p + 1]},${data[p + 2]}`;
      if (!allowed[key]) throw new Error(`non-canonical pixel ${key} at ${p / 3}`);
      seen.add(key);
    }
    expect(seen.size).toBeGreaterThanOrEqual(4);
    expect(out.length).toBeLessThan(750_000); // PSRAM firmware PNG limit
  });

  it('ignores the palette for BMP output (colour BMP is not supported)', async () => {
    const out = await service.applyEinkProcessing(await solidPng([255, 0, 0]), W, H, true, 'bmp', 1, 'spectra6');
    expect(out.toString('ascii', 0, 2)).toBe('BM');
  });

  it('keeps the monochrome path without a palette', async () => {
    const out = await service.applyEinkProcessing(await solidPng([255, 0, 0]), W, H, true, 'png', 1);
    const meta = await sharp(out).metadata();
    expect(meta.channels).toBe(1);
  });
});
