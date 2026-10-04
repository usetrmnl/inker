import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
  Param,
  Query,
  Res,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  NotFoundException,
  UnprocessableEntityException,
  Logger,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiHeader,
} from '@nestjs/swagger';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { DisplayService } from './display/display.service';
import { DefaultScreenService } from './display/default-screen.service';
import { SetupService } from './setup/setup.service';
import { LogService } from './log/log.service';
import { CreateLogDto } from './log/dto/create-log.dto';
import { ScreenRendererService } from '../screen-designer/services/screen-renderer.service';
import { parsePalette } from '../common/utils/spectra6.util';

/**
 * Device API Controller
 * Handles all public API endpoints for device communication
 * Compatible with Ruby Inker API
 */
@ApiTags('device-api')
@Controller('api')
@Public()
@SkipThrottle()
export class ApiController {
  private readonly logger = new Logger(ApiController.name);

  constructor(
    private readonly displayService: DisplayService,
    private readonly defaultScreenService: DefaultScreenService,
    private readonly setupService: SetupService,
    private readonly logService: LogService,
    private readonly screenRendererService: ScreenRendererService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Sanitize headers for logging — remove sensitive values
   */
  private sanitizeHeaders(headers: Record<string, string>): string {
    const sensitiveKeys = ['authorization', 'cookie', 'access-token', 'x-api-key'];
    const sanitized = { ...headers };
    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.includes(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      }
    }
    return JSON.stringify(sanitized);
  }

  /**
   * Extract base URL from request headers
   * Prefers configured API_URL to prevent host header injection.
   * Falls back to Host header for dynamic LAN/IP access.
   */
  private getBaseUrlFromRequest(headers: Record<string, string>): string {
    // Use configured API_URL if set (prevents host header injection)
    const configuredUrl = this.configService.get<string>('api.url');
    if (configuredUrl && configuredUrl !== `http://localhost:${this.configService.get('port', 3002)}`) {
      return configuredUrl;
    }

    // Fallback: derive from request headers (for LAN access where IP varies)
    let host = headers['host'] || headers['Host'] || 'localhost';
    const protocol = headers['x-forwarded-proto']
      || (headers['x-forwarded-ssl'] === 'on' ? 'https' : null)
      || (host.endsWith(':443') ? 'https' : null)
      || 'http';

    // If Host header already has a port, trust it (device/browser sent the correct port)
    // If Host has no port and INKER_PORT is non-standard, append it
    if (!host.includes(':')) {
      const inkerPort = this.configService.get<number>('inkerPort', 80);
      if (inkerPort && inkerPort !== 80) {
        host = `${host}:${inkerPort}`;
      }
    }

    return `${protocol}://${host}`;
  }

  /**
   * Device Display Endpoint - GET /api/display
   * Returns current screen content for device to display
   * Uses HTTP_ID header for device identification (API key)
   */
  @Get('display')
  @HttpCode(HttpStatus.OK)
  @ApiHeader({
    name: 'HTTP_ID',
    description: 'Device API Key',
    required: true,
  })
  @ApiHeader({
    name: 'BASE64',
    description: 'Request base64 encoded image (optional)',
    required: false,
  })
  @ApiHeader({
    name: 'battery-voltage',
    description: 'Device battery voltage (e.g., "3.95")',
    required: false,
  })
  @ApiHeader({
    name: 'rssi',
    description: 'WiFi signal strength in dBm (e.g., "-51")',
    required: false,
  })
  @ApiOperation({
    summary: 'Get display content for device',
    description:
      'Device polling endpoint - returns current screen to display with optional firmware update info',
  })
  @ApiResponse({
    status: 200,
    description: 'Current screen content returned',
    schema: {
      example: {
        status: 0,
        filename: 'design-5-1702069200000.png',
        image_url: 'http://localhost:3002/api/device-images/design/5?t=1702069200000',
        firmware_url: '',
        update_firmware: false,
        refresh_rate: 900,
        reset_firmware: false,
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Device not found' })
  async getDisplay(@Headers() headers: Record<string, string>) {
    // DEBUG: Log ALL incoming headers to see what the device is actually sending
    this.logger.debug(`[DISPLAY] Incoming headers: ${this.sanitizeHeaders(headers)}`);

    // Try multiple header name variations (case-insensitive)
    const deviceApiKey = this.extractHeader(headers, [
      'http_id',
      'HTTP_ID',
      'Http-Id',
      'http-id',
      'id',
      'ID',
      'x-device-id',
      'device-id',
      'access-token',
      'Access-Token',
    ]);

    const base64 = this.extractHeader(headers, [
      'base64',
      'BASE64',
      'Base64',
    ]);

    // Extract battery voltage header (e.g., "3.95" volts)
    const batteryVoltageStr = this.extractHeader(headers, [
      'battery-voltage',
      'Battery-Voltage',
      'battery_voltage',
      'batteryvoltage',
    ]);

    // Extract RSSI (WiFi signal strength) header (e.g., "-51" dBm)
    const rssiStr = this.extractHeader(headers, [
      'rssi',
      'RSSI',
      'Rssi',
      'wifi-rssi',
      'wifi_rssi',
    ]);

    // Extract firmware version header
    const firmwareVersion = this.extractHeader(headers, [
      'http_fw_version',
      'HTTP_FW_VERSION',
      'Http-Fw-Version',
      'http-fw-version',
      'fw-version',
      'firmware-version',
      'Firmware-Version',
      'version',
    ]);

    // Parse battery voltage to percentage (approximate conversion)
    // Typical LiPo: 4.2V = 100%, 3.0V = 0%
    const batteryVoltage = batteryVoltageStr ? parseFloat(batteryVoltageStr) : undefined;
    const battery = batteryVoltage !== undefined && !isNaN(batteryVoltage)
      ? this.voltageToPercentage(batteryVoltage)
      : undefined;

    // Parse RSSI to integer
    const wifi = rssiStr ? parseInt(rssiStr, 10) : undefined;

    // Model + resolution the device reports (used if this device has to auto-provision here)
    const modelName = this.extractHeader(headers, [
      'http_model', 'HTTP_MODEL', 'Http-Model', 'http-model', 'model', 'device-model', 'x-device-model',
    ]);
    const { width: reportedWidth, height: reportedHeight } = this.extractReportedResolution(headers);
    // The device reports the refresh rate it just slept for — lets touch mode tell a tap (early wake)
    // from a scheduled timer wake on untimed screens.
    const refreshRateStr = this.extractHeader(headers, ['refresh-rate', 'Refresh-Rate', 'refresh_rate', 'http_refresh_rate']);
    const reportedRefreshRate = refreshRateStr ? parseInt(refreshRateStr, 10) : undefined;

    this.logger.debug(`[DISPLAY] Extracted deviceApiKey: ${deviceApiKey}, battery: ${batteryVoltageStr}V → ${battery}%, wifi: ${wifi} dBm, fw: ${firmwareVersion}, model: ${modelName}, size: ${reportedWidth}x${reportedHeight}`);

    if (!deviceApiKey) {
      this.logger.error(`[DISPLAY] Missing HTTP_ID header. All headers: ${this.sanitizeHeaders(headers)}`);
      throw new UnprocessableEntityException({
        type: '/problem_details#device_id',
        status: 'unprocessable_content',
        detail: 'Invalid device ID.',
        instance: '/api/display',
        extensions: {
          errors: { HTTP_ID: ['is missing'] },
        },
      });
    }

    try {
      // Get dynamic base URL from request host header
      const baseUrl = this.getBaseUrlFromRequest(headers);

      const result = await this.displayService.getDisplayContent(
        deviceApiKey,
        base64 === 'true',
        { battery, wifi },
        baseUrl,
        firmwareVersion,
        {
          model: modelName,
          width: reportedWidth,
          height: reportedHeight,
          reportedRefreshRate: reportedRefreshRate !== undefined && !isNaN(reportedRefreshRate) ? reportedRefreshRate : undefined,
        },
      );

      this.logger.debug(`Display content served to device: ${deviceApiKey.slice(0, 8)}... (baseUrl: ${baseUrl})`);
      return result;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException({
          type: '/problem_details#device_id',
          status: 'not_found',
          detail: 'Invalid device ID.',
          instance: '/api/display',
        });
      }
      throw error;
    }
  }

  /**
   * Device Setup Endpoint - GET /api/setup
   * Auto-provisions device using MAC address
   * Uses HTTP_ID header for MAC address and optional HTTP_FW_VERSION for firmware version
   */
  @Get('setup')
  @HttpCode(HttpStatus.OK)
  @ApiHeader({
    name: 'HTTP_ID',
    description: 'Device MAC Address',
    required: true,
  })
  @ApiHeader({
    name: 'HTTP_FW_VERSION',
    description: 'Firmware Version (optional)',
    required: false,
  })
  @ApiHeader({
    name: 'battery-voltage',
    description: 'Device battery voltage (e.g., "3.95")',
    required: false,
  })
  @ApiHeader({
    name: 'rssi',
    description: 'WiFi signal strength in dBm (e.g., "-51")',
    required: false,
  })
  @ApiHeader({
    name: 'HTTP_MODEL',
    description: 'Device model name (e.g., "og_png", "large_png"). Defaults to og_png if not provided.',
    required: false,
  })
  @ApiOperation({
    summary: 'Auto-provision device (setup endpoint)',
    description:
      'Allows device to self-register using MAC address. Returns API key and configuration.',
  })
  @ApiResponse({
    status: 200,
    description: 'Device provisioned successfully',
    schema: {
      example: {
        api_key: 'S_PMVGON8htPIae-zRiL6vhGZmo3n1ftYLKvL_9J1f0',
        friendly_id: 'calm-lion-39',
        image_url: 'http://localhost:3001/assets/setup.bmp',
        message: 'Welcome to Inker!',
      },
    },
  })
  @ApiResponse({ status: 422, description: 'Invalid MAC address or setup failed' })
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async getSetup(@Headers() headers: Record<string, string>) {
    // DEBUG: Log ALL incoming headers to see what the device is actually sending
    this.logger.debug(`[SETUP] Incoming headers: ${this.sanitizeHeaders(headers)}`);

    // Try multiple header name variations (case-insensitive)
    const macAddress = this.extractHeader(headers, [
      'http_id',
      'HTTP_ID',
      'Http-Id',
      'http-id',
      'id',
      'ID',
      'mac-address',
      'mac_address',
      'x-device-id',
    ]);

    const firmwareVersion = this.extractHeader(headers, [
      'http_fw_version',
      'HTTP_FW_VERSION',
      'Http-Fw-Version',
      'http-fw-version',
      'fw-version',
      'firmware-version',
      'version',
    ]);

    // Extract battery voltage header (e.g., "3.95" volts)
    const batteryVoltageStr = this.extractHeader(headers, [
      'battery-voltage',
      'Battery-Voltage',
      'battery_voltage',
      'batteryvoltage',
    ]);

    // Extract RSSI (WiFi signal strength) header (e.g., "-51" dBm)
    const rssiStr = this.extractHeader(headers, [
      'rssi',
      'RSSI',
      'Rssi',
      'wifi-rssi',
      'wifi_rssi',
    ]);

    // Parse battery voltage to percentage (approximate conversion)
    const batteryVoltage = batteryVoltageStr ? parseFloat(batteryVoltageStr) : undefined;
    const battery = batteryVoltage !== undefined && !isNaN(batteryVoltage)
      ? this.voltageToPercentage(batteryVoltage)
      : undefined;

    // Parse RSSI to integer
    const wifi = rssiStr ? parseInt(rssiStr, 10) : undefined;

    // Extract model name header (e.g., "large_png", "og_bmp")
    const modelName = this.extractHeader(headers, [
      'http_model',
      'HTTP_MODEL',
      'Http-Model',
      'http-model',
      'model',
      'device-model',
      'x-device-model',
    ]);

    // Extract the display resolution the device reports (TRMNL firmware sends width/height headers)
    const { width: reportedWidth, height: reportedHeight } = this.extractReportedResolution(headers);

    this.logger.debug(`[SETUP] Extracted macAddress: ${macAddress}, firmwareVersion: ${firmwareVersion}, battery: ${battery}%, wifi: ${wifi} dBm, model: ${modelName}, size: ${reportedWidth}x${reportedHeight}`);

    if (!macAddress) {
      this.logger.error(`[SETUP] Missing HTTP_ID header. All headers: ${this.sanitizeHeaders(headers)}`);
      throw new UnprocessableEntityException({
        type: '/problem_details#device_setup',
        status: 'unprocessable_content',
        detail: 'Invalid request headers.',
        instance: '/api/setup',
        extensions: {
          errors: { HTTP_ID: ['is missing'] },
        },
      });
    }

    try {
      // Get dynamic base URL from request host header
      const baseUrl = this.getBaseUrlFromRequest(headers);

      const result = await this.setupService.provisionDevice(
        macAddress,
        firmwareVersion,
        { battery, wifi },
        baseUrl,  // Pass dynamic URL to service
        modelName,
        reportedWidth,
        reportedHeight,
      );

      this.logger.log(`Device setup: ${macAddress} (baseUrl: ${baseUrl})`);
      return result;
    } catch (error) {
      this.logger.error(`[SETUP] Device provisioning failed: ${error.message}`);
      throw new UnprocessableEntityException({
        type: '/problem_details#device_setup',
        status: 'not_found',
        detail: 'Device setup failed',
        instance: '/api/setup',
      });
    }
  }

  /**
   * Device Log Endpoint - POST /api/log
   * Accepts log data from devices
   */
  @Post('log')
  @HttpCode(HttpStatus.OK)
  @ApiHeader({
    name: 'HTTP_ID',
    description: 'Device API Key',
    required: true,
  })
  @ApiOperation({
    summary: 'Create device log entry',
    description: 'Allows devices to send log data for debugging and monitoring',
  })
  @ApiResponse({ status: 201, description: 'Log entry created' })
  @ApiResponse({ status: 404, description: 'Device not found' })
  async createLog(
    @Headers() headers: Record<string, string>,
    @Body() createLogDto: CreateLogDto,
  ) {
    // DEBUG: Log ALL incoming headers
    this.logger.debug(`[LOG] Incoming headers: ${this.sanitizeHeaders(headers)}`);

    const deviceApiKey = this.extractHeader(headers, [
      'http_id',
      'HTTP_ID',
      'Http-Id',
      'http-id',
      'id',
      'ID',
      'x-device-id',
      'access-token',
      'Access-Token',
    ]);

    this.logger.debug(`[LOG] Extracted deviceApiKey: ${deviceApiKey}`);

    if (!deviceApiKey) {
      this.logger.error(`[LOG] Missing HTTP_ID header. All headers: ${this.sanitizeHeaders(headers)}`);
      throw new UnprocessableEntityException({
        type: '/problem_details#device_log',
        status: 'unprocessable_content',
        detail: 'Device API key required',
        instance: '/api/log',
        extensions: {
          errors: { HTTP_ID: ['is missing'] },
        },
      });
    }

    const result = await this.logService.createLog(deviceApiKey, createLogDto);

    this.logger.debug(`Log created for device: ${deviceApiKey.slice(0, 8)}...`);
    return result;
  }

  /**
   * Helper method to extract header value from multiple possible header names
   * NestJS/Express lowercases all headers, so we need to try multiple variations
   */
  private extractHeader(headers: Record<string, string>, possibleNames: string[]): string | undefined {
    // First, try exact matches
    for (const name of possibleNames) {
      if (headers[name]) {
        return headers[name];
      }
    }

    // If no exact match, try case-insensitive search
    const headerKeys = Object.keys(headers);
    for (const name of possibleNames) {
      const matchingKey = headerKeys.find(
        (key) => key.toLowerCase() === name.toLowerCase()
      );
      if (matchingKey && headers[matchingKey]) {
        return headers[matchingKey];
      }
    }

    return undefined;
  }

  /**
   * Extract the display resolution a device reports via headers. TRMNL firmware sends
   * `width`/`height` (e.g. the TRMNL X reports 1872x1404); used to auto-size a device at
   * provisioning instead of defaulting to 800x480.
   */
  private extractReportedResolution(headers: Record<string, string>): { width?: number; height?: number } {
    const w = this.extractHeader(headers, ['width', 'Width', 'http_width', 'HTTP_WIDTH', 'x-width']);
    const h = this.extractHeader(headers, ['height', 'Height', 'http_height', 'HTTP_HEIGHT', 'x-height']);
    const width = w ? parseInt(w, 10) : undefined;
    const height = h ? parseInt(h, 10) : undefined;
    return {
      width: width !== undefined && !isNaN(width) && width > 0 ? width : undefined,
      height: height !== undefined && !isNaN(height) && height > 0 ? height : undefined,
    };
  }

  /**
   * Convert battery voltage to percentage
   * LiPo battery: 4.2V = 100%, 3.5V = 0% (device low-voltage cutoff)
   * Using linear approximation for simplicity
   */
  private voltageToPercentage(voltage: number): number {
    const minVoltage = 3.0;  // 0% battery - LiPo low-voltage cutoff
    const maxVoltage = 4.2;  // 100% battery

    if (voltage >= maxVoltage) return 100;
    if (voltage <= minVoltage) return 0;

    const percentage = ((voltage - minVoltage) / (maxVoltage - minVoltage)) * 100;
    return Math.round(percentage);
  }

  /**
   * Legacy setup endpoint with trailing slash
   * For compatibility with firmware 1.5.x
   */
  @Get('setup/')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async getSetupLegacy(@Headers() headers: Record<string, string>) {
    return this.getSetup(headers);
  }

  /**
   * Device Current Screen Preview Endpoint - GET /api/device-images/device/:id
   * Returns the PNG image that a device is currently displaying (preview mode)
   * Used by admin UI to preview what a device should be showing
   */
  @Get('device-images/device/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Render current screen for a device (preview for admin)' })
  @ApiResponse({
    status: 200,
    description: 'PNG image of the current screen',
    content: { 'image/png': {} },
  })
  @ApiResponse({ status: 404, description: 'Device not found' })
  async renderDeviceCurrentScreen(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    try {
      const imageBuffer = await this.displayService.getCurrentScreenImage(id);

      res.set({
        'Content-Type': 'image/png',
        'Content-Length': imageBuffer.length,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      });

      res.send(imageBuffer);
    } catch (error) {
      this.logger.error(`Failed to render current screen for device ${id}: ${error.message}`);
      throw new NotFoundException('Device or screen not found');
    }
  }

  /**
   * Screen Design Render Endpoint - GET /api/device-images/design/:id
   * Returns rendered PNG image for designed screens (public, no auth required)
   * Used by devices to fetch designed screen images
   *
   * Query parameters:
   * - t: Cache buster timestamp
   * - battery: Device battery percentage (0-100)
   * - wifi: Device WiFi RSSI in dBm
   * - deviceName: Device name
   * - firmwareVersion: Device firmware version
   * - macAddress: Device MAC address
   * - mode: Render mode ('device' | 'preview' | 'einkPreview')
   *   - device: Full e-ink processing with inversion (default, for actual device)
   *   - preview: No e-ink processing (RGB preview for admin UI)
   *   - einkPreview: Full e-ink processing without inversion (pixel-perfect preview on RGB display)
   * - preview: Legacy boolean parameter (deprecated, use mode instead)
   * - palette: Colour panel palette; only 'spectra6' is recognised (other values are ignored)
   */
  @Get('device-images/design/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Render a screen design to PNG (public, for devices)' })
  @ApiResponse({
    status: 200,
    description: 'PNG image of the rendered screen design',
    content: { 'image/png': {} },
  })
  @ApiResponse({ status: 404, description: 'Screen design not found' })
  async renderScreenDesignPublic(
    @Param('id', ParseIntPipe) id: number,
    @Query('battery') battery: string,
    @Query('wifi') wifi: string,
    @Query('deviceName') deviceName: string,
    @Query('firmwareVersion') firmwareVersion: string,
    @Query('macAddress') macAddress: string,
    @Query('mode') mode: string,
    @Query('preview') preview: string,
    @Query('format') format: string,
    @Query('bitDepth') bitDepthRaw: string,
    @Query('palette') paletteRaw: string,
    @Res() res: Response,
  ) {
    // Container: 'bmp' for TRMNL OG / DIY-kit firmware that rejects PNG (issue #31), otherwise PNG.
    // bitDepth 4 → 16-level grayscale (TRMNL X), delivered as a compressed grayscale PNG by default.
    const bitDepth = bitDepthRaw === '4' ? 4 : 1;
    // palette=spectra6 → 6-colour indexed PNG for Spectra 6 panels (whitelisted; PNG only).
    const palette = parsePalette(paletteRaw);
    const imageFormat: 'png' | 'bmp' = format === 'bmp' ? 'bmp' : 'png';
    const contentType = imageFormat === 'bmp' ? 'image/bmp' : 'image/png';
    try {
      // Determine render mode:
      // 1. Use explicit mode parameter if provided
      // 2. Fall back to legacy preview parameter for backwards compatibility
      // 3. Default to 'device' mode
      let renderMode: 'device' | 'preview' | 'einkPreview' = 'device';
      if (mode === 'preview' || mode === 'einkPreview' || mode === 'device') {
        renderMode = mode;
      } else if (preview === 'true' || preview === '1') {
        renderMode = 'preview';
      }

      // NOTE: Capture serving is handled by display.service.ts which returns capture URLs
      // for static screens and render URLs for dynamic screens (clock, countdown, weather).
      // This endpoint should ALWAYS render fresh to support dynamic widgets.

      // Build device context from query params
      const deviceContext = {
        battery: battery ? parseFloat(battery) : undefined,
        wifi: wifi ? parseInt(wifi, 10) : undefined,
        deviceName: deviceName || undefined,
        firmwareVersion: firmwareVersion || undefined,
        macAddress: macAddress || undefined,
      };

      // Fall back to re-rendering if no capture exists
      const imageBuffer = await this.screenRendererService.renderScreenDesign(id, deviceContext, renderMode, imageFormat, bitDepth, palette);

      // Disable caching for all render modes - admin UI needs fresh previews
      const cacheHeaders = {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      };

      res.set({
        'Content-Type': contentType,
        'Content-Length': imageBuffer.length,
        ...cacheHeaders,
      });

      res.send(imageBuffer);
    } catch (error) {
      this.logger.error(`Failed to render screen design ${id}: ${error.message}`);
      // Return default screen instead of 404 to prevent device loading loop.
      // Honor the requested format so BMP-only firmware still gets a usable image.
      try {
        const fallbackBuffer = imageFormat === 'bmp'
          ? await this.defaultScreenService.getDefaultScreenBmpBuffer()
          : await this.defaultScreenService.getDefaultScreenBuffer();
        res.set({
          'Content-Type': contentType,
          'Content-Length': fallbackBuffer.length,
          'Cache-Control': 'no-store',
        });
        res.send(fallbackBuffer);
      } catch {
        throw new NotFoundException('Screen design not found');
      }
    }
  }

  /**
   * Uploaded Screen (device format) Endpoint - GET /api/device-images/screen/:id
   * Serves an uploaded screen converted to the device's required format. Used for
   * TRMNL OG / DIY-kit firmware that rejects PNG and needs 1-bit BMP (issue #31).
   * PNG devices continue to fetch the stored upload directly (static /uploads path).
   */
  @Get('device-images/screen/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Render an uploaded screen to the device format (BMP for OG/DIY firmware)' })
  @ApiResponse({ status: 200, description: 'Screen image in the requested format' })
  @ApiResponse({ status: 404, description: 'Screen not found' })
  async renderUploadedScreen(
    @Param('id', ParseIntPipe) id: number,
    @Query('bitDepth') bitDepthRaw: string,
    @Query('format') format: string,
    @Res() res: Response,
  ) {
    try {
      const bitDepth = bitDepthRaw === '4' ? 4 : 1;
      const imageFormat: 'png' | 'bmp' = format === 'bmp' ? 'bmp' : 'png';
      const imageBuffer = await this.displayService.getUploadedScreenForDevice(id, imageFormat, bitDepth);
      res.set({
        'Content-Type': imageFormat === 'bmp' ? 'image/bmp' : 'image/png',
        'Content-Length': imageBuffer.length,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      });
      res.send(imageBuffer);
    } catch (error) {
      this.logger.error(`Failed to render uploaded screen ${id}: ${error.message}`);
      throw new NotFoundException('Screen not found');
    }
  }
}
