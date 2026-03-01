import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { generateToken } from '../common/utils/crypto.util';
import { wrapPaginatedResponse } from '../common/utils/response.util';
import { serializeDevice, serializeDevices } from './entities/device.entity';

@Injectable()
export class DevicesService {
  private readonly logger = new Logger(DevicesService.name);

  constructor(
    private prisma: PrismaService,
    private eventsService: EventsService,
  ) {}

  /**
   * Create a new device with auto-generated API key
   * If MAC was previously blocked (deleted device), unblock it first
   */
  async create(createDeviceDto: CreateDeviceDto) {
    // Check if MAC address already exists
    const existingDevice = await this.prisma.device.findUnique({
      where: { macAddress: createDeviceDto.macAddress },
    });

    if (existingDevice) {
      throw new BadRequestException('Device with this MAC address already exists');
    }

    // Remove from blocked list if exists (allows re-adding deleted devices)
    await this.prisma.blockedDevice.deleteMany({
      where: { macAddress: createDeviceDto.macAddress },
    });

    // Generate unique API key
    const apiKey = this.generateApiKey();

    // Create device
    const device = await this.prisma.device.create({
      data: {
        name: createDeviceDto.name,
        macAddress: createDeviceDto.macAddress,
        apiKey,
        modelId: createDeviceDto.modelId,
        playlistId: createDeviceDto.playlistId,
      },
      include: {
        model: true,
        playlist: {
          include: {
            items: {
              include: {
                screen: true,
              },
              orderBy: {
                order: 'asc',
              },
            },
          },
        },
      },
    });

    this.logger.log(`Device created: ${device.name} (${device.macAddress})`);

    return serializeDevice(device);
  }

  /**
   * Find all devices with pagination
   */
  async findAll(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [devices, total] = await Promise.all([
      this.prisma.device.findMany({
        include: {
          model: true,
          playlist: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.device.count(),
    ]);

    return wrapPaginatedResponse(serializeDevices(devices), total, page, limit);
  }

  /**
   * Find one device by ID
   */
  async findOne(id: number) {
    const device = await this.prisma.device.findUnique({
      where: { id },
      include: {
        model: true,
        playlist: {
          include: {
            items: {
              include: {
                screen: true,
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

    return serializeDevice(device);
  }

  /**
   * Update device
   */
  async update(id: number, updateDeviceDto: UpdateDeviceDto) {
    const device = await this.prisma.device.findUnique({
      where: { id },
    });

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    // Check if MAC address is being changed to an existing one
    if (updateDeviceDto.macAddress && updateDeviceDto.macAddress !== device.macAddress) {
      const existingDevice = await this.prisma.device.findUnique({
        where: { macAddress: updateDeviceDto.macAddress },
      });

      if (existingDevice) {
        throw new BadRequestException('Device with this MAC address already exists');
      }
    }

    // Check if playlist is being changed - trigger device refresh
    const playlistChanging = updateDeviceDto.playlistId !== undefined &&
      updateDeviceDto.playlistId !== device.playlistId;

    const updatedDevice = await this.prisma.device.update({
      where: { id },
      data: {
        name: updateDeviceDto.name,
        macAddress: updateDeviceDto.macAddress,
        firmwareVersion: updateDeviceDto.firmwareVersion,
        modelId: updateDeviceDto.modelId,
        playlistId: updateDeviceDto.playlistId,
        isActive: updateDeviceDto.isActive,
        // Set refreshPending if playlist changed to trigger immediate device refresh
        ...(playlistChanging && { refreshPending: true }),
      },
      include: {
        model: true,
        playlist: {
          include: {
            items: {
              include: {
                screen: true,
              },
              orderBy: {
                order: 'asc',
              },
            },
          },
        },
      },
    });

    this.logger.log(`Device updated: ${updatedDevice.name}`);

    // Notify device to refresh if playlist changed (including unassigned)
    if (playlistChanging) {
      await this.eventsService.notifyDevicesRefresh([id]);
      this.logger.log(`Device ${id} playlist changed - refresh notification sent`);
    }

    return serializeDevice(updatedDevice);
  }

  /**
   * Delete device
   * Adds MAC address to blocked_devices to prevent auto-re-provisioning
   */
  async remove(id: number) {
    const device = await this.prisma.device.findUnique({
      where: { id },
    });

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    // Add MAC to blocked devices to prevent auto-re-provisioning
    // Device will receive reset_firmware: true on next /api/setup call
    await this.prisma.blockedDevice.upsert({
      where: { macAddress: device.macAddress },
      create: { macAddress: device.macAddress, reason: 'Deleted by admin' },
      update: { createdAt: new Date() },
    });

    await this.prisma.device.delete({
      where: { id },
    });

    this.logger.log(`Device deleted and blocked: ${device.name} (${device.macAddress})`);

    return { message: 'Device deleted successfully' };
  }

  /**
   * Device polling endpoint - returns current screen to display
   * This is called by the device using its API key
   */
  async getDisplayContent(apiKey: string) {
    const device = await this.prisma.device.findUnique({
      where: { apiKey },
      include: {
        model: true,
        playlist: {
          include: {
            items: {
              include: {
                screen: true,
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

    if (!device.isActive) {
      throw new ForbiddenException('Device is inactive');
    }

    // Update last seen timestamp
    await this.prisma.device.update({
      where: { id: device.id },
      data: { lastSeenAt: new Date() },
    });

    // If no playlist assigned, return default "Hello World" welcome screen
    if (!device.playlist || !device.playlist.items.length) {
      return {
        deviceId: device.id,
        deviceName: device.name,
        message: 'No playlist assigned - showing default welcome screen',
        screen: null,
        defaultContent: {
          type: 'welcome',
          title: 'Hello World',
          subtitle: 'This is inker!',
          message: 'Assign a playlist to this device to display your content',
        },
        refreshRate: device.refreshRate || 900,
      };
    }

    // Get current screen from playlist (simple rotation for now)
    // In production, you might want more sophisticated scheduling
    const currentIndex = Math.floor(Date.now() / 60000) % device.playlist.items.length;
    const currentItem = device.playlist.items[currentIndex];

    if (!currentItem.screen) {
      throw new NotFoundException('Current playlist item has no screen');
    }

    this.logger.debug(
      `Device ${device.name} polling - serving screen: ${currentItem.screen.name}`,
    );

    return {
      deviceId: device.id,
      deviceName: device.name,
      screen: {
        id: currentItem.screen.id,
        name: currentItem.screen.name,
        imageUrl: currentItem.screen.imageUrl,
        duration: currentItem.duration,
      },
      nextRefresh: currentItem.duration,
    };
  }

  /**
   * Regenerate API key for a device
   */
  async regenerateApiKey(id: number) {
    const device = await this.prisma.device.findUnique({
      where: { id },
    });

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    const newApiKey = this.generateApiKey();
    const updatedDevice = await this.prisma.device.update({
      where: { id },
      data: { apiKey: newApiKey },
    });

    this.logger.log(`API key regenerated for device: ${device.name}`);

    return {
      deviceId: updatedDevice.id,
      apiKey: updatedDevice.apiKey,
    };
  }

  /**
   * Generate a unique API key
   */
  private generateApiKey(): string {
    return generateToken(32);
  }

  /**
   * Log device event
   */
  async logDeviceEvent(
    deviceId: number,
    level: string,
    message: string,
    metadata?: any,
  ) {
    return this.prisma.deviceLog.create({
      data: {
        deviceId,
        level,
        message,
        metadata: metadata || {},
      },
    });
  }

  /**
   * Get device logs
   */
  async getDeviceLogs(deviceId: number) {
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
    });

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    return this.prisma.deviceLog.findMany({
      where: { deviceId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  /**
   * Trigger device refresh
   * Sets refreshPending flag and emits SSE event to notify connected clients
   */
  async triggerRefresh(id: number) {
    const device = await this.prisma.device.findUnique({
      where: { id },
    });

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    // Set refreshPending flag
    await this.prisma.device.update({
      where: { id },
      data: { refreshPending: true },
    });

    // Emit SSE event for connected clients
    await this.eventsService.notifyDevicesRefresh([id]);

    this.logger.log(`Refresh triggered for device: ${device.name}`);

    return { message: 'Device refresh triggered', deviceId: id };
  }

  /**
   * Unassign playlist from device
   * Device will display the default "Hello World" welcome screen
   */
  async unassignPlaylist(id: number) {
    const device = await this.prisma.device.findUnique({
      where: { id },
      include: {
        playlist: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    // Check if device has a playlist assigned
    if (!device.playlistId) {
      throw new BadRequestException('Device has no playlist assigned');
    }

    const previousPlaylist = device.playlist;

    // Unassign playlist and trigger refresh
    const updatedDevice = await this.prisma.device.update({
      where: { id },
      data: {
        playlistId: null,
        refreshPending: true, // Trigger refresh to show default screen
      },
      include: {
        model: true,
      },
    });

    // Notify device to refresh (will now show the default welcome screen)
    await this.eventsService.notifyDevicesRefresh([id]);

    this.logger.log(
      `Playlist "${previousPlaylist?.name}" unassigned from device "${device.name}" - device will show default welcome screen`,
    );

    return {
      message: 'Playlist unassigned successfully',
      device: serializeDevice(updatedDevice),
      previousPlaylist: previousPlaylist
        ? { id: previousPlaylist.id, name: previousPlaylist.name }
        : null,
      displayContent: {
        type: 'welcome',
        title: 'Hello World',
        subtitle: 'This is inker!',
        message: 'Assign a playlist to this device to display your content',
      },
    };
  }
}
