import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateLogDto } from './dto/create-log.dto';

@Injectable()
export class LogService {
  private readonly logger = new Logger(LogService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Create device log entry
   * Called by device to send log data
   * Supports both single log format and batch format
   */
  async createLog(identifier: string, createLogDto: CreateLogDto) {
    // Find device by MAC address or API key (firmware sends MAC via ID header)
    const device = await this.prisma.device.findFirst({
      where: {
        OR: [
          { macAddress: identifier },
          { apiKey: identifier },
        ],
      },
    });

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    // Handle batch format from TRMNL firmware
    if (createLogDto.logs && Array.isArray(createLogDto.logs)) {
      const entries = createLogDto.logs.slice(0, 100); // Cap at 100 entries to prevent DoS
      const createdLogs = await Promise.all(
        entries.map((logEntry) =>
          this.prisma.deviceLog.create({
            data: {
              deviceId: device.id,
              level: String(logEntry.level ?? 'info'),
              message: logEntry.message || '',
              metadata: logEntry.metadata || {},
            },
          }),
        ),
      );

      this.logger.debug(
        `Created ${createdLogs.length} batch logs for device ${device.name}`,
      );

      return {
        status: 'ok',
        message: `${createdLogs.length} logs created successfully`,
        count: createdLogs.length,
      };
    }

    // Handle single log format
    const log = await this.prisma.deviceLog.create({
      data: {
        deviceId: device.id,
        level: createLogDto.level || 'info',
        message: createLogDto.message || '',
        metadata: createLogDto.metadata || {},
      },
    });

    this.logger.debug(
      `Log created for device ${device.name}: [${log.level}] ${log.message}`,
    );

    // Update device metadata if provided
    if (createLogDto.metadata) {
      const updates: any = {};

      if (createLogDto.metadata.battery !== undefined) {
        updates.battery = createLogDto.metadata.battery;
      }

      if (createLogDto.metadata.wifi !== undefined) {
        updates.wifi = createLogDto.metadata.wifi;
      }

      if (Object.keys(updates).length > 0) {
        await this.prisma.device.update({
          where: { id: device.id },
          data: {
            ...updates,
            lastSeenAt: new Date(),
          },
        });
      }
    }

    return {
      status: 'ok',
      message: 'Log created successfully',
    };
  }
}
