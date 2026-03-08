import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as sharpModule from 'sharp';
// Handle both ESM and CJS imports for Bun compatibility
const sharp = (sharpModule as any).default || sharpModule;
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Default Screen Service
 * Generates a default "Hello World" screen for devices without a playlist
 * Uses Sharp for pure image generation (no Puppeteer/browser dependency)
 */
@Injectable()
export class DefaultScreenService implements OnModuleInit {
  private readonly logger = new Logger(DefaultScreenService.name);
  private readonly assetsDir: string;
  private readonly defaultScreenPath: string;
  private defaultScreenGenerated = false;

  // Default TRMNL e-ink display dimensions (800x480)
  private readonly DEFAULT_WIDTH = 800;
  private readonly DEFAULT_HEIGHT = 480;

  constructor(private readonly config: ConfigService) {
    this.assetsDir = path.join(process.cwd(), 'assets');
    this.defaultScreenPath = path.join(this.assetsDir, 'default-screen.png');
  }

  /**
   * Generate default screen on module initialization
   */
  async onModuleInit() {
    await this.ensureDefaultScreenExists();
  }

  /**
   * Ensure the default screen image exists
   * Generates it if not present
   */
  async ensureDefaultScreenExists(): Promise<void> {
    try {
      // Create assets directory if it doesn't exist
      await fs.mkdir(this.assetsDir, { recursive: true });

      // Check if default screen already exists
      try {
        await fs.access(this.defaultScreenPath);
        this.logger.log(`Default screen already exists at: ${this.defaultScreenPath}`);
        this.defaultScreenGenerated = true;
        return;
      } catch {
        // File doesn't exist, generate it
      }

      await this.generateDefaultScreen();
      this.defaultScreenGenerated = true;
      this.logger.log(`Default screen generated at: ${this.defaultScreenPath}`);
    } catch (error) {
      this.logger.error('Failed to ensure default screen exists:', error);
    }
  }

  /**
   * Generate the default screen image using Sharp
   * Creates a clean, e-ink optimized image with the text:
   * - "Hello World"
   * - "This is Inker!"
   */
  async generateDefaultScreen(
    width: number = this.DEFAULT_WIDTH,
    height: number = this.DEFAULT_HEIGHT,
  ): Promise<string> {
    this.logger.log(`Generating default screen: ${width}x${height}`);

    try {
      // Create SVG with the text content
      // SVG is rendered by Sharp and produces clean text output
      const svg = this.createDefaultScreenSvg(width, height);

      // Convert SVG to e-ink optimized 1-bit PNG (same pipeline as designed screens)
      // TRMNL OG firmware requires dithered, negated, 1-bit palette PNG
      const grayBuffer = await sharp(Buffer.from(svg))
        .grayscale()
        .normalise()
        .raw()
        .toBuffer({ resolveWithObject: true });

      const dithered = this.applyFloydSteinbergDithering(
        grayBuffer.data, grayBuffer.info.width, grayBuffer.info.height, 140,
      );

      await sharp(dithered, {
        raw: { width: grayBuffer.info.width, height: grayBuffer.info.height, channels: 1 },
      })
        .negate()
        .png({ compressionLevel: 9, palette: true, colours: 2 })
        .toFile(this.defaultScreenPath);

      this.logger.log(`Default screen saved to: ${this.defaultScreenPath}`);
      return this.defaultScreenPath;
    } catch (error) {
      this.logger.error('Failed to generate default screen:', error);
      throw error;
    }
  }

  /**
   * Create SVG content for the default screen
   * Clean, centered design optimized for e-ink displays
   */
  private createDefaultScreenSvg(width: number, height: number): string {
    const centerX = width / 2;
    const centerY = height / 2;

    return `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <!-- White background -->
        <rect width="100%" height="100%" fill="white"/>

        <!-- Main title: Hello World -->
        <text
          x="${centerX}"
          y="${centerY - 40}"
          font-family="Arial, Helvetica, sans-serif"
          font-size="64"
          font-weight="bold"
          fill="black"
          text-anchor="middle"
          dominant-baseline="middle"
        >Hello World</text>

        <!-- Subtitle: This is Inker! -->
        <text
          x="${centerX}"
          y="${centerY + 40}"
          font-family="Arial, Helvetica, sans-serif"
          font-size="32"
          fill="black"
          text-anchor="middle"
          dominant-baseline="middle"
        >This is Inker!</text>

        <!-- Decorative line above title -->
        <line
          x1="${centerX - 200}"
          y1="${centerY - 100}"
          x2="${centerX + 200}"
          y2="${centerY - 100}"
          stroke="black"
          stroke-width="2"
        />

        <!-- Decorative line below subtitle -->
        <line
          x1="${centerX - 200}"
          y1="${centerY + 100}"
          x2="${centerX + 200}"
          y2="${centerY + 100}"
          stroke="black"
          stroke-width="2"
        />
      </svg>
    `.trim();
  }

  /**
   * Get the URL path for the default screen
   */
  getDefaultScreenUrl(): string {
    return '/assets/default-screen.png';
  }

  /**
   * Get the filesystem path to the default screen
   */
  getDefaultScreenPath(): string {
    return this.defaultScreenPath;
  }

  /**
   * Check if default screen has been generated
   */
  isReady(): boolean {
    return this.defaultScreenGenerated;
  }

  /**
   * Force regeneration of the default screen
   * Useful if dimensions or content need to change
   */
  async regenerate(
    width: number = this.DEFAULT_WIDTH,
    height: number = this.DEFAULT_HEIGHT,
  ): Promise<string> {
    this.logger.log('Force regenerating default screen...');
    return this.generateDefaultScreen(width, height);
  }

  /**
   * Generate a custom default screen for a specific device model
   * @param modelWidth Device screen width
   * @param modelHeight Device screen height
   * @returns Path to the generated screen
   */
  async generateForModel(
    modelWidth: number,
    modelHeight: number,
  ): Promise<string> {
    const filename = `default-screen-${modelWidth}x${modelHeight}.png`;
    const outputPath = path.join(this.assetsDir, filename);

    // Check if this resolution already exists
    try {
      await fs.access(outputPath);
      return outputPath;
    } catch {
      // Generate new resolution
    }

    this.logger.log(`Generating default screen for model: ${modelWidth}x${modelHeight}`);

    const svg = this.createDefaultScreenSvg(modelWidth, modelHeight);

    const grayBuffer = await sharp(Buffer.from(svg))
      .grayscale()
      .normalise()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const dithered = this.applyFloydSteinbergDithering(
      grayBuffer.data, grayBuffer.info.width, grayBuffer.info.height, 140,
    );

    await sharp(dithered, {
      raw: { width: grayBuffer.info.width, height: grayBuffer.info.height, channels: 1 },
    })
      .negate()
      .png({ compressionLevel: 9, palette: true, colours: 2 })
      .toFile(outputPath);

    return outputPath;
  }

  /**
   * Floyd-Steinberg dithering for 1-bit e-ink output
   */
  private applyFloydSteinbergDithering(
    data: Buffer, width: number, height: number, threshold: number,
  ): Buffer {
    const pixels = new Float32Array(data.length);
    for (let i = 0; i < data.length; i++) {
      const val = data[i];
      if (val > 200) pixels[i] = 255;
      else if (val < 55) pixels[i] = 0;
      else pixels[i] = val;
    }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const oldPixel = pixels[idx];
        const newPixel = oldPixel > threshold ? 255 : 0;
        pixels[idx] = newPixel;
        const error = oldPixel - newPixel;
        if (x + 1 < width) pixels[idx + 1] += error * 7 / 16;
        if (y + 1 < height) {
          if (x - 1 >= 0) pixels[(y + 1) * width + (x - 1)] += error * 3 / 16;
          pixels[(y + 1) * width + x] += error * 5 / 16;
          if (x + 1 < width) pixels[(y + 1) * width + (x + 1)] += error * 1 / 16;
        }
      }
    }

    const result = Buffer.alloc(data.length);
    for (let i = 0; i < data.length; i++) {
      result[i] = Math.max(0, Math.min(255, Math.round(pixels[i])));
    }
    return result;
  }

  /**
   * Get the default screen as base64 encoded string
   */
  async getDefaultScreenBase64(): Promise<string> {
    await this.ensureDefaultScreenExists();

    const buffer = await fs.readFile(this.defaultScreenPath);
    return buffer.toString('base64');
  }

  /**
   * Get the default screen as a buffer
   */
  async getDefaultScreenBuffer(): Promise<Buffer> {
    await this.ensureDefaultScreenExists();

    return fs.readFile(this.defaultScreenPath);
  }
}
