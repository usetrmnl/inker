import { describe, it, expect, beforeEach } from 'bun:test';
import { DisplayService } from './display.service';
import { createMockPrisma } from '../../test/mocks/prisma.mock';
import { createMock } from '../../test/mocks/helpers';

describe('DisplayService', () => {
  let service: DisplayService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;
  let mockConfig: any;
  let mockDefaultScreenService: any;
  let mockScreenRendererService: any;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    mockConfig = { get: createMock().mockReturnValue('http://localhost:3002') };
    mockDefaultScreenService = {
      getDefaultScreenUrl: createMock().mockReturnValue('/uploads/default-screen.png'),
      getDefaultScreenBase64: createMock().mockResolvedValue('base64data'),
      getDefaultScreenBuffer: createMock().mockResolvedValue(Buffer.from('PNG')),
    };
    mockScreenRendererService = {
      renderScreenDesign: createMock().mockResolvedValue(Buffer.from('PNG')),
    };
    service = new DisplayService(
      mockPrisma as any,
      mockConfig,
      mockDefaultScreenService,
      mockScreenRendererService,
    );
  });

  describe('getCurrentScreen (private)', () => {
    const getCurrentScreen = (items: any[]) =>
      (service as any).getCurrentScreen(items);

    it('should return null for empty items', () => {
      expect(getCurrentScreen([])).toBeNull();
      expect(getCurrentScreen(null)).toBeNull();
    });

    it('should default duration to 60 when duration is 0 (falsy)', () => {
      // duration 0 is falsy, so `item.duration || 60` defaults to 60
      const items = [{ id: 1, duration: 0 }];
      const result = getCurrentScreen(items);
      expect(result.item.id).toBe(1);
      expect(result.remainingTime).toBeGreaterThan(0);
      expect(result.remainingTime).toBeLessThanOrEqual(60);
    });

    it('should return single item with calculated remaining time', () => {
      const items = [{ id: 1, duration: 60 }];
      const result = getCurrentScreen(items);
      expect(result.item.id).toBe(1);
      expect(result.remainingTime).toBeGreaterThan(0);
      expect(result.remainingTime).toBeLessThanOrEqual(60);
    });

    it('should default duration to 60 when not set', () => {
      const items = [{ id: 1 }];
      const result = getCurrentScreen(items);
      expect(result.item.id).toBe(1);
      expect(result.remainingTime).toBeGreaterThan(0);
      expect(result.remainingTime).toBeLessThanOrEqual(60);
    });

    it('should rotate through multiple screens based on time', () => {
      const items = [
        { id: 1, duration: 30 },
        { id: 2, duration: 30 },
      ];
      const result = getCurrentScreen(items);
      expect(result).not.toBeNull();
      expect([1, 2]).toContain(result.item.id);
      expect(result.remainingTime).toBeGreaterThan(0);
      expect(result.remainingTime).toBeLessThanOrEqual(30);
    });
  });

  describe('hasTimeSensitiveWidgets (private)', () => {
    const hasTimeSensitive = (design: any) =>
      (service as any).hasTimeSensitiveWidgets(design);

    it('should return false for null/empty design', () => {
      expect(hasTimeSensitive(null)).toBe(false);
      expect(hasTimeSensitive({})).toBe(false);
      expect(hasTimeSensitive({ widgets: [] })).toBe(false);
    });

    it('should return true for clock widget', () => {
      expect(hasTimeSensitive({
        widgets: [{ template: { name: 'clock' } }],
      })).toBe(true);
    });

    it('should return true for countdown widget', () => {
      expect(hasTimeSensitive({
        widgets: [{ template: { name: 'countdown' } }],
      })).toBe(true);
    });

    it('should return true for date widget', () => {
      expect(hasTimeSensitive({
        widgets: [{ template: { name: 'date' } }],
      })).toBe(true);
    });

    it('should return false for non-time widgets', () => {
      expect(hasTimeSensitive({
        widgets: [{ template: { name: 'text' } }, { template: { name: 'weather' } }],
      })).toBe(false);
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
    const getRate = (screen: any, deviceRate: number, immediate: boolean, remaining: number) =>
      (service as any).getRefreshRateForScreen(screen, deviceRate, immediate, remaining);

    it('should return 1 when shouldRefreshImmediately is true', () => {
      expect(getRate({}, 900, true, 60)).toBe(1);
    });

    it('should return device refresh rate for normal screens', () => {
      const screen = { screenDesign: { widgets: [{ template: { name: 'text' } }] } };
      expect(getRate(screen, 900, false, 1000)).toBe(900);
    });

    it('should return 60 for time-sensitive (non-clock) widgets', () => {
      const screen = { screenDesign: { widgets: [{ template: { name: 'countdown' } }] } };
      expect(getRate(screen, 900, false, 1000)).toBe(60);
    });

    it('should calculate clock refresh based on seconds until next minute', () => {
      const screen = { screenDesign: { widgets: [{ template: { name: 'clock' } }] } };
      const rate = getRate(screen, 900, false, 1000);
      // Should be between 4 (0 seconds into minute + 3 buffer) and 63 (59 seconds + 3 + cap)
      expect(rate).toBeGreaterThanOrEqual(4);
      expect(rate).toBeLessThanOrEqual(63);
    });

    it('should cap at remaining time when remaining is smaller', () => {
      const screen = { screenDesign: { widgets: [{ template: { name: 'text' } }] } };
      expect(getRate(screen, 900, false, 30)).toBe(30);
    });
  });

  describe('getNextRefreshTimestamp', () => {
    it('should return ~1 second from now when immediate', () => {
      const screen = {};
      const ts = service.getNextRefreshTimestamp(screen, 900, true, 60);
      expect(ts).not.toBeNull();
      expect(ts! - Date.now()).toBeLessThanOrEqual(2000);
    });

    it('should return device refresh rate ms from now for normal screens', () => {
      const screen = { screenDesign: { widgets: [{ template: { name: 'text' } }] } };
      const ts = service.getNextRefreshTimestamp(screen, 900, false, 1000);
      const diff = ts! - Date.now();
      // Should be approximately 900 seconds from now
      expect(diff).toBeGreaterThan(899000);
      expect(diff).toBeLessThan(901000);
    });

    it('should cap by remaining time', () => {
      const screen = { screenDesign: { widgets: [{ template: { name: 'text' } }] } };
      const ts = service.getNextRefreshTimestamp(screen, 900, false, 30);
      const diff = ts! - Date.now();
      expect(diff).toBeLessThanOrEqual(31000);
    });
  });

  describe('getFirmwareUpdateUrl (private)', () => {
    const getFirmware = (version?: string) =>
      (service as any).getFirmwareUpdateUrl(version);

    it('should return empty string when no current version', async () => {
      expect(await getFirmware(undefined)).toBe('');
    });

    it('should return empty string when no stable firmware exists', async () => {
      mockPrisma.firmware.findFirst.mockResolvedValue(null);
      expect(await getFirmware('1.0.0')).toBe('');
    });

    it('should return empty string when versions match', async () => {
      mockPrisma.firmware.findFirst.mockResolvedValue({ version: '1.0.0', downloadUrl: 'http://fw.bin' });
      expect(await getFirmware('1.0.0')).toBe('');
    });

    it('should return download URL when version differs', async () => {
      mockPrisma.firmware.findFirst.mockResolvedValue({ version: '2.0.0', downloadUrl: 'http://fw.bin' });
      expect(await getFirmware('1.0.0')).toBe('http://fw.bin');
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

    it('should return refresh_rate 1 when refreshPending is true', async () => {
      mockPrisma.device.findFirst.mockResolvedValue({
        id: 1, name: 'Test', playlist: null, refreshRate: 900, refreshPending: true,
      });
      mockPrisma.device.update.mockResolvedValue({ id: 1, battery: 80, wifi: -51 });
      mockPrisma.firmware.findFirst.mockResolvedValue(null);

      const result = await service.getDisplayContent('test-key', false, { battery: 80, wifi: -51 });
      expect(result.refresh_rate).toBe(1);
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
});
