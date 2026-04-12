import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { DefaultScreenService } from './default-screen.service';
import { ScreenRendererService } from '../../screen-designer/services/screen-renderer.service';
import { PluginsService } from '../../plugins/plugins.service';
import { SetupService } from '../setup/setup.service';

/**
 * Device metrics from headers
 */
export interface DeviceMetrics {
  battery?: number;  // Battery percentage (0-100)
  wifi?: number;     // WiFi RSSI in dBm (e.g., -51)
}

@Injectable()
export class DisplayService {
  private readonly logger = new Logger(DisplayService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private defaultScreenService: DefaultScreenService,
    private screenRendererService: ScreenRendererService,
    private pluginsService: PluginsService,
    private setupService: SetupService,
  ) {}

  /**
   * Get display content for device
   * Called by device using its MAC address (from id header) to fetch current screen to display
   *
   * @param macAddressOrApiKey - Device MAC address or API key
   * @param useBase64 - Whether to include base64 encoded image
   * @param metrics - Device metrics (battery, wifi)
   * @param baseUrl - Dynamic base URL from request (e.g., "http://localhost:3002")
   */
  async getDisplayContent(
    macAddressOrApiKey: string,
    useBase64: boolean = false,
    metrics?: { battery?: number; wifi?: number },
    baseUrl?: string,
    firmwareVersion?: string,
  ) {
    // Use dynamic baseUrl from request, or fall back to config
    const apiUrl = baseUrl || this.config.get<string>('api.url', 'http://localhost:3002');
    // Find device by MAC address (id header) or API key (access-token header)
    // The Ruby version looks up by MAC address for better compatibility
    let device = await this.prisma.device.findFirst({
      where: {
        OR: [
          { macAddress: macAddressOrApiKey },
          { apiKey: macAddressOrApiKey },
        ],
      },
      include: {
        model: true,
        playlist: {
          include: {
            items: {
              include: {
                screen: true,
                screenDesign: {
                  include: {
                    widgets: {
                      include: {
                        template: true,
                      },
                    },
                  },
                },
                pluginInstance: {
                  include: {
                    plugin: true,
                  },
                },
              },
              orderBy: {
                order: 'asc',
              },
            },
          },
        },
      },
    });

    if (!device) {
      // Auto-provision unknown devices instead of factory resetting
      // This handles devices connecting to a new/rebuilt server that still have
      // a stored api_key — they skip /api/setup and call /api/display directly
      const macRegex = /^([0-9A-Fa-f]{2}[:-]?){5}([0-9A-Fa-f]{2})$/;
      const isBlocked = macRegex.test(macAddressOrApiKey) && await this.prisma.blockedDevice.findUnique({
        where: { macAddress: macAddressOrApiKey },
      });
      if (macRegex.test(macAddressOrApiKey) && !isBlocked) {
        this.logger.log(`Auto-provisioning unknown device with MAC ${macAddressOrApiKey}`);
        try {
          await this.setupService.provisionDevice(
            macAddressOrApiKey,
            firmwareVersion,
            metrics,
            baseUrl,
          );
          // Re-fetch the newly created device to continue with display logic
          device = await this.prisma.device.findFirst({
            where: { macAddress: macAddressOrApiKey },
            include: {
              model: true,
              playlist: {
                include: {
                  items: {
                    include: {
                      screen: true,
                      screenDesign: { include: { widgets: { include: { template: true } } } },
                      pluginInstance: { include: { plugin: true } },
                    },
                    orderBy: { order: 'asc' },
                  },
                },
              },
            },
          });
        } catch (err) {
          this.logger.error(`Auto-provision failed for ${macAddressOrApiKey}: ${err.message}`);
        }
      }

      // If still not found after auto-provision attempt, send reset
      if (!device) {
        this.logger.log(`Device not found for key ${macAddressOrApiKey} - sending factory reset signal`);
        return {
          status: 0,
          image_url: '',
          filename: '',
          image_url_timeout: 0,
          firmware_url: '',
          update_firmware: false,
          refresh_rate: 0,
          reset_firmware: true,
          special_function: '',
          temperature_profile: 'default',
          maximum_compatibility: false,
          message: 'Device removed from server',
        };
      }
    }

    // Check if device has a pending refresh (playlist just changed)
    const shouldRefreshImmediately = device.refreshPending;

    // Build update data with lastSeenAt and optional metrics
    const updateData: {
      lastSeenAt: Date;
      battery?: number;
      wifi?: number;
      firmwareVersion?: string;
      refreshPending?: boolean;
    } = {
      lastSeenAt: new Date(),
      // Reset refreshPending flag after serving content
      refreshPending: false,
    };

    // Update battery if provided (store as percentage)
    if (metrics?.battery !== undefined && !isNaN(metrics.battery)) {
      updateData.battery = metrics.battery;
    }

    // Update wifi RSSI if provided
    if (metrics?.wifi !== undefined && !isNaN(metrics.wifi)) {
      updateData.wifi = metrics.wifi;
    }

    // Update firmware version if provided and changed
    if (firmwareVersion && firmwareVersion !== device.firmwareVersion) {
      updateData.firmwareVersion = firmwareVersion;
    }

    // Update device with last seen timestamp and metrics
    const updatedDevice = await this.prisma.device.update({
      where: { id: device.id },
      data: updateData,
    });

    if (shouldRefreshImmediately) {
      this.logger.log(`Device ${device.name} has pending refresh - sending immediate refresh signal`);
    }

    this.logger.debug(
      `Device ${device.name} updated: battery=${updatedDevice.battery}%, wifi=${updatedDevice.wifi} dBm`,
    );

    // Check for firmware update
    const firmwareUrl = await this.getFirmwareUpdateUrl(device.firmwareVersion || undefined);

    // Default refresh rate (used for default screens or when no playlist)
    const defaultRefreshRate = shouldRefreshImmediately ? 1 : device.refreshRate;

    // If no playlist or no screens in playlist, return the default welcome screen
    if (!device.playlist || !device.playlist.items || device.playlist.items.length === 0) {
      this.logger.log(`Device ${device.name} has no playlist - serving default screen`);

      await this.defaultScreenService.ensureDefaultScreenExists();
      const defaultScreenUrl = this.defaultScreenService.getDefaultScreenUrl();
      const fullDefaultUrl = `${apiUrl}${defaultScreenUrl}?t=${Date.now()}`;

      // Get base64 if requested
      let imageData: string | undefined;
      if (useBase64) {
        try {
          imageData = await this.defaultScreenService.getDefaultScreenBase64();
        } catch (error) {
          this.logger.warn('Failed to get default screen base64:', error);
        }
      }

      return {
        status: 0,
        image_url: fullDefaultUrl,
        filename: `default-screen-${Date.now()}.png`,
        image_url_timeout: 0,
        image_data: imageData,
        firmware_url: firmwareUrl,
        update_firmware: !!firmwareUrl,
        refresh_rate: defaultRefreshRate,
        reset_firmware: false,
        special_function: '',
        temperature_profile: 'default',
        maximum_compatibility: false,
        battery: updatedDevice.battery,
        wifi: updatedDevice.wifi,
      };
    }

    // Get current screen from playlist rotation
    const currentScreenResult = this.getCurrentScreen(device.playlist.items);

    if (!currentScreenResult) {
      this.logger.log(`Device ${device.name} playlist has no valid screens - serving default screen`);

      await this.defaultScreenService.ensureDefaultScreenExists();
      const defaultScreenUrl = this.defaultScreenService.getDefaultScreenUrl();
      const fullDefaultUrl = `${apiUrl}${defaultScreenUrl}?t=${Date.now()}`;

      // Get base64 if requested
      let imageData: string | undefined;
      if (useBase64) {
        try {
          imageData = await this.defaultScreenService.getDefaultScreenBase64();
        } catch (error) {
          this.logger.warn('Failed to get default screen base64:', error);
        }
      }

      return {
        status: 0,
        image_url: fullDefaultUrl,
        filename: `default-screen-${Date.now()}.png`,
        image_url_timeout: 0,
        image_data: imageData,
        firmware_url: firmwareUrl,
        update_firmware: !!firmwareUrl,
        refresh_rate: defaultRefreshRate,
        reset_firmware: false,
        special_function: '',
        temperature_profile: 'default',
        maximum_compatibility: false,
        battery: updatedDevice.battery,
        wifi: updatedDevice.wifi,
      };
    }

    const { item: currentScreen } = currentScreenResult;

    // Calculate total playlist duration for refresh rate capping
    // This prevents the device from getting stuck on one screen when refreshRate >= totalDuration
    const playlistItems = device.playlist.items;
    const totalPlaylistDuration = playlistItems.length > 1
      ? playlistItems.reduce((sum: number, item: any) => sum + (item.duration || 60), 0)
      : Infinity; // Single screen: no rotation cap needed

    // Generate unique screen ID to detect screen changes
    const currentScreenId = currentScreen.screenDesign
      ? `design-${currentScreen.screenDesign.id}`
      : currentScreen.screen
        ? `screen-${currentScreen.screen.id}`
        : null;

    // Detect screen change for ghosting prevention (full refresh on e-ink)
    // maximum_compatibility = true forces slower full refresh, preventing artifacts
    const screenChanged = !!(currentScreenId && device.lastScreenId !== currentScreenId);
    if (screenChanged) {
      this.logger.debug(
        `Screen changed for device ${device.name}: ${device.lastScreenId} -> ${currentScreenId} (will trigger full refresh)`,
      );
      // Update lastScreenId in database
      await this.prisma.device.update({
        where: { id: device.id },
        data: { lastScreenId: currentScreenId },
      });
    }

    // Calculate refresh rate based on current screen content
    // Clock widgets get minute-synced refresh, countdown widgets get 60s refresh
    // Capped at total playlist duration to prevent stuck screens
    const effectiveRefreshRate = this.getRefreshRateForScreen(
      currentScreen,
      device.refreshRate,
      shouldRefreshImmediately,
      totalPlaylistDuration,
    );

    // Calculate the next refresh timestamp for minute-synchronized clock updates
    const nextRefreshAt = this.getNextRefreshTimestamp(
      currentScreen,
      device.refreshRate,
      shouldRefreshImmediately,
      totalPlaylistDuration,
    );

    // Handle both regular screens and designed screens
    if (currentScreen.screen) {
      // Regular uploaded screen
      const imageUrl = currentScreen.screen.imageUrl.startsWith('http')
        ? currentScreen.screen.imageUrl
        : `${apiUrl}${currentScreen.screen.imageUrl}`;

      this.logger.debug(
        `Serving screen "${currentScreen.screen.name}" to device ${device.name}`,
      );

      return {
        status: 0,
        image_url: imageUrl,
        filename: this.getImageFilename(currentScreen.screen.imageUrl),
        image_url_timeout: 0,
        image_data: useBase64 ? await this.getBase64Image(currentScreen.screen.imageUrl) : undefined,
        firmware_url: firmwareUrl,
        update_firmware: !!firmwareUrl,
        refresh_rate: effectiveRefreshRate,
        reset_firmware: false,
        special_function: '',
        temperature_profile: 'default',
        maximum_compatibility: screenChanged,
        refresh_at: nextRefreshAt,
        battery: updatedDevice.battery,
        wifi: updatedDevice.wifi,
      };
    } else if (currentScreen.screenDesign) {
      // Designed screen - always render fresh via the render endpoint
      // This ensures consistent URLs and up-to-date content for all widget types
      const timestamp = Date.now();

      const queryParams = new URLSearchParams({
        t: timestamp.toString(),
        battery: (updatedDevice.battery ?? 0).toString(),
        wifi: (updatedDevice.wifi ?? 0).toString(),
        deviceName: device.name || 'Unknown',
        firmwareVersion: device.firmwareVersion || 'Unknown',
        macAddress: device.macAddress ? `XX:XX:XX:${device.macAddress.slice(-8)}` : 'Unknown',
      });
      const renderUrl = `${apiUrl}/api/device-images/design/${currentScreen.screenDesign.id}?${queryParams.toString()}`;

      // CRITICAL: Include timestamp in filename to force device to fetch new image
      // The TRMNL device firmware caches images by filename, so if we always return
      // "design-5.png", the device thinks it already has this image and won't fetch
      // the new URL. By changing the filename on each request (e.g., "design-5-1702069200000.png"),
      // the device recognizes it as a new file and downloads the fresh image.
      const dynamicFilename = `design-${currentScreen.screenDesign.id}-${timestamp}.png`;

      this.logger.debug(
        `Serving screen "${currentScreen.screenDesign.name}" to device ${device.name} (refresh: ${effectiveRefreshRate}s, next_at: ${nextRefreshAt ? new Date(nextRefreshAt).toISOString() : 'N/A'})`,
      );

      return {
        status: 0,
        image_url: renderUrl,
        filename: dynamicFilename,
        image_url_timeout: 0,
        image_data: undefined,
        firmware_url: firmwareUrl,
        update_firmware: !!firmwareUrl,
        refresh_rate: effectiveRefreshRate,
        reset_firmware: false,
        special_function: '',
        temperature_profile: 'default',
        maximum_compatibility: screenChanged,
        refresh_at: nextRefreshAt,
        battery: updatedDevice.battery,
        wifi: updatedDevice.wifi,
      };
    } else if (currentScreen.pluginInstance?.plugin) {
      // Plugin instance - render via plugin engine
      const pluginInstance = currentScreen.pluginInstance;
      const timestamp = Date.now();

      const renderUrl = `${apiUrl}/api/plugins/instances/${pluginInstance.id}/render?mode=device&t=${timestamp}`;
      const dynamicFilename = `plugin-${pluginInstance.plugin.slug}-${timestamp}.png`;

      this.logger.debug(
        `Serving PLUGIN "${pluginInstance.plugin.name}" to device ${device.name} (refresh: ${effectiveRefreshRate}s)`,
      );

      return {
        status: 0,
        image_url: renderUrl,
        filename: dynamicFilename,
        image_url_timeout: 0,
        image_data: undefined,
        firmware_url: firmwareUrl,
        update_firmware: !!firmwareUrl,
        refresh_rate: effectiveRefreshRate,
        reset_firmware: false,
        special_function: '',
        temperature_profile: 'default',
        maximum_compatibility: screenChanged,
        refresh_at: nextRefreshAt,
        battery: updatedDevice.battery,
        wifi: updatedDevice.wifi,
      };
    } else {
      // Neither screen, screenDesign, nor plugin - handle gracefully
      this.logger.warn(`Playlist item ${currentScreen.id} has no screen, screenDesign, or plugin`);

      await this.defaultScreenService.ensureDefaultScreenExists();
      const defaultScreenUrl = this.defaultScreenService.getDefaultScreenUrl();
      const fullDefaultUrl = `${apiUrl}${defaultScreenUrl}?t=${Date.now()}`;

      return {
        status: 0,
        image_url: fullDefaultUrl,
        filename: `default-screen-${Date.now()}.png`,
        image_url_timeout: 0,
        image_data: undefined,
        firmware_url: firmwareUrl,
        update_firmware: !!firmwareUrl,
        refresh_rate: defaultRefreshRate,
        reset_firmware: false,
        special_function: '',
        temperature_profile: 'default',
        maximum_compatibility: false,
        battery: updatedDevice.battery,
        wifi: updatedDevice.wifi,
      };
    }
  }

  /**
   * Get current screen from playlist items using simple rotation
   *
   * Returns: { item, remainingTime } - the current playlist item and seconds until it should rotate
   */
  private getCurrentScreen(items: any[]): { item: any; remainingTime: number } | null {
    if (!items || items.length === 0) {
      return null;
    }

    // SINGLE SCREEN: No rotation needed — use device refresh rate
    // Dynamic widgets (clock, countdown) are handled by getRefreshRateForScreen()
    if (items.length === 1) {
      return { item: items[0], remainingTime: Infinity };
    }

    // Multiple screens: rotation based on current time
    // Each screen shows for its duration, then rotates to next
    const totalDuration = items.reduce((sum, item) => sum + (item.duration || 60), 0);

    // Guard against division by zero (shouldn't happen, but defensive)
    if (totalDuration <= 0) {
      const firstItemDuration = items[0].duration || 60;
      return { item: items[0], remainingTime: firstItemDuration };
    }

    const currentSecond = Math.floor(Date.now() / 1000);
    const positionInCycle = currentSecond % totalDuration;

    let elapsed = 0;
    for (const item of items) {
      const itemDuration = item.duration || 60;
      elapsed += itemDuration;
      if (positionInCycle < elapsed) {
        // Calculate remaining time for this screen
        const remainingTime = elapsed - positionInCycle;
        return { item, remainingTime };
      }
    }

    // Fallback to first item
    const firstItemDuration = items[0].duration || 60;
    return { item: items[0], remainingTime: firstItemDuration };
  }

  /**
   * Get current time in HH:MM format
   */
  private getCurrentTimeHHMM(): string {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  /**
   * Check if firmware update is available
   */
  private async getFirmwareUpdateUrl(currentVersion?: string): Promise<string> {
    if (!currentVersion) {
      return '';
    }

    // Get latest stable firmware
    const latestFirmware = await this.prisma.firmware.findFirst({
      where: { isStable: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!latestFirmware) {
      return '';
    }

    // Only return update URL if version is different
    if (latestFirmware.version === currentVersion) {
      return '';
    }

    return latestFirmware.downloadUrl;
  }

  /**
   * Extract filename from image URL
   */
  private getImageFilename(imageUrl: string): string {
    const parts = imageUrl.split('/');
    return parts[parts.length - 1];
  }

  /**
   * Get base64 encoded image (if requested by device)
   * This would require actual image processing in production
   */
  private async getBase64Image(imageUrl: string): Promise<string | undefined> {
    // TODO: Implement base64 encoding of image
    // For now, return undefined and device will fetch via URL
    return undefined;
  }

  /**
   * Check if a screen design contains a clock widget
   */
  private hasClockWidget(screenDesign: any): boolean {
    if (!screenDesign?.widgets || !Array.isArray(screenDesign.widgets)) {
      return false;
    }

    return screenDesign.widgets.some(
      (widget: any) => widget.template && widget.template.name === 'clock',
    );
  }

  /**
   * Get the appropriate refresh rate based on screen content
   * For clock widgets, returns the exact seconds until next minute boundary
   * This ensures the device wakes up exactly when the minute changes
   * Capped at totalPlaylistDuration to prevent getting stuck on one screen
   */
  private getRefreshRateForScreen(
    currentScreen: any,
    deviceRefreshRate: number,
    shouldRefreshImmediately: boolean,
    totalPlaylistDuration: number,
  ): number {
    // If refresh is pending, return 1 second to force immediate update
    if (shouldRefreshImmediately) {
      return 1;
    }

    let refreshRate = deviceRefreshRate;

    // For screens with clock widgets, calculate exact seconds until next minute boundary
    // The device should wake up AFTER the minute changes so the clock shows the new time
    if (currentScreen?.screenDesign && this.hasClockWidget(currentScreen.screenDesign)) {
      const now = new Date();
      const secondsIntoMinute = now.getSeconds();
      const secondsUntilNextMinute = 60 - secondsIntoMinute;

      // Add a small buffer (3 seconds) to ensure we're past the minute boundary
      // This way the clock renders the new minute, not the old one
      const bufferSeconds = 3;
      refreshRate = secondsUntilNextMinute + bufferSeconds;

      // Cap at reasonable values
      if (refreshRate > 63) {
        refreshRate = 63;
      }

      this.logger.debug(
        `Clock widget - calculated refresh ${refreshRate}s (${secondsUntilNextMinute}s until minute + ${bufferSeconds}s buffer)`,
      );
    }

    // Cap at total playlist duration to ensure device sees all screens in rotation
    // Unlike the old per-screen remainingTime cap, this is constant and predictable
    if (totalPlaylistDuration > 0 && totalPlaylistDuration < refreshRate) {
      this.logger.debug(
        `Capping refresh rate from ${refreshRate}s to ${totalPlaylistDuration}s (total playlist duration)`,
      );
      refreshRate = totalPlaylistDuration;
    }

    // Floor: never go below 10 seconds to prevent rapid polling from edge cases
    if (refreshRate < 10) {
      refreshRate = 10;
    }

    return refreshRate;
  }

  /**
   * Calculate the exact timestamp when the device should refresh next
   * For clock widgets, this is synchronized to the next minute boundary
   * This ensures the clock updates exactly when the minute changes (e.g., 20:00 -> 20:01)
   * Capped at totalPlaylistDuration to prevent getting stuck on one screen
   */
  getNextRefreshTimestamp(
    currentScreen: any,
    deviceRefreshRate: number,
    shouldRefreshImmediately: boolean,
    totalPlaylistDuration: number,
  ): number | null {
    // If refresh is pending, refresh immediately
    if (shouldRefreshImmediately) {
      return Date.now() + 1000; // 1 second from now
    }

    let refreshMs = deviceRefreshRate * 1000;

    // For screens with clock widgets, synchronize to minute boundaries
    // Wake up AFTER the minute changes so the clock shows the correct new time
    if (currentScreen?.screenDesign && this.hasClockWidget(currentScreen.screenDesign)) {
      const now = new Date();
      // Calculate milliseconds until the next minute starts
      const secondsUntilNextMinute = 60 - now.getSeconds();
      const msUntilNextMinute = (secondsUntilNextMinute * 1000) - now.getMilliseconds();

      // Add a 3 second buffer to ensure we're past the minute boundary
      // This ensures the clock renders the new minute, not the old one
      const bufferMs = 3000;
      refreshMs = msUntilNextMinute + bufferMs;

      this.logger.debug(
        `Clock widget detected - calculated refresh in ${Math.round(refreshMs / 1000)}s (after minute boundary)`,
      );
    }

    // Cap at total playlist duration to ensure device sees all screens
    const totalPlaylistDurationMs = totalPlaylistDuration * 1000;
    if (totalPlaylistDurationMs > 0 && totalPlaylistDurationMs < refreshMs) {
      refreshMs = totalPlaylistDurationMs;
    }

    return Date.now() + refreshMs;
  }

  /**
   * Get the current screen image for a device (preview mode for admin UI)
   * Returns the rendered PNG buffer of what the device should currently be displaying
   */
  async getCurrentScreenImage(deviceId: number): Promise<Buffer> {
    // Find device with playlist and screens
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
      include: {
        playlist: {
          include: {
            items: {
              include: {
                screen: true,
                screenDesign: {
                  include: {
                    widgets: {
                      include: {
                        template: true,
                      },
                    },
                  },
                },
                pluginInstance: {
                  include: {
                    plugin: true,
                  },
                },
              },
              orderBy: {
                order: 'asc',
              },
            },
          },
        },
      },
    });

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    // If no playlist or no items, return default screen
    if (!device.playlist || !device.playlist.items || device.playlist.items.length === 0) {
      return this.defaultScreenService.getDefaultScreenPreviewBuffer();
    }

    // Get current screen from playlist rotation
    const currentScreenResult = this.getCurrentScreen(device.playlist.items);

    if (!currentScreenResult) {
      return this.defaultScreenService.getDefaultScreenPreviewBuffer();
    }

    const { item: currentScreen } = currentScreenResult;

    // Handle screen design (rendered screens)
    if (currentScreen.screenDesign) {
      const deviceContext = {
        battery: device.battery ?? undefined,
        wifi: device.wifi ?? undefined,
        deviceName: device.name || undefined,
        firmwareVersion: device.firmwareVersion || undefined,
        macAddress: device.macAddress || undefined,
      };

      // Render in preview mode (no e-ink processing)
      return this.screenRendererService.renderScreenDesign(
        currentScreen.screenDesign.id,
        deviceContext,
        true, // preview mode
      );
    }

    // Handle regular uploaded screens
    if (currentScreen.screen?.imageUrl) {
      // For regular screens, we'd need to read the file
      // For now, return default screen as fallback
      return this.defaultScreenService.getDefaultScreenPreviewBuffer();
    }

    return this.defaultScreenService.getDefaultScreenPreviewBuffer();
  }
}
