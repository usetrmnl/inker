import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Multer } from 'multer';
import * as path from 'path';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as sharpModule from 'sharp';
// Handle both ESM and CJS imports for Bun compatibility
const sharp = (sharpModule as any).default || sharpModule;

// Max file size for widget images (90KB for e-ink devices)
const MAX_WIDGET_IMAGE_SIZE = 90000;

// Ensure widgets upload directory exists
const widgetsUploadDir = './uploads/widgets';
if (!fs.existsSync(widgetsUploadDir)) {
  fs.mkdirSync(widgetsUploadDir, { recursive: true });
}

// Ensure captures upload directory exists (for pixel-perfect screen captures)
const capturesUploadDir = './uploads/captures';
if (!fs.existsSync(capturesUploadDir)) {
  fs.mkdirSync(capturesUploadDir, { recursive: true });
}

// Ensure drawings upload directory exists (for separate drawing overlays)
const drawingsUploadDir = './uploads/drawings';
if (!fs.existsSync(drawingsUploadDir)) {
  fs.mkdirSync(drawingsUploadDir, { recursive: true });
}
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ScreenDesignerService } from './screen-designer.service';
import { WidgetTemplatesService } from './services/widget-templates.service';
import { ScreenRendererService } from './services/screen-renderer.service';
import {
  CreateScreenDesignDto,
  UpdateScreenDesignDto,
  CreateWidgetDto,
  UpdateWidgetDto,
  AssignDeviceDto,
} from './dto';

@ApiTags('screen-designs')
@Controller('screen-designs')
export class ScreenDesignerController {
  private readonly logger = new Logger(ScreenDesignerController.name);

  constructor(
    private readonly screenDesignerService: ScreenDesignerService,
    private readonly widgetTemplatesService: WidgetTemplatesService,
    private readonly screenRendererService: ScreenRendererService,
  ) {}

  // ========================
  // Screen Design Endpoints
  // ========================

  @Post()
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a new screen design' })
  @ApiResponse({ status: 201, description: 'Screen design created successfully' })
  async createScreenDesign(@Body() dto: CreateScreenDesignDto) {
    return this.screenDesignerService.createScreenDesign(dto);
  }

  @Get()
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get all screen designs with pagination' })
  @ApiResponse({ status: 200, description: 'Paginated list of screen designs' })
  async getScreenDesigns(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = Math.max(parseInt(page || '1', 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit || '20', 10) || 20, 1), 100);
    return this.screenDesignerService.getAllScreenDesigns(pageNum, limitNum);
  }

  @Get(':id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get a screen design by ID' })
  @ApiParam({ name: 'id', description: 'Screen design ID' })
  @ApiResponse({ status: 200, description: 'Screen design details' })
  @ApiResponse({ status: 404, description: 'Screen design not found' })
  async getScreenDesign(@Param('id', ParseIntPipe) id: number) {
    return this.screenDesignerService.getScreenDesign(id);
  }

  @Put(':id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update a screen design' })
  @ApiParam({ name: 'id', description: 'Screen design ID' })
  @ApiResponse({ status: 200, description: 'Screen design updated successfully' })
  @ApiResponse({ status: 404, description: 'Screen design not found' })
  async updateScreenDesign(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateScreenDesignDto,
  ) {
    return this.screenDesignerService.updateScreenDesign(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete a screen design' })
  @ApiParam({ name: 'id', description: 'Screen design ID' })
  @ApiResponse({ status: 200, description: 'Screen design deleted successfully' })
  @ApiResponse({ status: 404, description: 'Screen design not found' })
  async deleteScreenDesign(@Param('id', ParseIntPipe) id: number) {
    return this.screenDesignerService.deleteScreenDesign(id);
  }

  @Post(':id/duplicate')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Duplicate a screen design' })
  @ApiParam({ name: 'id', description: 'Screen design ID to duplicate' })
  @ApiQuery({ name: 'name', required: false, description: 'Name for the duplicate' })
  @ApiResponse({ status: 201, description: 'Screen design duplicated successfully' })
  @ApiResponse({ status: 404, description: 'Screen design not found' })
  async duplicateScreenDesign(
    @Param('id', ParseIntPipe) id: number,
    @Query('name') name: string,
  ) {
    return this.screenDesignerService.duplicateScreenDesign(id, name);
  }

  // ========================
  // Widget Endpoints
  // ========================

  @Post(':id/widgets')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Add a widget to a screen design' })
  @ApiParam({ name: 'id', description: 'Screen design ID' })
  @ApiResponse({ status: 201, description: 'Widget added successfully' })
  @ApiResponse({ status: 404, description: 'Screen design or template not found' })
  async addWidget(
    @Param('id', ParseIntPipe) screenDesignId: number,
    @Body() dto: CreateWidgetDto,
  ) {
    return this.screenDesignerService.addWidget(screenDesignId, dto);
  }

  @Put(':id/widgets/:widgetId')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update a widget' })
  @ApiParam({ name: 'id', description: 'Screen design ID' })
  @ApiParam({ name: 'widgetId', description: 'Widget ID' })
  @ApiResponse({ status: 200, description: 'Widget updated successfully' })
  @ApiResponse({ status: 404, description: 'Widget not found' })
  async updateWidget(
    @Param('id', ParseIntPipe) screenDesignId: number,
    @Param('widgetId', ParseIntPipe) widgetId: number,
    @Body() dto: UpdateWidgetDto,
  ) {
    return this.screenDesignerService.updateWidget(screenDesignId, widgetId, dto);
  }

  @Delete(':id/widgets/:widgetId')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Remove a widget from a screen design' })
  @ApiParam({ name: 'id', description: 'Screen design ID' })
  @ApiParam({ name: 'widgetId', description: 'Widget ID' })
  @ApiResponse({ status: 200, description: 'Widget removed successfully' })
  @ApiResponse({ status: 404, description: 'Widget not found' })
  async removeWidget(
    @Param('id', ParseIntPipe) screenDesignId: number,
    @Param('widgetId', ParseIntPipe) widgetId: number,
  ) {
    return this.screenDesignerService.removeWidget(screenDesignId, widgetId);
  }

  // ========================
  // Device Assignment Endpoints
  // ========================

  @Post(':id/assign')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Assign a screen design to a device' })
  @ApiParam({ name: 'id', description: 'Screen design ID' })
  @ApiResponse({ status: 201, description: 'Screen design assigned to device' })
  @ApiResponse({ status: 404, description: 'Screen design or device not found' })
  async assignToDevice(
    @Param('id', ParseIntPipe) screenDesignId: number,
    @Body() dto: AssignDeviceDto,
  ) {
    return this.screenDesignerService.assignToDevice(screenDesignId, dto);
  }

  @Delete(':id/assign/:deviceId')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Unassign a screen design from a device' })
  @ApiParam({ name: 'id', description: 'Screen design ID' })
  @ApiParam({ name: 'deviceId', description: 'Device ID' })
  @ApiResponse({ status: 200, description: 'Screen design unassigned from device' })
  @ApiResponse({ status: 404, description: 'Assignment not found' })
  async unassignFromDevice(
    @Param('id', ParseIntPipe) screenDesignId: number,
    @Param('deviceId', ParseIntPipe) deviceId: number,
  ) {
    return this.screenDesignerService.unassignFromDevice(screenDesignId, deviceId);
  }

  // ========================
  // Rendering Endpoint
  // ========================

  @Get(':id/render')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Render a screen design to PNG image' })
  @ApiParam({ name: 'id', description: 'Screen design ID' })
  @ApiResponse({
    status: 200,
    description: 'PNG image of the rendered screen design',
    content: {
      'image/png': {},
    },
  })
  @ApiResponse({ status: 404, description: 'Screen design not found' })
  async renderScreenDesign(@Param('id', ParseIntPipe) id: number) {
    // Verify design exists
    await this.screenDesignerService.getScreenDesign(id);

    // Then render
    const imageBuffer = await this.screenRendererService.renderScreenDesign(id);

    return {
      contentType: 'image/png',
      data: imageBuffer.toString('base64'),
    };
  }

  @Get(':id/preview')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get a preview thumbnail of the screen design' })
  @ApiParam({ name: 'id', description: 'Screen design ID' })
  @ApiResponse({ status: 200, description: 'Preview thumbnail' })
  @ApiResponse({ status: 404, description: 'Screen design not found' })
  async getPreview(@Param('id', ParseIntPipe) id: number) {
    // Verify design exists
    await this.screenDesignerService.getScreenDesign(id);

    // Then render preview
    const imageBuffer = await this.screenRendererService.renderPreview(id);

    return {
      contentType: 'image/png',
      data: imageBuffer.toString('base64'),
    };
  }

  @Post(':id/refresh-devices')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Refresh all devices using this screen design' })
  @ApiParam({ name: 'id', description: 'Screen design ID' })
  @ApiResponse({ status: 200, description: 'Devices refresh triggered' })
  @ApiResponse({ status: 404, description: 'Screen design not found' })
  async refreshDevices(@Param('id', ParseIntPipe) id: number) {
    return this.screenDesignerService.refreshDevicesUsingDesign(id);
  }

  // ========================
  // Pixel-Perfect Capture Endpoint
  // ========================

  @Post(':id/capture')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Render and save screen capture for device (legacy)',
    description: 'Renders the screen design server-side with Puppeteer, applies e-ink processing (dithering + inversion), and saves for device display. Use upload-capture for pixel-perfect browser rendering.',
  })
  @ApiParam({ name: 'id', description: 'Screen design ID' })
  @ApiResponse({ status: 201, description: 'Capture rendered and saved' })
  @ApiResponse({ status: 404, description: 'Screen design not found' })
  async captureForDevice(@Param('id', ParseIntPipe) id: number) {
    // Verify the screen design exists
    await this.screenDesignerService.getScreenDesign(id);

    // Render the design using Puppeteer with full e-ink processing
    // 'device' mode applies: dithering + inversion for TRMNL
    const imageBuffer = await this.screenRendererService.renderScreenDesign(
      id,
      undefined, // No device context needed for capture
      'device',  // Full e-ink processing
    );

    // Save to captures directory
    const filename = `capture_${id}.png`;
    const filepath = path.join(capturesUploadDir, filename);
    await fs.promises.writeFile(filepath, imageBuffer);

    const captureUrl = `/uploads/captures/${filename}`;

    // Update the screen design with capture timestamp
    await this.screenDesignerService.updateCaptureTimestamp(id);

    return {
      captureUrl,
      filename,
      size: imageBuffer.length,
    };
  }

  @Post(':id/upload-capture')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Upload browser-captured B&W image for device',
    description: 'Receives a PNG with Floyd-Steinberg dithering already applied from browser. Only inverts colors for TRMNL e-ink device and saves.',
  })
  @ApiParam({ name: 'id', description: 'Screen design ID' })
  @ApiResponse({ status: 201, description: 'Capture saved for device' })
  @ApiResponse({ status: 400, description: 'Invalid file type or no file uploaded' })
  @ApiResponse({ status: 404, description: 'Screen design not found' })
  @UseInterceptors(
    FileInterceptor('image', {
      fileFilter: (req, file, cb) => {
        // Accept only PNG files
        if (file.mimetype === 'image/png') {
          cb(null, true);
        } else {
          cb(new BadRequestException('Only PNG files are allowed'), false);
        }
      },
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max
      },
    }),
  )
  async uploadCapture(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Multer.File,
  ) {
    // Verify the screen design exists
    await this.screenDesignerService.getScreenDesign(id);

    if (!file) {
      throw new BadRequestException('No file uploaded. Make sure to send file with field name "image"');
    }

    this.logger.log(`Saving browser capture for screen ${id}: ${file.size} bytes`);

    try {
      // Simple e-ink processing for browser captures:
      // 1. Flatten transparency to white background
      // 2. Convert to grayscale
      //
      // NOTE: NO negate() - browser captures already have correct colors
      // (white background, black content). The device displays as-is.
      const processedBuffer = await sharp(file.buffer)
        .flatten({ background: { r: 255, g: 255, b: 255 } })
        .grayscale()
        .png({ compressionLevel: 9 })
        .toBuffer();

      // Save to captures directory
      const filename = `capture_${id}.png`;
      const filepath = path.join(capturesUploadDir, filename);
      await fs.promises.writeFile(filepath, processedBuffer);

      const captureUrl = `/uploads/captures/${filename}`;

      // Update the screen design with capture timestamp
      await this.screenDesignerService.updateCaptureTimestamp(id);

      this.logger.log(`Browser capture saved for screen ${id}: ${processedBuffer.length} bytes`);

      return {
        captureUrl,
        filename,
        size: processedBuffer.length,
      };
    } catch (error) {
      this.logger.error('Failed to save browser capture:', error);
      const message = process.env.NODE_ENV === 'production'
        ? 'Image processing failed'
        : `Failed to process image: ${error.message}`;
      throw new BadRequestException(message);
    }
  }

  @Get(':id/drawing')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get drawing overlay for a screen design',
    description: 'Returns the drawing URL if a drawing overlay exists for this screen.',
  })
  @ApiParam({ name: 'id', description: 'Screen design ID' })
  @ApiResponse({ status: 200, description: 'Drawing info' })
  @ApiResponse({ status: 404, description: 'No drawing found' })
  async getDrawing(@Param('id', ParseIntPipe) id: number) {
    const drawingPath = path.join(drawingsUploadDir, `drawing_${id}.png`);

    if (fs.existsSync(drawingPath)) {
      const stats = await fs.promises.stat(drawingPath);
      return {
        exists: true,
        url: `/uploads/drawings/drawing_${id}.png`,
        size: stats.size,
        updatedAt: stats.mtime,
      };
    }

    return {
      exists: false,
      url: null,
    };
  }

  @Delete(':id/drawing')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Delete drawing overlay for a screen design',
    description: 'Removes the drawing overlay file.',
  })
  @ApiParam({ name: 'id', description: 'Screen design ID' })
  @ApiResponse({ status: 200, description: 'Drawing deleted' })
  async deleteDrawing(@Param('id', ParseIntPipe) id: number) {
    const drawingPath = path.join(drawingsUploadDir, `drawing_${id}.png`);

    if (fs.existsSync(drawingPath)) {
      await fs.promises.unlink(drawingPath);
      return { deleted: true };
    }

    return { deleted: false, message: 'No drawing to delete' };
  }

  @Post(':id/capture-with-drawing')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Capture screen with optional drawing overlay',
    description: 'Renders widgets server-side with Puppeteer, composites optional drawing on top, and applies e-ink processing.',
  })
  @ApiParam({ name: 'id', description: 'Screen design ID' })
  @ApiResponse({ status: 201, description: 'Capture saved for device' })
  @ApiResponse({ status: 400, description: 'Invalid file type' })
  @ApiResponse({ status: 404, description: 'Screen design not found' })
  @UseInterceptors(
    FileInterceptor('drawing', {
      fileFilter: (req, file, cb) => {
        // Accept only PNG files
        if (file.mimetype === 'image/png') {
          cb(null, true);
        } else {
          cb(new BadRequestException('Only PNG files are allowed'), false);
        }
      },
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max
      },
    }),
  )
  async captureWithDrawing(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() drawingFile?: Multer.File,
  ) {
    // Verify the screen design exists
    await this.screenDesignerService.getScreenDesign(id);

    this.logger.log(`[captureWithDrawing] Screen ${id}, hasDrawing: ${!!drawingFile}`);

    try {
      // Save drawing separately if provided (for compositing during dynamic renders)
      if (drawingFile) {
        const drawingPath = path.join(drawingsUploadDir, `drawing_${id}.png`);
        await fs.promises.writeFile(drawingPath, drawingFile.buffer);
        this.logger.log(`[captureWithDrawing] Drawing saved separately: ${drawingPath}`);
      }

      // Render widgets using Puppeteer (preview mode - no e-ink processing yet)
      const widgetsBuffer = await this.screenRendererService.renderScreenDesign(
        id,
        undefined, // No device context
        'preview', // Raw render without e-ink processing
      );

      this.logger.log(`[captureWithDrawing] Widgets rendered: ${widgetsBuffer.length} bytes`);

      let compositeBuffer: Buffer;

      if (drawingFile) {
        this.logger.log(`[captureWithDrawing] Drawing received: ${drawingFile.size} bytes`);

        // Composite drawing on top of widgets
        // Drawing has transparent background, so it overlays correctly
        compositeBuffer = await sharp(widgetsBuffer)
          .composite([
            {
              input: drawingFile.buffer,
              top: 0,
              left: 0,
            },
          ])
          .png()
          .toBuffer();

        this.logger.log(`[captureWithDrawing] Composite done: ${compositeBuffer.length} bytes`);
      } else {
        compositeBuffer = widgetsBuffer;
      }

      // Apply e-ink processing: flatten, grayscale
      // NO negate() - colors are correct (white bg, black content)
      const processedBuffer = await sharp(compositeBuffer)
        .flatten({ background: { r: 255, g: 255, b: 255 } })
        .grayscale()
        .png({ compressionLevel: 9 })
        .toBuffer();

      this.logger.log(`[captureWithDrawing] E-ink processed: ${processedBuffer.length} bytes`);

      // Save to captures directory
      const filename = `capture_${id}.png`;
      const filepath = path.join(capturesUploadDir, filename);
      await fs.promises.writeFile(filepath, processedBuffer);

      const captureUrl = `/uploads/captures/${filename}`;

      // Update the screen design with capture timestamp
      await this.screenDesignerService.updateCaptureTimestamp(id);

      this.logger.log(`[captureWithDrawing] Saved: ${filepath}`);

      return {
        captureUrl,
        filename,
        size: processedBuffer.length,
      };
    } catch (error) {
      this.logger.error('[captureWithDrawing] Failed:', error);
      const message = process.env.NODE_ENV === 'production'
        ? 'Screen capture failed'
        : `Failed to capture screen: ${error.message}`;
      throw new BadRequestException(message);
    }
  }

  // ========================
  // GitHub API Proxy Endpoint
  // ========================

  @Get('github-stars/:owner/:repo')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Fetch GitHub repository stars (proxied to use token)' })
  @ApiParam({ name: 'owner', description: 'GitHub repository owner' })
  @ApiParam({ name: 'repo', description: 'GitHub repository name' })
  @ApiResponse({ status: 200, description: 'GitHub stars data' })
  async getGitHubStars(
    @Param('owner') owner: string,
    @Param('repo') repo: string,
  ) {
    return this.screenRendererService.getGitHubStars(owner, repo);
  }

  // ========================
  // Widget Image Upload Endpoint
  // ========================

  @Post('upload-widget-image')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Upload an image for use in image widgets' })
  @ApiResponse({ status: 201, description: 'Image uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid file type' })
  @UseInterceptors(
    FileInterceptor('file', {
      fileFilter: (req, file, cb) => {
        // Accept only image files
        if (file.mimetype.match(/\/(jpg|jpeg|png|gif|bmp|webp)$/)) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Only image files are allowed'), false);
        }
      },
      limits: {
        fileSize: 25 * 1024 * 1024, // 25MB max
      },
    }),
  )
  async uploadWidgetImage(@UploadedFile() file: Multer.File) {
    this.logger.log(`Upload request received, file: ${file ? JSON.stringify({ name: file.originalname, size: file.size, mimetype: file.mimetype }) : 'NO FILE'}`);

    if (!file) {
      throw new BadRequestException('No file uploaded. Make sure to send file with field name "file"');
    }

    const uniqueSuffix = `${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    const outputFilename = `widget_${uniqueSuffix}.png`;
    const outputPath = path.join(widgetsUploadDir, outputFilename);

    try {
      // Process image for e-ink: 1-bit (black/white) or 2-bit (4 grays), max 90KB
      // Use in-memory buffer (no disk write before validation)
      const inputBuffer = file.buffer;
      let scale = 1.0;
      let buffer: Buffer;
      let attempts = 0;
      const maxAttempts = 15;

      // Get original image metadata
      const metadata = await sharp(inputBuffer).metadata();
      const originalWidth = metadata.width || 800;
      const originalHeight = metadata.height || 480;

      do {
        const newWidth = Math.round(originalWidth * scale);
        const newHeight = Math.round(originalHeight * scale);

        // Convert to grayscale and normalize
        // IMPORTANT: flatten() converts transparent backgrounds to white
        // Without this, transparent pixels become black after processing
        const grayBuffer = await sharp(inputBuffer)
          .flatten({ background: { r: 255, g: 255, b: 255 } })
          .resize(newWidth, newHeight, {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .grayscale()
          .normalise()
          .raw()
          .toBuffer({ resolveWithObject: true });

        // Apply Floyd-Steinberg dithering for 1-bit output
        const { data, info } = grayBuffer;
        const pixels = new Float32Array(data.length);
        for (let i = 0; i < data.length; i++) {
          pixels[i] = data[i];
        }

        // Floyd-Steinberg dithering to black/white (1-bit)
        const threshold = 128;
        for (let y = 0; y < info.height; y++) {
          for (let x = 0; x < info.width; x++) {
            const idx = y * info.width + x;
            const oldPixel = pixels[idx];
            const newPixel = oldPixel < threshold ? 0 : 255;
            pixels[idx] = newPixel;
            const error = oldPixel - newPixel;

            if (x + 1 < info.width) {
              pixels[idx + 1] += (error * 7) / 16;
            }
            if (x - 1 >= 0 && y + 1 < info.height) {
              pixels[(y + 1) * info.width + (x - 1)] += (error * 3) / 16;
            }
            if (y + 1 < info.height) {
              pixels[(y + 1) * info.width + x] += (error * 5) / 16;
            }
            if (x + 1 < info.width && y + 1 < info.height) {
              pixels[(y + 1) * info.width + (x + 1)] += (error * 1) / 16;
            }
          }
        }

        // Convert back to buffer
        const output = Buffer.alloc(data.length);
        for (let i = 0; i < pixels.length; i++) {
          output[i] = Math.max(0, Math.min(255, Math.round(pixels[i])));
        }

        // Create 1-bit PNG using palette mode (black and white only)
        buffer = await sharp(output, {
          raw: {
            width: info.width,
            height: info.height,
            channels: 1,
          },
        })
          .png({
            compressionLevel: 9,
            palette: true,
            colours: 2, // 1-bit: 2 colors (black/white)
          })
          .toBuffer();

        attempts++;

        // If still too large, reduce dimensions
        if (buffer.length > MAX_WIDGET_IMAGE_SIZE) {
          scale *= 0.85;
        }
      } while (buffer.length > MAX_WIDGET_IMAGE_SIZE && attempts < maxAttempts);

      // Save the processed image to disk
      await fs.promises.writeFile(outputPath, buffer);

      const imageUrl = `/uploads/widgets/${outputFilename}`;

      // Return data directly - TransformInterceptor will wrap it in {data: ...}
      return {
        url: imageUrl,
        filename: outputFilename,
        originalName: file.originalname,
        size: buffer.length,
        compressed: buffer.length < file.size,
      };
    } catch (error) {
      const message = process.env.NODE_ENV === 'production'
        ? 'Image processing failed'
        : `Failed to process image: ${error.message}`;
      throw new BadRequestException(message);
    }
  }

  /**
   * Apply Floyd-Steinberg dithering to convert image to 1-bit (black/white)
   * This is the same algorithm used in e-ink processing for optimal display
   */
  private async applyFloydSteinbergDithering(
    inputBuffer: Buffer,
    width: number,
    height: number,
  ): Promise<Buffer> {
    // Get raw grayscale pixel data
    const { data, info } = await sharp(inputBuffer)
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Create float array for error diffusion
    const pixels = new Float32Array(data.length);
    for (let i = 0; i < data.length; i++) {
      pixels[i] = data[i];
    }

    // Floyd-Steinberg dithering to black/white
    const threshold = 128;
    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        const idx = y * info.width + x;
        const oldPixel = pixels[idx];
        const newPixel = oldPixel < threshold ? 0 : 255;
        pixels[idx] = newPixel;
        const error = oldPixel - newPixel;

        // Distribute error to neighboring pixels
        if (x + 1 < info.width) {
          pixels[idx + 1] += (error * 7) / 16;
        }
        if (x - 1 >= 0 && y + 1 < info.height) {
          pixels[(y + 1) * info.width + (x - 1)] += (error * 3) / 16;
        }
        if (y + 1 < info.height) {
          pixels[(y + 1) * info.width + x] += (error * 5) / 16;
        }
        if (x + 1 < info.width && y + 1 < info.height) {
          pixels[(y + 1) * info.width + (x + 1)] += (error * 1) / 16;
        }
      }
    }

    // Convert back to buffer
    const output = Buffer.alloc(data.length);
    for (let i = 0; i < pixels.length; i++) {
      output[i] = Math.max(0, Math.min(255, Math.round(pixels[i])));
    }

    // Create PNG from raw grayscale data
    return sharp(output, {
      raw: {
        width: info.width,
        height: info.height,
        channels: 1,
      },
    })
      .png({ compressionLevel: 9 })
      .toBuffer();
  }
}

// ========================
// Widget Templates Controller
// ========================

@ApiTags('widget-templates')
@Controller('widget-templates')
export class WidgetTemplatesController {
  constructor(private readonly widgetTemplatesService: WidgetTemplatesService) {}

  @Get()
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get all widget templates' })
  @ApiResponse({ status: 200, description: 'List of widget templates' })
  async getAll() {
    return this.widgetTemplatesService.getAll();
  }

  @Get('categories')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get all widget template categories' })
  @ApiResponse({ status: 200, description: 'List of categories' })
  async getCategories() {
    return this.widgetTemplatesService.getCategories();
  }

  @Get('category/:category')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get widget templates by category' })
  @ApiParam({ name: 'category', description: 'Category name' })
  @ApiResponse({ status: 200, description: 'List of widget templates in category' })
  async getByCategory(@Param('category') category: string) {
    return this.widgetTemplatesService.getByCategory(category);
  }

  @Get(':id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get a widget template by ID' })
  @ApiParam({ name: 'id', description: 'Widget template ID' })
  @ApiResponse({ status: 200, description: 'Widget template details' })
  @ApiResponse({ status: 404, description: 'Widget template not found' })
  async getById(@Param('id', ParseIntPipe) id: number) {
    return this.widgetTemplatesService.getById(id);
  }
}
