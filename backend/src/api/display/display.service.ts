import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { paletteForModel } from '../../common/utils/spectra6.util';
import { DefaultScreenService } from './default-screen.service';
import { SleepScreenService } from './sleep-screen.service';
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

  /** Refresh rate (seconds) for an untimed touch-playlist screen — long enough to "stay until a tap". */
  private static readonly STAY_REFRESH = 86400; // 24h

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private defaultScreenService: DefaultScreenService,
    private sleepScreenService: SleepScreenService,
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
    deviceHints?: { model?: string; width?: number; height?: number; reportedRefreshRate?: number },
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
            deviceHints?.model,
            deviceHints?.width,
            deviceHints?.height,
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

    // Inker never pushes OTA firmware updates to devices — there is no firmware
    // hosting/distribution here. "Update available" is surfaced as info only on the
    // admin device-detail page (see DevicesService.findOne). So the device response
    // always reports no firmware update, keeping the device working normally.
    const firmwareUrl = '';

    // Render descriptor derived from the device's model:
    //  - bitDepth 1  → 1-bit output (dithered). PNG for firmware 1.7.8, BMP for OG/DIY (issue #31).
    //  - bitDepth 4  → 16-level grayscale (TRMNL X, 1872x1404), emitted as a compressed PNG.
    // Images are always sized to the device's native resolution so they fill the panel.
    // Container is driven purely by the model's mimeType; bitDepth governs grayscale vs 1-bit.
    //  - colors 6 (PNG) → Spectra 6 colour e-ink: plugin/designed-screen renders get palette=spectra6
    //    and come back as a 6-colour indexed PNG. Default/sleep screens keep the 1-bit path.
    const bitDepth = device.model?.bitDepth ?? 1;
    const isBmp = device.model?.mimeType === 'image/bmp';
    const imageFormat: 'png' | 'bmp' = isBmp ? 'bmp' : 'png';
    const palette = paletteForModel(device.model);
    const devW = device.width || 800;
    const devH = device.height || 480;
    // Swap a filename's extension to match the served format (drives the device's
    // filename-based image cache; keep the timestamp so a new format forces a refetch).
    const withFormatExt = (name: string) => name.replace(/\.(png|bmp)$/i, `.${imageFormat}`);

    // Quiet hours: if the device is within its configured sleep window, return
    // a refresh_rate equal to the seconds until the wake time, so the device
    // sleeps the whole night in a single deep-sleep cycle instead of polling.
    const sleepSeconds = this.getQuietHoursSeconds(device);

    // Sleep-screen mode: show a dedicated sleep screen until the wake time.
    // (Freeze mode keeps the current screen and is handled via the refresh-rate
    // overrides below, so we only short-circuit here when a sleep screen is wanted.)
    if (sleepSeconds !== null && device.showSleepScreen) {
      const wakeTime = device.sleepStopAt as string;
      const { url, filename } = await this.sleepScreenService.getSleepScreen(
        device.width,
        device.height,
        wakeTime,
        imageFormat,
        bitDepth,
      );
      const imageData = useBase64
        ? await this.sleepScreenService.getSleepScreenBase64(device.width, device.height, wakeTime, imageFormat, bitDepth)
        : undefined;

      this.logger.log(
        `Device ${device.name} in quiet hours - serving sleep screen, next poll in ${sleepSeconds}s`,
      );

      return {
        status: 0,
        image_url: `${apiUrl}${url}`,
        filename,
        image_url_timeout: 0,
        image_data: imageData,
        firmware_url: '',
        update_firmware: false,
        refresh_rate: sleepSeconds,
        reset_firmware: false,
        special_function: '',
        temperature_profile: 'default',
        maximum_compatibility: true,
        battery: updatedDevice.battery,
        wifi: updatedDevice.wifi,
      };
    }

    // Default refresh rate (used for default screens or when no playlist).
    // In quiet hours (freeze mode) this is overridden with the sleep duration.
    const defaultRefreshRate = sleepSeconds ?? device.refreshRate;

    // If no playlist or no screens in playlist, return the default welcome screen
    if (!device.playlist || !device.playlist.items || device.playlist.items.length === 0) {
      this.logger.log(`Device ${device.name} has no playlist - serving default screen`);

      // Always render the default screen at the device's native resolution + depth so it fills
      // the panel (a fixed 800x480 image lands in a corner of a larger panel — TRMNL X).
      await this.defaultScreenService.ensureDefaultScreenForSize(devW, devH, imageFormat, bitDepth);
      const defaultScreenUrl = this.defaultScreenService.getDefaultScreenUrlForSize(devW, devH, imageFormat);
      const fullDefaultUrl = `${apiUrl}${defaultScreenUrl}?t=${Date.now()}`;

      // Get base64 if requested
      let imageData: string | undefined;
      if (useBase64) {
        try {
          imageData = await this.defaultScreenService.getDefaultScreenBase64ForSize(devW, devH, imageFormat, bitDepth);
        } catch (error) {
          this.logger.warn('Failed to get default screen base64:', error);
        }
      }

      return {
        status: 0,
        image_url: fullDefaultUrl,
        filename: `default-screen-${Date.now()}.${imageFormat}`,
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

    // TRMNL X touch mode: when the playlist opts in and the device is a touch panel, advance one
    // screen on every device poll (a middle tap and the on-schedule timer both poll here; left/right
    // are firmware-local and never reach us). Per-screen duration drives refresh_rate; a screen with
    // no duration stays until a tap. Otherwise use the normal duration-based rotation.
    const touchMode =
      device.model?.name === 'trmnl_x' &&
      (device.playlist as { advanceOnTap?: boolean }).advanceOnTap === true;

    const currentScreenResult = touchMode
      ? this.getTouchScreen(
          device.playlist.items,
          device.lastScreenId,
          device.screenStartedAt,
          deviceHints?.reportedRefreshRate,
        )
      : this.getCurrentScreen(
          device.playlist.items,
          device.lastScreenId,
          device.screenStartedAt,
        );

    if (!currentScreenResult) {
      this.logger.log(`Device ${device.name} playlist has no valid screens - serving default screen`);

      // Always render the default screen at the device's native resolution + depth so it fills
      // the panel (a fixed 800x480 image lands in a corner of a larger panel — TRMNL X).
      await this.defaultScreenService.ensureDefaultScreenForSize(devW, devH, imageFormat, bitDepth);
      const defaultScreenUrl = this.defaultScreenService.getDefaultScreenUrlForSize(devW, devH, imageFormat);
      const fullDefaultUrl = `${apiUrl}${defaultScreenUrl}?t=${Date.now()}`;

      // Get base64 if requested
      let imageData: string | undefined;
      if (useBase64) {
        try {
          imageData = await this.defaultScreenService.getDefaultScreenBase64ForSize(devW, devH, imageFormat, bitDepth);
        } catch (error) {
          this.logger.warn('Failed to get default screen base64:', error);
        }
      }

      return {
        status: 0,
        image_url: fullDefaultUrl,
        filename: `default-screen-${Date.now()}.${imageFormat}`,
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

    const { item: currentScreen, screenChanged, idealStartTime } = currentScreenResult;

    // Generate unique screen ID for tracking
    const currentScreenId = currentScreen.screenDesign
      ? `design-${currentScreen.screenDesign.id}`
      : currentScreen.screen
        ? `screen-${currentScreen.screen.id}`
        : currentScreen.pluginInstance?.plugin
          ? `plugin-${currentScreen.pluginInstance.id}`
          : null;

    // Update screen tracking when screen changes
    // screenStartedAt tracks when this screen began displaying (for duration-based rotation)
    // maximum_compatibility = true forces full e-ink refresh to prevent ghosting artifacts
    if (touchMode && currentScreenId) {
      // In touch mode, reset screenStartedAt on EVERY poll so "elapsed since last poll" reflects the
      // real sleep duration (used to tell a tap from a long timer wake on untimed screens).
      await this.prisma.device.update({
        where: { id: device.id },
        data: { lastScreenId: currentScreenId, screenStartedAt: new Date() },
      });
    } else if (screenChanged && currentScreenId) {
      this.logger.debug(
        `Screen changed for device ${device.name}: ${device.lastScreenId} -> ${currentScreenId} (will trigger full refresh)`,
      );
      await this.prisma.device.update({
        where: { id: device.id },
        data: { lastScreenId: currentScreenId, screenStartedAt: idealStartTime || new Date() },
      });
    }

    // Use the playlist item's configured duration as the refresh rate
    // so the device checks back at the interval the user actually set
    const screenDuration = currentScreen.duration || 60;
    const effectiveDeviceRate = screenDuration;

    // Calculate refresh rate based on current screen content
    // Clock widgets get minute-synced refresh; otherwise uses device's configured rate.
    // Touch mode overrides with the item's duration (or STAY_REFRESH for untimed = stay until tap).
    const effectiveRefreshRate = touchMode
      ? (currentScreenResult as { refreshRate?: number }).refreshRate ?? effectiveDeviceRate
      : this.getRefreshRateForScreen(currentScreen, effectiveDeviceRate);

    // Calculate the next refresh timestamp for minute-synchronized clock updates
    const nextRefreshAt = this.getNextRefreshTimestamp(
      currentScreen,
      effectiveDeviceRate,
    );

    // Quiet hours (freeze mode): keep the current screen but make the device
    // sleep until the wake time instead of refreshing at the normal interval.
    const finalRefreshRate = sleepSeconds ?? effectiveRefreshRate;
    const finalRefreshAt = sleepSeconds !== null ? Date.now() + sleepSeconds * 1000 : nextRefreshAt;

    // Handle both regular screens and designed screens
    if (currentScreen.screen) {
      // Regular uploaded screen. A plain 1-bit PNG device gets the stored file directly; devices
      // needing a converted image — 1-bit BMP (issue #31) or grayscale (TRMNL X) — fetch it via the
      // screen-image endpoint, which re-processes the upload to the right format/depth/resolution.
      // No colour variant: uploads only keep their 1-bit dithered file (the original is deleted on
      // upload), so Spectra 6 panels show uploaded screens in black & white.
      const needsConversion = isBmp || bitDepth >= 4;
      const convParams = `format=${imageFormat}${bitDepth > 1 ? `&bitDepth=${bitDepth}` : ''}&t=${Date.now()}`;
      const imageUrl = needsConversion
        ? `${apiUrl}/api/device-images/screen/${currentScreen.screen.id}?${convParams}`
        : currentScreen.screen.imageUrl.startsWith('http')
          ? currentScreen.screen.imageUrl
          : `${apiUrl}${currentScreen.screen.imageUrl}`;

      this.logger.debug(
        `Serving screen "${currentScreen.screen.name}" to device ${device.name}`,
      );

      return {
        status: 0,
        image_url: imageUrl,
        filename: withFormatExt(this.getImageFilename(currentScreen.screen.imageUrl)),
        image_url_timeout: 0,
        image_data: useBase64
          ? needsConversion
            ? (await this.getUploadedScreenForDevice(currentScreen.screen.id, imageFormat, bitDepth)).toString('base64')
            : await this.getBase64Image(currentScreen.screen.imageUrl)
          : undefined,
        firmware_url: firmwareUrl,
        update_firmware: !!firmwareUrl,
        refresh_rate: finalRefreshRate,
        reset_firmware: false,
        special_function: '',
        temperature_profile: 'default',
        maximum_compatibility: screenChanged,
        refresh_at: finalRefreshAt,
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
        // Only add format for BMP devices so PNG render URLs stay unchanged (issue #31)
        ...(isBmp ? { format: 'bmp' } : {}),
        // 4-bit grayscale panels (TRMNL X) request a matching color depth
        ...(bitDepth > 1 ? { bitDepth: String(bitDepth) } : {}),
        // Colour panels (Spectra 6) request a colour render instead of 1-bit
        ...(palette ? { palette } : {}),
      });
      const renderUrl = `${apiUrl}/api/device-images/design/${currentScreen.screenDesign.id}?${queryParams.toString()}`;

      // CRITICAL: Include timestamp in filename to force device to fetch new image
      // The TRMNL device firmware caches images by filename, so if we always return
      // "design-5.png", the device thinks it already has this image and won't fetch
      // the new URL. By changing the filename on each request (e.g., "design-5-1702069200000.png"),
      // the device recognizes it as a new file and downloads the fresh image.
      const dynamicFilename = `design-${currentScreen.screenDesign.id}-${timestamp}.${imageFormat}`;

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
        refresh_rate: finalRefreshRate,
        reset_firmware: false,
        special_function: '',
        temperature_profile: 'default',
        maximum_compatibility: screenChanged,
        refresh_at: finalRefreshAt,
        battery: updatedDevice.battery,
        wifi: updatedDevice.wifi,
      };
    } else if (currentScreen.pluginInstance?.plugin) {
      // Plugin instance - render via plugin engine
      // Use Date.now() so filename changes on every poll, forcing device to fetch fresh render
      const pluginInstance = currentScreen.pluginInstance;
      const timestamp = Date.now();

      const paletteParam = palette ? `&palette=${palette}` : '';
      const renderUrl = `${apiUrl}/api/plugins/instances/${pluginInstance.id}/render?mode=device${paletteParam}&t=${timestamp}`;
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
        refresh_rate: finalRefreshRate,
        reset_firmware: false,
        special_function: '',
        temperature_profile: 'default',
        maximum_compatibility: screenChanged,
        refresh_at: finalRefreshAt,
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
        filename: `default-screen-${Date.now()}.${imageFormat}`,
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
   * Get current screen from playlist items using per-device rotation
   *
   * Each device tracks which screen it's showing and when it started.
   * When the screen's duration expires, it advances to the next screen.
   * This ensures each screen shows for exactly its configured duration.
   */
  private getCurrentScreen(
    items: any[],
    lastScreenId: string | null,
    screenStartedAt: Date | null,
  ): { item: any; screenChanged: boolean; idealStartTime?: Date } | null {
    if (!items || items.length === 0) {
      return null;
    }

    // SINGLE SCREEN: No rotation needed
    if (items.length === 1) {
      return { item: items[0], screenChanged: false };
    }

    // Find the screen ID for a playlist item
    const getItemScreenId = (item: any): string | null =>
      item.screenDesign ? `design-${item.screenDesign.id}`
        : item.screen ? `screen-${item.screen.id}`
        : item.pluginInstance?.plugin ? `plugin-${item.pluginInstance.id}`
        : null;

    // Find the current item by lastScreenId
    let currentIndex = -1;
    if (lastScreenId) {
      currentIndex = items.findIndex(item => getItemScreenId(item) === lastScreenId);
    }

    // If no previous screen or it's no longer in the playlist, start at first item
    if (currentIndex === -1) {
      return { item: items[0], screenChanged: true };
    }

    // Check if the current screen's duration has expired
    const currentItem = items[currentIndex];
    const duration = currentItem.duration || 60;

    // If screenStartedAt is null (e.g. existing device before migration),
    // treat as screen change so the timestamp gets initialized
    if (!screenStartedAt) {
      return { item: currentItem, screenChanged: true };
    }

    const elapsedSeconds = (Date.now() - screenStartedAt.getTime()) / 1000;
    if (elapsedSeconds >= duration) {
      // Duration expired — advance to next screen
      // Use ideal start time (previous start + duration) to prevent drift accumulation
      const nextIndex = (currentIndex + 1) % items.length;
      const idealStartTime = new Date(screenStartedAt.getTime() + duration * 1000);
      return { item: items[nextIndex], screenChanged: true, idealStartTime };
    }

    // Duration not expired — keep showing current screen
    return { item: currentItem, screenChanged: false };
  }

  /**
   * TRMNL X "advance on tap" rotation. Each device poll (middle tap OR the on-schedule timer wake)
   * moves one screen forward; per-screen `duration` becomes the refresh_rate. A screen with no
   * duration uses STAY_REFRESH so the device only wakes on a tap, and it only advances when the poll
   * comes back earlier than that long sleep (i.e. a manual tap), never on the rare long timer wake.
   *
   * screenStartedAt is reset on every poll by the caller, so `elapsed` here equals the real time the
   * device just slept — which is how a tap (short) is told apart from a timer wake (~refresh_rate),
   * robust to firmware that caps the refresh rate (we compare against the device-reported value).
   */
  private getTouchScreen(
    items: any[],
    lastScreenId: string | null,
    screenStartedAt: Date | null,
    reportedRefreshRate?: number,
  ): { item: any; screenChanged: boolean; idealStartTime?: Date; refreshRate: number } | null {
    if (!items || items.length === 0) {
      return null;
    }

    const getItemScreenId = (item: any): string | null =>
      item.screenDesign ? `design-${item.screenDesign.id}`
        : item.screen ? `screen-${item.screen.id}`
        : item.pluginInstance?.plugin ? `plugin-${item.pluginInstance.id}`
        : null;
    const isTimed = (item: any) => item.duration != null && item.duration > 0;
    const refreshFor = (item: any) => (isTimed(item) ? item.duration : DisplayService.STAY_REFRESH);

    const currentIndex = lastScreenId
      ? items.findIndex((it) => getItemScreenId(it) === lastScreenId)
      : -1;

    // First poll (or the tracked screen was removed): show the first item, don't advance past it.
    if (currentIndex === -1) {
      return { item: items[0], screenChanged: true, idealStartTime: new Date(), refreshRate: refreshFor(items[0]) };
    }

    const current = items[currentIndex];
    let advance: boolean;
    if (isTimed(current)) {
      advance = true; // timed: a timer wake (duration elapsed) and an early tap both advance
    } else {
      // untimed: advance only if the device came back before its long sleep finished (= a tap)
      const expected = reportedRefreshRate && reportedRefreshRate > 0 ? reportedRefreshRate : DisplayService.STAY_REFRESH;
      const elapsed = screenStartedAt ? (Date.now() - screenStartedAt.getTime()) / 1000 : expected;
      const margin = Math.max(30, expected * 0.2);
      advance = elapsed < expected - margin;
    }

    if (!advance) {
      return { item: current, screenChanged: false, refreshRate: refreshFor(current) };
    }

    const next = items[(currentIndex + 1) % items.length];
    return {
      item: next,
      screenChanged: getItemScreenId(next) !== lastScreenId,
      idealStartTime: new Date(),
      refreshRate: refreshFor(next),
    };
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
   * Extract filename from image URL
   */
  private getImageFilename(imageUrl: string): string {
    const parts = imageUrl.split('/');
    return parts[parts.length - 1];
  }

  /**
   * Load an uploaded screen's stored image and convert it to a 1-bit BMP for
   * TRMNL OG / DIY-kit firmware that rejects PNG (issue #31). Runs the same
   * e-ink dithering pipeline as designed screens. Served by the
   * GET /api/device-images/screen/:id endpoint and used for inline base64.
   */
  async getUploadedScreenForDevice(
    screenId: number,
    format: 'png' | 'bmp' = 'bmp',
    bitDepth: number = 1,
  ): Promise<Buffer> {
    const screen = await this.prisma.screen.findUnique({
      where: { id: screenId },
      include: { model: true },
    });
    if (!screen) {
      throw new NotFoundException('Screen not found');
    }

    const imagePath = path.join(process.cwd(), screen.imageUrl);
    const input = await fs.readFile(imagePath);
    const width = screen.model?.width || 800;
    const height = screen.model?.height || 480;

    return this.screenRendererService.applyEinkProcessing(input, width, height, false, format, bitDepth);
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
   * Determine whether the device is currently within its configured quiet-hours
   * (sleep) window and, if so, how many seconds remain until the wake time.
   *
   * Times are stored as "HH:MM" strings and evaluated against the server's
   * configured DEFAULT_TIMEZONE (the same timezone used by clock/date widgets).
   * Handles windows that cross midnight (e.g. 22:00–07:00).
   *
   * @returns seconds until the wake time when sleeping, otherwise null
   */
  private getQuietHoursSeconds(device: {
    sleepStartAt: string | null;
    sleepStopAt: string | null;
  }): number | null {
    const startSec = device.sleepStartAt ? this.parseTimeToSeconds(device.sleepStartAt) : null;
    const stopSec = device.sleepStopAt ? this.parseTimeToSeconds(device.sleepStopAt) : null;
    if (startSec === null || stopSec === null || startSec === stopSec) {
      return null;
    }

    const nowSec = this.getSecondsSinceMidnight();

    // Is "now" inside the window? Handle windows that wrap past midnight.
    const inWindow =
      startSec < stopSec
        ? nowSec >= startSec && nowSec < stopSec
        : nowSec >= startSec || nowSec < stopSec;

    if (!inWindow) {
      return null;
    }

    // Seconds until the next occurrence of the stop time, plus a small buffer so
    // the device wakes just after the window ends. Capped at 24h for safety.
    const SECONDS_PER_DAY = 86400;
    const untilWake =
      (((stopSec - nowSec) % SECONDS_PER_DAY) + SECONDS_PER_DAY) % SECONDS_PER_DAY || SECONDS_PER_DAY;
    return Math.min(untilWake + 60, SECONDS_PER_DAY);
  }

  /**
   * Parse an "HH:MM" string into seconds since midnight, or null if invalid.
   */
  private parseTimeToSeconds(value: string): number | null {
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
    if (!match) {
      return null;
    }
    return parseInt(match[1], 10) * 3600 + parseInt(match[2], 10) * 60;
  }

  /**
   * Current seconds since midnight in the configured DEFAULT_TIMEZONE.
   */
  private getSecondsSinceMidnight(): number {
    const timeZone = this.config.get<string>('defaultTimezone', 'UTC');
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(new Date());

    const get = (type: string) =>
      parseInt(parts.find((p) => p.type === type)?.value || '0', 10);
    // Intl can emit "24" for the midnight hour in some environments; normalize to 0.
    const hour = get('hour') % 24;
    return hour * 3600 + get('minute') * 60 + get('second');
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
   */
  private getRefreshRateForScreen(
    currentScreen: any,
    deviceRefreshRate: number,
  ): number {
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
   */
  getNextRefreshTimestamp(
    currentScreen: any,
    deviceRefreshRate: number,
  ): number | null {
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
      throw new NotFoundException('Device not found');
    }

    // Reflect quiet hours in the preview: when the device is within its sleep
    // window with a dedicated sleep screen, show that (it's what the device
    // displays). Freeze mode keeps the current screen, which the path below
    // already returns, so it needs no special handling here.
    if (device.showSleepScreen && this.getQuietHoursSeconds(device) !== null) {
      return this.sleepScreenService.getSleepScreenBuffer(
        device.width,
        device.height,
        device.sleepStopAt as string,
      );
    }

    // If no playlist or no items, return default screen
    if (!device.playlist || !device.playlist.items || device.playlist.items.length === 0) {
      return this.defaultScreenService.getDefaultScreenPreviewBuffer();
    }

    // Get current screen from playlist rotation (preview uses device state too)
    const currentScreenResult = this.getCurrentScreen(
      device.playlist.items,
      device.lastScreenId,
      device.screenStartedAt,
    );

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

    // Plugin instances: render as the e-ink preview, in colour for Spectra 6 devices
    if (currentScreen.pluginInstance?.plugin) {
      return this.pluginsService.renderInstance(
        currentScreen.pluginInstance.id,
        'full',
        'einkPreview',
        paletteForModel(device.model),
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
