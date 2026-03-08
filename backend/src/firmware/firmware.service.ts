import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFirmwareDto } from './dto/create-firmware.dto';
import { UpdateFirmwareDto } from './dto/update-firmware.dto';
import { wrapListResponse } from '../common/utils/response.util';

@Injectable()
export class FirmwareService {
  private readonly logger = new Logger(FirmwareService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Create a new firmware version
   */
  async create(createFirmwareDto: CreateFirmwareDto) {
    // Check if version already exists
    const existingFirmware = await this.prisma.firmware.findUnique({
      where: { version: createFirmwareDto.version },
    });

    if (existingFirmware) {
      throw new ConflictException('Firmware version already exists');
    }

    const firmware = await this.prisma.firmware.create({
      data: {
        version: createFirmwareDto.version,
        downloadUrl: createFirmwareDto.downloadUrl,
        releaseNotes: createFirmwareDto.releaseNotes,
        isStable: createFirmwareDto.isStable ?? false,
      },
    });

    this.logger.log(`Firmware version ${firmware.version} created`);

    return firmware;
  }

  /**
   * Find all firmware versions
   */
  async findAll(stableOnly = false) {
    const where = stableOnly ? { isStable: true } : {};

    const firmware = await this.prisma.firmware.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return wrapListResponse(firmware);
  }

  /**
   * Find latest stable firmware
   */
  async findLatestStable() {
    const firmware = await this.prisma.firmware.findFirst({
      where: { isStable: true },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!firmware) {
      throw new NotFoundException('No stable firmware version available');
    }

    return firmware;
  }

  /**
   * Find one firmware by ID
   */
  async findOne(id: number) {
    const firmware = await this.prisma.firmware.findUnique({
      where: { id },
    });

    if (!firmware) {
      throw new NotFoundException('Firmware not found');
    }

    return firmware;
  }

  /**
   * Find firmware by version
   */
  async findByVersion(version: string) {
    const firmware = await this.prisma.firmware.findUnique({
      where: { version },
    });

    if (!firmware) {
      throw new NotFoundException('Firmware version not found');
    }

    return firmware;
  }

  /**
   * Update firmware
   */
  async update(id: number, updateFirmwareDto: UpdateFirmwareDto) {
    const firmware = await this.prisma.firmware.findUnique({
      where: { id },
    });

    if (!firmware) {
      throw new NotFoundException('Firmware not found');
    }

    // Check if version is being changed to an existing version
    if (updateFirmwareDto.version && updateFirmwareDto.version !== firmware.version) {
      const existingFirmware = await this.prisma.firmware.findUnique({
        where: { version: updateFirmwareDto.version },
      });

      if (existingFirmware) {
        throw new ConflictException('Firmware version already exists');
      }
    }

    const updatedFirmware = await this.prisma.firmware.update({
      where: { id },
      data: {
        version: updateFirmwareDto.version,
        downloadUrl: updateFirmwareDto.downloadUrl,
        releaseNotes: updateFirmwareDto.releaseNotes,
        isStable: updateFirmwareDto.isStable,
      },
    });

    this.logger.log(`Firmware version ${updatedFirmware.version} updated`);

    return updatedFirmware;
  }

  /**
   * Delete firmware
   */
  async remove(id: number) {
    const firmware = await this.prisma.firmware.findUnique({
      where: { id },
    });

    if (!firmware) {
      throw new NotFoundException('Firmware not found');
    }

    await this.prisma.firmware.delete({
      where: { id },
    });

    this.logger.log(`Firmware version ${firmware.version} deleted`);

    return { message: 'Firmware deleted successfully' };
  }

  /**
   * Mark firmware as stable
   */
  async markAsStable(id: number) {
    const firmware = await this.prisma.firmware.findUnique({
      where: { id },
    });

    if (!firmware) {
      throw new NotFoundException('Firmware not found');
    }

    const updatedFirmware = await this.prisma.firmware.update({
      where: { id },
      data: { isStable: true },
    });

    this.logger.log(`Firmware version ${updatedFirmware.version} marked as stable`);

    return updatedFirmware;
  }
}
