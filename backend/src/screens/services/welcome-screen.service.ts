import { Injectable, Logger } from '@nestjs/common';
import { ImageProcessorService } from './image-processor.service';
import { ScreenRendererService } from '../../screen-designer/services/screen-renderer.service';
import * as path from 'path';
import * as fs from 'fs/promises';
import { generateToken } from '../../common/utils/crypto.util';

/**
 * Welcome Screen Service
 * Generates welcome screens for newly provisioned devices
 * Similar to Ruby's app/aspects/screens/welcomer.rb
 */
@Injectable()
export class WelcomeScreenService {
  private readonly logger = new Logger(WelcomeScreenService.name);
  private readonly uploadsDir = path.join(process.cwd(), 'uploads', 'screens');

  constructor(
    private screenRenderer: ScreenRendererService,
    private imageProcessor: ImageProcessorService,
  ) {
    this.ensureUploadsDir();
  }

  private async ensureUploadsDir() {
    try {
      await fs.mkdir(this.uploadsDir, { recursive: true });
    } catch (error) {
      this.logger.error('Failed to create uploads directory:', error);
    }
  }

  /**
   * Generate welcome screen HTML
   * Creates a simple, clean design optimized for e-ink display
   */
  private generateWelcomeHtml(
    deviceName: string,
    friendlyId: string,
    width: number,
    height: number,
  ): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      width: ${width}px;
      height: ${height}px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      background-color: white;
      color: black;
      font-family: 'Arial', 'Helvetica', sans-serif;
      text-align: center;
      padding: 40px;
    }

    .main-title {
      font-size: 48px;
      font-weight: bold;
      margin-bottom: 30px;
      letter-spacing: 2px;
    }

    .subtitle {
      font-size: 32px;
      margin-bottom: 20px;
      line-height: 1.4;
    }

    .device-info {
      font-size: 24px;
      margin-top: 40px;
      color: #333;
    }

    .footer {
      font-size: 18px;
      margin-top: 60px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="main-title">Hello World</div>
  <div class="subtitle">This is inker!</div>
  <div class="device-info">Device: ${deviceName}</div>
  <div class="device-info">ID: ${friendlyId}</div>
  <div class="footer">Welcome to your terminal display</div>
</body>
</html>
    `.trim();
  }

  /**
   * Create welcome screen for a device
   * Generates HTML, renders to PNG, processes for e-ink, creates thumbnail
   *
   * @param deviceName Device name
   * @param friendlyId Device friendly ID
   * @param width Screen width in pixels
   * @param height Screen height in pixels
   * @param colors Number of colors (for e-ink processing, typically 2)
   * @returns Object with image and thumbnail paths
   */
  async createWelcomeScreen(
    deviceName: string,
    friendlyId: string,
    width: number,
    height: number,
    colors: number = 2,
  ): Promise<{ imageUrl: string; thumbnailUrl: string; imagePath: string }> {
    this.logger.log(
      `Generating welcome screen for device ${deviceName} (${width}x${height})`,
    );

    try {
      // Generate HTML content
      const html = this.generateWelcomeHtml(
        deviceName,
        friendlyId,
        width,
        height,
      );

      // Generate unique filename
      const timestamp = Date.now();
      const token = generateToken(8);
      const filename = `welcome_${timestamp}_${token}.png`;
      const rawPath = path.join(this.uploadsDir, `raw_${filename}`);

      // Generate screenshot from HTML using shared Puppeteer browser
      const screenshotBuffer = await this.screenRenderer.renderHtmlToPng(html, width, height);
      await fs.writeFile(rawPath, screenshotBuffer);

      // Process image for e-ink display with Floyd-Steinberg dithering
      const processedFilename = `processed_${filename}`;
      const processedPath = path.join(this.uploadsDir, processedFilename);

      await this.imageProcessor.processForEinkWithDithering(
        rawPath,
        processedPath,
        width,
        height,
        { dithering: colors === 2 },
      );

      // Create thumbnail
      const thumbnailFilename = `thumb_${filename.replace('.png', '.jpg')}`;
      const thumbnailPath = path.join(this.uploadsDir, thumbnailFilename);

      await this.imageProcessor.createThumbnail(
        processedPath,
        thumbnailPath,
        200,
        150,
      );

      // Clean up raw file
      await fs.unlink(rawPath).catch(() => {
        // Ignore errors if file doesn't exist
      });

      const imageUrl = `/uploads/screens/${processedFilename}`;
      const thumbnailUrl = `/uploads/screens/${thumbnailFilename}`;

      this.logger.log(`Welcome screen created: ${imageUrl}`);

      return {
        imageUrl,
        thumbnailUrl,
        imagePath: processedPath,
      };
    } catch (error) {
      this.logger.error('Failed to create welcome screen:', error);
      throw error;
    }
  }
}
