import {
  Injectable,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { generateToken } from '../../common/utils/crypto.util';
import { SetupScreenService } from './setup-screen.service';

/**
 * Device metrics from headers
 */
export interface DeviceMetrics {
  battery?: number;  // Battery percentage (0-100)
  wifi?: number;     // WiFi RSSI in dBm (e.g., -51)
}

@Injectable()
export class SetupService {
  private readonly logger = new Logger(SetupService.name);

  constructor(
    private prisma: PrismaService,
    private setupScreenService: SetupScreenService,
  ) {}

  /**
   * Provision device using MAC address
   * Returns device UUID (API key) and configuration
   * Compatible with Ruby Inker setup endpoint
   *
   * @param macAddress - Device MAC address
   * @param firmwareVersion - Device firmware version (optional)
   * @param metrics - Device metrics (battery, wifi)
   * @param baseUrl - Dynamic base URL from request (e.g., "http://localhost:3002")
   */
  async provisionDevice(
    macAddress: string,
    firmwareVersion?: string,
    metrics?: DeviceMetrics,
    baseUrl?: string,
  ) {
    // Validate MAC address format
    if (!this.isValidMacAddress(macAddress)) {
      throw new BadRequestException('Invalid MAC address format');
    }

    // Check if device was deleted/blocked - return reset signal instead of provisioning
    // This prevents auto-re-provisioning of deleted devices
    const blockedDevice = await this.prisma.blockedDevice.findUnique({
      where: { macAddress },
    });

    if (blockedDevice) {
      this.logger.log(`Device ${macAddress} is blocked - sending factory reset signal and unblocking`);

      // Remove from blocked list so device can re-provision after factory reset
      await this.prisma.blockedDevice.delete({
        where: { macAddress },
      });

      return {
        status: 200,
        api_key: '',
        friendly_id: '',
        image_url: '',
        message: 'Device was removed from server',
        reset_firmware: true,
      };
    }

    // Check if device already exists
    let device = await this.prisma.device.findUnique({
      where: { macAddress },
      include: {
        model: true,
      },
    });

    if (device) {
      // Device exists, update firmware version and metrics if provided
      const updateData: {
        firmwareVersion?: string;
        lastSeenAt: Date;
        battery?: number;
        wifi?: number;
      } = {
        lastSeenAt: new Date(),
      };

      if (firmwareVersion && firmwareVersion !== device.firmwareVersion) {
        updateData.firmwareVersion = firmwareVersion;
      }

      // Update battery if provided
      if (metrics?.battery !== undefined && !isNaN(metrics.battery)) {
        updateData.battery = metrics.battery;
      }

      // Update wifi RSSI if provided
      if (metrics?.wifi !== undefined && !isNaN(metrics.wifi)) {
        updateData.wifi = metrics.wifi;
      }

      device = await this.prisma.device.update({
        where: { id: device.id },
        data: updateData,
        include: {
          model: true,
        },
      });

      this.logger.log(
        `Device ${device.name} re-provisioned (MAC: ${macAddress}, battery: ${device.battery}%, wifi: ${device.wifi} dBm)`,
      );

      return this.buildSetupResponse(device, baseUrl);
    }

    // Device doesn't exist, create new one
    // Find default model (og_png) or create it if it doesn't exist
    let defaultModel = await this.prisma.model.findFirst({
      where: { name: 'og_png' },
    });

    // Auto-create the default model if it doesn't exist (for fresh databases)
    if (!defaultModel) {
      this.logger.log('Default model "og_png" not found, creating it...');
      defaultModel = await this.prisma.model.create({
        data: {
          name: 'og_png',
          label: 'TRMNL Original (PNG)',
          width: 800,
          height: 480,
          description: 'Original TRMNL device with 800x480 e-ink display (PNG format)',
          mimeType: 'image/png',
          colors: 2,
          bitDepth: 1,
          rotation: 0,
          offsetX: 0,
          offsetY: 0,
          kind: 'terminus',
          scaleFactor: 1.0,
        },
      });
      this.logger.log('Default model "og_png" created successfully');
    }

    // Generate API key (UUID)
    const apiKey = generateToken(32);

    // Create new device with initial metrics if provided
    device = await this.prisma.device.create({
      data: {
        name: `Device-${macAddress.slice(-8)}`,
        friendlyId: this.generateFriendlyId(),
        macAddress,
        apiKey,
        firmwareVersion,
        modelId: defaultModel.id,
        lastSeenAt: new Date(),
        refreshRate: 900, // 15 minutes default
        wifi: metrics?.wifi !== undefined && !isNaN(metrics.wifi) ? metrics.wifi : 0,
        battery: metrics?.battery !== undefined && !isNaN(metrics.battery) ? metrics.battery : 0,
      },
      include: {
        model: true,
      },
    });

    if (!device) {
      throw new BadRequestException('Failed to create device');
    }

    this.logger.log(
      `New device provisioned: ${device.name} (MAC: ${macAddress})`,
    );

    return this.buildSetupResponse(device, baseUrl);
  }

  /**
   * Build setup response compatible with Ruby Inker format
   * Must match the exact format from firmware/setup.rb:
   * { api_key, friendly_id, image_url, message }
   */
  private buildSetupResponse(device: any, baseUrl?: string) {
    // Use dynamic URL from request, or fall back to environment/default
    const apiUrl = baseUrl || process.env.API_URL || 'http://localhost:3002';

    // Get the setup screen URL from the SetupScreenService
    const setupScreenUrl = this.setupScreenService.getSetupScreenUrl();

    return {
      status: 200,                      // TRMNL firmware expects status field
      api_key: device.apiKey,           // CRITICAL: Must be 'api_key' not 'uuid'
      friendly_id: device.friendlyId,   // Friendly name for the device
      image_url: `${apiUrl}${setupScreenUrl}`,  // Setup screen image
      message: 'Welcome to Inker!',     // Welcome message
    };
  }

  /**
   * Validate MAC address format
   */
  private isValidMacAddress(mac: string): boolean {
    // Accept various MAC address formats:
    // - AA:BB:CC:DD:EE:FF
    // - AA-BB-CC-DD-EE-FF
    // - AABBCCDDEEFF
    const macRegex = /^([0-9A-Fa-f]{2}[:-]?){5}([0-9A-Fa-f]{2})$/;
    return macRegex.test(mac);
  }

  /**
   * Generate a friendly ID for device
   */
  private generateFriendlyId(): string {
    const adjectives = ['swift', 'bright', 'calm', 'bold', 'wise', 'keen'];
    const nouns = ['fox', 'hawk', 'wolf', 'bear', 'lion', 'eagle'];

    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const num = Math.floor(Math.random() * 100);

    return `${adj}-${noun}-${num}`;
  }
}
