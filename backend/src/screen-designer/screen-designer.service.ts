import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateScreenDesignDto,
  UpdateScreenDesignDto,
  CreateWidgetDto,
  UpdateWidgetDto,
  AssignDeviceDto,
} from './dto';
import { wrapListResponse, wrapPaginatedResponse } from '../common/utils/response.util';
import { EventsService } from '../events/events.service';
import { WidgetTemplatesService } from './services/widget-templates.service';
import { CUSTOM_WIDGET_TEMPLATE_OFFSET } from '../common/constants/widget.constants';

@Injectable()
export class ScreenDesignerService {
  private readonly logger = new Logger(ScreenDesignerService.name);

  constructor(
    private prisma: PrismaService,
    private eventsService: EventsService,
    private widgetTemplatesService: WidgetTemplatesService,
  ) {}

  /**
   * Create a new screen design
   */
  async createScreenDesign(dto: CreateScreenDesignDto) {
    const { widgets, ...designData } = dto;

    // Check if any widgets are custom widgets (templateId >= CUSTOM_WIDGET_TEMPLATE_OFFSET)
    // If so, we need to use the base template ID for the FK constraint
    let customWidgetBaseTemplateId: number | null = null;
    if (widgets?.some(w => w.templateId >= CUSTOM_WIDGET_TEMPLATE_OFFSET)) {
      customWidgetBaseTemplateId = await this.widgetTemplatesService.getCustomWidgetBaseTemplateId();
    }

    // Map widgets, converting custom widget templateIds to base template ID
    const mappedWidgets = widgets?.map((widget, index) => {
      const isCustomWidget = widget.templateId >= CUSTOM_WIDGET_TEMPLATE_OFFSET;
      const actualTemplateId = isCustomWidget ? customWidgetBaseTemplateId! : widget.templateId;

      // For custom widgets, ensure customWidgetId is stored in config
      const config = isCustomWidget
        ? {
            ...(widget.config ?? {}),
            customWidgetId: widget.templateId - CUSTOM_WIDGET_TEMPLATE_OFFSET,
          }
        : (widget.config ?? {});

      return {
        templateId: actualTemplateId,
        x: widget.x ?? 0,
        y: widget.y ?? 0,
        width: widget.width ?? 200,
        height: widget.height ?? 100,
        rotation: widget.rotation ?? 0,
        config,
        zIndex: widget.zIndex ?? index,
      };
    });

    const screenDesign = await this.prisma.screenDesign.create({
      data: {
        name: designData.name,
        description: designData.description,
        width: designData.width ?? 800,
        height: designData.height ?? 480,
        background: designData.background ?? '#FFFFFF',
        isTemplate: designData.isTemplate ?? false,
        widgets: mappedWidgets?.length
          ? { create: mappedWidgets }
          : undefined,
      },
      include: {
        widgets: {
          include: {
            template: true,
          },
          orderBy: {
            zIndex: 'asc',
          },
        },
      },
    });

    this.logger.log(`Screen design created: ${screenDesign.name}`);

    // Transform widgets to restore virtual template IDs for custom widgets
    const transformedDesign = this.transformScreenDesignForResponse(screenDesign);

    return transformedDesign;
  }

  /**
   * Update a screen design
   */
  async updateScreenDesign(id: number, dto: UpdateScreenDesignDto) {
    const screenDesign = await this.prisma.screenDesign.findUnique({
      where: { id },
    });

    if (!screenDesign) {
      throw new NotFoundException('Screen design not found');
    }

    const { widgets, ...updateData } = dto;

    // Check if any widgets are custom widgets (templateId >= CUSTOM_WIDGET_TEMPLATE_OFFSET)
    let customWidgetBaseTemplateId: number | null = null;
    if (widgets?.some(w => w.templateId >= CUSTOM_WIDGET_TEMPLATE_OFFSET)) {
      customWidgetBaseTemplateId = await this.widgetTemplatesService.getCustomWidgetBaseTemplateId();
    }

    // Use a transaction to update design and replace all widgets atomically
    const updatedDesign = await this.prisma.$transaction(async (tx) => {
      // Update the screen design properties
      await tx.screenDesign.update({
        where: { id },
        data: {
          name: updateData.name,
          description: updateData.description,
          width: updateData.width,
          height: updateData.height,
          background: updateData.background,
          isTemplate: updateData.isTemplate,
        },
      });

      // If widgets are provided, replace all existing widgets with new ones
      if (widgets !== undefined) {
        // Delete all existing widgets for this design
        await tx.screenWidget.deleteMany({
          where: { screenDesignId: id },
        });

        // Create new widgets if any were provided
        if (widgets.length > 0) {
          // Map widgets, converting custom widget templateIds to base template ID
          const mappedWidgets = widgets.map((widget, index) => {
            const isCustomWidget = widget.templateId >= CUSTOM_WIDGET_TEMPLATE_OFFSET;
            const actualTemplateId = isCustomWidget ? customWidgetBaseTemplateId! : widget.templateId;

            // For custom widgets, ensure customWidgetId is stored in config
            const config = isCustomWidget
              ? {
                  ...(widget.config ?? {}),
                  customWidgetId: widget.templateId - CUSTOM_WIDGET_TEMPLATE_OFFSET,
                }
              : (widget.config ?? {});

            return {
              screenDesignId: id,
              templateId: actualTemplateId,
              x: widget.x ?? 0,
              y: widget.y ?? 0,
              width: widget.width ?? 200,
              height: widget.height ?? 100,
              rotation: widget.rotation ?? 0,
              config,
              zIndex: widget.zIndex ?? index,
            };
          });

          await tx.screenWidget.createMany({
            data: mappedWidgets,
          });
        }

        this.logger.log(`Screen design ${id} widgets updated: ${widgets.length} widgets`);
      }

      // Fetch and return the updated design with all relations
      return tx.screenDesign.findUnique({
        where: { id },
        include: {
          widgets: {
            include: {
              template: true,
            },
            orderBy: {
              zIndex: 'asc',
            },
          },
        },
      });
    });

    this.logger.log(`Screen design updated: ${updatedDesign?.name}`);

    // Invalidate any existing capture file (it's now stale)
    this.invalidateCapture(id);

    // Notify devices that use this screen design to refresh
    await this.eventsService.notifyScreenDesignUpdate(id);

    // Transform widgets to restore virtual template IDs for custom widgets
    return updatedDesign ? this.transformScreenDesignForResponse(updatedDesign) : null;
  }

  /**
   * Delete a screen design
   */
  async deleteScreenDesign(id: number) {
    const screenDesign = await this.prisma.screenDesign.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            assignments: true,
          },
        },
      },
    });

    if (!screenDesign) {
      throw new NotFoundException('Screen design not found');
    }

    // Clean up capture file before deleting from database
    this.invalidateCapture(id);

    // Clean up drawing file if exists
    const drawingPath = path.join(process.cwd(), 'uploads', 'drawings', `drawing_${id}.png`);
    try {
      if (fs.existsSync(drawingPath)) {
        fs.unlinkSync(drawingPath);
        this.logger.log(`Deleted drawing for screen design ${id}`);
      }
    } catch (error) {
      this.logger.warn(`Failed to delete drawing for screen design ${id}: ${error.message}`);
    }

    await this.prisma.screenDesign.delete({
      where: { id },
    });

    this.logger.log(`Screen design deleted: ${screenDesign.name}`);

    return { message: 'Screen design deleted successfully' };
  }

  /**
   * Refresh all devices using a screen design
   * Triggers immediate refresh for all devices that have this design in their playlist
   */
  async refreshDevicesUsingDesign(id: number) {
    // Verify screen design exists
    const screenDesign = await this.prisma.screenDesign.findUnique({
      where: { id },
    });

    if (!screenDesign) {
      throw new NotFoundException('Screen design not found');
    }

    // Trigger refresh for all devices using this design
    const deviceCount = await this.eventsService.notifyScreenDesignUpdate(id);

    this.logger.log(`Refresh triggered for ${deviceCount} devices using screen design ${id}`);

    return {
      message: `Refresh triggered for ${deviceCount} device(s)`,
      deviceCount,
    };
  }

  /**
   * Update the capture timestamp for a screen design
   * This touches the updatedAt field to mark when the last capture was made
   */
  async updateCaptureTimestamp(id: number) {
    await this.prisma.screenDesign.update({
      where: { id },
      data: {
        // Touching updatedAt by re-setting the name (Prisma auto-updates updatedAt)
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Invalidate (delete) the capture file for a screen design.
   * Called when design is updated to prevent serving stale captures.
   */
  invalidateCapture(id: number) {
    const capturePath = path.join(process.cwd(), 'uploads', 'captures', `capture_${id}.png`);
    try {
      if (fs.existsSync(capturePath)) {
        fs.unlinkSync(capturePath);
        this.logger.log(`Invalidated capture for screen design ${id}`);
      }
    } catch (error) {
      this.logger.warn(`Failed to invalidate capture for screen design ${id}: ${error.message}`);
    }
  }

  /**
   * Get a single screen design with widgets
   */
  async getScreenDesign(id: number) {
    const screenDesign = await this.prisma.screenDesign.findUnique({
      where: { id },
      include: {
        widgets: {
          include: {
            template: true,
          },
          orderBy: {
            zIndex: 'asc',
          },
        },
        assignments: {
          include: {
            device: {
              select: {
                id: true,
                name: true,
                macAddress: true,
              },
            },
          },
        },
      },
    });

    if (!screenDesign) {
      throw new NotFoundException('Screen design not found');
    }

    // Transform widgets to restore virtual template IDs for custom widgets
    return this.transformScreenDesignForResponse(screenDesign);
  }

  /**
   * Get all screen designs with pagination
   */
  async getAllScreenDesigns(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [screenDesigns, total] = await Promise.all([
      this.prisma.screenDesign.findMany({
        include: {
          widgets: {
            include: {
              template: {
                select: {
                  id: true,
                  name: true,
                  label: true,
                  category: true,
                },
              },
            },
            orderBy: {
              zIndex: 'asc',
            },
          },
          _count: {
            select: {
              assignments: true,
            },
          },
        },
        orderBy: {
          updatedAt: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.screenDesign.count(),
    ]);

    // Transform each design to restore virtual template IDs for custom widgets
    const transformedDesigns = screenDesigns.map(design =>
      this.transformScreenDesignForResponse(design)
    );

    return wrapPaginatedResponse(transformedDesigns, total, page, limit);
  }

  /**
   * Add a widget to a screen design
   */
  async addWidget(screenDesignId: number, dto: CreateWidgetDto) {
    // Verify screen design exists
    const screenDesign = await this.prisma.screenDesign.findUnique({
      where: { id: screenDesignId },
    });

    if (!screenDesign) {
      throw new NotFoundException('Screen design not found');
    }

    // Verify template exists
    const template = await this.prisma.widgetTemplate.findUnique({
      where: { id: dto.templateId },
    });

    if (!template) {
      throw new BadRequestException('Widget template not found');
    }

    // Check minimum dimensions
    const width = dto.width ?? 200;
    const height = dto.height ?? 100;

    if (width < template.minWidth || height < template.minHeight) {
      throw new BadRequestException(
        `Widget dimensions must be at least ${template.minWidth}x${template.minHeight}`,
      );
    }

    // Merge default config with provided config
    const config = {
      ...(template.defaultConfig as object),
      ...(dto.config ?? {}),
    };

    const widget = await this.prisma.screenWidget.create({
      data: {
        screenDesignId,
        templateId: dto.templateId,
        x: dto.x ?? 0,
        y: dto.y ?? 0,
        width,
        height,
        rotation: dto.rotation ?? 0,
        config,
        zIndex: dto.zIndex ?? 0,
      },
      include: {
        template: true,
      },
    });

    this.logger.log(
      `Widget added to screen design ${screenDesignId}: ${template.name}`,
    );

    // Notify devices that use this screen design to refresh
    await this.eventsService.notifyScreenDesignUpdate(screenDesignId);

    return widget;
  }

  /**
   * Update a widget
   */
  async updateWidget(
    screenDesignId: number,
    widgetId: number,
    dto: UpdateWidgetDto,
  ) {
    // Get widget with screen design
    const widget = await this.prisma.screenWidget.findUnique({
      where: { id: widgetId },
      include: {
        screenDesign: true,
        template: true,
      },
    });

    if (!widget) {
      throw new NotFoundException('Widget not found');
    }

    if (widget.screenDesignId !== screenDesignId) {
      throw new BadRequestException('Widget does not belong to this screen design');
    }

    // Check minimum dimensions if provided
    const width = dto.width ?? widget.width;
    const height = dto.height ?? widget.height;

    if (width < widget.template.minWidth || height < widget.template.minHeight) {
      throw new BadRequestException(
        `Widget dimensions must be at least ${widget.template.minWidth}x${widget.template.minHeight}`,
      );
    }

    // Merge existing config with updates
    const config = dto.config
      ? { ...(widget.config as object), ...dto.config }
      : undefined;

    const updatedWidget = await this.prisma.screenWidget.update({
      where: { id: widgetId },
      data: {
        x: dto.x,
        y: dto.y,
        width: dto.width,
        height: dto.height,
        rotation: dto.rotation,
        config,
        zIndex: dto.zIndex,
      },
      include: {
        template: true,
      },
    });

    this.logger.log(`Widget ${widgetId} updated`);

    // Notify devices that use this screen design to refresh
    await this.eventsService.notifyScreenDesignUpdate(screenDesignId);

    return updatedWidget;
  }

  /**
   * Remove a widget from a screen design
   */
  async removeWidget(screenDesignId: number, widgetId: number) {
    const widget = await this.prisma.screenWidget.findUnique({
      where: { id: widgetId },
      include: {
        screenDesign: true,
        template: true,
      },
    });

    if (!widget) {
      throw new NotFoundException('Widget not found');
    }

    if (widget.screenDesignId !== screenDesignId) {
      throw new BadRequestException('Widget does not belong to this screen design');
    }

    await this.prisma.screenWidget.delete({
      where: { id: widgetId },
    });

    this.logger.log(`Widget ${widgetId} removed from screen design ${screenDesignId}`);

    // Notify devices that use this screen design to refresh
    await this.eventsService.notifyScreenDesignUpdate(screenDesignId);

    return { message: 'Widget removed successfully' };
  }

  /**
   * Assign a screen design to a device
   */
  async assignToDevice(screenDesignId: number, dto: AssignDeviceDto) {
    // Verify screen design exists
    const screenDesign = await this.prisma.screenDesign.findUnique({
      where: { id: screenDesignId },
    });

    if (!screenDesign) {
      throw new NotFoundException('Screen design not found');
    }

    // Verify device exists
    const device = await this.prisma.device.findUnique({
      where: { id: dto.deviceId },
    });

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    // Check if assignment already exists
    const existingAssignment = await this.prisma.deviceScreenAssignment.findUnique({
      where: {
        deviceId_screenDesignId: {
          deviceId: dto.deviceId,
          screenDesignId,
        },
      },
    });

    if (existingAssignment) {
      throw new BadRequestException(
        'This screen design is already assigned to this device',
      );
    }

    const assignment = await this.prisma.deviceScreenAssignment.create({
      data: {
        deviceId: dto.deviceId,
        screenDesignId,
        isActive: true,
      },
      include: {
        device: {
          select: {
            id: true,
            name: true,
            macAddress: true,
          },
        },
        screenDesign: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    this.logger.log(
      `Screen design ${screenDesignId} assigned to device ${dto.deviceId}`,
    );

    return assignment;
  }

  /**
   * Unassign a screen design from a device
   */
  async unassignFromDevice(screenDesignId: number, deviceId: number) {
    const assignment = await this.prisma.deviceScreenAssignment.findUnique({
      where: {
        deviceId_screenDesignId: {
          deviceId,
          screenDesignId,
        },
      },
      include: {
        device: true,
        screenDesign: true,
      },
    });

    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    await this.prisma.deviceScreenAssignment.delete({
      where: {
        deviceId_screenDesignId: {
          deviceId,
          screenDesignId,
        },
      },
    });

    this.logger.log(
      `Screen design ${screenDesignId} unassigned from device ${deviceId}`,
    );

    return { message: 'Screen design unassigned from device successfully' };
  }

  /**
   * Get all screen designs assigned to a device
   */
  async getDeviceScreenDesigns(deviceId: number) {
    // Verify device exists
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
    });

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    const assignments = await this.prisma.deviceScreenAssignment.findMany({
      where: { deviceId },
      include: {
        screenDesign: {
          include: {
            widgets: {
              include: {
                template: true,
              },
              orderBy: {
                zIndex: 'asc',
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const screenDesigns = assignments.map((a) => ({
      ...this.transformScreenDesignForResponse(a.screenDesign),
      assignmentId: a.id,
      isActive: a.isActive,
      assignedAt: a.createdAt,
    }));

    return wrapListResponse(screenDesigns);
  }

  /**
   * Get the active screen design for a device (for rendering)
   */
  async getActiveScreenDesignForDevice(deviceId: number) {
    const assignment = await this.prisma.deviceScreenAssignment.findFirst({
      where: {
        deviceId,
        isActive: true,
      },
      include: {
        screenDesign: {
          include: {
            widgets: {
              include: {
                template: true,
              },
              orderBy: {
                zIndex: 'asc',
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!assignment) {
      return null;
    }

    // Transform widgets to restore virtual template IDs for custom widgets
    return this.transformScreenDesignForResponse(assignment.screenDesign);
  }

  /**
   * Duplicate a screen design
   */
  async duplicateScreenDesign(id: number, newName?: string) {
    const original = await this.prisma.screenDesign.findUnique({
      where: { id },
      include: {
        widgets: true,
      },
    });

    if (!original) {
      throw new NotFoundException('Screen design not found');
    }

    const duplicate = await this.prisma.screenDesign.create({
      data: {
        name: newName || `${original.name} (Copy)`,
        description: original.description,
        width: original.width,
        height: original.height,
        background: original.background,
        isTemplate: false, // Copies are never templates by default
        widgets: {
          create: original.widgets.map((widget) => ({
            templateId: widget.templateId,
            x: widget.x,
            y: widget.y,
            width: widget.width,
            height: widget.height,
            rotation: widget.rotation,
            config: widget.config as object,
            zIndex: widget.zIndex,
          })),
        },
      },
      include: {
        widgets: {
          include: {
            template: true,
          },
          orderBy: {
            zIndex: 'asc',
          },
        },
      },
    });

    this.logger.log(
      `Screen design duplicated: ${original.name} -> ${duplicate.name}`,
    );

    return this.transformScreenDesignForResponse(duplicate);
  }

  /**
   * Transform screen design for API response
   * Restores virtual template IDs for custom widgets based on customWidgetId in config
   * Adds captureUrl if a browser capture file exists
   */
  private transformScreenDesignForResponse(screenDesign: any): any {
    if (!screenDesign || !screenDesign.widgets) {
      return screenDesign;
    }

    // Check if capture file exists
    const captureFilename = `capture_${screenDesign.id}.png`;
    const capturePath = path.join(process.cwd(), 'uploads', 'captures', captureFilename);
    const captureExists = fs.existsSync(capturePath);
    const captureUrl = captureExists ? `/uploads/captures/${captureFilename}` : null;

    return {
      ...screenDesign,
      captureUrl, // Include capture URL if exists (for preview with drawings)
      widgets: screenDesign.widgets.map((widget: any) => {
        const config = widget.config as Record<string, unknown>;
        const customWidgetId = config?.customWidgetId as number | undefined;

        // If this widget has a customWidgetId, restore the virtual template ID
        if (customWidgetId !== undefined && customWidgetId !== null) {
          return {
            ...widget,
            templateId: CUSTOM_WIDGET_TEMPLATE_OFFSET + customWidgetId,
          };
        }

        return widget;
      }),
    };
  }
}
