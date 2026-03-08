import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExtensionDto } from './dto/create-extension.dto';
import { UpdateExtensionDto } from './dto/update-extension.dto';
import { wrapListResponse } from '../common/utils/response.util';

@Injectable()
export class ExtensionsService {
  private readonly logger = new Logger(ExtensionsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Create a new extension
   */
  async create(createExtensionDto: CreateExtensionDto) {
    const extension = await this.prisma.extension.create({
      data: {
        name: createExtensionDto.name,
        description: createExtensionDto.description,
        type: createExtensionDto.type,
        config: createExtensionDto.config || {},
        isActive: createExtensionDto.isActive ?? true,
      },
    });

    this.logger.log(`Extension created: ${extension.name}`);

    return extension;
  }

  /**
   * Find all extensions
   */
  async findAll(activeOnly = false) {
    const where = activeOnly ? { isActive: true } : {};

    const extensions = await this.prisma.extension.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return wrapListResponse(extensions);
  }

  /**
   * Find one extension by ID
   */
  async findOne(id: number) {
    const extension = await this.prisma.extension.findUnique({
      where: { id },
    });

    if (!extension) {
      throw new NotFoundException('Extension not found');
    }

    return extension;
  }

  /**
   * Update extension
   */
  async update(id: number, updateExtensionDto: UpdateExtensionDto) {
    const extension = await this.prisma.extension.findUnique({
      where: { id },
    });

    if (!extension) {
      throw new NotFoundException('Extension not found');
    }

    const updatedExtension = await this.prisma.extension.update({
      where: { id },
      data: {
        name: updateExtensionDto.name,
        description: updateExtensionDto.description,
        type: updateExtensionDto.type,
        config: updateExtensionDto.config,
        isActive: updateExtensionDto.isActive,
      },
    });

    this.logger.log(`Extension updated: ${updatedExtension.name}`);

    return updatedExtension;
  }

  /**
   * Delete extension
   */
  async remove(id: number) {
    const extension = await this.prisma.extension.findUnique({
      where: { id },
    });

    if (!extension) {
      throw new NotFoundException('Extension not found');
    }

    await this.prisma.extension.delete({
      where: { id },
    });

    this.logger.log(`Extension deleted: ${extension.name}`);

    return { message: 'Extension deleted successfully' };
  }

  /**
   * Toggle extension active status
   */
  async toggleActive(id: number) {
    const extension = await this.prisma.extension.findUnique({
      where: { id },
    });

    if (!extension) {
      throw new NotFoundException('Extension not found');
    }

    const updatedExtension = await this.prisma.extension.update({
      where: { id },
      data: {
        isActive: !extension.isActive,
      },
    });

    this.logger.log(
      `Extension ${updatedExtension.name} ${updatedExtension.isActive ? 'activated' : 'deactivated'}`,
    );

    return updatedExtension;
  }
}
