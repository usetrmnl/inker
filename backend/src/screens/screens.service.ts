import {
  Injectable,
  NotFoundException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateScreenDto } from './dto/create-screen.dto';
import { UpdateScreenDto } from './dto/update-screen.dto';
import { wrapListResponse } from '../common/utils/response.util';
import { ImageProcessorService } from './services/image-processor.service';
import { ScreenRendererService } from '../screen-designer/services/screen-renderer.service';
import { EventsService } from '../events/events.service';
import * as path from 'path';
import * as fs from 'fs/promises';
import { generateToken } from '../common/utils/crypto.util';

@Injectable()
export class ScreensService {
  private readonly logger = new Logger(ScreensService.name);
  private readonly uploadsDir = path.join(process.cwd(), 'uploads', 'screens');

  constructor(
    private prisma: PrismaService,
    private screenRenderer: ScreenRendererService,
    private imageProcessor: ImageProcessorService,
    private eventsService: EventsService,
  ) {
    // Ensure uploads directory exists
    this.ensureUploadsDir();
  }

  private async ensureUploadsDir() {
    try {
      await fs.mkdir(this.uploadsDir, { recursive: true });
    } catch (error) {
      this.logger.error('Failed to create uploads directory:', error);
    }
  }

  /**
   * Create a new screen
   */
  async create(createScreenDto: CreateScreenDto) {
    const screen = await this.prisma.screen.create({
      data: {
        name: createScreenDto.name,
        description: createScreenDto.description,
        imageUrl: createScreenDto.imageUrl,
        thumbnailUrl: createScreenDto.thumbnailUrl,
        modelId: createScreenDto.modelId,
        isPublic: createScreenDto.isPublic || false,
      },
      include: {
        model: true,
      },
    });

    this.logger.log(`Screen created: ${screen.name}`);

    return screen;
  }

  /**
   * Find all screens
   */
  async findAll() {
    const screens = await this.prisma.screen.findMany({
      include: {
        model: true,
        _count: {
          select: {
            playlistItems: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return wrapListResponse(screens);
  }

  /**
   * Find one screen by ID
   */
  async findOne(id: number) {
    const screen = await this.prisma.screen.findUnique({
      where: { id },
      include: {
        model: true,
        playlistItems: {
          include: {
            playlist: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!screen) {
      throw new NotFoundException('Screen not found');
    }

    return screen;
  }

  /**
   * Update screen
   */
  async update(id: number, updateScreenDto: UpdateScreenDto) {
    const screen = await this.prisma.screen.findUnique({
      where: { id },
    });

    if (!screen) {
      throw new NotFoundException('Screen not found');
    }

    const updatedScreen = await this.prisma.screen.update({
      where: { id },
      data: {
        name: updateScreenDto.name,
        description: updateScreenDto.description,
        imageUrl: updateScreenDto.imageUrl,
        thumbnailUrl: updateScreenDto.thumbnailUrl,
        modelId: updateScreenDto.modelId,
        isPublic: updateScreenDto.isPublic,
      },
      include: {
        model: true,
      },
    });

    this.logger.log(`Screen updated: ${updatedScreen.name}`);

    // Notify devices that use this screen to refresh
    await this.eventsService.notifyScreenUpdate(id);

    return updatedScreen;
  }

  /**
   * Delete screen
   * Handles cascade deletion of associated PlaylistItems (via Prisma onDelete: Cascade)
   * Also cleans up uploaded image files from the filesystem
   */
  async remove(id: number) {
    const screen = await this.prisma.screen.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            playlistItems: true,
          },
        },
        playlistItems: {
          select: {
            playlistId: true,
          },
        },
      },
    });

    if (!screen) {
      throw new NotFoundException('Screen not found');
    }

    // Collect affected playlist IDs for notification before deletion
    const affectedPlaylistIds = [
      ...new Set(screen.playlistItems.map((item) => item.playlistId)),
    ];

    // Delete screen from database (PlaylistItems cascade automatically via Prisma)
    await this.prisma.screen.delete({
      where: { id },
    });

    // Clean up image files from filesystem
    await this.cleanupScreenFiles(screen.imageUrl, screen.thumbnailUrl);

    this.logger.log(
      `Screen deleted: ${screen.name} (removed from ${screen._count.playlistItems} playlist(s))`,
    );

    // Notify devices using affected playlists to refresh
    for (const playlistId of affectedPlaylistIds) {
      await this.eventsService.notifyPlaylistUpdate(playlistId);
    }

    return {
      message: 'Screen deleted successfully',
      affectedPlaylists: affectedPlaylistIds.length,
    };
  }

  /**
   * Clean up screen image files from filesystem
   * Silently handles missing files (already deleted or never existed)
   */
  private async cleanupScreenFiles(
    imageUrl: string | null,
    thumbnailUrl: string | null,
  ): Promise<void> {
    const filesToDelete: string[] = [];

    // Convert URL paths to filesystem paths
    if (imageUrl) {
      // imageUrl format: /uploads/screens/processed_filename.png
      const imagePath = path.join(process.cwd(), imageUrl);
      filesToDelete.push(imagePath);
    }

    if (thumbnailUrl) {
      // thumbnailUrl format: /uploads/screens/thumb_filename.jpg
      const thumbPath = path.join(process.cwd(), thumbnailUrl);
      filesToDelete.push(thumbPath);
    }

    // Delete files concurrently, ignoring errors for missing files
    await Promise.allSettled(
      filesToDelete.map(async (filePath) => {
        try {
          await fs.unlink(filePath);
          this.logger.debug(`Deleted file: ${filePath}`);
        } catch (error: any) {
          // ENOENT = file not found, which is acceptable
          if (error.code !== 'ENOENT') {
            this.logger.warn(`Failed to delete file ${filePath}: ${error.message}`);
          }
        }
      }),
    );
  }

  /**
   * Get public screens (for device/public access)
   */
  async findPublicScreens() {
    const screens = await this.prisma.screen.findMany({
      where: { isPublic: true },
      include: {
        model: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return wrapListResponse(screens);
  }

  /**
   * Create screen from HTML content
   * Generates PNG screenshot using Puppeteer
   */
  async createFromHtml(
    html: string,
    name: string,
    modelId: number,
    description?: string,
  ) {
    // Get model dimensions
    const model = await this.prisma.model.findUnique({
      where: { id: modelId },
    });

    if (!model) {
      throw new BadRequestException('Model not found');
    }

    // Generate unique filename
    const filename = `screen_${Date.now()}_${generateToken(8)}.png`;
    const outputPath = path.join(this.uploadsDir, filename);

    // Generate screenshot from HTML using shared Puppeteer browser
    const screenshotBuffer = await this.screenRenderer.renderHtmlToPng(html, model.width, model.height);
    await fs.writeFile(outputPath, screenshotBuffer);

    // Process image for e-ink display with Floyd-Steinberg dithering
    const processedPath = path.join(
      this.uploadsDir,
      `processed_${filename}`,
    );
    await this.imageProcessor.processForEinkWithDithering(
      outputPath,
      processedPath,
      model.width,
      model.height,
      { dithering: model.colors === 2 },
    );

    // Create thumbnail
    const thumbnailPath = path.join(
      this.uploadsDir,
      `thumb_${filename}`,
    );
    await this.imageProcessor.createThumbnail(
      processedPath,
      thumbnailPath,
      200,
      150,
    );

    // Clean up original unprocessed file
    await fs.unlink(outputPath);

    // Create screen record
    const imageUrl = `/uploads/screens/processed_${filename}`;
    const thumbnailUrl = `/uploads/screens/thumb_${filename}`;

    const screen = await this.prisma.screen.create({
      data: {
        name,
        description,
        imageUrl,
        thumbnailUrl,
        modelId,
        isPublic: false,
      },
      include: {
        model: true,
      },
    });

    this.logger.log(`Screen created from HTML: ${screen.name}`);

    return screen;
  }

  /**
   * Create screen from image file
   * Processes and optimizes image for e-ink display
   */
  async createFromImage(
    imageBuffer: Buffer,
    originalName: string,
    name: string,
    modelId: number,
    description?: string,
  ) {
    // Get model dimensions
    const model = await this.prisma.model.findUnique({
      where: { id: modelId },
    });

    if (!model) {
      throw new BadRequestException('Model not found');
    }

    // Generate unique filename
    const ext = path.extname(originalName);
    const filename = `screen_${Date.now()}_${generateToken(8)}${ext}`;
    const tempPath = path.join(this.uploadsDir, `temp_${filename}`);

    // Save temporary file
    await fs.writeFile(tempPath, imageBuffer);

    // Process image for e-ink display with Floyd-Steinberg dithering
    // Dithering improves grayscale rendering on monochrome e-ink displays
    const processedFilename = `processed_${filename.replace(ext, '.png')}`;
    const processedPath = path.join(this.uploadsDir, processedFilename);

    await this.imageProcessor.processForEinkWithDithering(
      tempPath,
      processedPath,
      model.width,
      model.height,
      { dithering: model.colors === 2 },
    );

    // Create thumbnail
    const thumbnailFilename = `thumb_${filename.replace(ext, '.jpg')}`;
    const thumbnailPath = path.join(this.uploadsDir, thumbnailFilename);

    await this.imageProcessor.createThumbnail(
      processedPath,
      thumbnailPath,
      200,
      150,
    );

    // Clean up temporary file
    await fs.unlink(tempPath);

    // Create screen record
    const imageUrl = `/uploads/screens/${processedFilename}`;
    const thumbnailUrl = `/uploads/screens/${thumbnailFilename}`;

    const screen = await this.prisma.screen.create({
      data: {
        name,
        description,
        imageUrl,
        thumbnailUrl,
        modelId,
        isPublic: false,
      },
      include: {
        model: true,
      },
    });

    this.logger.log(`Screen created from image: ${screen.name}`);

    return screen;
  }

  /**
   * Create screen from URL
   * Takes screenshot of webpage using Puppeteer
   */
  async createFromUrl(
    url: string,
    name: string,
    modelId: number,
    description?: string,
  ) {
    // Get model dimensions
    const model = await this.prisma.model.findUnique({
      where: { id: modelId },
    });

    if (!model) {
      throw new BadRequestException('Model not found');
    }

    // Generate unique filename
    const filename = `screen_${Date.now()}_${generateToken(8)}.png`;
    const outputPath = path.join(this.uploadsDir, filename);

    // Generate screenshot from URL using shared Puppeteer browser
    const screenshotBuffer = await this.screenRenderer.renderUrlToPng(url, model.width, model.height);
    await fs.writeFile(outputPath, screenshotBuffer);

    // Process image for e-ink display with Floyd-Steinberg dithering
    const processedPath = path.join(
      this.uploadsDir,
      `processed_${filename}`,
    );
    await this.imageProcessor.processForEinkWithDithering(
      outputPath,
      processedPath,
      model.width,
      model.height,
      { dithering: model.colors === 2 },
    );

    // Create thumbnail
    const thumbnailPath = path.join(
      this.uploadsDir,
      `thumb_${filename}`,
    );
    await this.imageProcessor.createThumbnail(
      processedPath,
      thumbnailPath,
      200,
      150,
    );

    // Clean up original unprocessed file
    await fs.unlink(outputPath);

    // Create screen record
    const imageUrl = `/uploads/screens/processed_${filename}`;
    const thumbnailUrl = `/uploads/screens/thumb_${filename}`;

    const screen = await this.prisma.screen.create({
      data: {
        name,
        description,
        imageUrl,
        thumbnailUrl,
        modelId,
        isPublic: false,
      },
      include: {
        model: true,
      },
    });

    this.logger.log(`Screen created from URL: ${screen.name}`);

    return screen;
  }
}
