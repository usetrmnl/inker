import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as sharpModule from 'sharp';
// Handle both ESM and CJS imports for Bun compatibility
const sharp = (sharpModule as any).default || sharpModule;
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Setup Screen Service
 * Generates a welcome/setup screen for newly connected devices
 * This screen is shown immediately after device setup before they get their first playlist content
 */
@Injectable()
export class SetupScreenService implements OnModuleInit {
  private readonly logger = new Logger(SetupScreenService.name);
  private readonly assetsDir: string;
  private readonly setupScreenPath: string;
  private setupScreenGenerated = false;

  // Default TRMNL e-ink display dimensions (800x480)
  private readonly DEFAULT_WIDTH = 800;
  private readonly DEFAULT_HEIGHT = 480;

  constructor() {
    this.assetsDir = path.join(process.cwd(), 'assets');
    this.setupScreenPath = path.join(this.assetsDir, 'setup.png');
  }

  /**
   * Generate setup screen on module initialization
   */
  async onModuleInit() {
    await this.ensureSetupScreenExists();
  }

  /**
   * Ensure the setup screen image exists
   * Generates it if not present
   */
  async ensureSetupScreenExists(): Promise<void> {
    try {
      // Create assets directory if it doesn't exist
      await fs.mkdir(this.assetsDir, { recursive: true });

      // Check if setup screen already exists
      try {
        await fs.access(this.setupScreenPath);
        this.logger.log(`Setup screen already exists at: ${this.setupScreenPath}`);
        this.setupScreenGenerated = true;
        return;
      } catch {
        // File doesn't exist, generate it
      }

      await this.generateSetupScreen();
      this.setupScreenGenerated = true;
      this.logger.log(`Setup screen generated at: ${this.setupScreenPath}`);
    } catch (error) {
      this.logger.error('Failed to ensure setup screen exists:', error);
    }
  }

  /**
   * Generate the setup screen image using Sharp
   * Creates a clean, e-ink optimized welcome screen
   */
  async generateSetupScreen(
    width: number = this.DEFAULT_WIDTH,
    height: number = this.DEFAULT_HEIGHT,
  ): Promise<string> {
    this.logger.log(`Generating setup screen: ${width}x${height}`);

    try {
      // Create SVG with the welcome content
      const svg = this.createSetupScreenSvg(width, height);

      // Convert SVG to e-ink optimized 1-bit PNG (same pipeline as designed screens)
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
        .toFile(this.setupScreenPath);

      this.logger.log(`Setup screen saved to: ${this.setupScreenPath}`);
      return this.setupScreenPath;
    } catch (error) {
      this.logger.error('Failed to generate setup screen:', error);
      throw error;
    }
  }

  /**
   * Create SVG content for the setup screen
   * Shows welcome message and setup instructions
   */
  private createSetupScreenSvg(width: number, height: number): string {
    const centerX = width / 2;
    const centerY = height / 2;

    return `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <!-- White background -->
        <rect width="100%" height="100%" fill="white"/>

        <!-- Checkmark icon circle -->
        <circle
          cx="${centerX}"
          cy="${centerY - 100}"
          r="50"
          fill="none"
          stroke="black"
          stroke-width="4"
        />

        <!-- Checkmark inside circle -->
        <polyline
          points="${centerX - 20},${centerY - 100} ${centerX - 5},${centerY - 85} ${centerX + 25},${centerY - 120}"
          fill="none"
          stroke="black"
          stroke-width="6"
          stroke-linecap="round"
          stroke-linejoin="round"
        />

        <!-- Main title: Device Connected -->
        <text
          x="${centerX}"
          y="${centerY}"
          font-family="Arial, Helvetica, sans-serif"
          font-size="48"
          font-weight="bold"
          fill="black"
          text-anchor="middle"
          dominant-baseline="middle"
        >Device Connected</text>

        <!-- Subtitle: Setup complete -->
        <text
          x="${centerX}"
          y="${centerY + 50}"
          font-family="Arial, Helvetica, sans-serif"
          font-size="24"
          fill="black"
          text-anchor="middle"
          dominant-baseline="middle"
        >Setup complete! Waiting for content...</text>

        <!-- Instructions -->
        <text
          x="${centerX}"
          y="${centerY + 100}"
          font-family="Arial, Helvetica, sans-serif"
          font-size="18"
          fill="black"
          text-anchor="middle"
          dominant-baseline="middle"
        >Assign a playlist in the Inker dashboard</text>

        <!-- Decorative line below instructions -->
        <line
          x1="${centerX - 250}"
          y1="${centerY + 140}"
          x2="${centerX + 250}"
          y2="${centerY + 140}"
          stroke="black"
          stroke-width="1"
        />

        <!-- Inker branding -->
        <text
          x="${centerX}"
          y="${centerY + 170}"
          font-family="Arial, Helvetica, sans-serif"
          font-size="14"
          fill="black"
          text-anchor="middle"
          dominant-baseline="middle"
        >Powered by Inker</text>
      </svg>
    `.trim();
  }

  /**
   * Get the URL path for the setup screen
   */
  getSetupScreenUrl(): string {
    return '/assets/setup.png';
  }

  /**
   * Get the filesystem path to the setup screen
   */
  getSetupScreenPath(): string {
    return this.setupScreenPath;
  }

  /**
   * Check if setup screen has been generated
   */
  isReady(): boolean {
    return this.setupScreenGenerated;
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
   * Force regeneration of the setup screen
   */
  async regenerate(
    width: number = this.DEFAULT_WIDTH,
    height: number = this.DEFAULT_HEIGHT,
  ): Promise<string> {
    this.logger.log('Force regenerating setup screen...');
    return this.generateSetupScreen(width, height);
  }

  /**
   * Get the setup screen as base64 encoded string
   */
  async getSetupScreenBase64(): Promise<string> {
    await this.ensureSetupScreenExists();

    const buffer = await fs.readFile(this.setupScreenPath);
    return buffer.toString('base64');
  }
}
