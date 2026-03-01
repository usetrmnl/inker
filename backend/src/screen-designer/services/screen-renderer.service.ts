import {
  Injectable,
  NotFoundException,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { CustomWidgetsService } from '../../custom-widgets/custom-widgets.service';
import { SettingsService } from '../../settings/settings.service';
import * as sharpModule from 'sharp';
import type { Sharp, FitEnum } from 'sharp';
// Handle both ESM and CJS imports for Bun compatibility
const sharp = (sharpModule as any).default || sharpModule;
import puppeteer, { Browser } from 'puppeteer';
import QRCode from 'qrcode';
import { validateUrlSafety } from '../../common/utils/url-safety';
import type { ScreenDesign, ScreenWidget, WidgetTemplate } from '@prisma/client';

type WidgetWithTemplate = ScreenWidget & { template: WidgetTemplate };
type ScreenDesignWithWidgets = ScreenDesign & { widgets: WidgetWithTemplate[] };

/**
 * Device context passed during rendering
 * Contains real-time device data for battery/wifi/info widgets
 */
export interface DeviceContext {
  battery?: number;         // Battery percentage (0-100)
  wifi?: number;            // WiFi RSSI in dBm (e.g., -51)
  deviceName?: string;      // Device name/label
  firmwareVersion?: string; // Firmware version
  macAddress?: string;      // MAC address
}

/**
 * Render mode for screen designs
 * - 'device': Full e-ink processing with inversion (for actual device display)
 * - 'preview': No e-ink processing (RGB preview for admin UI)
 * - 'einkPreview': Full e-ink processing WITHOUT inversion (pixel-perfect preview on RGB display)
 */
export type RenderMode = 'device' | 'preview' | 'einkPreview';

/**
 * Screen Renderer Service
 * Renders screen designs with widgets to PNG images for e-ink devices
 * Uses Puppeteer for 1:1 HTML/CSS rendering matching the frontend
 */
@Injectable()
export class ScreenRendererService implements OnModuleDestroy, OnModuleInit {
  private readonly logger = new Logger(ScreenRendererService.name);
  private browser: Browser | null = null;
  private fontsBase64: Record<string, string> = {};
  private fontStyleTag: string = '';

  // GitHub API cache to reduce rate limit usage (5 minute TTL)
  private githubCache: Map<string, { data: { stars: number; name: string }; timestamp: number }> = new Map();
  private readonly GITHUB_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly GITHUB_CACHE_MAX_SIZE = 100;

  constructor(
    private prisma: PrismaService,
    private customWidgetsService: CustomWidgetsService,
    private configService: ConfigService,
    private settingsService: SettingsService,
  ) {}

  /**
   * Resolve an /uploads/ path safely, preventing path traversal via ../
   */
  private resolveUploadPath(url: string): string {
    const uploadsRoot = path.resolve(process.cwd(), 'uploads');
    const resolved = path.resolve(process.cwd(), url.slice(1)); // remove leading /
    if (!resolved.startsWith(uploadsRoot + path.sep) && resolved !== uploadsRoot) {
      throw new Error('Path traversal detected');
    }
    return resolved;
  }

  /**
   * Load fonts at module initialization
   */
  async onModuleInit() {
    try {
      const fontsDir = path.join(process.cwd(), 'assets', 'fonts');

      if (!fs.existsSync(fontsDir)) {
        this.logger.warn(`Fonts directory not found: ${fontsDir}`);
        return;
      }

      const fontFiles = [
        { name: 'Inter-Regular', weight: 400, family: 'Inter' },
        { name: 'Inter-Medium', weight: 500, family: 'Inter' },
        { name: 'Inter-SemiBold', weight: 600, family: 'Inter' },
        { name: 'Inter-Bold', weight: 700, family: 'Inter' },
        { name: 'RobotoMono-Regular', weight: 400, family: 'Roboto Mono' },
        { name: 'RobotoMono-Medium', weight: 500, family: 'Roboto Mono' },
        { name: 'RobotoMono-Bold', weight: 700, family: 'Roboto Mono' },
        { name: 'Merriweather-Regular', weight: 400, family: 'Merriweather' },
        { name: 'Merriweather-Bold', weight: 700, family: 'Merriweather' },
      ];

      const fontFaces: string[] = [];

      for (const font of fontFiles) {
        const fontPath = path.join(fontsDir, `${font.name}.woff2`);
        if (fs.existsSync(fontPath)) {
          const fontData = fs.readFileSync(fontPath);
          this.fontsBase64[font.name] = fontData.toString('base64');

          fontFaces.push(`
            @font-face {
              font-family: '${font.family}';
              font-style: normal;
              font-weight: ${font.weight};
              font-display: block;
              src: url(data:font/woff2;base64,${this.fontsBase64[font.name]}) format('woff2');
            }
          `);
        } else {
          this.logger.warn(`Font file not found: ${fontPath}`);
        }
      }

      this.fontStyleTag = `<style>${fontFaces.join('\n')}</style>`;
      this.logger.log(`Loaded ${Object.keys(this.fontsBase64).length} fonts for rendering`);
    } catch (error) {
      this.logger.error('Failed to load fonts:', error);
    }
  }

  /**
   * Map generic CSS font families to specific loaded font names
   * This ensures the loaded woff2 fonts are actually used
   */
  private mapFontFamily(fontFamily: string): string {
    switch (fontFamily) {
      case 'sans-serif':
        return "'Inter', sans-serif";
      case 'monospace':
        return "'Roboto Mono', monospace";
      case 'serif':
        return "'Merriweather', serif";
      default:
        // If already a specific font or unknown, return with fallback
        return fontFamily.includes(',') ? fontFamily : `${fontFamily}, sans-serif`;
    }
  }

  /**
   * Get or create Puppeteer browser instance
   * Handles browser reconnection if the browser crashes or disconnects
   */
  private async getBrowser(): Promise<Browser> {
    // Check if browser exists and is still connected
    if (this.browser) {
      try {
        // Test if browser is still responsive by checking if it's connected
        if (!this.browser.connected) {
          this.logger.warn('Puppeteer browser disconnected, reinitializing...');
          this.browser = null;
        }
      } catch {
        // Browser is in an invalid state, reset it
        this.logger.warn('Puppeteer browser in invalid state, reinitializing...');
        this.browser = null;
      }
    }

    if (!this.browser) {
      this.logger.debug('Launching new Puppeteer browser instance');
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--font-render-hinting=none',
          '--disable-font-subpixel-positioning',
          '--force-color-profile=srgb',
          // Network hardening — reduce Chrome's attack surface
          '--disable-background-networking',
          '--disable-default-apps',
          '--disable-extensions',
          '--disable-sync',
          '--disable-translate',
          '--metrics-recording-only',
          '--no-first-run',
        ],
      });

      // Set up disconnect handler to reset browser reference
      this.browser.on('disconnected', () => {
        this.logger.warn('Puppeteer browser disconnected unexpectedly');
        this.browser = null;
      });
    }
    return this.browser;
  }

  /**
   * Cleanup browser on module destroy
   */
  async onModuleDestroy() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Render a screen design to PNG buffer
   * @param screenDesignId - ID of the screen design to render
   * @param deviceContext - Optional device data for battery/wifi/info widgets
   * @param mode - Render mode: 'device' (full e-ink), 'preview' (no processing), 'einkPreview' (e-ink without inversion)
   */
  async renderScreenDesign(screenDesignId: number, deviceContext?: DeviceContext, mode: RenderMode | boolean = 'device'): Promise<Buffer> {
    // Support legacy boolean parameter for backwards compatibility
    const renderMode: RenderMode = typeof mode === 'boolean' ? (mode ? 'preview' : 'device') : mode;

    const screenDesign = await this.prisma.screenDesign.findUnique({
      where: { id: screenDesignId },
      include: {
        widgets: {
          include: {
            template: true,
          },
          orderBy: {
            zIndex: 'asc',
          },
        },
      },
    });

    if (!screenDesign) {
      throw new NotFoundException('Screen design not found');
    }

    return this.renderDesign(screenDesign as ScreenDesignWithWidgets, deviceContext, renderMode);
  }

  /**
   * Render a preview thumbnail of the screen design
   */
  async renderPreview(screenDesignId: number): Promise<Buffer> {
    const fullImage = await this.renderScreenDesign(screenDesignId, undefined, true);

    // Create a 200px wide thumbnail
    const thumbnail = await sharp(fullImage)
      .resize(200, null, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .png()
      .toBuffer();

    return thumbnail;
  }

  /**
   * Internal render method - uses HTML/CSS + Puppeteer for pixel-perfect rendering
   * @param mode - Render mode: 'device' (full e-ink), 'preview' (no processing), 'einkPreview' (e-ink without inversion)
   */
  private async renderDesign(screenDesign: ScreenDesignWithWidgets, deviceContext?: DeviceContext, mode: RenderMode = 'device'): Promise<Buffer> {
    const { width, height } = screenDesign;

    this.logger.debug(
      `Rendering screen design: ${screenDesign.name} (${width}x${height}, mode=${mode})`,
    );

    // Use HTML-based rendering for pixel-perfect output matching frontend
    let renderBuffer = await this.renderDesignAsHtml(screenDesign, deviceContext);

    // Check if a separate drawing file exists and composite it on top
    // This allows screens with dynamic widgets (clock, etc.) to also display drawings
    const drawingPath = path.join(process.cwd(), 'uploads', 'drawings', `drawing_${screenDesign.id}.png`);
    if (fs.existsSync(drawingPath)) {
      this.logger.debug(`Compositing drawing overlay: ${drawingPath}`);
      const drawingBuffer = await fs.promises.readFile(drawingPath);
      renderBuffer = await sharp(renderBuffer)
        .composite([{ input: drawingBuffer, top: 0, left: 0 }])
        .png()
        .toBuffer();
    }

    // For preview mode, return the composited screenshot directly
    if (mode === 'preview') {
      return renderBuffer;
    }

    // Apply e-ink processing for 'device' and 'einkPreview' modes
    // 'device' mode inverts colors for TRMNL e-ink display
    // 'einkPreview' mode applies dithering but no inversion (for admin preview)
    const shouldNegate = mode === 'device';

    // Create Sharp instance from the composited screenshot for e-ink processing
    const canvas = sharp(renderBuffer);

    return this.applyEinkProcessing(canvas, width, height, shouldNegate);
  }

  /**
   * Apply e-ink processing to a sharp canvas
   * - Grayscale conversion
   * - Contrast normalization
   * - Floyd-Steinberg dithering
   * - Optional color inversion (for device display)
   * - 1-bit PNG output
   *
   * @param canvas - Sharp canvas with composited widgets
   * @param width - Original canvas width
   * @param height - Original canvas height
   * @param negate - If true, invert colors (required for TRMNL e-ink devices)
   */
  private async applyEinkProcessing(
    canvas: Sharp,
    width: number,
    height: number,
    negate: boolean,
  ): Promise<Buffer> {
    const MAX_SIZE = 90000; // Max 90KB for TRMNL devices
    const threshold = 140; // Higher threshold favors white

    // First get grayscale raw pixels for Floyd-Steinberg dithering
    const grayBuffer = await canvas
      .grayscale()
      .normalise()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { data, info } = grayBuffer;

    // Apply Floyd-Steinberg dithering
    const ditheredBuffer = this.applyFloydSteinbergDithering(data, info.width, info.height, threshold);

    // Create 1-bit PNG
    let sharpInstance = sharp(ditheredBuffer, {
      raw: {
        width: info.width,
        height: info.height,
        channels: 1,
      },
    });

    // Apply negate for device mode (TRMNL expects inverted colors)
    if (negate) {
      sharpInstance = sharpInstance.negate();
    }

    let buffer = await sharpInstance
      .png({
        compressionLevel: 9,
        palette: true,
        colours: 2,
      })
      .toBuffer();

    // If still too large, scale down and re-dither
    let scale = 1.0;
    let attempts = 0;
    while (buffer.length > MAX_SIZE && attempts < 10) {
      scale *= 0.9;
      attempts++;

      const newWidth = Math.round(width * scale);
      const newHeight = Math.round(height * scale);

      this.logger.debug(
        `Screen too large (${buffer.length} bytes), scaling to ${newWidth}x${newHeight}`,
      );

      // Re-render at smaller size
      const scaledGray = await canvas
        .resize(newWidth, newHeight)
        .grayscale()
        .normalise()
        .raw()
        .toBuffer({ resolveWithObject: true });

      const scaledDithered = this.applyFloydSteinbergDithering(
        scaledGray.data,
        scaledGray.info.width,
        scaledGray.info.height,
        threshold,
      );

      let scaledSharp = sharp(scaledDithered, {
        raw: {
          width: scaledGray.info.width,
          height: scaledGray.info.height,
          channels: 1,
        },
      });

      if (negate) {
        scaledSharp = scaledSharp.negate();
      }

      buffer = await scaledSharp
        .png({
          compressionLevel: 9,
          palette: true,
          colours: 2,
        })
        .toBuffer();
    }

    this.logger.debug(
      `E-ink processing complete: ${buffer.length} bytes, 1-bit, negate=${negate}`,
    );

    return buffer;
  }

  /**
   * Apply Floyd-Steinberg dithering algorithm
   * Converts grayscale image data to 1-bit with error diffusion
   */
  private applyFloydSteinbergDithering(
    data: Buffer,
    width: number,
    height: number,
    threshold: number,
  ): Buffer {
    const pixels = new Float32Array(data.length);

    // Pre-dithering contrast enhancement
    for (let i = 0; i < data.length; i++) {
      const val = data[i];
      if (val > 200) pixels[i] = 255;      // Near-white becomes pure white
      else if (val < 55) pixels[i] = 0;    // Near-black becomes pure black
      else pixels[i] = val;
    }

    // Floyd-Steinberg dithering
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const oldPixel = pixels[idx];
        const newPixel = oldPixel < threshold ? 0 : 255;
        pixels[idx] = newPixel;
        const error = oldPixel - newPixel;

        // Error diffusion: 7/16, 3/16, 5/16, 1/16
        if (x + 1 < width) {
          pixels[idx + 1] += (error * 7) / 16;
        }
        if (x - 1 >= 0 && y + 1 < height) {
          pixels[(y + 1) * width + (x - 1)] += (error * 3) / 16;
        }
        if (y + 1 < height) {
          pixels[(y + 1) * width + x] += (error * 5) / 16;
        }
        if (x + 1 < width && y + 1 < height) {
          pixels[(y + 1) * width + (x + 1)] += (error * 1) / 16;
        }
      }
    }

    // Convert back to buffer
    const output = Buffer.alloc(data.length);
    for (let i = 0; i < pixels.length; i++) {
      output[i] = Math.max(0, Math.min(255, Math.round(pixels[i])));
    }

    return output;
  }

  /**
   * Render a single widget to a buffer
   */
  private async renderWidget(widget: WidgetWithTemplate, deviceContext?: DeviceContext): Promise<Buffer | null> {
    const { template, width, height, config } = widget;
    const widgetConfig = config as Record<string, any>;

    switch (template.name) {
      case 'clock':
        return this.renderClockWidget(width, height, widgetConfig);

      case 'date':
        return this.renderDateWidget(width, height, widgetConfig);

      case 'text':
        return this.renderTextWidget(width, height, widgetConfig);

      case 'weather':
        return this.renderWeatherWidget(width, height, widgetConfig);

      case 'qrcode':
        return this.renderQRCodeWidget(width, height, widgetConfig);

      case 'battery':
        return this.renderBatteryWidget(width, height, widgetConfig, deviceContext);

      case 'countdown':
        return this.renderCountdownWidget(width, height, widgetConfig);

      case 'divider':
        return this.renderDividerWidget(width, height, widgetConfig);

      case 'rectangle':
        return this.renderRectangleWidget(width, height, widgetConfig);

      case 'wifi':
        return this.renderWifiWidget(width, height, widgetConfig, deviceContext);

      case 'deviceinfo':
        return this.renderDeviceInfoWidget(width, height, widgetConfig, deviceContext);

      case 'image':
        return this.renderImageWidget(width, height, widgetConfig);

      case 'daysuntil':
        return this.renderDaysUntilWidget(width, height, widgetConfig);

      case 'github':
        return this.renderGitHubWidget(width, height, widgetConfig);

      case 'custom-widget-base':
        return this.renderCustomWidget(width, height, widgetConfig);

      default:
        this.logger.warn(`Unknown widget type: ${template.name}`);
        return this.renderPlaceholderWidget(width, height, template.label);
    }
  }

  /**
   * Render clock widget
   */
  private async renderClockWidget(
    width: number,
    height: number,
    config: Record<string, any>,
  ): Promise<Buffer> {
    const now = new Date();
    const format = config.format || '24h';
    const showSeconds = config.showSeconds || false;
    const fontSize = config.fontSize || 48;

    // Handle timezone:
    // - 'local' or empty: Use configured DEFAULT_TIMEZONE (falls back to UTC)
    // - Otherwise use the specified IANA timezone like 'Europe/Warsaw', 'America/New_York'
    // Note: Docker containers default to UTC, so this is configurable via env var
    const timezone = config.timezone || 'local';
    const defaultTimezone = this.configService.get<string>('defaultTimezone', 'UTC');
    const effectiveTimezone = (timezone === 'local' || timezone === '')
      ? defaultTimezone
      : timezone;

    // Format time based on timezone
    const options: Intl.DateTimeFormatOptions = {
      timeZone: effectiveTimezone,
      hour: '2-digit',
      minute: '2-digit',
      second: showSeconds ? '2-digit' : undefined,
      hour12: format === '12h',
    };

    const timeStr = now.toLocaleTimeString('en-US', options);

    this.logger.debug(`Rendering clock: timezone=${effectiveTimezone}, time=${timeStr}`);

    return this.renderTextToBuffer(timeStr, width, height, {
      fontSize,
      fontFamily: config.fontFamily || 'monospace',
      color: this.sanitizeColor(config.color || '#000000'),
      textAlign: config.textAlign || 'left',
      noWrap: true,
    });
  }

  /**
   * Render date widget
   * Supports configurable display of: weekday, day, month, year
   */
  private async renderDateWidget(
    width: number,
    height: number,
    config: Record<string, any>,
  ): Promise<Buffer> {
    const now = new Date();
    const fontSize = config.fontSize || 24;
    const locale = config.locale || 'en-US';

    // Configurable date parts (all default to true except weekday)
    const showWeekday = config.showWeekday ?? config.showDayOfWeek ?? false;
    const showDay = config.showDay ?? true;
    const showMonth = config.showMonth ?? true;
    const showYear = config.showYear ?? true;

    // Handle timezone:
    // - 'local' or empty: Use configured DEFAULT_TIMEZONE (falls back to UTC)
    // - Otherwise use the specified IANA timezone like 'Europe/Warsaw', 'America/New_York'
    // Note: Docker containers default to UTC, so this is configurable via env var
    const timezone = config.timezone || 'local';
    const defaultTimezone = this.configService.get<string>('defaultTimezone', 'UTC');
    const effectiveTimezone = (timezone === 'local' || timezone === '')
      ? defaultTimezone
      : timezone;

    // Build format options based on what should be shown
    const options: Intl.DateTimeFormatOptions = {
      timeZone: effectiveTimezone,
    };

    if (showWeekday) {
      options.weekday = 'long';
    }
    if (showDay) {
      options.day = 'numeric';
    }
    if (showMonth) {
      options.month = 'long';
    }
    if (showYear) {
      options.year = 'numeric';
    }

    // Fallback if nothing is selected
    if (!showWeekday && !showDay && !showMonth && !showYear) {
      options.day = 'numeric';
      options.month = 'long';
      options.year = 'numeric';
    }

    const dateStr = now.toLocaleDateString(locale, options);

    return this.renderTextToBuffer(dateStr, width, height, {
      fontSize,
      fontFamily: config.fontFamily || 'sans-serif',
      color: this.sanitizeColor(config.color || '#000000'),
      textAlign: config.textAlign || 'center',
      noWrap: true,
    });
  }

  /**
   * Render text widget
   */
  private async renderTextWidget(
    width: number,
    height: number,
    config: Record<string, any>,
  ): Promise<Buffer> {
    const text = config.text || 'Text';
    const fontSize = config.fontSize || 24;

    return this.renderTextToBuffer(text, width, height, {
      fontSize,
      fontFamily: config.fontFamily || 'sans-serif',
      fontWeight: config.fontWeight || 'normal',
      color: this.sanitizeColor(config.color || '#000000'),
      textAlign: config.textAlign || 'left',
    });
  }

  /**
   * Weather code to condition text mapping (WMO codes)
   * https://open-meteo.com/en/docs
   */
  private getWeatherCondition(code: number): { text: string; icon: string } {
    const conditions: Record<number, { text: string; icon: string }> = {
      0: { text: 'Clear', icon: 'sun' },
      1: { text: 'Mostly Clear', icon: 'sun' },
      2: { text: 'Partly Cloudy', icon: 'cloud-sun' },
      3: { text: 'Cloudy', icon: 'cloud' },
      45: { text: 'Foggy', icon: 'fog' },
      48: { text: 'Icy Fog', icon: 'fog' },
      51: { text: 'Light Drizzle', icon: 'drizzle' },
      53: { text: 'Drizzle', icon: 'drizzle' },
      55: { text: 'Heavy Drizzle', icon: 'drizzle' },
      56: { text: 'Freezing Drizzle', icon: 'drizzle' },
      57: { text: 'Heavy Freezing Drizzle', icon: 'drizzle' },
      61: { text: 'Light Rain', icon: 'rain' },
      63: { text: 'Rain', icon: 'rain' },
      65: { text: 'Heavy Rain', icon: 'rain' },
      66: { text: 'Freezing Rain', icon: 'rain' },
      67: { text: 'Heavy Freezing Rain', icon: 'rain' },
      71: { text: 'Light Snow', icon: 'snow' },
      73: { text: 'Snow', icon: 'snow' },
      75: { text: 'Heavy Snow', icon: 'snow' },
      77: { text: 'Snow Grains', icon: 'snow' },
      80: { text: 'Light Showers', icon: 'rain' },
      81: { text: 'Showers', icon: 'rain' },
      82: { text: 'Heavy Showers', icon: 'rain' },
      85: { text: 'Snow Showers', icon: 'snow' },
      86: { text: 'Heavy Snow Showers', icon: 'snow' },
      95: { text: 'Thunderstorm', icon: 'thunder' },
      96: { text: 'Thunderstorm + Hail', icon: 'thunder' },
      99: { text: 'Heavy Thunderstorm', icon: 'thunder' },
    };
    return conditions[code] || { text: 'Unknown', icon: 'cloud' };
  }

  /**
   * Get weather icon SVG path
   */
  private getWeatherIconSvg(icon: string, size: number, color: string): string {
    const cx = size / 2;
    const cy = size / 2;
    const r = size * 0.3;

    switch (icon) {
      case 'sun':
        // Sun with rays
        return `
          <circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}"/>
          ${[0, 45, 90, 135, 180, 225, 270, 315].map(angle => {
            const rad = (angle * Math.PI) / 180;
            const x1 = cx + Math.cos(rad) * (r + 4);
            const y1 = cy + Math.sin(rad) * (r + 4);
            const x2 = cx + Math.cos(rad) * (r + 10);
            const y2 = cy + Math.sin(rad) * (r + 10);
            return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="2"/>`;
          }).join('')}
        `;
      case 'cloud':
        return `
          <ellipse cx="${cx - 5}" cy="${cy + 5}" rx="${r * 0.8}" ry="${r * 0.6}" fill="${color}"/>
          <ellipse cx="${cx + 8}" cy="${cy + 5}" rx="${r * 0.7}" ry="${r * 0.5}" fill="${color}"/>
          <ellipse cx="${cx}" cy="${cy - 2}" rx="${r}" ry="${r * 0.7}" fill="${color}"/>
        `;
      case 'cloud-sun':
        return `
          <circle cx="${cx + 10}" cy="${cy - 8}" r="${r * 0.5}" fill="${color}"/>
          ${[0, 60, 120, 180, 240, 300].map(angle => {
            const rad = (angle * Math.PI) / 180;
            const x1 = cx + 10 + Math.cos(rad) * (r * 0.5 + 3);
            const y1 = cy - 8 + Math.sin(rad) * (r * 0.5 + 3);
            const x2 = cx + 10 + Math.cos(rad) * (r * 0.5 + 7);
            const y2 = cy - 8 + Math.sin(rad) * (r * 0.5 + 7);
            return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="1.5"/>`;
          }).join('')}
          <ellipse cx="${cx - 5}" cy="${cy + 8}" rx="${r * 0.7}" ry="${r * 0.5}" fill="${color}"/>
          <ellipse cx="${cx + 6}" cy="${cy + 8}" rx="${r * 0.6}" ry="${r * 0.45}" fill="${color}"/>
          <ellipse cx="${cx}" cy="${cy + 2}" rx="${r * 0.85}" ry="${r * 0.6}" fill="${color}"/>
        `;
      case 'rain':
        return `
          <ellipse cx="${cx - 5}" cy="${cy - 5}" rx="${r * 0.7}" ry="${r * 0.5}" fill="${color}"/>
          <ellipse cx="${cx + 6}" cy="${cy - 5}" rx="${r * 0.6}" ry="${r * 0.45}" fill="${color}"/>
          <ellipse cx="${cx}" cy="${cy - 10}" rx="${r * 0.85}" ry="${r * 0.6}" fill="${color}"/>
          <line x1="${cx - 8}" y1="${cy + 5}" x2="${cx - 12}" y2="${cy + 15}" stroke="${color}" stroke-width="2"/>
          <line x1="${cx}" y1="${cy + 5}" x2="${cx - 4}" y2="${cy + 15}" stroke="${color}" stroke-width="2"/>
          <line x1="${cx + 8}" y1="${cy + 5}" x2="${cx + 4}" y2="${cy + 15}" stroke="${color}" stroke-width="2"/>
        `;
      case 'drizzle':
        return `
          <ellipse cx="${cx - 5}" cy="${cy - 5}" rx="${r * 0.7}" ry="${r * 0.5}" fill="${color}"/>
          <ellipse cx="${cx + 6}" cy="${cy - 5}" rx="${r * 0.6}" ry="${r * 0.45}" fill="${color}"/>
          <ellipse cx="${cx}" cy="${cy - 10}" rx="${r * 0.85}" ry="${r * 0.6}" fill="${color}"/>
          <circle cx="${cx - 6}" cy="${cy + 8}" r="2" fill="${color}"/>
          <circle cx="${cx + 2}" cy="${cy + 12}" r="2" fill="${color}"/>
          <circle cx="${cx + 8}" cy="${cy + 6}" r="2" fill="${color}"/>
        `;
      case 'snow':
        return `
          <ellipse cx="${cx - 5}" cy="${cy - 5}" rx="${r * 0.7}" ry="${r * 0.5}" fill="${color}"/>
          <ellipse cx="${cx + 6}" cy="${cy - 5}" rx="${r * 0.6}" ry="${r * 0.45}" fill="${color}"/>
          <ellipse cx="${cx}" cy="${cy - 10}" rx="${r * 0.85}" ry="${r * 0.6}" fill="${color}"/>
          <text x="${cx - 8}" y="${cy + 12}" font-size="12" fill="${color}">*</text>
          <text x="${cx}" y="${cy + 16}" font-size="12" fill="${color}">*</text>
          <text x="${cx + 8}" y="${cy + 10}" font-size="12" fill="${color}">*</text>
        `;
      case 'thunder':
        return `
          <ellipse cx="${cx - 5}" cy="${cy - 8}" rx="${r * 0.7}" ry="${r * 0.5}" fill="${color}"/>
          <ellipse cx="${cx + 6}" cy="${cy - 8}" rx="${r * 0.6}" ry="${r * 0.45}" fill="${color}"/>
          <ellipse cx="${cx}" cy="${cy - 13}" rx="${r * 0.85}" ry="${r * 0.6}" fill="${color}"/>
          <path d="M ${cx - 2} ${cy} L ${cx + 5} ${cy} L ${cx} ${cy + 8} L ${cx + 8} ${cy + 8} L ${cx - 3} ${cy + 20} L ${cx} ${cy + 10} L ${cx - 6} ${cy + 10} Z" fill="${color}"/>
        `;
      case 'fog':
        return `
          <line x1="${cx - 15}" y1="${cy - 8}" x2="${cx + 15}" y2="${cy - 8}" stroke="${color}" stroke-width="3" stroke-linecap="round"/>
          <line x1="${cx - 12}" y1="${cy}" x2="${cx + 12}" y2="${cy}" stroke="${color}" stroke-width="3" stroke-linecap="round"/>
          <line x1="${cx - 15}" y1="${cy + 8}" x2="${cx + 15}" y2="${cy + 8}" stroke="${color}" stroke-width="3" stroke-linecap="round"/>
        `;
      default:
        return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="2"/>`;
    }
  }

  /**
   * Fetch weather data from Open-Meteo API
   */
  private async fetchWeatherData(
    latitude: number,
    longitude: number,
    forecastDay: number,
    forecastTime: string,
  ): Promise<{
    temperature: number;
    weatherCode: number;
    humidity: number;
    windSpeed: number;
    dayName: string;
  } | null> {
    try {
      // Build API URL with required parameters
      const url = new URL('https://api.open-meteo.com/v1/forecast');
      url.searchParams.set('latitude', latitude.toString());
      url.searchParams.set('longitude', longitude.toString());
      url.searchParams.set('current', 'temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m');
      url.searchParams.set('hourly', 'temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m');
      url.searchParams.set('forecast_days', Math.max(forecastDay + 1, 1).toString());
      url.searchParams.set('timezone', 'auto');

      this.logger.debug(`Fetching weather from: ${url.toString()}`);

      // Add timeout to prevent hanging on slow weather API
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(url.toString(), { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Weather API error: ${response.status}`);
      }

      const data = await response.json();

      // Determine which data to use based on forecastDay and forecastTime
      const now = new Date();
      let targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + forecastDay);

      // Get day name
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      let dayName = dayNames[targetDate.getDay()];
      if (forecastDay === 0) dayName = 'Today';
      else if (forecastDay === 1) dayName = 'Tomorrow';

      // If current weather (day 0, time current), use current data
      if (forecastDay === 0 && forecastTime === 'current') {
        return {
          temperature: Math.round(data.current.temperature_2m),
          weatherCode: data.current.weather_code,
          humidity: data.current.relative_humidity_2m,
          windSpeed: Math.round(data.current.wind_speed_10m),
          dayName,
        };
      }

      // Otherwise, find the appropriate hourly data
      const hourMap: Record<string, number> = {
        'current': now.getHours(),
        'morning': 8,
        'noon': 12,
        'afternoon': 15,
        'evening': 19,
        'night': 22,
      };

      const targetHour = hourMap[forecastTime] ?? 12;

      // Build target datetime string (YYYY-MM-DDTHH:00)
      const year = targetDate.getFullYear();
      const month = String(targetDate.getMonth() + 1).padStart(2, '0');
      const day = String(targetDate.getDate()).padStart(2, '0');
      const hour = String(targetHour).padStart(2, '0');
      const targetTimeStr = `${year}-${month}-${day}T${hour}:00`;

      // Find the index in hourly data
      const hourlyTimes = data.hourly?.time || [];
      const index = hourlyTimes.findIndex((t: string) => t === targetTimeStr);

      if (index >= 0 && data.hourly) {
        return {
          temperature: Math.round(data.hourly.temperature_2m[index]),
          weatherCode: data.hourly.weather_code[index],
          humidity: data.hourly.relative_humidity_2m[index],
          windSpeed: Math.round(data.hourly.wind_speed_10m[index]),
          dayName,
        };
      }

      // Fallback to current if hourly not found
      return {
        temperature: Math.round(data.current.temperature_2m),
        weatherCode: data.current.weather_code,
        humidity: data.current.relative_humidity_2m,
        windSpeed: Math.round(data.current.wind_speed_10m),
        dayName,
      };
    } catch (error) {
      this.logger.warn(`Failed to fetch weather: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * Render weather widget with real data from Open-Meteo API
   */
  private async renderWeatherWidget(
    width: number,
    height: number,
    config: Record<string, any>,
  ): Promise<Buffer> {
    const location = config.location || 'Unknown';
    const latitude = config.latitude || 52.2297;
    const longitude = config.longitude || 21.0122;
    const units = config.units || 'metric';
    const forecastDay = config.forecastDay || 0;
    const forecastTime = config.forecastTime || 'current';
    const fontSize = config.fontSize || 32;
    const showIcon = config.showIcon !== false;
    const showTemperature = config.showTemperature !== false;
    const showCondition = config.showCondition !== false;
    const showLocation = config.showLocation !== false;
    const showHumidity = config.showHumidity || false;
    const showWind = config.showWind || false;
    const showDayName = config.showDayName || false;
    const color = this.sanitizeColor(config.color || '#000000');

    // Fetch real weather data
    const weatherData = await this.fetchWeatherData(latitude, longitude, forecastDay, forecastTime);

    if (!weatherData) {
      // Fallback to placeholder if API fails
      return this.renderTextToBuffer(`${location}\nWeather unavailable`, width, height, {
        fontSize: fontSize * 0.7,
        fontFamily: 'sans-serif',
        color: '#000000',
        textAlign: 'center',
      });
    }

    const { temperature, weatherCode, humidity, windSpeed, dayName } = weatherData;
    const condition = this.getWeatherCondition(weatherCode);

    // Convert temperature if imperial
    const displayTemp = units === 'imperial'
      ? Math.round((temperature * 9/5) + 32)
      : temperature;
    const tempUnit = units === 'imperial' ? '°F' : '°C';

    // Build SVG content
    const iconSize = Math.min(width * 0.3, height * 0.5, 60);
    const tempFontSize = fontSize;
    const smallFontSize = Math.max(12, fontSize * 0.5);

    let svgContent = '';
    let currentY = 10;

    // Day name (if forecast)
    if (showDayName && forecastDay > 0) {
      svgContent += `
        <text x="${width/2}" y="${currentY + smallFontSize}" text-anchor="middle"
              font-size="${smallFontSize}" font-family="sans-serif" fill="${color}">
          ${dayName}
        </text>
      `;
      currentY += smallFontSize + 5;
    }

    // Layout: icon on left, temp and condition on right
    const iconX = showIcon ? 10 : 0;
    const textX = showIcon ? iconSize + 20 : width / 2;
    const textAnchor = showIcon ? 'start' : 'middle';

    // Weather icon
    if (showIcon) {
      const iconY = currentY + 5;
      svgContent += `
        <g transform="translate(${iconX}, ${iconY})">
          ${this.getWeatherIconSvg(condition.icon, iconSize, color)}
        </g>
      `;
    }

    // Temperature
    if (showTemperature) {
      const tempY = currentY + tempFontSize + 5;
      svgContent += `
        <text x="${textX}" y="${tempY}" text-anchor="${textAnchor}"
              font-size="${tempFontSize}" font-family="sans-serif" font-weight="bold" fill="${color}">
          ${displayTemp}${tempUnit}
        </text>
      `;
      currentY = tempY + 5;
    }

    // Condition text
    if (showCondition) {
      currentY += smallFontSize + 3;
      svgContent += `
        <text x="${textX}" y="${currentY}" text-anchor="${textAnchor}"
              font-size="${smallFontSize}" font-family="sans-serif" fill="${color}">
          ${condition.text}
        </text>
      `;
    }

    // Humidity
    if (showHumidity) {
      currentY += smallFontSize + 3;
      svgContent += `
        <text x="${textX}" y="${currentY}" text-anchor="${textAnchor}"
              font-size="${smallFontSize}" font-family="sans-serif" fill="${color}">
          Humidity: ${humidity}%
        </text>
      `;
    }

    // Wind speed
    if (showWind) {
      currentY += smallFontSize + 3;
      const windUnit = units === 'imperial' ? 'mph' : 'km/h';
      const displayWind = units === 'imperial' ? Math.round(windSpeed * 0.621) : windSpeed;
      svgContent += `
        <text x="${textX}" y="${currentY}" text-anchor="${textAnchor}"
              font-size="${smallFontSize}" font-family="sans-serif" fill="${color}">
          Wind: ${displayWind} ${windUnit}
        </text>
      `;
    }

    // Location name at bottom
    if (showLocation) {
      currentY = height - 5;
      svgContent += `
        <text x="${width/2}" y="${currentY}" text-anchor="middle"
              font-size="${smallFontSize * 0.9}" font-family="sans-serif" fill="${color}">
          ${this.escapeXml(location)}
        </text>
      `;
    }

    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        ${svgContent}
      </svg>
    `;

    return sharp(Buffer.from(svg)).png().toBuffer();
  }

  /**
   * Render QR code widget
   * Generates QR code locally using qrcode library (no external API)
   */
  private async renderQRCodeWidget(
    width: number,
    height: number,
    config: Record<string, any>,
  ): Promise<Buffer> {
    const content = config.content || 'https://example.com';
    const size = Math.min(width, height);

    try {
      // Generate QR code locally
      const qrBuffer = await QRCode.toBuffer(content, {
        width: size,
        margin: 1,
        errorCorrectionLevel: 'M',
        color: { dark: '#000000', light: '#ffffff' },
      });

      // Resize to exact widget dimensions with transparent background
      const resizedBuffer = await sharp(qrBuffer)
        .resize(width, height, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer();

      return resizedBuffer;
    } catch (error) {
      this.logger.warn(`Failed to generate QR code: ${error instanceof Error ? error.message : String(error)}`);
      // Fallback to placeholder on error
      return this.renderPlaceholderWidget(width, height, 'QR Code');
    }
  }

  /**
   * Render battery widget with icon
   */
  private async renderBatteryWidget(
    width: number,
    height: number,
    config: Record<string, any>,
    deviceContext?: DeviceContext,
  ): Promise<Buffer> {
    const showPercentage = config.showPercentage ?? true;
    const showIcon = config.showIcon ?? true;
    const fontSize = config.fontSize || 18;
    const color = this.sanitizeColor(config.color || '#000000');

    // Use real battery data from device context, or show placeholder
    const battery = deviceContext?.battery;
    const percentage = battery !== undefined ? Math.round(battery) : 85; // Default 85 for preview
    const percentageText = battery !== undefined ? `${percentage}%` : '--%';

    // Calculate icon size based on font size
    const iconSize = Math.max(24, fontSize * 1.2);
    const iconWidth = iconSize * 1.2; // Battery icon is wider
    const iconHeight = iconSize * 0.7;

    // Calculate fill width based on battery percentage
    const fillPercent = typeof percentage === 'number' ? percentage : 0;
    const fillWidth = Math.max(0, (fillPercent / 100) * (iconWidth - 8));

    // Calculate layout
    const gap = 8;
    let totalContentWidth = 0;
    if (showIcon) totalContentWidth += iconWidth + 6; // Icon + terminal
    if (showIcon && showPercentage) totalContentWidth += gap;
    if (showPercentage) totalContentWidth += percentageText.length * fontSize * 0.6;

    const startX = (width - totalContentWidth) / 2;
    const centerY = height / 2;

    // Build SVG elements
    let svgContent = '';
    let currentX = startX;

    // Battery icon (outline + fill + terminal)
    if (showIcon) {
      const iconY = centerY - iconHeight / 2;

      // Battery body outline
      svgContent += `
        <rect x="${currentX}" y="${iconY}" width="${iconWidth}" height="${iconHeight}"
              rx="3" ry="3" fill="none" stroke="${color}" stroke-width="2"/>
      `;

      // Battery fill (based on percentage)
      if (fillWidth > 0) {
        svgContent += `
          <rect x="${currentX + 3}" y="${iconY + 3}" width="${fillWidth}" height="${iconHeight - 6}"
                rx="1" ry="1" fill="${color}"/>
        `;
      }

      // Battery terminal (the small bump on the right)
      svgContent += `
        <rect x="${currentX + iconWidth}" y="${iconY + iconHeight * 0.25}"
              width="6" height="${iconHeight * 0.5}" rx="1" ry="1" fill="${color}"/>
      `;

      currentX += iconWidth + 6 + gap;
    }

    // Percentage text
    if (showPercentage) {
      const textY = centerY + fontSize * 0.35;
      svgContent += `
        <text x="${currentX}" y="${textY}" font-size="${fontSize}" font-family="sans-serif" fill="${color}">
          ${percentageText}
        </text>
      `;
    }

    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        ${svgContent}
      </svg>
    `;

    return sharp(Buffer.from(svg)).png().toBuffer();
  }

  /**
   * Render countdown widget
   */
  private async renderCountdownWidget(
    width: number,
    height: number,
    config: Record<string, any>,
  ): Promise<Buffer> {
    const targetDate = new Date(config.targetDate || new Date());
    const label = config.label || 'Countdown';
    const fontSize = config.fontSize || 32;

    const now = new Date();
    const diff = targetDate.getTime() - now.getTime();

    let countdownText = '';
    if (diff > 0) {
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      const parts: string[] = [];
      if (config.showDays !== false && days > 0) parts.push(`${days}d`);
      if (config.showHours !== false) parts.push(`${hours}h`);
      if (config.showMinutes !== false) parts.push(`${minutes}m`);

      countdownText = parts.join(' ');
    } else {
      countdownText = 'Expired';
    }

    const text = `${label}\n${countdownText}`;

    return this.renderTextToBuffer(text, width, height, {
      fontSize,
      fontFamily: config.fontFamily || 'monospace',
      color: this.sanitizeColor(config.color || '#000000'),
      textAlign: 'left',
      noWrap: true,
    });
  }

  /**
   * Render divider widget
   * Creates a line (horizontal or vertical) centered within the widget area
   */
  private async renderDividerWidget(
    width: number,
    height: number,
    config: Record<string, any>,
  ): Promise<Buffer> {
    const orientation = config.orientation || 'horizontal';
    const color = this.sanitizeColor(config.color || '#000000');
    const thickness = config.thickness || 2;
    const style = config.style || 'solid';

    // Build SVG with line centered in widget area
    let lineElement: string;

    if (orientation === 'horizontal') {
      const y = Math.floor(height / 2);
      const strokeDasharray = style === 'dashed' ? `${thickness * 3},${thickness * 2}` :
                              style === 'dotted' ? `${thickness},${thickness}` : 'none';
      lineElement = `<line x1="0" y1="${y}" x2="${width}" y2="${y}"
                          stroke="${color}" stroke-width="${thickness}"
                          ${strokeDasharray !== 'none' ? `stroke-dasharray="${strokeDasharray}"` : ''}/>`;
    } else {
      const x = Math.floor(width / 2);
      const strokeDasharray = style === 'dashed' ? `${thickness * 3},${thickness * 2}` :
                              style === 'dotted' ? `${thickness},${thickness}` : 'none';
      lineElement = `<line x1="${x}" y1="0" x2="${x}" y2="${height}"
                          stroke="${color}" stroke-width="${thickness}"
                          ${strokeDasharray !== 'none' ? `stroke-dasharray="${strokeDasharray}"` : ''}/>`;
    }

    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${width}" height="${height}" fill="white"/>
        ${lineElement}
      </svg>
    `;

    return sharp(Buffer.from(svg)).png().toBuffer();
  }

  /**
   * Render rectangle widget
   */
  private async renderRectangleWidget(
    width: number,
    height: number,
    config: Record<string, any>,
  ): Promise<Buffer> {
    const fillColor = this.parseColor(config.fillColor || '#000000');
    const borderRadius = config.borderRadius || 0;

    // Create a simple rectangle (borderRadius would need SVG overlay for proper support)
    return sharp({
      create: {
        width,
        height,
        channels: 4,
        background: fillColor,
      },
    })
      .png()
      .toBuffer();
  }

  /**
   * Render WiFi widget with icon
   */
  private async renderWifiWidget(
    width: number,
    height: number,
    config: Record<string, any>,
    deviceContext?: DeviceContext,
  ): Promise<Buffer> {
    const fontSize = config.fontSize || 18;
    const showStrength = config.showStrength !== false;
    const showIcon = config.showIcon !== false;
    const color = this.sanitizeColor(config.color || '#000000');

    // Use real WiFi RSSI from device context, or show placeholder
    const rssi = deviceContext?.wifi;
    const rssiText = rssi !== undefined ? `${rssi} dBm` : '-- dBm';

    // Calculate icon size based on font size
    const iconSize = Math.max(24, fontSize * 1.4);

    // Calculate layout
    const gap = 8;
    let totalContentWidth = 0;
    if (showIcon) totalContentWidth += iconSize;
    if (showIcon && showStrength) totalContentWidth += gap;
    if (showStrength) totalContentWidth += rssiText.length * fontSize * 0.6;

    const startX = (width - totalContentWidth) / 2;
    const centerY = height / 2;

    // Build SVG elements
    let svgContent = '';
    let currentX = startX;

    // WiFi icon (signal arcs)
    if (showIcon) {
      const iconCenterX = currentX + iconSize / 2;
      const iconCenterY = centerY + iconSize * 0.2;

      // WiFi arcs (from outer to inner)
      // Outer arc
      svgContent += `
        <path d="M ${iconCenterX - iconSize * 0.45} ${iconCenterY - iconSize * 0.3}
                 Q ${iconCenterX} ${iconCenterY - iconSize * 0.7}
                   ${iconCenterX + iconSize * 0.45} ${iconCenterY - iconSize * 0.3}"
              fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round"/>
      `;

      // Middle arc
      svgContent += `
        <path d="M ${iconCenterX - iconSize * 0.3} ${iconCenterY - iconSize * 0.15}
                 Q ${iconCenterX} ${iconCenterY - iconSize * 0.45}
                   ${iconCenterX + iconSize * 0.3} ${iconCenterY - iconSize * 0.15}"
              fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round"/>
      `;

      // Inner arc
      svgContent += `
        <path d="M ${iconCenterX - iconSize * 0.15} ${iconCenterY}
                 Q ${iconCenterX} ${iconCenterY - iconSize * 0.2}
                   ${iconCenterX + iconSize * 0.15} ${iconCenterY}"
              fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round"/>
      `;

      // Center dot
      svgContent += `
        <circle cx="${iconCenterX}" cy="${iconCenterY + iconSize * 0.1}" r="3" fill="${color}"/>
      `;

      currentX += iconSize + gap;
    }

    // Signal strength text
    if (showStrength) {
      const textY = centerY + fontSize * 0.35;
      svgContent += `
        <text x="${currentX}" y="${textY}" font-size="${fontSize}" font-family="sans-serif" fill="${color}">
          ${rssiText}
        </text>
      `;
    }

    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        ${svgContent}
      </svg>
    `;

    return sharp(Buffer.from(svg)).png().toBuffer();
  }

  /**
   * Render device info widget
   */
  private async renderDeviceInfoWidget(
    width: number,
    height: number,
    config: Record<string, any>,
    deviceContext?: DeviceContext,
  ): Promise<Buffer> {
    const fontSize = config.fontSize || 16;
    const showName = config.showName ?? true;
    const showFirmware = config.showFirmware ?? true;
    const showMac = config.showMac ?? false;

    // Build info lines from real device context
    const lines: string[] = [];

    if (showName) {
      const name = deviceContext?.deviceName || 'Unknown';
      lines.push(name);
    }

    if (showFirmware) {
      const firmware = deviceContext?.firmwareVersion || '--';
      lines.push(`FW: ${firmware}`);
    }

    if (showMac) {
      const mac = deviceContext?.macAddress || '--';
      lines.push(mac);
    }

    const text = lines.length > 0 ? lines.join('\n') : 'Device Info';

    return this.renderTextToBuffer(text, width, height, {
      fontSize,
      fontFamily: config.fontFamily || 'sans-serif',
      color: this.sanitizeColor(config.color || '#000000'),
      textAlign: 'center',
    });
  }

  /**
   * Render days until widget
   */
  private async renderDaysUntilWidget(
    width: number,
    height: number,
    config: Record<string, any>,
  ): Promise<Buffer> {
    const targetDateStr = config.targetDate || '2025-12-25';
    const fontSize = config.fontSize || 32;

    // New customizable prefix/suffix format
    const labelPrefix = config.labelPrefix ?? 'Days till Christmas: ';
    const labelSuffix = config.labelSuffix || '';

    // Calculate days until target date
    const targetDate = new Date(targetDateStr);
    targetDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Format using prefix + number + suffix
    const days = diffDays < 0 ? Math.abs(diffDays) : diffDays;
    const text = `${labelPrefix}${days}${labelSuffix}`;

    this.logger.debug(`Rendering daysuntil: ${text}`);

    return this.renderTextToBuffer(text, width, height, {
      fontSize,
      fontFamily: config.fontFamily || 'sans-serif',
      color: this.sanitizeColor(config.color || '#000000'),
      textAlign: 'left',
      noWrap: true,
    });
  }

  /**
   * Get GitHub repository stars - public API for frontend preview
   */
  async getGitHubStars(
    owner: string,
    repo: string,
  ): Promise<{ stars: number; name: string } | null> {
    return this.fetchGitHubStars(owner, repo);
  }

  /**
   * Fetch GitHub repository stars with caching
   */
  private async fetchGitHubStars(
    owner: string,
    repo: string,
  ): Promise<{ stars: number; name: string } | null> {
    const cacheKey = `${owner}/${repo}`.toLowerCase();

    // Check cache first
    const cached = this.githubCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.GITHUB_CACHE_TTL) {
      this.logger.debug(`GitHub stars for ${owner}/${repo} served from cache`);
      return cached.data;
    }

    try {
      const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

      // Get GitHub token from database settings first, fallback to environment variable
      let githubToken = await this.settingsService.getGitHubToken();
      if (!githubToken) {
        githubToken = this.configService.get<string>('github.token') ?? null;
      }

      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const headers: Record<string, string> = {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Inker-E-Ink-Display',
      };

      if (githubToken) {
        headers['Authorization'] = `Bearer ${githubToken}`;
        this.logger.debug(`Fetching GitHub stars for ${owner}/${repo} with token`);
      } else {
        this.logger.debug(`Fetching GitHub stars for ${owner}/${repo} without token (rate limit: 60/hr)`);
      }

      const response = await fetch(url, {
        signal: controller.signal,
        headers,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const rateLimit = response.headers.get('x-ratelimit-remaining');
        const resetTime = response.headers.get('x-ratelimit-reset');
        this.logger.warn(`GitHub API error ${response.status} for ${owner}/${repo}. Rate limit remaining: ${rateLimit}, resets at: ${resetTime ? new Date(parseInt(resetTime) * 1000).toISOString() : 'unknown'}`);

        // If rate limited, return cached data even if expired
        if (response.status === 403 && cached) {
          this.logger.debug(`Returning expired cache for ${owner}/${repo} due to rate limit`);
          return cached.data;
        }

        throw new Error(`GitHub API error: ${response.status}`);
      }

      const data = await response.json();

      const result = {
        stars: data.stargazers_count || 0,
        name: data.full_name || `${owner}/${repo}`,
      };

      // Store in cache and evict expired entries
      const now = Date.now();
      this.githubCache.set(cacheKey, { data: result, timestamp: now });
      for (const [key, entry] of this.githubCache.entries()) {
        if (now - entry.timestamp > this.GITHUB_CACHE_TTL * 2) {
          this.githubCache.delete(key);
        }
      }
      // Cap cache size by evicting oldest entries
      if (this.githubCache.size > this.GITHUB_CACHE_MAX_SIZE) {
        const sorted = [...this.githubCache.entries()].sort(([, a], [, b]) => a.timestamp - b.timestamp);
        for (const [key] of sorted.slice(0, this.githubCache.size - this.GITHUB_CACHE_MAX_SIZE)) {
          this.githubCache.delete(key);
        }
      }
      this.logger.debug(`GitHub stars for ${owner}/${repo}: ${result.stars} (cached)`);

      return result;
    } catch (error) {
      this.logger.warn(`Failed to fetch GitHub stars: ${error instanceof Error ? error.message : String(error)}`);

      // Return expired cache if available
      if (cached) {
        this.logger.debug(`Returning expired cache for ${owner}/${repo} due to error`);
        return cached.data;
      }

      return null;
    }
  }

  /**
   * Get GitHub star icon SVG
   */
  private getGitHubStarIconSvg(size: number, color: string): string {
    // Star icon path (5-point star)
    const cx = size / 2;
    const cy = size / 2;
    const outerR = size * 0.45;
    const innerR = size * 0.18;

    // Calculate star points
    const points: string[] = [];
    for (let i = 0; i < 5; i++) {
      // Outer point (tip of star)
      const outerAngle = (i * 72 - 90) * Math.PI / 180;
      points.push(`${cx + Math.cos(outerAngle) * outerR},${cy + Math.sin(outerAngle) * outerR}`);

      // Inner point (between tips)
      const innerAngle = ((i * 72) + 36 - 90) * Math.PI / 180;
      points.push(`${cx + Math.cos(innerAngle) * innerR},${cy + Math.sin(innerAngle) * innerR}`);
    }

    return `<polygon points="${points.join(' ')}" fill="${color}"/>`;
  }

  /**
   * Render GitHub Stars widget
   */
  private async renderGitHubWidget(
    width: number,
    height: number,
    config: Record<string, any>,
  ): Promise<Buffer> {
    const owner = config.owner || 'facebook';
    const repo = config.repo || 'react';
    const showIcon = config.showIcon !== false;
    const showRepoName = config.showRepoName || false;
    const fontSize = config.fontSize || 32;
    const fontFamily = config.fontFamily || 'sans-serif';
    const color = this.sanitizeColor(config.color || '#000000');

    // Fetch stars from GitHub API
    const githubData = await this.fetchGitHubStars(owner, repo);

    if (!githubData) {
      // Fallback if API fails
      return this.renderTextToBuffer(`${owner}/${repo}\nUnavailable`, width, height, {
        fontSize: fontSize * 0.7,
        fontFamily,
        color,
        textAlign: 'center',
      });
    }

    const { stars, name } = githubData;

    // Format star count (e.g., 1.2k, 15.3k)
    let starsText: string;
    if (stars >= 1000000) {
      starsText = `${(stars / 1000000).toFixed(1)}M`;
    } else if (stars >= 1000) {
      starsText = `${(stars / 1000).toFixed(1)}k`;
    } else {
      starsText = String(stars);
    }

    // Build SVG
    const iconSize = showIcon ? Math.min(fontSize * 1.2, height * 0.6) : 0;
    const gap = showIcon ? 8 : 0;

    // Estimate text width
    const textWidth = starsText.length * fontSize * 0.6;
    const totalContentWidth = iconSize + gap + textWidth;
    const startX = (width - totalContentWidth) / 2;

    let svgContent = '';

    // Calculate vertical center for main content
    const mainContentY = showRepoName ? height * 0.4 : height / 2;

    // Star icon
    if (showIcon) {
      const iconY = mainContentY - iconSize / 2;
      svgContent += `
        <g transform="translate(${startX}, ${iconY})">
          ${this.getGitHubStarIconSvg(iconSize, color)}
        </g>
      `;
    }

    // Stars count
    const textX = startX + (showIcon ? iconSize + gap : 0);
    const textY = mainContentY + fontSize * 0.35;
    svgContent += `
      <text x="${textX}" y="${textY}" font-size="${fontSize}" font-family="${fontFamily}" font-weight="bold" fill="${color}">
        ${starsText}
      </text>
    `;

    // Repo name at bottom
    if (showRepoName) {
      const smallFontSize = Math.max(12, fontSize * 0.4);
      svgContent += `
        <text x="${width / 2}" y="${height - 8}" text-anchor="middle" font-size="${smallFontSize}" font-family="${fontFamily}" fill="${color}">
          ${this.escapeXml(name)}
        </text>
      `;
    }

    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        ${svgContent}
      </svg>
    `;

    return sharp(Buffer.from(svg)).png().toBuffer();
  }

  /**
   * Render image widget
   * Processes image for e-ink display (grayscale, high contrast)
   */
  private async renderImageWidget(
    width: number,
    height: number,
    config: Record<string, any>,
  ): Promise<Buffer> {
    const url = config.url;
    const fit = config.fit || 'contain';

    if (!url) {
      return this.renderPlaceholderWidget(width, height, 'No Image');
    }

    try {
      let imageBuffer: Buffer;

      // Check if it's a local file path (starts with /uploads/)
      if (url.startsWith('/uploads/')) {
        // Read directly from filesystem (with path traversal protection)
        const fs = await import('fs/promises');
        const filePath = this.resolveUploadPath(url);
        imageBuffer = await fs.readFile(filePath);
      } else {
        // Validate URL for SSRF before fetching (blocks private IPs, file://, etc.)
        await validateUrlSafety(url);

        // Fetch remote image with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.status}`);
        }

        imageBuffer = Buffer.from(await response.arrayBuffer());
      }

      // Process for e-ink: flatten transparent to white, grayscale, high contrast, resize
      // IMPORTANT: flatten() must come BEFORE grayscale() to convert transparent pixels to white
      return sharp(imageBuffer)
        .flatten({ background: { r: 255, g: 255, b: 255 } })
        .grayscale()
        .normalize() // Enhances contrast for e-ink
        .resize(width, height, {
          fit: fit as keyof FitEnum,
          background: { r: 255, g: 255, b: 255, alpha: 1 }, // White background for e-ink
        })
        .png()
        .toBuffer();
    } catch (error) {
      this.logger.warn(`Failed to load image from ${url}: ${error instanceof Error ? error.message : String(error)}`);
      return this.renderPlaceholderWidget(width, height, 'Image Error');
    }
  }

  /**
   * Render custom widget using Puppeteer for 1:1 HTML/CSS rendering
   * Generates the exact same HTML as the frontend WidgetRenderer component
   * Font settings (fontSize, fontFamily, fontWeight, textAlign, color) are read from config
   */
  private async renderCustomWidget(
    width: number,
    height: number,
    config: Record<string, any>,
  ): Promise<Buffer> {
    const customWidgetId = config.customWidgetId as number | undefined;

    // Font settings from screen designer config
    const fontSize = config.fontSize || 24;
    const fontFamily = config.fontFamily || 'sans-serif';
    const fontWeight = config.fontWeight || 'normal';
    const textAlign = config.textAlign || 'center';
    const verticalAlign = config.verticalAlign || 'middle';
    const color = this.sanitizeColor(config.color || '#000000');

    // Per-cell overrides from screen designer
    const cellOverrides = (config.cellOverrides as Record<string, Record<string, unknown>>) || {};

    if (!customWidgetId) {
      this.logger.warn('Custom widget missing customWidgetId in config');
      return this.renderPlaceholderWidget(width, height, 'No Widget ID');
    }

    try {
      // Fetch the custom widget with its rendered data
      const preview = await this.customWidgetsService.getWithData(customWidgetId);
      const { widget, renderedContent } = preview;
      const widgetConfig = widget.config as Record<string, any>;
      const fieldType = widgetConfig.fieldType as string | undefined;
      const valueFieldType = widgetConfig.valueFieldType as string | undefined;

      this.logger.debug(`Rendering custom widget ${customWidgetId}: displayType=${widget.displayType}, fontSize=${fontSize}`);

      // Generate the exact same HTML as the frontend WidgetRenderer (async to process images)
      const html = await this.generateCustomWidgetHtml(
        width,
        height,
        renderedContent,
        { fontSize, fontFamily, fontWeight, textAlign, verticalAlign, color },
        { fieldType, valueFieldType },
        cellOverrides,
      );

      // Render HTML to PNG using Puppeteer
      return await this.renderHtmlToPng(html, width, height);
    } catch (error) {
      this.logger.error(`Failed to render custom widget ${customWidgetId}:`, error);
      return this.renderPlaceholderWidget(width, height, 'Error');
    }
  }

  /**
   * Generate HTML that matches the frontend WidgetRenderer component exactly
   * Processes image URLs for e-ink display (grayscale, high contrast)
   */
  private async generateCustomWidgetHtml(
    width: number,
    height: number,
    renderedContent: any,
    styles: { fontSize: number; fontFamily: string; fontWeight: string; textAlign: string; verticalAlign: string; color: string },
    fieldTypes: { fieldType?: string; valueFieldType?: string },
    cellOverrides: Record<string, Record<string, unknown>> = {},
  ): Promise<string> {
    const { fontSize, fontWeight, textAlign, verticalAlign, color } = styles;
    // Apply font family mapping to use loaded fonts
    const fontFamily = this.mapFontFamily(styles.fontFamily);

    // Map alignment values to CSS flexbox properties
    const alignItems = textAlign === 'left' ? 'flex-start' : textAlign === 'right' ? 'flex-end' : 'center';
    const justifyContent = verticalAlign === 'top' ? 'flex-start' : verticalAlign === 'bottom' ? 'flex-end' : 'center';
    const { fieldType, valueFieldType } = fieldTypes;

    // Generate inner content based on content type - exact match to frontend
    let innerHtml = '';

    if (typeof renderedContent === 'string') {
      if (fieldType === 'image') {
        // Process image for e-ink display (grayscale, high contrast)
        const processedImageUrl = await this.processImageForEink(renderedContent);
        innerHtml = `<img src="${this.escapeHtml(processedImageUrl)}" alt="Custom widget image" style="max-width: 100%; max-height: 100%; object-fit: contain;" />`;
      } else {
        innerHtml = `<div style="width: 100%; text-align: ${textAlign};">${this.escapeHtml(renderedContent)}</div>`;
      }
    } else if (Array.isArray(renderedContent)) {
      // List items already have prefix (•, -, 1.) from renderList(), so no list-style needed
      // Use full fontSize to match frontend WidgetRenderer.tsx
      // Allow text wrapping (no white-space: nowrap) to match designer behavior
      const listItems = renderedContent.slice(0, 10).map(item =>
        `<li style="font-size: ${fontSize}px; line-height: 1.2; margin-bottom: 4px;">${this.escapeHtml(String(item))}</li>`
      ).join('');
      innerHtml = `<ul style="list-style: none; width: 100%; text-align: ${textAlign}; margin: 0; padding: 0;">${listItems}</ul>`;
    } else if (typeof renderedContent === 'object' && renderedContent !== null) {
      // Check if it's a grid display type
      if ('type' in renderedContent && renderedContent.type === 'grid') {
        const gridContent = renderedContent as {
          type: 'grid';
          gridCols: number;
          gridRows: number;
          gridGap: number;
          cells: Array<{
            row: number;
            col: number;
            field: string;
            fieldType: string;
            label?: string;
            value: unknown;
            formattedValue: string;
            align?: string;
            verticalAlign?: string;
          }>;
        };

        const cellFontSize = fontSize * 0.7;
        const labelFontSize = cellFontSize * 0.6;

        // Pre-process all image URLs in parallel for e-ink display
        const processedCells = await Promise.all(
          gridContent.cells.map(async (cell) => {
            let processedImageUrl: string | null = null;
            if (cell.fieldType === 'image' && cell.value) {
              processedImageUrl = await this.processImageForEink(String(cell.value));
            }
            return { ...cell, processedImageUrl };
          })
        );

        // Build grid cells HTML with processed images
        const cellsHtml = processedCells.map(cell => {
          const cellKey = `${cell.row}-${cell.col}`;
          // Get cell-specific overrides from screen designer config
          const override = cellOverrides[cellKey] || {};

          // Use override values or fall back to defaults
          const cellFontSizeOverride = (override.fontSize as number) || cellFontSize;
          const cellFontWeightOverride = (override.fontWeight as string) || 'bold';
          // Apply font mapping to cell override or use the already-mapped parent fontFamily
          const cellFontFamilyOverride = override.fontFamily
            ? this.mapFontFamily(override.fontFamily as string)
            : fontFamily;
          const cellAlign = (override.align as string) || cell.align || 'center';
          const cellVerticalAlign = (override.verticalAlign as string) || cell.verticalAlign || 'middle';
          const imageFit = (override.imageFit as string) || 'contain';

          // Map horizontal alignment to flexbox align-items
          const alignItems = cellAlign === 'left' ? 'flex-start' : cellAlign === 'right' ? 'flex-end' : 'center';
          // Map vertical alignment to flexbox justify-content
          const justifyContent = cellVerticalAlign === 'top' ? 'flex-start' : cellVerticalAlign === 'bottom' ? 'flex-end' : 'center';

          const labelFontSizeForCell = cellFontSizeOverride * 0.6;
          const labelHtml = cell.label
            ? `<div style="font-size: ${labelFontSizeForCell}px; color: #666666; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${this.escapeHtml(cell.label)}</div>`
            : '';

          let valueHtml: string;
          if (cell.fieldType === 'image' && cell.processedImageUrl) {
            valueHtml = `<img src="${this.escapeHtml(cell.processedImageUrl)}" alt="${this.escapeHtml(cell.label || 'Grid cell')}" style="max-width: 100%; max-height: 100%; object-fit: ${imageFit};" />`;
          } else {
            valueHtml = `<span style="font-weight: ${cellFontWeightOverride}; font-size: ${cellFontSizeOverride}px; font-family: ${cellFontFamilyOverride};">${this.escapeHtml(cell.formattedValue)}</span>`;
          }

          return `
            <div data-cell="${cellKey}" style="
              grid-row: ${cell.row + 1};
              grid-column: ${cell.col + 1};
              display: flex;
              flex-direction: column;
              align-items: ${alignItems};
              justify-content: ${justifyContent};
              text-align: ${cellAlign};
              overflow: hidden;
            ">
              ${labelHtml}
              ${valueHtml}
            </div>
          `;
        }).join('');

        innerHtml = `
          <div style="
            display: grid;
            grid-template-columns: repeat(${gridContent.gridCols}, 1fr);
            grid-template-rows: repeat(${gridContent.gridRows}, 1fr);
            gap: ${gridContent.gridGap}px;
            width: 100%;
            height: 100%;
          ">
            ${cellsHtml}
          </div>
        `;
      } else if (('title' in renderedContent || 'label' in renderedContent) && 'value' in renderedContent) {
        const label = String('title' in renderedContent ? renderedContent.title : renderedContent.label);
        const value = String(renderedContent.value);

        if (valueFieldType === 'image') {
          // Process image for e-ink display (grayscale, high contrast)
          const processedImageUrl = await this.processImageForEink(value);
          innerHtml = `
            <div style="width: 100%; text-align: ${textAlign};">
              <div style="font-size: ${fontSize * 0.6}px; opacity: 0.6;">${this.escapeHtml(label)}</div>
              <div style="margin-top: 8px; max-height: 80%;">
                <img src="${this.escapeHtml(processedImageUrl)}" alt="Custom widget image" style="max-width: 100%; max-height: 100%; object-fit: contain;" />
              </div>
            </div>
          `;
        } else {
          innerHtml = `
            <div style="width: 100%; text-align: ${textAlign};">
              <div style="font-size: ${fontSize * 0.6}px; opacity: 0.6;">${this.escapeHtml(label)}</div>
              <div style="font-weight: bold;">${this.escapeHtml(value)}</div>
            </div>
          `;
        }
      } else {
        // Generic object - render as JSON
        innerHtml = `<pre style="font-size: 12px; text-align: left; margin: 0; white-space: pre-wrap; word-break: break-word;">${this.escapeHtml(JSON.stringify(renderedContent, null, 2))}</pre>`;
      }
    } else {
      innerHtml = `<span style="opacity: 0.5;">Invalid content</span>`;
    }

    // Full HTML document with exact same CSS as frontend
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          ${this.fontStyleTag}
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              width: ${width}px;
              height: ${height}px;
              overflow: hidden;
              background: transparent;
              -webkit-font-smoothing: antialiased;
              -moz-osx-font-smoothing: grayscale;
              text-rendering: geometricPrecision;
            }
            .widget-container {
              display: flex;
              flex-direction: column;
              align-items: ${alignItems};
              justify-content: ${justifyContent};
              width: 100%;
              height: 100%;
              padding: 8px;
              font-size: ${fontSize}px;
              font-family: ${fontFamily}, sans-serif;
              font-weight: ${fontWeight};
              text-align: ${textAlign};
              color: ${color};
              line-height: 1.2;
              overflow: hidden;
            }
          </style>
        </head>
        <body>
          <div class="widget-container">
            ${innerHtml}
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Render HTML to PNG using Puppeteer
   */
  async renderHtmlToPng(html: string, width: number, height: number): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      // Block all outbound network requests — all content should be inline/data URLs
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        const reqUrl = request.url();
        if (reqUrl.startsWith('data:') || reqUrl === 'about:blank') {
          request.continue();
        } else {
          request.abort('blockedbyclient');
        }
      });

      // Set viewport to exact widget size
      await page.setViewport({ width, height, deviceScaleFactor: 1 });

      // Load HTML content
      // Use 'load' to wait for all resources (images) to finish loading
      // This is important for custom widgets that contain embedded base64 images
      await page.setContent(html, { waitUntil: 'load', timeout: 10000 });

      // Wait for fonts to load (with timeout fallback)
      await Promise.race([
        page.evaluateHandle('document.fonts.ready'),
        new Promise(resolve => setTimeout(resolve, 500)),
      ]);

      // Take screenshot with transparent background
      const screenshot = await page.screenshot({
        type: 'png',
        omitBackground: true,
      });

      return Buffer.from(screenshot);
    } finally {
      await page.close();
    }
  }

  /**
   * Render a URL to PNG using Puppeteer
   */
  async renderUrlToPng(url: string, width: number, height: number): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      await page.setViewport({ width, height, deviceScaleFactor: 1 });
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

      const screenshot = await page.screenshot({ type: 'png', fullPage: false });
      return Buffer.from(screenshot);
    } finally {
      await page.close();
    }
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Helper to render an image from URL (reused from renderImageWidget logic)
   */
  private async renderImageFromUrl(
    url: string,
    width: number,
    height: number,
  ): Promise<Buffer> {
    if (!url) {
      return this.renderPlaceholderWidget(width, height, 'No Image URL');
    }

    try {
      let imageBuffer: Buffer;

      // Check if it's a local file path (starts with /uploads/)
      if (url.startsWith('/uploads/')) {
        // Read directly from filesystem (with path traversal protection)
        const fs = await import('fs/promises');
        const filePath = this.resolveUploadPath(url);
        imageBuffer = await fs.readFile(filePath);
      } else {
        // Validate URL for SSRF before fetching (blocks private IPs, file://, etc.)
        await validateUrlSafety(url);

        // Add timeout to prevent hanging on slow/unresponsive image servers
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.status}`);
        }

        imageBuffer = Buffer.from(await response.arrayBuffer());
      }

      // Resize and fit the image with transparent background
      return sharp(imageBuffer)
        .resize(width, height, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer();
    } catch (error) {
      this.logger.warn(`Failed to load image from ${url}: ${error instanceof Error ? error.message : String(error)}`);
      return this.renderPlaceholderWidget(width, height, 'Image Error');
    }
  }

  /**
   * Process an image URL for e-ink display and return base64 data URL
   * Applies grayscale conversion and high contrast for better e-ink rendering
   */
  private async processImageForEink(url: string): Promise<string> {
    if (!url) {
      return '';
    }

    try {
      let imageBuffer: Buffer;

      // Check if it's a local file path (starts with /uploads/)
      if (url.startsWith('/uploads/')) {
        // Read directly from filesystem (with path traversal protection)
        const fs = await import('fs/promises');
        const filePath = this.resolveUploadPath(url);
        imageBuffer = await fs.readFile(filePath);
      } else {
        // Add timeout to prevent hanging on slow/unresponsive image servers
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.status}`);
        }

        imageBuffer = Buffer.from(await response.arrayBuffer());
      }

      // Process image for e-ink: grayscale with high contrast
      // IMPORTANT: flatten() converts transparent backgrounds to white
      // Without this, transparent pixels become black after processing
      const processedBuffer = await sharp(imageBuffer)
        .flatten({ background: { r: 255, g: 255, b: 255 } })
        .grayscale()
        .normalize() // Enhances contrast
        .png()
        .toBuffer();

      // Convert to base64 data URL
      const base64 = processedBuffer.toString('base64');
      return `data:image/png;base64,${base64}`;
    } catch (error) {
      this.logger.warn(`Failed to process image for e-ink from ${url}: ${error instanceof Error ? error.message : String(error)}`);
      return ScreenRendererService.FALLBACK_PIXEL;
    }
  }

  /**
   * Render a placeholder widget
   */
  private async renderPlaceholderWidget(
    width: number,
    height: number,
    label: string,
  ): Promise<Buffer> {
    return this.renderTextToBuffer(label, width, height, {
      fontSize: 14,
      fontFamily: 'sans-serif',
      color: '#666666',
      textAlign: 'center',
    });
  }

  /**
   * Render text to a buffer using SVG with proper word wrapping
   *
   * Options:
   * - noWrap: Don't word-wrap text (only split on explicit newlines)
   * - clipContent: Use SVG clipPath to clip content to widget bounds (like CSS overflow:hidden)
   *                When true, renders all content at natural size and clips what doesn't fit
   */
  private async renderTextToBuffer(
    text: string,
    width: number,
    height: number,
    options: {
      fontSize: number;
      fontFamily: string;
      fontWeight?: string;
      color: string;
      textAlign: string;
      noWrap?: boolean;
      clipContent?: boolean;
    },
  ): Promise<Buffer> {
    const { fontSize, fontFamily, fontWeight, color, textAlign, noWrap, clipContent } = options;

    // Calculate text anchor based on alignment
    const textAnchor =
      textAlign === 'center' ? 'middle' : textAlign === 'right' ? 'end' : 'start';
    const xPos =
      textAlign === 'center'
        ? width / 2
        : textAlign === 'right'
          ? width - 10
          : 10;

    // Padding from edges
    const padding = 5;
    const availableWidth = width - (padding * 2);

    // Estimate character width (approximate for monospace/sans-serif)
    // Using 0.5 as average - this is more conservative to prevent premature wrapping
    // Monospace fonts are typically ~0.6, proportional fonts vary from 0.4-0.7
    const avgCharWidth = fontSize * 0.5;
    const maxCharsPerLine = Math.max(10, Math.floor(availableWidth / avgCharWidth));

    // Word wrap text (skip if noWrap or clipContent is true)
    const wrappedLines: string[] = [];
    const inputLines = text.split('\n');

    if (noWrap || clipContent) {
      // No wrapping - keep lines as-is (only split on explicit newlines)
      wrappedLines.push(...inputLines);
    } else {
      for (const line of inputLines) {
        if (line.length <= maxCharsPerLine) {
          wrappedLines.push(line);
        } else {
          // Word wrap this line
          const words = line.split(' ');
          let currentLine = '';

          for (const word of words) {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            if (testLine.length <= maxCharsPerLine) {
              currentLine = testLine;
            } else {
              if (currentLine) {
                wrappedLines.push(currentLine);
              }
              // If single word is too long, split it
              if (word.length > maxCharsPerLine) {
                let remaining = word;
                while (remaining.length > maxCharsPerLine) {
                  wrappedLines.push(remaining.substring(0, maxCharsPerLine));
                  remaining = remaining.substring(maxCharsPerLine);
                }
                currentLine = remaining;
              } else {
                currentLine = word;
              }
            }
          }
          if (currentLine) {
            wrappedLines.push(currentLine);
          }
        }
      }
    }

    const lineHeight = fontSize * 1.2;
    const totalTextHeight = wrappedLines.length * lineHeight;

    // Calculate starting Y position for vertical centering
    // SVG text y-coordinate is at the baseline
    // To center text visually, we need: baseline = center + (ascender - descender) / 2
    // For most fonts: ascender ~= 0.75 * fontSize, descender ~= 0.25 * fontSize
    // Visual center offset from baseline ~= 0.35 * fontSize (upward)
    // So baseline should be at: widgetCenter + 0.35 * fontSize

    let startY: number;
    if (totalTextHeight <= height) {
      // For single/multi-line text that fits:
      // Calculate where the first line's baseline should be
      const numLines = wrappedLines.length;
      const textBlockHeight = numLines * lineHeight;
      const firstLineCenter = (height - textBlockHeight) / 2 + lineHeight / 2;
      // Baseline is below center by ~0.35 * fontSize
      startY = firstLineCenter + fontSize * 0.35;
    } else {
      // For text that doesn't fit, start from top
      startY = fontSize * 0.85;
    }

    // Determine which lines to render
    let linesToRender: string[];
    if (clipContent) {
      // Render all lines - SVG viewport will clip overflowing content
      linesToRender = wrappedLines;
    } else {
      // Only render lines that fit within height (but always render at least 1 line)
      const maxLines = Math.max(1, Math.floor(height / lineHeight));
      linesToRender = wrappedLines.slice(0, maxLines);
    }

    const textElements = linesToRender
      .map((line, i) => {
        const y = startY + i * lineHeight;
        const escapedLine = this.escapeXml(line);
        return `<text x="${xPos}" y="${y}" text-anchor="${textAnchor}" font-size="${fontSize}" font-family="${fontFamily}" font-weight="${fontWeight || 'normal'}" fill="${color}">${escapedLine}</text>`;
      })
      .join('\n');

    // Use transparent background so widgets can overlay each other
    // viewBox + clipPath ensures content outside widget bounds is clipped (like CSS overflow:hidden)
    const svg = `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <clipPath id="clip">
            <rect x="0" y="0" width="${width}" height="${height}"/>
          </clipPath>
        </defs>
        <g clip-path="url(#clip)">
          ${textElements}
        </g>
      </svg>
    `;

    return sharp(Buffer.from(svg)).png().toBuffer();
  }

  /**
   * Parse hex color to RGBA object
   */
  private parseColor(hex: string): { r: number; g: number; b: number; alpha: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
      return {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
        alpha: 1,
      };
    }
    return { r: 255, g: 255, b: 255, alpha: 1 };
  }

  /**
   * Sanitize a color value for safe CSS/SVG interpolation.
   * Only allows valid hex colors (#RGB, #RRGGBB, #RRGGBBAA).
   */
  private sanitizeColor(color: string, fallback = '#000000'): string {
    if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(color)) return color;
    return fallback;
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  // ============================================================
  // HTML-BASED RENDERING (Pixel-Perfect)
  // Uses Puppeteer to render HTML matching frontend WidgetRenderer.tsx
  // ============================================================

  /**
   * Render screen design using HTML/CSS + Puppeteer for pixel-perfect output
   * This matches exactly what the frontend shows in the designer
   */
  async renderDesignAsHtml(screenDesign: ScreenDesignWithWidgets, deviceContext?: DeviceContext): Promise<Buffer> {
    const { width, height, background, widgets } = screenDesign;
    const startTime = Date.now();

    // Log widget positions for debugging
    this.logger.debug(`Rendering ${widgets.length} widgets for screen ${screenDesign.id} (${width}x${height})`);
    widgets.forEach((w, i) => {
      const crossesEdge = w.x < 0 || w.y < 0 || (w.x + w.width) > width || (w.y + w.height) > height;
      this.logger.debug(`  Widget ${i}: ${w.template.name} at (${w.x}, ${w.y}) size ${w.width}x${w.height}${crossesEdge ? ' [CROSSES EDGE]' : ''}`);
    });

    // Generate HTML for all widgets
    const widgetsHtml = await Promise.all(
      widgets.map(widget => this.generateWidgetHtml(widget, deviceContext))
    );
    const htmlGenTime = Date.now();
    this.logger.debug(`  HTML generation took ${htmlGenTime - startTime}ms`);

    // Create full HTML page matching frontend structure
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  ${this.fontStyleTag}
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: ${width}px;
      height: ${height}px;
      background: ${this.sanitizeColor(background || '#ffffff', '#ffffff')};
      position: relative;
      overflow: hidden;
      font-family: sans-serif;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      text-rendering: geometricPrecision;
    }
    .widget {
      position: absolute;
      display: flex;
      align-items: center;
      overflow: hidden;
    }
  </style>
</head>
<body>
  ${widgetsHtml.join('\n  ')}
</body>
</html>`;

    // Render with Puppeteer
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      // Block all outbound network requests — all content is pre-fetched and inline
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        const reqUrl = request.url();
        if (reqUrl.startsWith('data:') || reqUrl === 'about:blank') {
          request.continue();
        } else {
          request.abort('blockedbyclient');
        }
      });

      await page.setViewport({ width, height, deviceScaleFactor: 1 });
      await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 15000 });

      // Wait for fonts and all images to load (with timeout fallback)
      await Promise.race([
        Promise.all([
          page.evaluateHandle('document.fonts.ready'),
          page.evaluate(() => {
            const images = Array.from(document.querySelectorAll('img'));
            return Promise.all(
              images.map(img =>
                img.complete
                  ? Promise.resolve()
                  : new Promise(resolve => {
                      img.onload = resolve;
                      img.onerror = resolve;
                    })
              )
            );
          }),
        ]),
        new Promise(resolve => setTimeout(resolve, 5000)),
      ]);

      const screenshot = await page.screenshot({
        type: 'png',
        clip: { x: 0, y: 0, width, height },
      });
      const screenshotTime = Date.now();
      this.logger.debug(`  Puppeteer screenshot took ${screenshotTime - htmlGenTime}ms (total: ${screenshotTime - startTime}ms)`);

      return Buffer.from(screenshot);
    } finally {
      await page.close();
    }
  }

  /**
   * Generate HTML for a single widget matching frontend WidgetRenderer.tsx
   */
  private async generateWidgetHtml(widget: WidgetWithTemplate, deviceContext?: DeviceContext): Promise<string> {
    const { x, y, width, height, config, template } = widget;
    const widgetConfig = config as Record<string, any>;

    // Get widget-specific content
    let content = '';
    let extraStyles = '';

    switch (template.name) {
      case 'clock':
        content = this.generateClockContent(widgetConfig);
        extraStyles = this.getClockStyles(widgetConfig);
        break;
      case 'date':
        content = this.generateDateContent(widgetConfig);
        extraStyles = this.getDateStyles(widgetConfig);
        break;
      case 'text':
        content = this.generateTextContent(widgetConfig);
        extraStyles = this.getTextStyles(widgetConfig);
        break;
      case 'daysuntil':
        content = this.generateDaysUntilContent(widgetConfig);
        extraStyles = this.getDaysUntilStyles(widgetConfig);
        break;
      case 'countdown':
        content = this.generateCountdownContent(widgetConfig);
        extraStyles = this.getCountdownStyles(widgetConfig);
        break;
      case 'weather':
        content = await this.generateWeatherContent(widgetConfig);
        extraStyles = this.getWeatherStyles(widgetConfig);
        break;
      case 'qrcode':
        content = await this.generateQRCodeContent(widgetConfig, Math.min(width, height));
        break;
      case 'battery':
        content = this.generateBatteryContent(widgetConfig, deviceContext);
        extraStyles = this.getBatteryStyles(widgetConfig);
        break;
      case 'wifi':
        content = this.generateWifiContent(widgetConfig, deviceContext);
        extraStyles = this.getWifiStyles(widgetConfig);
        break;
      case 'deviceinfo':
        content = this.generateDeviceInfoContent(widgetConfig, deviceContext);
        extraStyles = this.getDeviceInfoStyles(widgetConfig);
        break;
      case 'image':
        content = await this.generateImageContent(widgetConfig, width, height);
        break;
      case 'divider':
        content = this.generateDividerContent(widgetConfig, width, height);
        break;
      case 'rectangle':
        content = this.generateRectangleContent(widgetConfig);
        break;
      case 'github':
        content = await this.generateGitHubContent(widgetConfig);
        extraStyles = this.getGitHubStyles(widgetConfig);
        break;
      case 'custom-widget-base':
        content = await this.generateCustomWidgetContent(widgetConfig, width, height);
        extraStyles = this.getCustomWidgetStyles(widgetConfig);
        break;
      default:
        content = `<div style="color: #999; font-size: 12px;">Unknown: ${template.name}</div>`;
    }

    // Handle rotation, z-index, and opacity
    const rotation = (widget as any).rotation || 0;
    const zIndex = widget.zIndex || 0;
    const opacity = (widgetConfig.opacity as number) ?? 100;
    const rotationStyle = rotation !== 0 ? `transform: rotate(${rotation}deg); transform-origin: center center;` : '';
    const opacityStyle = opacity < 100 ? `opacity: ${opacity / 100};` : '';

    return `<div class="widget" style="left: ${x}px; top: ${y}px; width: ${width}px; height: ${height}px; z-index: ${zIndex}; ${opacityStyle} ${extraStyles} ${rotationStyle}">${content}</div>`;
  }

  // ----- Clock Widget -----
  private generateClockContent(config: Record<string, any>): string {
    const now = new Date();
    const format = config.format || '24h';
    const showSeconds = config.showSeconds || false;
    const timezone = config.timezone || 'local';
    const defaultTimezone = this.configService.get<string>('defaultTimezone', 'UTC');
    const effectiveTimezone = (timezone === 'local' || timezone === '') ? defaultTimezone : timezone;

    const options: Intl.DateTimeFormatOptions = {
      timeZone: effectiveTimezone,
      hour: '2-digit',
      minute: '2-digit',
      second: showSeconds ? '2-digit' : undefined,
      hour12: format === '12h',
    };

    return this.escapeHtml(now.toLocaleTimeString('en-US', options));
  }

  private getClockStyles(config: Record<string, any>): string {
    const fontSize = config.fontSize || 48;
    const fontFamily = this.mapFontFamily(config.fontFamily || 'monospace');
    const textAlign = config.textAlign || 'left';
    const justifyContent = textAlign === 'left' ? 'flex-start' : textAlign === 'right' ? 'flex-end' : 'center';
    return `font-size: ${fontSize}px; font-family: ${fontFamily}; justify-content: ${justifyContent}; white-space: nowrap; padding: 0 8px;`;
  }

  // ----- Date Widget -----
  private generateDateContent(config: Record<string, any>): string {
    const now = new Date();
    const locale = config.locale || 'en-US';
    const showWeekday = config.showWeekday ?? config.showDayOfWeek ?? false;
    const showDay = config.showDay ?? true;
    const showMonth = config.showMonth ?? true;
    const showYear = config.showYear ?? true;
    const timezone = config.timezone || '';
    const defaultTimezone = this.configService.get<string>('defaultTimezone', 'UTC');
    const effectiveTimezone = (timezone === 'local' || timezone === '') ? defaultTimezone : timezone;

    this.logger.debug(`Date widget: config.timezone="${timezone}", effectiveTimezone="${effectiveTimezone}"`);

    const options: Intl.DateTimeFormatOptions = { timeZone: effectiveTimezone };
    if (showWeekday) options.weekday = 'long';
    if (showDay) options.day = 'numeric';
    if (showMonth) options.month = 'long';
    if (showYear) options.year = 'numeric';
    if (!showWeekday && !showDay && !showMonth && !showYear) {
      options.day = 'numeric';
      options.month = 'long';
      options.year = 'numeric';
    }

    const dateStr = now.toLocaleDateString(locale, options);
    this.logger.debug(`Date widget: rendered "${dateStr}"`);

    return this.escapeHtml(dateStr);
  }

  private getDateStyles(config: Record<string, any>): string {
    const fontSize = config.fontSize || 24;
    const fontFamily = this.mapFontFamily(config.fontFamily || 'sans-serif');
    const textAlign = config.textAlign || 'center';
    const justifyContent = textAlign === 'left' ? 'flex-start' : textAlign === 'right' ? 'flex-end' : 'center';
    const lineHeight = fontSize * 1.2;
    return `font-size: ${fontSize}px; font-family: ${fontFamily}; line-height: ${lineHeight}px; white-space: nowrap; padding: 0 8px; justify-content: ${justifyContent};`;
  }

  // ----- Text Widget -----
  private generateTextContent(config: Record<string, any>): string {
    const text = config.text || 'Text';
    return `<div style="width: 100%; text-align: ${config.textAlign || 'left'};">${this.escapeHtml(text)}</div>`;
  }

  private getTextStyles(config: Record<string, any>): string {
    const fontSize = config.fontSize || 24;
    const fontFamily = this.mapFontFamily(config.fontFamily || 'sans-serif');
    const fontWeight = config.fontWeight || 'normal';
    const color = this.sanitizeColor(config.color || '#000000');
    return `font-size: ${fontSize}px; font-family: ${fontFamily}; font-weight: ${fontWeight}; color: ${color}; padding: 10px; line-height: 1.2;`;
  }

  // ----- Days Until Widget -----
  private generateDaysUntilContent(config: Record<string, any>): string {
    const targetDateStr = config.targetDate || '2025-12-25';
    const labelPrefix = config.labelPrefix ?? 'Days till Christmas: ';
    const labelSuffix = config.labelSuffix || '';

    const targetDate = new Date(targetDateStr);
    targetDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const days = diffDays < 0 ? Math.abs(diffDays) : diffDays;

    return this.escapeHtml(`${labelPrefix}${days}${labelSuffix}`);
  }

  private getDaysUntilStyles(config: Record<string, any>): string {
    const fontSize = config.fontSize || 32;
    const fontFamily = this.mapFontFamily(config.fontFamily || 'sans-serif');
    const color = this.sanitizeColor(config.color || '#000000');
    return `font-size: ${fontSize}px; font-family: ${fontFamily}; color: ${color}; white-space: nowrap; padding: 0 8px;`;
  }

  // ----- Countdown Widget -----
  private generateCountdownContent(config: Record<string, any>): string {
    const targetDateStr = config.targetDate || '2025-12-31T23:59:59';
    const label = config.label || '';
    const showDays = config.showDays !== false;
    const showHours = config.showHours !== false;
    const showMinutes = config.showMinutes !== false;
    const showSeconds = config.showSeconds !== false;

    const now = new Date();
    const targetDate = new Date(targetDateStr);
    const diffMs = targetDate.getTime() - now.getTime();

    if (diffMs <= 0) {
      return this.escapeHtml(label || "Time's up!");
    }

    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

    const parts: string[] = [];
    if (showDays && days > 0) parts.push(`${days}d`);
    if (showHours) parts.push(`${hours.toString().padStart(2, '0')}h`);
    if (showMinutes) parts.push(`${minutes.toString().padStart(2, '0')}m`);
    if (showSeconds) parts.push(`${seconds.toString().padStart(2, '0')}s`);

    const fontSize = config.fontSize || 32;
    let html = '';
    if (label) {
      html += `<div style="font-size: ${fontSize * 0.5}px; margin-bottom: 4px;">${this.escapeHtml(label)}</div>`;
    }
    html += `<div style="font-weight: bold;">${this.escapeHtml(parts.join(' '))}</div>`;
    return html;
  }

  private getCountdownStyles(config: Record<string, any>): string {
    const fontSize = config.fontSize || 32;
    const fontFamily = this.mapFontFamily(config.fontFamily || 'monospace');
    return `font-size: ${fontSize}px; font-family: ${fontFamily}; flex-direction: column; justify-content: center; white-space: nowrap; padding: 0 8px;`;
  }

  // ----- Weather Widget -----
  private async generateWeatherContent(config: Record<string, any>): Promise<string> {
    const location = config.location || 'Unknown';
    const latitude = config.latitude || 52.2297;
    const longitude = config.longitude || 21.0122;
    const units = config.units || 'metric';
    const forecastDay = config.forecastDay || 0;
    const forecastTime = config.forecastTime || 'current';
    const showIcon = config.showIcon !== false;
    const showTemperature = config.showTemperature !== false;
    const showCondition = config.showCondition !== false;
    const showLocation = config.showLocation !== false;
    const showHumidity = config.showHumidity as boolean;
    const showWind = config.showWind as boolean;
    const showDayName = config.showDayName as boolean;
    const fontSize = config.fontSize || 32;

    try {
      const weatherData = await this.fetchWeatherData(latitude, longitude, forecastDay, forecastTime);
      if (!weatherData) {
        return `<div style="color: #666;">${this.escapeHtml(location)}<br>Weather unavailable</div>`;
      }

      const condition = this.getWeatherCondition(weatherData.weatherCode);
      const displayTemp = units === 'imperial'
        ? Math.round((weatherData.temperature * 9/5) + 32)
        : weatherData.temperature;
      const tempUnit = units === 'imperial' ? '°F' : '°C';
      const windUnit = units === 'imperial' ? 'mph' : 'km/h';
      const displayWind = units === 'imperial' ? Math.round(weatherData.windSpeed * 0.621) : weatherData.windSpeed;

      const iconSize = Math.min(fontSize * 1.5, 48);
      const smallFontSize = Math.max(10, fontSize * 0.4);

      let html = '<div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">';

      if (showDayName && forecastDay > 0) {
        html += `<div style="font-size: ${smallFontSize}px; color: #666;">${weatherData.dayName}</div>`;
      }

      html += '<div style="display: flex; align-items: center; gap: 8px;">';
      if (showIcon) {
        html += `<div style="color: currentColor;">${this.getWeatherIconSvg(condition.icon, iconSize, 'currentColor')}</div>`;
      }
      html += '<div style="display: flex; flex-direction: column;">';
      if (showTemperature) {
        html += `<div style="font-size: ${fontSize}px; font-weight: bold;">${displayTemp}${tempUnit}</div>`;
      }
      if (showCondition) {
        html += `<div style="font-size: ${smallFontSize}px; color: #666;">${condition.text}</div>`;
      }
      html += '</div></div>';

      if (showHumidity) {
        html += `<div style="font-size: ${smallFontSize}px; color: #888;">Humidity: ${weatherData.humidity}%</div>`;
      }
      if (showWind) {
        html += `<div style="font-size: ${smallFontSize}px; color: #888;">Wind: ${displayWind} ${windUnit}</div>`;
      }
      if (showLocation) {
        html += `<div style="font-size: ${smallFontSize * 0.9}px; color: #999; margin-top: 4px;">${this.escapeHtml(location)}</div>`;
      }

      html += '</div>';
      return html;
    } catch {
      return `<div style="color: #666;">${this.escapeHtml(location)}<br>Weather unavailable</div>`;
    }
  }

  private getWeatherStyles(config: Record<string, any>): string {
    return 'justify-content: center; padding: 8px;';
  }

  // ----- QR Code Widget -----
  private async generateQRCodeContent(config: Record<string, any>, size: number): Promise<string> {
    const content = config.content || 'https://example.com';
    const qrSize = config.size || Math.min(size - 20, 100);
    try {
      const qrDataUrl = await QRCode.toDataURL(content, {
        width: qrSize,
        margin: 1,
        errorCorrectionLevel: 'M',
        color: { dark: '#000000', light: '#ffffff' },
      });
      return `<div style="display: flex; flex-direction: column; align-items: center;">
        <img src="${qrDataUrl}" alt="QR" style="width: ${qrSize}px; height: ${qrSize}px;" />
        <div style="font-size: 10px; color: #888; margin-top: 4px; max-width: 100%; overflow: hidden; text-overflow: ellipsis;">${this.escapeHtml(content.length > 30 ? content.substring(0, 30) + '...' : content)}</div>
      </div>`;
    } catch {
      return `<div style="font-size: 10px; color: #888;">QR Code</div>`;
    }
  }

  // ----- Battery Widget -----
  private generateBatteryContent(config: Record<string, any>, deviceContext?: DeviceContext): string {
    const showPercentage = config.showPercentage as boolean;
    const showIcon = config.showIcon as boolean;
    const batteryLevel = deviceContext?.battery ?? 85;

    let html = '<div style="display: flex; align-items: center; gap: 8px;">';
    if (showIcon) {
      const fillWidth = Math.round((batteryLevel / 100) * 14);
      html += `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="1" y="6" width="18" height="12" rx="2" />
        <rect x="19" y="9" width="4" height="6" rx="1" />
        <rect x="3" y="8" width="${fillWidth}" height="8" fill="currentColor" rx="1" />
      </svg>`;
    }
    if (showPercentage) {
      html += `<span>${batteryLevel}%</span>`;
    }
    html += '</div>';
    return html;
  }

  private getBatteryStyles(config: Record<string, any>): string {
    const fontSize = config.fontSize || 16;
    return `font-size: ${fontSize}px; justify-content: center;`;
  }

  // ----- WiFi Widget -----
  private generateWifiContent(config: Record<string, any>, deviceContext?: DeviceContext): string {
    const showStrength = config.showStrength !== false;
    const showIcon = config.showIcon !== false;
    const signalStrength = deviceContext?.wifi ?? -55;

    let html = '<div style="display: flex; align-items: center; gap: 8px;">';
    if (showIcon) {
      html += `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8.111 16.404a5.5 5.5 0 017.778 0" />
        <path d="M12 20h.01" />
        <path d="M4.93 13.071c3.904-3.905 10.236-3.905 14.141 0" />
        <path d="M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
      </svg>`;
    }
    if (showStrength) {
      html += `<span>${signalStrength} dBm</span>`;
    }
    html += '</div>';
    return html;
  }

  private getWifiStyles(config: Record<string, any>): string {
    const fontSize = config.fontSize || 16;
    return `font-size: ${fontSize}px; justify-content: center;`;
  }

  // ----- Device Info Widget -----
  private generateDeviceInfoContent(config: Record<string, any>, deviceContext?: DeviceContext): string {
    const showName = config.showName !== false;
    const showFirmware = config.showFirmware !== false;
    const showMac = config.showMac as boolean;

    const deviceName = deviceContext?.deviceName || 'TRMNL Device';
    const firmware = deviceContext?.firmwareVersion || 'v1.0.0';
    const mac = deviceContext?.macAddress || 'AA:BB:CC:DD:EE:FF';

    let html = '<div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">';
    if (showName) html += `<div style="font-weight: bold;">${this.escapeHtml(deviceName)}</div>`;
    if (showFirmware) html += `<div style="color: #666;">Firmware: ${this.escapeHtml(firmware)}</div>`;
    if (showMac) html += `<div style="color: #888; font-size: 12px;">${this.escapeHtml(mac)}</div>`;
    html += '</div>';
    return html;
  }

  private getDeviceInfoStyles(config: Record<string, any>): string {
    const fontSize = config.fontSize || 14;
    return `font-size: ${fontSize}px; justify-content: center;`;
  }

  // ----- Image Widget -----
  private async generateImageContent(config: Record<string, any>, width: number, height: number): Promise<string> {
    const url = config.url || config.imageUrl || '';
    const fit = config.fit || 'contain';

    if (!url) {
      return '<div style="color: #999; font-size: 12px;">No image URL</div>';
    }

    // Convert ALL images to base64 data URLs so Puppeteer never makes outbound requests
    let imageUrl: string;
    if (url.startsWith('/uploads/')) {
      try {
        const fs = await import('fs/promises');
        const filePath = this.resolveUploadPath(url);
        const imageBuffer = await fs.readFile(filePath);
        const base64 = imageBuffer.toString('base64');
        const ext = path.extname(url).slice(1) || 'png';
        imageUrl = `data:image/${ext};base64,${base64}`;
      } catch {
        return '<div style="color: #999; font-size: 12px;">Image not found</div>';
      }
    } else {
      // Pre-fetch remote images server-side with SSRF validation
      try {
        await validateUrlSafety(url);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const buffer = Buffer.from(await response.arrayBuffer());
        const base64 = buffer.toString('base64');
        const contentType = response.headers.get('content-type') || 'image/png';
        imageUrl = `data:${contentType};base64,${base64}`;
      } catch {
        return '<div style="color: #999; font-size: 12px;">Image unavailable</div>';
      }
    }

    return `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: white;">
      <img src="${imageUrl}" alt="Image" style="max-width: 100%; max-height: 100%; object-fit: ${fit}; filter: grayscale(100%) contrast(1.2);" />
    </div>`;
  }

  // ----- Divider Widget -----
  private generateDividerContent(config: Record<string, any>, width: number, height: number): string {
    const orientation = config.orientation || 'horizontal';
    const thickness = config.thickness || 2;
    const color = this.sanitizeColor(config.color || '#000000');
    const style = config.style || 'solid';

    const isHorizontal = orientation === 'horizontal';
    const lineStyle = style === 'solid'
      ? `background-color: ${color};`
      : `border-style: ${style}; border-color: ${color}; border-width: ${thickness}px; background-color: transparent;`;

    return `<div style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">
      <div style="${lineStyle} ${isHorizontal ? `width: 100%; height: ${thickness}px;` : `width: ${thickness}px; height: 100%;`}"></div>
    </div>`;
  }

  // ----- Rectangle Widget -----
  private generateRectangleContent(config: Record<string, any>): string {
    const backgroundColor = this.sanitizeColor(config.backgroundColor || '#000000');
    const borderColor = this.sanitizeColor(config.borderColor || '#000000');
    const borderWidth = config.borderWidth || 0;

    const borderStyle = borderWidth > 0 ? `border: ${borderWidth}px solid ${borderColor};` : 'border: none;';
    return `<div style="width: 100%; height: 100%; background-color: ${backgroundColor}; ${borderStyle}"></div>`;
  }

  // ----- GitHub Widget -----
  private async generateGitHubContent(config: Record<string, any>): Promise<string> {
    const owner = config.owner || 'facebook';
    const repo = config.repo || 'react';
    const showIcon = config.showIcon !== false;
    const showRepoName = config.showRepoName as boolean;
    const fontSize = config.fontSize || 32;

    const result = await this.fetchGitHubStars(owner, repo);
    const starsCount = result?.stars ?? 0;
    const formattedStars = starsCount >= 1000000 ? `${(starsCount / 1000000).toFixed(1)}M` : starsCount >= 1000 ? `${(starsCount / 1000).toFixed(1)}k` : String(starsCount);
    const iconSize = Math.min(fontSize * 1.2, 48);
    const smallFontSize = Math.max(12, fontSize * 0.4);

    let html = '<div style="display: flex; flex-direction: column; align-items: center;">';
    html += '<div style="display: flex; align-items: center; gap: 8px;">';
    if (showIcon) {
      html += `<svg width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="currentColor"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" /></svg>`;
    }
    html += `<span style="font-size: ${fontSize}px; font-weight: bold;">${formattedStars}</span>`;
    html += '</div>';
    if (showRepoName) {
      html += `<div style="font-size: ${smallFontSize}px; color: #888; margin-top: 4px;">${this.escapeHtml(owner)}/${this.escapeHtml(repo)}</div>`;
    }
    html += '</div>';
    return html;
  }

  private getGitHubStyles(config: Record<string, any>): string {
    const fontFamily = this.mapFontFamily(config.fontFamily || 'sans-serif');
    return `font-family: ${fontFamily}; justify-content: center;`;
  }

  // ----- Custom Widget -----
  private async generateCustomWidgetContent(config: Record<string, any>, width: number, height: number): Promise<string> {
    const customWidgetId = config.customWidgetId as number;
    if (!customWidgetId) return '<div style="color: #999;">No widget ID</div>';

    try {
      const result = await this.customWidgetsService.getWithData(customWidgetId);
      const renderedContent = result.renderedContent;
      const widgetConfig = (result.widget?.config as Record<string, any>) || {};

      const fontSize = config.fontSize || 24;
      const fontFamily = this.mapFontFamily(config.fontFamily || 'sans-serif');
      const fontWeight = config.fontWeight || 'normal';
      const textAlign = config.textAlign || 'center';
      const verticalAlign = config.verticalAlign || 'middle';
      const color = this.sanitizeColor(config.color || '#000000');

      const alignItems = textAlign === 'left' ? 'flex-start' : textAlign === 'right' ? 'flex-end' : 'center';
      const justifyContent = verticalAlign === 'top' ? 'flex-start' : verticalAlign === 'bottom' ? 'flex-end' : 'center';

      const baseStyle = `display: flex; flex-direction: column; align-items: ${alignItems}; justify-content: ${justifyContent}; width: 100%; height: 100%; padding: 8px; font-size: ${fontSize}px; font-family: ${fontFamily}; font-weight: ${fontWeight}; text-align: ${textAlign}; color: ${color}; line-height: 1.2; overflow: hidden;`;

      if (typeof renderedContent === 'string') {
        if (widgetConfig.fieldType === 'image') {
          const imageUrl = await this.processImageForEinkHtml(renderedContent);
          return `<div style="${baseStyle}"><img src="${imageUrl}" style="max-width: 100%; max-height: 100%; object-fit: contain;" /></div>`;
        }
        return `<div style="${baseStyle}"><div style="width: 100%; text-align: ${textAlign};">${this.escapeHtml(renderedContent)}</div></div>`;
      }

      if (Array.isArray(renderedContent)) {
        const items = renderedContent.slice(0, 10).map(item =>
          `<li style="margin-bottom: 4px;">${this.escapeHtml(String(item))}</li>`
        ).join('');
        return `<div style="${baseStyle}"><ul style="list-style: none; margin: 0; padding: 0; width: 100%; text-align: ${textAlign};">${items}</ul></div>`;
      }

      if (typeof renderedContent === 'object' && renderedContent !== null) {
        // Grid display
        if ('type' in renderedContent && renderedContent.type === 'grid') {
          return await this.generateGridHtml(renderedContent as any, fontSize, fontFamily, config.cellOverrides || {});
        }
        // Title-value display
        if (('title' in renderedContent || 'label' in renderedContent) && 'value' in renderedContent) {
          const label = String('title' in renderedContent ? renderedContent.title : renderedContent.label);
          const value = String(renderedContent.value);
          if (widgetConfig.valueFieldType === 'image') {
            const imageUrl = await this.processImageForEinkHtml(value);
            return `<div style="${baseStyle}">
              <div style="font-size: ${fontSize * 0.6}px; opacity: 0.6;">${this.escapeHtml(label)}</div>
              <img src="${imageUrl}" style="max-width: 100%; max-height: 80%; object-fit: contain; margin-top: 8px;" />
            </div>`;
          }
          return `<div style="${baseStyle}">
            <div style="font-size: ${fontSize * 0.6}px; opacity: 0.6;">${this.escapeHtml(label)}</div>
            <div style="font-weight: bold;">${this.escapeHtml(value)}</div>
          </div>`;
        }
        // Generic object
        return `<div style="${baseStyle}"><pre style="font-size: 12px; text-align: left; margin: 0; white-space: pre-wrap;">${this.escapeHtml(JSON.stringify(renderedContent, null, 2))}</pre></div>`;
      }

      return '<div style="color: #999;">Invalid content</div>';
    } catch (error) {
      return `<div style="color: #f00; font-size: 12px;">Error: ${this.escapeHtml(String(error))}</div>`;
    }
  }

  private getCustomWidgetStyles(config: Record<string, any>): string {
    return '';
  }

  private async generateGridHtml(
    gridContent: { gridCols: number; gridRows: number; gridGap: number; cells: any[] },
    fontSize: number,
    fontFamily: string,
    cellOverrides: Record<string, any>
  ): Promise<string> {
    const { gridCols, gridRows, gridGap, cells } = gridContent;
    const cellFontSize = fontSize * 0.7;

    const cellsHtml = await Promise.all(cells.map(async cell => {
      const cellKey = `${cell.row}-${cell.col}`;
      const override = cellOverrides[cellKey] || {};
      const cFontSize = override.fontSize || cellFontSize;
      const cFontWeight = override.fontWeight || 'bold';
      const cFontFamily = override.fontFamily || fontFamily;
      const cAlign = override.align || cell.align || 'center';

      if (cell.fieldType === 'image' && cell.value) {
        const imageUrl = await this.processImageForEinkHtml(String(cell.value));
        return `<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; overflow: hidden; grid-row: ${cell.row + 1}; grid-column: ${cell.col + 1};">
          ${cell.label ? `<div style="font-size: ${cFontSize * 0.6}px; color: #888;">${this.escapeHtml(cell.label)}</div>` : ''}
          <img src="${imageUrl}" style="max-width: 100%; max-height: 100%; object-fit: contain;" />
        </div>`;
      }

      return `<div style="display: flex; flex-direction: column; align-items: ${cAlign === 'left' ? 'flex-start' : cAlign === 'right' ? 'flex-end' : 'center'}; justify-content: center; overflow: hidden; text-align: ${cAlign}; grid-row: ${cell.row + 1}; grid-column: ${cell.col + 1};">
        ${cell.label ? `<div style="font-size: ${cFontSize * 0.6}px; color: #888;">${this.escapeHtml(cell.label)}</div>` : ''}
        <span style="font-size: ${cFontSize}px; font-weight: ${cFontWeight}; font-family: ${cFontFamily};">${this.escapeHtml(cell.formattedValue)}</span>
      </div>`;
    }));

    return `<div style="display: grid; grid-template-columns: repeat(${gridCols}, 1fr); grid-template-rows: repeat(${gridRows}, 1fr); gap: ${gridGap}px; width: 100%; height: 100%;">${cellsHtml.join('')}</div>`;
  }

  // 1x1 transparent pixel fallback — prevents Puppeteer from fetching unreachable URLs
  private static readonly FALLBACK_PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

  private async processImageForEinkHtml(url: string): Promise<string> {
    if (!url) return '';
    try {
      let imageBuffer: Buffer;
      if (url.startsWith('/uploads/')) {
        const fs = await import('fs/promises');
        imageBuffer = await fs.readFile(this.resolveUploadPath(url));
      } else if (url.startsWith('data:')) {
        return url; // Already a data URL
      } else {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.status}`);
        }
        imageBuffer = Buffer.from(await response.arrayBuffer());
      }
      // Flatten transparent backgrounds to white before processing
      const processedBuffer = await sharp(imageBuffer)
        .flatten({ background: { r: 255, g: 255, b: 255 } })
        .grayscale()
        .normalize()
        .png()
        .toBuffer();
      return `data:image/png;base64,${processedBuffer.toString('base64')}`;
    } catch (error) {
      this.logger.warn(`Failed to process image for e-ink HTML from ${url}: ${error instanceof Error ? error.message : String(error)}`);
      return ScreenRendererService.FALLBACK_PIXEL;
    }
  }
}
