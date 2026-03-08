import {
  Injectable,
  NotFoundException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CustomWidgetsService } from '../../custom-widgets/custom-widgets.service';
import { wrapListResponse } from '../../common/utils/response.util';

/**
 * Default widget templates to seed
 */
const DEFAULT_WIDGET_TEMPLATES = [
  {
    name: 'clock',
    label: 'Live Clock',
    description: 'Displays current time with configurable timezone',
    category: 'time',
    defaultConfig: {
      timezone: 'local', // Use 'local' for server timezone, or specify like 'Europe/Warsaw', 'America/New_York'
      format: '24h', // or '12h'
      showSeconds: false,
      showDate: true,
      dateFormat: 'YYYY-MM-DD',
      fontFamily: 'monospace',
      fontSize: 48,
    },
    minWidth: 200,
    minHeight: 80,
  },
  {
    name: 'weather',
    label: 'Weather',
    description: 'Shows weather for a location with forecast options',
    category: 'weather',
    defaultConfig: {
      location: 'Warsaw',
      latitude: 52.2297,
      longitude: 21.0122,
      units: 'metric', // 'metric' (Celsius) or 'imperial' (Fahrenheit)
      forecastDay: 0, // 0 = today, 1 = tomorrow, 2 = +2 days, etc. (up to 7)
      forecastTime: 'current', // 'current', 'morning' (6-9), 'noon' (12), 'afternoon' (15), 'evening' (18-21), 'night' (0-3)
      showIcon: true,
      showTemperature: true,
      showCondition: true,
      showLocation: true, // Show location name at bottom
      showHumidity: false,
      showWind: false,
      showDayName: false, // Show "Monday", "Tomorrow", etc.
      fontSize: 32,
    },
    minWidth: 200,
    minHeight: 150,
  },
  {
    name: 'text',
    label: 'Text Block',
    description: 'Static text content',
    category: 'content',
    defaultConfig: {
      text: 'Hello World',
      fontFamily: 'sans-serif',
      fontSize: 24,
      fontWeight: 'normal',
      textAlign: 'left',
      color: '#000000',
    },
    minWidth: 100,
    minHeight: 40,
  },
  {
    name: 'date',
    label: 'Date Display',
    description: 'Shows current date',
    category: 'time',
    defaultConfig: {
      timezone: 'local', // Use 'local' for server timezone, or specify like 'Europe/Warsaw', 'America/New_York'
      format: 'dddd, MMMM D, YYYY',
      fontSize: 24,
      fontFamily: 'sans-serif',
      color: '#000000',
    },
    minWidth: 250,
    minHeight: 50,
  },
  {
    name: 'qrcode',
    label: 'QR Code',
    description: 'Generates a QR code from text/URL',
    category: 'content',
    defaultConfig: {
      content: 'https://example.com',
      size: 150,
      errorCorrection: 'M', // L, M, Q, H
      darkColor: '#000000',
      lightColor: '#FFFFFF',
    },
    minWidth: 100,
    minHeight: 100,
  },
  {
    name: 'battery',
    label: 'Battery Status',
    description: 'Shows device battery level',
    category: 'system',
    defaultConfig: {
      showPercentage: true,
      showIcon: true,
      fontSize: 18,
      iconSize: 24,
      color: '#000000',
    },
    minWidth: 80,
    minHeight: 40,
  },
  {
    name: 'countdown',
    label: 'Countdown Timer',
    description: 'Counts down to a specific date/time',
    category: 'time',
    defaultConfig: {
      targetDate: '2025-01-01T00:00:00Z',
      label: 'New Year',
      showDays: true,
      showHours: true,
      showMinutes: true,
      showSeconds: false,
      fontSize: 32,
      fontFamily: 'monospace',
      color: '#000000',
    },
    minWidth: 250,
    minHeight: 80,
  },
  {
    name: 'image',
    label: 'Static Image',
    description: 'Displays a static image from URL',
    category: 'content',
    defaultConfig: {
      url: '',
      fit: 'contain', // contain, cover, fill
      backgroundColor: '#FFFFFF',
    },
    minWidth: 50,
    minHeight: 50,
  },
  {
    name: 'divider',
    label: 'Divider Line',
    description: 'A horizontal or vertical divider line',
    category: 'layout',
    defaultConfig: {
      orientation: 'horizontal', // horizontal, vertical
      color: '#000000',
      thickness: 2,
      style: 'solid', // solid, dashed, dotted
    },
    minWidth: 20,
    minHeight: 2,
  },
  {
    name: 'rectangle',
    label: 'Rectangle',
    description: 'A simple rectangle shape',
    category: 'layout',
    defaultConfig: {
      fillColor: '#000000',
      borderColor: '#000000',
      borderWidth: 0,
      borderRadius: 0,
    },
    minWidth: 20,
    minHeight: 20,
  },
  {
    name: 'wifi',
    label: 'WiFi Status',
    description: 'Shows WiFi signal strength',
    category: 'system',
    defaultConfig: {
      showStrength: true,
      showIcon: true,
      fontSize: 18,
      iconSize: 24,
      color: '#000000',
    },
    minWidth: 80,
    minHeight: 40,
  },
  {
    name: 'deviceinfo',
    label: 'Device Info',
    description: 'Shows device name and status',
    category: 'system',
    defaultConfig: {
      showName: true,
      showStatus: true,
      showLastSeen: false,
      fontSize: 16,
      fontFamily: 'sans-serif',
      color: '#000000',
    },
    minWidth: 150,
    minHeight: 60,
  },
  {
    name: 'daysuntil',
    label: 'Days Until',
    description: 'Shows days remaining until an event (e.g., "Days till Christmas: 15")',
    category: 'time',
    defaultConfig: {
      eventName: 'Christmas',
      targetDate: '2025-12-25',
      fontSize: 32,
      fontFamily: 'sans-serif',
      color: '#000000',
      showLabel: true,
      labelPosition: 'before', // 'before' = "Days till Christmas: 15", 'after' = "15 days till Christmas"
    },
    minWidth: 200,
    minHeight: 60,
  },
  {
    name: 'github',
    label: 'GitHub Stars',
    description: 'Displays star count for a GitHub repository',
    category: 'content',
    defaultConfig: {
      owner: 'facebook',
      repo: 'react',
      showIcon: true,
      showRepoName: false,
      fontSize: 32,
      fontFamily: 'sans-serif',
    },
    minWidth: 100,
    minHeight: 50,
  },
  // Special base template for custom widgets - used as FK reference in database
  {
    name: 'custom-widget-base',
    label: 'Custom Widget',
    description: 'Base template for user-created custom widgets',
    category: 'custom',
    defaultConfig: {
      customWidgetId: null,
      displayType: 'value',
      fontSize: 24,
    },
    minWidth: 100,
    minHeight: 50,
  },
];

// Re-export the constant for convenience
export { CUSTOM_WIDGET_TEMPLATE_OFFSET } from '../../common/constants/widget.constants';

@Injectable()
export class WidgetTemplatesService implements OnModuleInit {
  private readonly logger = new Logger(WidgetTemplatesService.name);

  constructor(
    private prisma: PrismaService,
    private customWidgetsService: CustomWidgetsService,
  ) {}

  /**
   * Initialize widget templates on module init
   */
  async onModuleInit() {
    // Seed templates on startup if they don't exist
    await this.seedTemplates();
  }

  /**
   * Get all widget templates (including custom widgets)
   */
  async getAll(includeCustom = true) {
    const templates = await this.prisma.widgetTemplate.findMany({
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    // Filter out the base template - it's only for internal use
    // Users should create actual custom widgets instead
    const filteredTemplates = templates.filter(t => t.name !== 'custom-widget-base');

    if (!includeCustom) {
      return wrapListResponse(filteredTemplates);
    }

    // Get custom widgets as templates
    const customTemplates = await this.customWidgetsService.getAsWidgetTemplates();

    // Combine built-in templates with custom widgets
    const allTemplates = [...filteredTemplates, ...customTemplates];

    return wrapListResponse(allTemplates);
  }

  /**
   * Get widget templates by category
   */
  async getByCategory(category: string) {
    const templates = await this.prisma.widgetTemplate.findMany({
      where: { category },
      orderBy: { name: 'asc' },
    });

    return wrapListResponse(templates);
  }

  /**
   * Get a single widget template by ID
   */
  async getById(id: number) {
    const template = await this.prisma.widgetTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException('Widget template not found');
    }

    return template;
  }

  /**
   * Get a single widget template by name
   */
  async getByName(name: string) {
    const template = await this.prisma.widgetTemplate.findUnique({
      where: { name },
    });

    if (!template) {
      throw new NotFoundException(`Widget template '${name}' not found`);
    }

    return template;
  }

  /**
   * Get all unique categories (including custom if widgets exist)
   */
  async getCategories() {
    const templates = await this.prisma.widgetTemplate.findMany({
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    });

    const categories = templates.map((t) => t.category);

    // Check if there are any custom widgets
    const customWidgetCount = await this.prisma.customWidget.count();
    if (customWidgetCount > 0 && !categories.includes('custom')) {
      categories.push('custom');
    }

    return categories;
  }

  /**
   * Get the custom widget base template ID
   * This is used when saving screen widgets that reference custom widgets
   */
  async getCustomWidgetBaseTemplateId(): Promise<number> {
    const template = await this.prisma.widgetTemplate.findUnique({
      where: { name: 'custom-widget-base' },
      select: { id: true },
    });

    if (!template) {
      // Create it if it doesn't exist (shouldn't happen after seeding)
      const newTemplate = await this.prisma.widgetTemplate.create({
        data: {
          name: 'custom-widget-base',
          label: 'Custom Widget',
          description: 'Base template for user-created custom widgets',
          category: 'custom',
          defaultConfig: {
            customWidgetId: null,
            displayType: 'value',
            fontSize: 24,
          },
          minWidth: 100,
          minHeight: 50,
        },
      });
      return newTemplate.id;
    }

    return template.id;
  }

  /**
   * Seed default widget templates
   */
  async seedTemplates() {
    this.logger.log('Checking widget templates...');

    let created = 0;
    let skipped = 0;

    for (const template of DEFAULT_WIDGET_TEMPLATES) {
      const existing = await this.prisma.widgetTemplate.findUnique({
        where: { name: template.name },
      });

      if (!existing) {
        await this.prisma.widgetTemplate.create({
          data: template,
        });
        created++;
        this.logger.debug(`Created widget template: ${template.name}`);
      } else {
        skipped++;
      }
    }

    if (created > 0) {
      this.logger.log(`Created ${created} widget templates`);
    }

    if (skipped > 0) {
      this.logger.debug(`Skipped ${skipped} existing widget templates`);
    }

    return { created, skipped };
  }
}
