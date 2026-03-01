import { Injectable, Logger } from '@nestjs/common';
import * as sharpModule from 'sharp';
// Handle both ESM and CJS imports for Bun compatibility
const sharp = (sharpModule as any).default || sharpModule;
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Image Processor Service
 * Uses Sharp for high-performance image processing
 * Handles resize, compress, convert, and optimize images for e-ink displays
 */
@Injectable()
export class ImageProcessorService {
  private readonly logger = new Logger(ImageProcessorService.name);

  /**
   * Process image for e-ink display
   * - Resize to target dimensions
   * - Convert to appropriate format
   * - Optimize for e-ink (reduce colors, increase contrast)
   */
  async processForEink(
    inputPath: string,
    outputPath: string,
    width: number,
    height: number,
    colors: number = 2,
  ): Promise<string> {
    try {
      this.logger.debug(
        `Processing image for e-ink: ${width}x${height}, ${colors} colors`,
      );

      let pipeline = sharp(inputPath)
        .resize(width, height, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        });

      // Apply grayscale for monochrome displays
      if (colors === 2) {
        pipeline = pipeline.grayscale();
      }

      // Output as standard grayscale PNG (not palette-indexed)
      // This avoids palette ordering issues that can cause color inversion on some e-ink displays
      // Grayscale PNG uses 0=black, 255=white which is universally interpreted correctly
      pipeline = pipeline.png({
        compressionLevel: 9,
      });

      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      await fs.mkdir(outputDir, { recursive: true });

      await pipeline.toFile(outputPath);

      this.logger.debug(`Processed image saved to: ${outputPath}`);

      return outputPath;
    } catch (error) {
      this.logger.error('Failed to process image for e-ink:', error);
      throw error;
    }
  }

  /**
   * Create thumbnail from image
   */
  async createThumbnail(
    inputPath: string,
    outputPath: string,
    width: number = 200,
    height: number = 150,
  ): Promise<string> {
    try {
      this.logger.debug(`Creating thumbnail: ${width}x${height}`);

      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      await fs.mkdir(outputDir, { recursive: true });

      await sharp(inputPath)
        .resize(width, height, {
          fit: 'cover',
          position: 'center',
        })
        .jpeg({
          quality: 80,
        })
        .toFile(outputPath);

      this.logger.debug(`Thumbnail saved to: ${outputPath}`);

      return outputPath;
    } catch (error) {
      this.logger.error('Failed to create thumbnail:', error);
      throw error;
    }
  }

  /**
   * Convert image to PNG format
   */
  async convertToPng(inputPath: string, outputPath: string): Promise<string> {
    try {
      this.logger.debug(`Converting image to PNG: ${inputPath}`);

      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      await fs.mkdir(outputDir, { recursive: true });

      await sharp(inputPath)
        .png({
          compressionLevel: 9,
        })
        .toFile(outputPath);

      this.logger.debug(`PNG image saved to: ${outputPath}`);

      return outputPath;
    } catch (error) {
      this.logger.error('Failed to convert to PNG:', error);
      throw error;
    }
  }

  /**
   * Get image metadata
   */
  async getMetadata(imagePath: string) {
    try {
      const metadata = await sharp(imagePath).metadata();
      return {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        channels: metadata.channels,
        hasAlpha: metadata.hasAlpha,
        space: metadata.space,
      };
    } catch (error) {
      this.logger.error('Failed to get image metadata:', error);
      throw error;
    }
  }

  /**
   * Compress image
   */
  async compress(
    inputPath: string,
    outputPath: string,
    quality: number = 80,
  ): Promise<string> {
    try {
      this.logger.debug(`Compressing image, quality: ${quality}`);

      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      await fs.mkdir(outputDir, { recursive: true });

      const extension = path.extname(inputPath).toLowerCase();

      let pipeline = sharp(inputPath);

      switch (extension) {
        case '.jpg':
        case '.jpeg':
          pipeline = pipeline.jpeg({ quality });
          break;
        case '.png':
          pipeline = pipeline.png({
            compressionLevel: Math.floor((100 - quality) / 10),
          });
          break;
        case '.webp':
          pipeline = pipeline.webp({ quality });
          break;
        default:
          pipeline = pipeline.png({ compressionLevel: 9 });
      }

      await pipeline.toFile(outputPath);

      this.logger.debug(`Compressed image saved to: ${outputPath}`);

      return outputPath;
    } catch (error) {
      this.logger.error('Failed to compress image:', error);
      throw error;
    }
  }

  /**
   * Convert image to base64
   */
  async toBase64(imagePath: string): Promise<string> {
    try {
      const buffer = await sharp(imagePath).png().toBuffer();
      return buffer.toString('base64');
    } catch (error) {
      this.logger.error('Failed to convert image to base64:', error);
      throw error;
    }
  }

  /**
   * Apply Floyd-Steinberg dithering for better e-ink rendering
   * This algorithm diffuses quantization error to neighboring pixels,
   * creating the illusion of more gray levels on binary displays.
   *
   * The error distribution pattern:
   *       X   7/16
   * 3/16 5/16 1/16
   *
   * This is the classic Floyd-Steinberg pattern for high-quality dithering.
   */
  async applyDithering(
    inputPath: string,
    outputPath: string,
    threshold: number = 128,
  ): Promise<string> {
    try {
      this.logger.debug('Applying Floyd-Steinberg dithering to image');

      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      await fs.mkdir(outputDir, { recursive: true });

      // Get image as raw grayscale pixels
      const image = sharp(inputPath).grayscale().normalise();
      const metadata = await image.metadata();
      const width = metadata.width!;
      const height = metadata.height!;

      // Get raw pixel data (1 byte per pixel for grayscale)
      const { data, info } = await image
        .raw()
        .toBuffer({ resolveWithObject: true });

      // Create a writable copy of pixel data
      const pixels = new Float32Array(data.length);
      for (let i = 0; i < data.length; i++) {
        pixels[i] = data[i];
      }

      // Apply Floyd-Steinberg dithering
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = y * width + x;
          const oldPixel = pixels[idx];

          // Quantize to black or white
          const newPixel = oldPixel < threshold ? 0 : 255;
          pixels[idx] = newPixel;

          // Calculate quantization error
          const error = oldPixel - newPixel;

          // Distribute error to neighboring pixels (Floyd-Steinberg pattern)
          // Right pixel: 7/16
          if (x + 1 < width) {
            pixels[idx + 1] += (error * 7) / 16;
          }
          // Bottom-left pixel: 3/16
          if (x - 1 >= 0 && y + 1 < height) {
            pixels[(y + 1) * width + (x - 1)] += (error * 3) / 16;
          }
          // Bottom pixel: 5/16
          if (y + 1 < height) {
            pixels[(y + 1) * width + x] += (error * 5) / 16;
          }
          // Bottom-right pixel: 1/16
          if (x + 1 < width && y + 1 < height) {
            pixels[(y + 1) * width + (x + 1)] += (error * 1) / 16;
          }
        }
      }

      // Convert back to Uint8Array, clamping values
      const output = Buffer.alloc(data.length);
      for (let i = 0; i < pixels.length; i++) {
        output[i] = Math.max(0, Math.min(255, Math.round(pixels[i])));
      }

      // Create output image from processed pixels
      await sharp(output, {
        raw: {
          width: info.width,
          height: info.height,
          channels: 1,
        },
      })
        .png({ compressionLevel: 9 })
        .toFile(outputPath);

      this.logger.debug(`Dithered image saved to: ${outputPath}`);

      return outputPath;
    } catch (error) {
      this.logger.error('Failed to apply dithering:', error);
      throw error;
    }
  }

  /**
   * Process image for e-ink with optional dithering
   * Enhanced version that applies Floyd-Steinberg dithering for better results
   */
  async processForEinkWithDithering(
    inputPath: string,
    outputPath: string,
    width: number,
    height: number,
    options: {
      dithering?: boolean;
      threshold?: number;
      contrast?: number;
    } = {},
  ): Promise<string> {
    try {
      const { dithering = true, threshold = 128, contrast = 1.2 } = options;

      this.logger.debug(
        `Processing image for e-ink with dithering: ${width}x${height}`,
      );

      // First resize and prepare the image
      const tempPath = outputPath.replace('.png', '_temp.png');

      let pipeline = sharp(inputPath)
        .resize(width, height, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        })
        .grayscale();

      // Apply contrast enhancement if specified
      if (contrast !== 1) {
        pipeline = pipeline.linear(contrast, -(128 * contrast - 128));
      }

      // Normalize for better tonal range
      pipeline = pipeline.normalise();

      await pipeline.png({ compressionLevel: 9 }).toFile(tempPath);

      if (dithering) {
        // Apply Floyd-Steinberg dithering
        await this.applyDithering(tempPath, outputPath, threshold);
        // Clean up temp file
        await fs.unlink(tempPath).catch(() => {});
      } else {
        // Just rename temp to final
        await fs.rename(tempPath, outputPath);
      }

      this.logger.debug(`Processed e-ink image saved to: ${outputPath}`);

      return outputPath;
    } catch (error) {
      this.logger.error('Failed to process image for e-ink:', error);
      throw error;
    }
  }

  /**
   * Rotate image
   */
  async rotate(
    inputPath: string,
    outputPath: string,
    degrees: number,
  ): Promise<string> {
    try {
      this.logger.debug(`Rotating image: ${degrees} degrees`);

      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      await fs.mkdir(outputDir, { recursive: true });

      await sharp(inputPath)
        .rotate(degrees, {
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        })
        .toFile(outputPath);

      this.logger.debug(`Rotated image saved to: ${outputPath}`);

      return outputPath;
    } catch (error) {
      this.logger.error('Failed to rotate image:', error);
      throw error;
    }
  }
}
