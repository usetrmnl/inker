import { describe, it, expect, beforeEach } from 'bun:test';
import { DisplayService } from './display.service';
import { createMockPrisma } from '../../test/mocks/prisma.mock';
import { createMock, type MockFn } from '../../test/mocks/helpers';
import type { PluginsService } from '../../plugins/plugins.service';

describe('DisplayService', () => {
  let service: DisplayService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;
  let mockConfig: any;
  let mockDefaultScreenService: any;
  let mockSleepScreenService: any;
  let mockScreenRendererService: any;
  let mockPluginsService: { renderInstance: MockFn<Promise<Buffer>> };

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    mockConfig = {
      get: createMock().mockImplementation((key: string) =>
        key === 'defaultTimezone' ? 'UTC' : 'http://localhost:3002',
      ),
    };
    mockDefaultScreenService = {
      getDefaultScreenUrl: createMock().mockReturnValue('/uploads/default-screen.png'),
      getDefaultScreenBase64: createMock().mockResolvedValue('base64data'),
      getDefaultScreenBuffer: createMock().mockResolvedValue(Buffer.from('PNG')),
      getDefaultScreenPreviewBuffer: createMock().mockResolvedValue(Buffer.from('PNG')),
      ensureDefaultScreenExists: createMock().mockResolvedValue(undefined),
      getDefaultScreenBmpUrl: createMock().mockReturnValue('/assets/default-screen.bmp'),
      getDefaultScreenBmpBase64: createMock().mockResolvedValue('base64bmp'),
      getDefaultScreenBmpBuffer: createMock().mockResolvedValue(Buffer.from('BM')),
      ensureDefaultScreenBmpExists: createMock().mockResolvedValue(undefined),
      ensureDefaultScreenForSize: createMock().mockResolvedValue(undefined),
      getDefaultScreenUrlForSize: createMock().mockImplementation(
        (w: number, h: number, fmt: string) => `/assets/default-screen-${w}x${h}.${fmt}`,
      ),
      getDefaultScreenBase64ForSize: createMock().mockResolvedValue('base64sized'),
    };
    mockSleepScreenService = {
      getSleepScreen: createMock().mockResolvedValue({
        url: '/assets/sleep-800x480-0700.png',
        filename: 'sleep-800x480-0700.png',
      }),
      getSleepScreenBase64: createMock().mockResolvedValue('base64sleep'),
      getSleepScreenBuffer: createMock().mockResolvedValue(Buffer.from('SLEEPPNG')),
    };
    mockScreenRendererService = {
      renderScreenDesign: createMock().mockResolvedValue(Buffer.from('PNG')),
    };
    mockPluginsService = {
      renderInstance: createMock().mockResolvedValue(Buffer.from('PLUGINPNG')),
    };
    service = new DisplayService(
      mockPrisma as any,
      mockConfig,
      mockDefaultScreenService,
      mockSleepScreenService,
      mockScreenRendererService,
      // Only renderInstance is exercised by DisplayService's preview path.
      mockPluginsService as unknown as PluginsService,
    );
  });

  describe('getCurrentScreen (private)', () => {
    const getCurrentScreen = (items: any[], lastScreenId: string | null = null, screenStartedAt: Date | null = null) =>
      (service as any).getCurrentScreen(items, lastScreenId, screenStartedAt);

    it('should return null for empty items', () => {
      expect(getCurrentScreen([], null, null)).toBeNull();
      expect(getCurrentScreen(null as any, null, null)).toBeNull();
    });

    it('should return single item without screen change', () => {
      const items = [{ id: 1, duration: 60 }];
      const result = getCurrentScreen(items);
      expect(result.item.id).toBe(1);
      expect(result.screenChanged).toBe(false);
    });

    it('should start at first item when no previous screen', () => {
      const items = [
        { id: 1, screenDesign: { id: 1 }, duration: 300 },
        { id: 2, screenDesign: { id: 2 }, duration: 60 },
      ];
      const result = getCurrentScreen(items, null, null);
      expect(result.item.id).toBe(1);
      expect(result.screenChanged).toBe(true);
    });

    it('should keep current screen when duration not expired', () => {
      const items = [
        { id: 1, screenDesign: { id: 1 }, duration: 300 },
        { id: 2, screenDesign: { id: 2 }, duration: 60 },
      ];
      // Screen started 100 seconds ago, duration is 300
      const startedAt = new Date(Date.now() - 100_000);
      const result = getCurrentScreen(items, 'design-1', startedAt);
      expect(result.item.id).toBe(1);
      expect(result.screenChanged).toBe(false);
    });

    it('should advance to next screen when duration expired', () => {
      const items = [
        { id: 1, screenDesign: { id: 1 }, duration: 300 },
        { id: 2, screenDesign: { id: 2 }, duration: 60 },
      ];
      // Screen started 301 seconds ago, duration is 300
      const startedAt = new Date(Date.now() - 301_000);
      const result = getCurrentScreen(items, 'design-1', startedAt);
      expect(result.item.id).toBe(2);
      expect(result.screenChanged).toBe(true);
    });

    it('should wrap around to first screen after last', () => {
      const items = [
        { id: 1, screenDesign: { id: 1 }, duration: 300 },
        { id: 2, screenDesign: { id: 2 }, duration: 60 },
      ];
      // On screen 2, duration expired
      const startedAt = new Date(Date.now() - 61_000);
      const result = getCurrentScreen(items, 'design-2', startedAt);
      expect(result.item.id).toBe(1);
      expect(result.screenChanged).toBe(true);
    });

    it('should start at first item when lastScreenId not found in playlist', () => {
      const items = [
        { id: 1, screenDesign: { id: 1 }, duration: 300 },
        { id: 2, screenDesign: { id: 2 }, duration: 60 },
      ];
      const result = getCurrentScreen(items, 'design-99', new Date());
      expect(result.item.id).toBe(1);
      expect(result.screenChanged).toBe(true);
    });
  });

  describe('hasClockWidget (private)', () => {
    const hasClock = (design: any) => (service as any).hasClockWidget(design);

    it('should return false for no widgets', () => {
      expect(hasClock(null)).toBe(false);
      expect(hasClock({ widgets: [] })).toBe(false);
    });

    it('should return true when clock exists', () => {
      expect(hasClock({ widgets: [{ template: { name: 'clock' } }] })).toBe(true);
    });

    it('should return false for countdown (not clock)', () => {
      expect(hasClock({ widgets: [{ template: { name: 'countdown' } }] })).toBe(false);
    });
  });

  describe('getRefreshRateForScreen (private)', () => {
    const getRate = (screen: any, deviceRate: number) =>
      (service as any).getRefreshRateForScreen(screen, deviceRate);

    it('should return device refresh rate for normal screens', () => {
      const screen = { screenDesign: { widgets: [{ template: { name: 'text' } }] } };
      expect(getRate(screen, 900)).toBe(900);
    });

    it('should return device refresh rate for countdown widgets (no override)', () => {
      const screen = { screenDesign: { widgets: [{ template: { name: 'countdown' } }] } };
      expect(getRate(screen, 900)).toBe(900);
    });

    it('should return device refresh rate for date widgets (not time-sensitive)', () => {
      const screen = { screenDesign: { widgets: [{ template: { name: 'date' } }] } };
      expect(getRate(screen, 900)).toBe(900);
    });

    it('should calculate clock refresh based on seconds until next minute', () => {
      const screen = { screenDesign: { widgets: [{ template: { name: 'clock' } }] } };
      const rate = getRate(screen, 900);
      expect(rate).toBeGreaterThanOrEqual(4);
      expect(rate).toBeLessThanOrEqual(63);
    });

    it('should enforce 10 second floor', () => {
      const screen = { screenDesign: { widgets: [{ template: { name: 'text' } }] } };
      expect(getRate(screen, 5)).toBe(10);
    });
  });

  describe('getNextRefreshTimestamp', () => {
    it('should return device refresh rate ms from now for normal screens', () => {
      const screen = { screenDesign: { widgets: [{ template: { name: 'text' } }] } };
      const ts = service.getNextRefreshTimestamp(screen, 900);
      const diff = ts! - Date.now();
      // Should be approximately 900 seconds from now
      expect(diff).toBeGreaterThan(899000);
      expect(diff).toBeLessThan(901000);
    });
  });

  describe('getDisplayContent', () => {
    it('should return reset_firmware with all expected fields when device not found', async () => {
      mockPrisma.device.findFirst.mockResolvedValue(null);
      const result = await service.getDisplayContent('unknown-key');
      expect(result.reset_firmware).toBe(true);
      expect(result.status).toBe(0);
      expect(result.image_url).toBe('');
      expect(result.filename).toBe('');
      expect(result.firmware_url).toBe('');
      expect(result.update_firmware).toBe(false);
      expect(result.refresh_rate).toBe(0);
    });

    it('should return default screen when no playlist', async () => {
      mockPrisma.device.findFirst.mockResolvedValue({
        id: 1, name: 'Test', playlist: null, refreshRate: 900, refreshPending: false,
      });
      mockPrisma.device.update.mockResolvedValue({ id: 1, battery: null, wifi: null });
      mockPrisma.firmware.findFirst.mockResolvedValue(null);

      const result = await service.getDisplayContent('test-key');
      expect(result.image_url).toContain('default-screen');
      expect(result.refresh_rate).toBe(900);
      expect(result.status).toBe(0);
      expect(result.update_firmware).toBe(false);
      expect(result.reset_firmware).toBe(false);
    });

    it('should return default screen when playlist has no items', async () => {
      mockPrisma.device.findFirst.mockResolvedValue({
        id: 1, name: 'Test', playlist: { items: [] }, refreshRate: 900, refreshPending: false,
      });
      mockPrisma.device.update.mockResolvedValue({ id: 1, battery: null, wifi: null });
      mockPrisma.firmware.findFirst.mockResolvedValue(null);

      const result = await service.getDisplayContent('test-key');
      expect(result.image_url).toContain('default-screen');
      expect(result.status).toBe(0);
      expect(result.reset_firmware).toBe(false);
    });

    it('should never push a firmware update to the device, even when a newer stable firmware exists', async () => {
      mockPrisma.device.findFirst.mockResolvedValue({
        id: 1, name: 'Test', firmwareVersion: '1.0.0', playlist: null, refreshRate: 900, refreshPending: false,
      });
      mockPrisma.device.update.mockResolvedValue({ id: 1, battery: null, wifi: null });
      mockPrisma.firmware.findFirst.mockResolvedValue({ version: '2.0.0', downloadUrl: 'http://fw.bin', isStable: true });

      const result = await service.getDisplayContent('test-key');
      expect(result.firmware_url).toBe('');
      expect(result.update_firmware).toBe(false);
    });

    it('should use normal refresh_rate even when refreshPending is true', async () => {
      mockPrisma.device.findFirst.mockResolvedValue({
        id: 1, name: 'Test', playlist: null, refreshRate: 900, refreshPending: true,
      });
      mockPrisma.device.update.mockResolvedValue({ id: 1, battery: 80, wifi: -51 });
      mockPrisma.firmware.findFirst.mockResolvedValue(null);

      const result = await service.getDisplayContent('test-key', false, { battery: 80, wifi: -51 });
      expect(result.refresh_rate).toBe(900);
    });

    it('should update device metrics', async () => {
      mockPrisma.device.findFirst.mockResolvedValue({
        id: 1, name: 'Test', playlist: null, refreshRate: 900, refreshPending: false,
      });
      mockPrisma.device.update.mockResolvedValue({ id: 1, battery: 85, wifi: -45 });
      mockPrisma.firmware.findFirst.mockResolvedValue(null);

      await service.getDisplayContent('test-key', false, { battery: 85, wifi: -45 });

      const updateCall = mockPrisma.device.update.calls[0];
      expect(updateCall[0].data.battery).toBe(85);
      expect(updateCall[0].data.wifi).toBe(-45);
    });
  });

  describe('getCurrentScreenImage', () => {
    it('should throw NotFoundException when device not found', async () => {
      mockPrisma.device.findUnique.mockResolvedValue(null);
      await expect(service.getCurrentScreenImage(999)).rejects.toThrow('Device not found');
    });

    it('should return default buffer when no playlist', async () => {
      mockPrisma.device.findUnique.mockResolvedValue({ id: 1, playlist: null });
      const result = await service.getCurrentScreenImage(1);
      expect(result).toBeInstanceOf(Buffer);
    });

    it('should render screen design in preview mode', async () => {
      mockPrisma.device.findUnique.mockResolvedValue({
        id: 1,
        name: 'Test',
        battery: 80,
        wifi: -51,
        playlist: {
          items: [{
            duration: 60,
            screenDesign: { id: 5, widgets: [] },
            screen: null,
          }],
        },
      });
      await service.getCurrentScreenImage(1);
      expect(mockScreenRendererService.renderScreenDesign.calls.length).toBe(1);
      // Second arg is deviceContext, third is preview=true
      expect(mockScreenRendererService.renderScreenDesign.calls[0][2]).toBe(true);
    });

    it('returns the sleep screen during quiet hours when showSleepScreen is true', async () => {
      const hhmm = (offsetMin: number) => {
        const now = new Date();
        const total = ((now.getUTCHours() * 60 + now.getUTCMinutes() + offsetMin) % 1440 + 1440) % 1440;
        return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
      };
      mockPrisma.device.findUnique.mockResolvedValue({
        id: 1, name: 'Test', width: 800, height: 480,
        sleepStartAt: hhmm(-60), sleepStopAt: hhmm(120), showSleepScreen: true,
        playlist: { items: [{ duration: 60, screenDesign: { id: 5, widgets: [] } }] },
      });
      const result = await service.getCurrentScreenImage(1);
      expect(mockSleepScreenService.getSleepScreenBuffer.calls.length).toBe(1);
      expect(mockScreenRendererService.renderScreenDesign.calls.length).toBe(0);
      expect(result).toBeInstanceOf(Buffer);
    });

    describe('plugin items', () => {
      const deviceWithPlugin = (model: Record<string, unknown> | null) => ({
        id: 1,
        name: 'Test',
        model,
        playlist: {
          items: [{
            duration: 60,
            screenDesign: null,
            screen: null,
            pluginInstance: { id: 7, plugin: { slug: 'weather', name: 'Weather' } },
          }],
        },
      });

      it('renders the plugin as a Spectra 6 e-ink preview on a colors-6 PNG device', async () => {
        mockPrisma.device.findUnique.mockResolvedValue(deviceWithPlugin({ colors: 6, mimeType: 'image/png' }));
        const result = await service.getCurrentScreenImage(1);
        expect(mockPluginsService.renderInstance.calls).toEqual([[7, 'full', 'einkPreview', 'spectra6']]);
        expect(result.toString()).toBe('PLUGINPNG');
        expect(mockDefaultScreenService.getDefaultScreenPreviewBuffer.calls.length).toBe(0);
      });

      it('renders the plugin without a palette on a 2-colour device', async () => {
        mockPrisma.device.findUnique.mockResolvedValue(deviceWithPlugin({ colors: 2, mimeType: 'image/png' }));
        await service.getCurrentScreenImage(1);
        expect(mockPluginsService.renderInstance.calls).toEqual([[7, 'full', 'einkPreview', undefined]]);
      });
    });
  });

  describe('getImageFilename (private)', () => {
    const getFilename = (url: string) => (service as any).getImageFilename(url);

    it('should extract filename from URL path', () => {
      expect(getFilename('/uploads/screens/test.png')).toBe('test.png');
    });

    it('should handle full URLs', () => {
      expect(getFilename('http://localhost/uploads/test.png')).toBe('test.png');
    });
  });

  describe('parseTimeToSeconds (private)', () => {
    const parse = (v: string) => (service as any).parseTimeToSeconds(v);

    it('parses valid HH:MM values', () => {
      expect(parse('00:00')).toBe(0);
      expect(parse('07:00')).toBe(25200);
      expect(parse('22:30')).toBe(81000);
      expect(parse('23:59')).toBe(86340);
    });

    it('returns null for invalid values', () => {
      expect(parse('24:00')).toBeNull();
      expect(parse('7:00')).toBeNull();
      expect(parse('12:60')).toBeNull();
      expect(parse('foo')).toBeNull();
    });
  });

  describe('getQuietHoursSeconds (private)', () => {
    const quiet = (device: any) => (service as any).getQuietHoursSeconds(device);
    // Build an "HH:MM" string offset by a number of minutes from current UTC time.
    const hhmmFromNowOffset = (offsetMin: number) => {
      const now = new Date();
      const total = ((now.getUTCHours() * 60 + now.getUTCMinutes() + offsetMin) % 1440 + 1440) % 1440;
      const h = Math.floor(total / 60);
      const m = total % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    it('returns null when sleep times are missing', () => {
      expect(quiet({ sleepStartAt: null, sleepStopAt: null })).toBeNull();
      expect(quiet({ sleepStartAt: '22:00', sleepStopAt: null })).toBeNull();
    });

    it('returns null when start equals stop', () => {
      expect(quiet({ sleepStartAt: '07:00', sleepStopAt: '07:00' })).toBeNull();
    });

    it('returns null when now is outside the window', () => {
      const device = {
        sleepStartAt: hhmmFromNowOffset(120),
        sleepStopAt: hhmmFromNowOffset(240),
      };
      expect(quiet(device)).toBeNull();
    });

    it('returns seconds-until-wake when now is inside the window', () => {
      const device = {
        sleepStartAt: hhmmFromNowOffset(-60), // started 1h ago
        sleepStopAt: hhmmFromNowOffset(120), // ends in 2h
      };
      const result = quiet(device);
      expect(result).not.toBeNull();
      // ~2h until wake (+60s buffer), with slack for the current seconds-in-minute
      expect(result).toBeGreaterThan(2 * 3600 - 120);
      expect(result).toBeLessThanOrEqual(2 * 3600 + 120);
    });

    it('handles windows that wrap past midnight and caps at 24h', () => {
      const device = {
        sleepStartAt: hhmmFromNowOffset(-30),
        sleepStopAt: hhmmFromNowOffset(30),
      };
      const result = quiet(device);
      expect(result).not.toBeNull();
      expect(result).toBeLessThanOrEqual(86400);
    });
  });

  describe('getDisplayContent - quiet hours', () => {
    const windowAroundNow = () => {
      const hhmm = (offsetMin: number) => {
        const now = new Date();
        const total = ((now.getUTCHours() * 60 + now.getUTCMinutes() + offsetMin) % 1440 + 1440) % 1440;
        return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
      };
      return { start: hhmm(-60), stop: hhmm(120) };
    };

    it('serves the sleep screen during quiet hours when showSleepScreen is true', async () => {
      const { start, stop } = windowAroundNow();
      mockPrisma.device.findFirst.mockResolvedValue({
        id: 1, name: 'Test', playlist: null, refreshRate: 900, refreshPending: false,
        width: 800, height: 480, sleepStartAt: start, sleepStopAt: stop, showSleepScreen: true,
      });
      mockPrisma.device.update.mockResolvedValue({ id: 1, battery: 80, wifi: -50 });
      mockPrisma.firmware.findFirst.mockResolvedValue(null);

      const result = await service.getDisplayContent('test-key');
      expect(result.image_url).toContain('/assets/sleep-');
      expect(mockSleepScreenService.getSleepScreen.calls.length).toBe(1);
      expect(result.update_firmware).toBe(false);
      expect(result.refresh_rate).toBeGreaterThan(2 * 3600 - 120);
    });

    it('freezes the current screen during quiet hours when showSleepScreen is false', async () => {
      const { start, stop } = windowAroundNow();
      mockPrisma.device.findFirst.mockResolvedValue({
        id: 1, name: 'Test',
        playlist: { items: [{ duration: 60, screen: { id: 9, name: 'S', imageUrl: '/uploads/s.png' } }] },
        refreshRate: 900, refreshPending: false,
        width: 800, height: 480, sleepStartAt: start, sleepStopAt: stop, showSleepScreen: false,
      });
      mockPrisma.device.update.mockResolvedValue({ id: 1, battery: 80, wifi: -50 });
      mockPrisma.firmware.findFirst.mockResolvedValue(null);

      const result = await service.getDisplayContent('test-key');
      // Keeps the current screen (no sleep screen) ...
      expect(result.image_url).toContain('/uploads/s.png');
      expect(mockSleepScreenService.getSleepScreen.calls.length).toBe(0);
      // ... but sleeps until the wake time (long refresh rate)
      expect(result.refresh_rate).toBeGreaterThan(2 * 3600 - 120);
    });

    it('uses normal refresh_rate outside quiet hours', async () => {
      const hhmm = (offsetMin: number) => {
        const now = new Date();
        const total = ((now.getUTCHours() * 60 + now.getUTCMinutes() + offsetMin) % 1440 + 1440) % 1440;
        return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
      };
      mockPrisma.device.findFirst.mockResolvedValue({
        id: 1, name: 'Test',
        playlist: { items: [{ duration: 120, screen: { id: 9, name: 'S', imageUrl: '/uploads/s.png' } }] },
        refreshRate: 900, refreshPending: false,
        width: 800, height: 480, sleepStartAt: hhmm(120), sleepStopAt: hhmm(240), showSleepScreen: true,
      });
      mockPrisma.device.update.mockResolvedValue({ id: 1, battery: 80, wifi: -50 });
      mockPrisma.firmware.findFirst.mockResolvedValue(null);

      const result = await service.getDisplayContent('test-key');
      expect(result.image_url).toContain('/uploads/s.png');
      expect(mockSleepScreenService.getSleepScreen.calls.length).toBe(0);
      expect(result.refresh_rate).toBe(120);
    });
  });

  describe('getDisplayContent - image format (issue #31)', () => {
    it('serves a 1-bit BMP default screen for an image/bmp model device', async () => {
      mockPrisma.device.findFirst.mockResolvedValue({
        id: 1, name: 'OG', playlist: null, refreshRate: 900, refreshPending: false,
        width: 800, height: 480, model: { mimeType: 'image/bmp', width: 800, height: 480 },
      });
      mockPrisma.device.update.mockResolvedValue({ id: 1, battery: null, wifi: null });
      mockPrisma.firmware.findFirst.mockResolvedValue(null);

      const result = await service.getDisplayContent('test-key');
      expect(result.image_url).toContain('/assets/default-screen-800x480.bmp');
      expect(result.filename).toMatch(/\.bmp$/);
      expect(mockDefaultScreenService.ensureDefaultScreenForSize.calls.length).toBe(1);
    });

    it('serves a PNG default screen sized to the device for a device with no model (default)', async () => {
      mockPrisma.device.findFirst.mockResolvedValue({
        id: 1, name: 'Default', playlist: null, refreshRate: 900, refreshPending: false,
        width: 800, height: 480,
      });
      mockPrisma.device.update.mockResolvedValue({ id: 1, battery: null, wifi: null });
      mockPrisma.firmware.findFirst.mockResolvedValue(null);

      const result = await service.getDisplayContent('test-key');
      expect(result.image_url).toContain('/assets/default-screen-800x480.png');
      expect(result.filename).toMatch(/\.png$/);
    });

    it('serves a device-sized 16-level grayscale PNG default screen for a TRMNL X (bitDepth 4)', async () => {
      mockPrisma.device.findFirst.mockResolvedValue({
        id: 1, name: 'X', playlist: null, refreshRate: 900, refreshPending: false,
        width: 1872, height: 1404,
        model: { mimeType: 'image/png', bitDepth: 4, width: 1872, height: 1404 },
      });
      mockPrisma.device.update.mockResolvedValue({ id: 1, battery: null, wifi: null });
      mockPrisma.firmware.findFirst.mockResolvedValue(null);

      const result = await service.getDisplayContent('test-key');
      expect(result.image_url).toContain('/assets/default-screen-1872x1404.png');
      expect(result.filename).toMatch(/\.png$/);
      const [w, h, fmt, depth] = mockDefaultScreenService.ensureDefaultScreenForSize.calls[0];
      expect([w, h, fmt, depth]).toEqual([1872, 1404, 'png', 4]);
    });

    it('appends bitDepth=4 (as PNG) to the designed-screen render URL for a TRMNL X', async () => {
      mockPrisma.device.findFirst.mockResolvedValue({
        id: 1, name: 'X', refreshRate: 900, refreshPending: false, width: 1872, height: 1404,
        model: { mimeType: 'image/png', bitDepth: 4, width: 1872, height: 1404 },
        playlist: { items: [{ duration: 60, screenDesign: { id: 7, name: 'D' } }] },
      });
      mockPrisma.device.update.mockResolvedValue({ id: 1, battery: null, wifi: null });
      mockPrisma.firmware.findFirst.mockResolvedValue(null);

      const result = await service.getDisplayContent('test-key');
      expect(result.image_url).toContain('/api/device-images/design/7');
      expect(result.image_url).toContain('bitDepth=4');
      expect(result.image_url).not.toContain('format=bmp');
      expect(result.filename).toMatch(/\.png$/);
    });

    it('appends format=bmp to the render URL and uses a .bmp filename for designed screens on bmp devices', async () => {
      mockPrisma.device.findFirst.mockResolvedValue({
        id: 1, name: 'OG', refreshRate: 900, refreshPending: false, width: 800, height: 480,
        model: { mimeType: 'image/bmp', width: 800, height: 480 },
        playlist: { items: [{ duration: 60, screenDesign: { id: 7, name: 'D' } }] },
      });
      mockPrisma.device.update.mockResolvedValue({ id: 1, battery: null, wifi: null });
      mockPrisma.firmware.findFirst.mockResolvedValue(null);

      const result = await service.getDisplayContent('test-key');
      expect(result.image_url).toContain('/api/device-images/design/7');
      expect(result.image_url).toContain('format=bmp');
      expect(result.filename).toMatch(/^design-7-\d+\.bmp$/);
    });

    it('keeps the PNG render URL (no format param) for designed screens on png devices', async () => {
      mockPrisma.device.findFirst.mockResolvedValue({
        id: 1, name: 'PNG', refreshRate: 900, refreshPending: false, width: 800, height: 480,
        model: { mimeType: 'image/png', width: 800, height: 480 },
        playlist: { items: [{ duration: 60, screenDesign: { id: 7, name: 'D' } }] },
      });
      mockPrisma.device.update.mockResolvedValue({ id: 1, battery: null, wifi: null });
      mockPrisma.firmware.findFirst.mockResolvedValue(null);

      const result = await service.getDisplayContent('test-key');
      expect(result.image_url).not.toContain('format=bmp');
      expect(result.filename).toMatch(/\.png$/);
    });

    it('routes uploaded screens through the BMP conversion endpoint for bmp devices', async () => {
      mockPrisma.device.findFirst.mockResolvedValue({
        id: 1, name: 'OG', refreshRate: 900, refreshPending: false, width: 800, height: 480,
        model: { mimeType: 'image/bmp', width: 800, height: 480 },
        playlist: { items: [{ duration: 60, screen: { id: 9, name: 'S', imageUrl: '/uploads/s.png' } }] },
      });
      mockPrisma.device.update.mockResolvedValue({ id: 1, battery: null, wifi: null });
      mockPrisma.firmware.findFirst.mockResolvedValue(null);

      const result = await service.getDisplayContent('test-key');
      expect(result.image_url).toContain('/api/device-images/screen/9');
      expect(result.image_url).toContain('format=bmp');
      expect(result.filename).toMatch(/\.bmp$/);
    });

    describe('Spectra 6 colour palette', () => {
      const deviceWith = (model: Record<string, unknown>, item: Record<string, unknown>) => ({
        id: 1, name: 'S6', refreshRate: 900, refreshPending: false, width: 800, height: 480,
        model: { width: 800, height: 480, bitDepth: 1, ...model },
        playlist: { items: [{ duration: 60, ...item }] },
      });
      const designItem = { screenDesign: { id: 7, name: 'D' } };
      const pluginItem = { pluginInstance: { id: 3, plugin: { slug: 'weather', name: 'Weather' } } };

      beforeEach(() => {
        mockPrisma.device.update.mockResolvedValue({ id: 1, battery: null, wifi: null });
        mockPrisma.firmware.findFirst.mockResolvedValue(null);
      });

      it('appends palette=spectra6 to the designed-screen render URL for a colors-6 PNG model', async () => {
        mockPrisma.device.findFirst.mockResolvedValue(deviceWith({ mimeType: 'image/png', colors: 6 }, designItem));
        const result = await service.getDisplayContent('test-key');
        expect(result.image_url).toContain('/api/device-images/design/7');
        expect(result.image_url).toContain('palette=spectra6');
        expect(result.image_url).not.toContain('bitDepth=');
        expect(result.filename).toMatch(/\.png$/);
      });

      it('appends palette=spectra6 to the plugin render URL for a colors-6 PNG model', async () => {
        mockPrisma.device.findFirst.mockResolvedValue(deviceWith({ mimeType: 'image/png', colors: 6 }, pluginItem));
        const result = await service.getDisplayContent('test-key');
        expect(result.image_url).toMatch(/\/api\/plugins\/instances\/3\/render\?mode=device&palette=spectra6&t=\d+$/);
      });

      it('does not append a palette for 1-bit or grayscale models', async () => {
        for (const model of [{ mimeType: 'image/png', colors: 2 }, { mimeType: 'image/png', colors: 16, bitDepth: 4 }]) {
          for (const item of [designItem, pluginItem]) {
            mockPrisma.device.findFirst.mockResolvedValue(deviceWith(model, item));
            const result = await service.getDisplayContent('test-key');
            expect(result.image_url).not.toContain('palette=');
          }
        }
      });

      it('does not append a palette for a colors-6 BMP model (colour BMP unsupported)', async () => {
        mockPrisma.device.findFirst.mockResolvedValue(deviceWith({ mimeType: 'image/bmp', colors: 6 }, designItem));
        const result = await service.getDisplayContent('test-key');
        expect(result.image_url).not.toContain('palette=');
        expect(result.image_url).toContain('format=bmp');
      });
    });
  });

  describe('getDisplayContent - TRMNL X touch advance-on-tap', () => {
    const xTouchDevice = (overrides: any = {}) => ({
      id: 1, name: 'X', refreshRate: 900, refreshPending: false, width: 1872, height: 1404,
      model: { name: 'trmnl_x', mimeType: 'image/png', bitDepth: 4, width: 1872, height: 1404 },
      playlist: {
        advanceOnTap: true,
        items: [
          { duration: 300, screen: { id: 11, name: 'A', imageUrl: '/uploads/a.png' } },
          { duration: 300, screen: { id: 12, name: 'B', imageUrl: '/uploads/b.png' } },
          { duration: null, screen: { id: 13, name: 'C', imageUrl: '/uploads/c.png' } },
        ],
      },
      lastScreenId: null, screenStartedAt: null,
      ...overrides,
    });

    it('shows the first item on the first poll and does not advance', async () => {
      mockPrisma.device.findFirst.mockResolvedValue(xTouchDevice());
      mockPrisma.device.update.mockResolvedValue({ id: 1, battery: null, wifi: null });
      mockPrisma.firmware.findFirst.mockResolvedValue(null);

      const result = await service.getDisplayContent('k');
      expect(result.image_url).toContain('/screen/11');
      expect(result.refresh_rate).toBe(300);
    });

    it('advances one screen on the next poll and uses the item duration as refresh_rate', async () => {
      mockPrisma.device.findFirst.mockResolvedValue(
        xTouchDevice({ lastScreenId: 'screen-11', screenStartedAt: new Date(Date.now() - 10_000) }),
      );
      mockPrisma.device.update.mockResolvedValue({ id: 1, battery: null, wifi: null });
      mockPrisma.firmware.findFirst.mockResolvedValue(null);

      const result = await service.getDisplayContent('k');
      expect(result.image_url).toContain('/screen/12'); // A -> B
      expect(result.refresh_rate).toBe(300);
    });

    it('an untimed screen advances on an early poll (a tap)', async () => {
      mockPrisma.device.findFirst.mockResolvedValue(
        xTouchDevice({ lastScreenId: 'screen-13', screenStartedAt: new Date(Date.now() - 5_000) }),
      );
      mockPrisma.device.update.mockResolvedValue({ id: 1, battery: null, wifi: null });
      mockPrisma.firmware.findFirst.mockResolvedValue(null);

      // reported refresh-rate was the long STAY value; a 5s-old poll is clearly early → advance C -> A(wrap)
      const result = await service.getDisplayContent('k', false, undefined, undefined, undefined, { reportedRefreshRate: 86400 });
      expect(result.image_url).toContain('/screen/11');
      expect(result.refresh_rate).toBe(300);
    });

    it('an untimed screen stays on a full-length (timer) poll and serves the long STAY refresh', async () => {
      mockPrisma.device.findFirst.mockResolvedValue(
        xTouchDevice({ lastScreenId: 'screen-13', screenStartedAt: new Date(Date.now() - 86400_000) }),
      );
      mockPrisma.device.update.mockResolvedValue({ id: 1, battery: null, wifi: null });
      mockPrisma.firmware.findFirst.mockResolvedValue(null);

      const result = await service.getDisplayContent('k', false, undefined, undefined, undefined, { reportedRefreshRate: 86400 });
      expect(result.image_url).toContain('/screen/13'); // stays on C
      expect(result.refresh_rate).toBe(86400);
    });

    it('does NOT advance-per-poll for a non-touch device or a playlist without advanceOnTap', async () => {
      // advanceOnTap off → falls back to duration-based rotation; mid-duration poll keeps the same screen
      mockPrisma.device.findFirst.mockResolvedValue(
        xTouchDevice({
          playlist: { advanceOnTap: false, items: [
            { duration: 300, screen: { id: 11, name: 'A', imageUrl: '/uploads/a.png' } },
            { duration: 300, screen: { id: 12, name: 'B', imageUrl: '/uploads/b.png' } },
          ] },
          lastScreenId: 'screen-11', screenStartedAt: new Date(Date.now() - 10_000),
        }),
      );
      mockPrisma.device.update.mockResolvedValue({ id: 1, battery: null, wifi: null });
      mockPrisma.firmware.findFirst.mockResolvedValue(null);

      const result = await service.getDisplayContent('k');
      expect(result.image_url).toContain('/screen/11'); // stayed (only 10s of 300s elapsed)
    });
  });
});
