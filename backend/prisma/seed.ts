import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Default widget templates for the Screen Designer
 */
const WIDGET_TEMPLATES = [
  {
    name: 'clock',
    label: 'Live Clock',
    description: 'Displays current time with configurable timezone',
    category: 'time',
    defaultConfig: {
      timezone: 'local',
      format: '24h',
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
    description: 'Shows current weather for a location',
    category: 'weather',
    defaultConfig: {
      location: 'New York, US',
      latitude: 40.7128,
      longitude: -74.006,
      units: 'metric',
      showIcon: true,
      showTemperature: true,
      showCondition: true,
      showHumidity: false,
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
      timezone: 'local',
      format: 'dddd, MMMM D, YYYY',
      fontSize: 24,
      fontFamily: 'sans-serif',
      color: '#000000',
      textAlign: 'center',
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
      errorCorrection: 'M',
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
      fit: 'contain',
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
      orientation: 'horizontal',
      color: '#000000',
      thickness: 2,
      style: 'solid',
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
    description: 'Shows days remaining until an event',
    category: 'time',
    defaultConfig: {
      eventName: 'Christmas',
      targetDate: '2025-12-25',
      fontSize: 32,
      fontFamily: 'sans-serif',
      color: '#000000',
      showLabel: true,
      labelPosition: 'before',
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

/**
 * Database seed script
 * Creates initial device models and widget templates
 */
async function main() {
  console.log('🌱 Starting database seed...');

  // Create device models
  const models = [
    {
      name: 'og_png',
      label: 'TRMNL Original (PNG)',
      width: 800,
      height: 480,
      description: 'Original TRMNL device with 800x480 e-ink display (PNG format)',
      mimeType: 'image/png',
      colors: 2,
      bitDepth: 1,
      rotation: 0,
      offsetX: 0,
      offsetY: 0,
      kind: 'terminus',
      scaleFactor: 1.0,
    },
    {
      name: 'og_bmp',
      label: 'TRMNL Original (BMP)',
      width: 800,
      height: 480,
      description: 'Original TRMNL device with 800x480 e-ink display (BMP format)',
      mimeType: 'image/bmp',
      colors: 2,
      bitDepth: 1,
      rotation: 0,
      offsetX: 0,
      offsetY: 0,
      kind: 'terminus',
      scaleFactor: 1.0,
    },
    {
      name: 'large_png',
      label: 'TRMNL Large (PNG)',
      width: 1200,
      height: 825,
      description: 'Large TRMNL device with 1200x825 e-ink display (PNG format)',
      mimeType: 'image/png',
      colors: 2,
      bitDepth: 1,
      rotation: 0,
      offsetX: 0,
      offsetY: 0,
      kind: 'terminus',
      scaleFactor: 1.0,
    },
  ];

  for (const modelData of models) {
    await prisma.model.upsert({
      where: { name: modelData.name },
      update: {},
      create: modelData,
    });
  }

  console.log(`✅ Created ${models.length} device models`);

  // Create sample firmware
  const firmware = await prisma.firmware.upsert({
    where: { version: '1.0.0' },
    update: {},
    create: {
      version: '1.0.0',
      downloadUrl: 'https://example.com/firmware/v1.0.0.bin',
      releaseNotes: 'Initial stable release',
      isStable: true,
    },
  });

  console.log(`✅ Created firmware version: ${firmware.version}`);

  // Seed widget templates
  console.log('Seeding widget templates...');
  let widgetTemplatesCreated = 0;
  for (const template of WIDGET_TEMPLATES) {
    await prisma.widgetTemplate.upsert({
      where: { name: template.name },
      update: {},
      create: template,
    });
    widgetTemplatesCreated++;
  }
  console.log(`✅ Created ${widgetTemplatesCreated} widget templates`);

  console.log('');
  console.log('🎉 Database seeding completed!');
  console.log('');
  console.log('📝 PIN Authentication:');
  console.log(`   Default PIN: 1111`);
  console.log('');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
