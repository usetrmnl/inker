import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateModelDto } from './dto/create-model.dto';
import { UpdateModelDto } from './dto/update-model.dto';
import { wrapListResponse } from '../common/utils/response.util';

@Injectable()
export class ModelsService {
  private readonly logger = new Logger(ModelsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Create a new device model
   */
  async create(createModelDto: CreateModelDto) {
    // Check if model with same name exists
    const existing = await this.prisma.model.findUnique({
      where: { name: createModelDto.name },
    });

    if (existing) {
      throw new BadRequestException('Model with this name already exists');
    }

    const model = await this.prisma.model.create({
      data: {
        name: createModelDto.name,
        label: createModelDto.label,
        width: createModelDto.width,
        height: createModelDto.height,
        description: createModelDto.description,
        mimeType: createModelDto.mimeType || 'image/png',
        colors: createModelDto.colors || 2,
        bitDepth: createModelDto.bitDepth || 1,
        rotation: createModelDto.rotation || 0,
        offsetX: createModelDto.offsetX || 0,
        offsetY: createModelDto.offsetY || 0,
        kind: createModelDto.kind || 'terminus',
        scaleFactor: createModelDto.scaleFactor || 1.0,
      },
    });

    this.logger.log(`Model created: ${model.name}`);
    return model;
  }

  /**
   * Find all models
   */
  async findAll() {
    const models = await this.prisma.model.findMany({
      include: {
        _count: {
          select: {
            devices: true,
            screens: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return wrapListResponse(models);
  }

  /**
   * Find one model by ID
   */
  async findOne(id: number) {
    const model = await this.prisma.model.findUnique({
      where: { id },
      include: {
        devices: {
          select: {
            id: true,
            name: true,
            macAddress: true,
            isActive: true,
          },
        },
        screens: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
          },
          take: 10,
        },
        _count: {
          select: {
            devices: true,
            screens: true,
          },
        },
      },
    });

    if (!model) {
      throw new NotFoundException('Model not found');
    }

    return model;
  }

  /**
   * Find model by name
   */
  async findByName(name: string) {
    return this.prisma.model.findUnique({
      where: { name },
    });
  }

  /**
   * Update model
   */
  async update(id: number, updateModelDto: UpdateModelDto) {
    const model = await this.prisma.model.findUnique({
      where: { id },
    });

    if (!model) {
      throw new NotFoundException('Model not found');
    }

    // Check name uniqueness if changing
    if (updateModelDto.name && updateModelDto.name !== model.name) {
      const existing = await this.prisma.model.findUnique({
        where: { name: updateModelDto.name },
      });

      if (existing) {
        throw new BadRequestException('Model with this name already exists');
      }
    }

    const updated = await this.prisma.model.update({
      where: { id },
      data: {
        name: updateModelDto.name,
        label: updateModelDto.label,
        width: updateModelDto.width,
        height: updateModelDto.height,
        description: updateModelDto.description,
        mimeType: updateModelDto.mimeType,
        colors: updateModelDto.colors,
        bitDepth: updateModelDto.bitDepth,
        rotation: updateModelDto.rotation,
        offsetX: updateModelDto.offsetX,
        offsetY: updateModelDto.offsetY,
        kind: updateModelDto.kind,
        scaleFactor: updateModelDto.scaleFactor,
      },
    });

    this.logger.log(`Model updated: ${updated.name}`);
    return updated;
  }

  /**
   * Delete model
   */
  async remove(id: number) {
    const model = await this.prisma.model.findUnique({
      where: { id },
      include: {
        _count: {
          select: { devices: true },
        },
      },
    });

    if (!model) {
      throw new NotFoundException('Model not found');
    }

    // Prevent deletion if devices are using this model
    if (model._count.devices > 0) {
      throw new BadRequestException(
        `Cannot delete model: ${model._count.devices} device(s) are using it`,
      );
    }

    await this.prisma.model.delete({
      where: { id },
    });

    this.logger.log(`Model deleted: ${model.name}`);
    return { message: 'Model deleted successfully' };
  }
}
