import { describe, it, expect, beforeEach } from 'bun:test';
import { DashboardService } from './dashboard.service';
import { createMockPrisma, MockPrisma } from '../test/mocks/prisma.mock';

describe('DashboardService', () => {
  let service: DashboardService;
  let mockPrisma: MockPrisma;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    service = new DashboardService(mockPrisma as any);
  });

  // ─── getStats ────────────────────────────────────────────────────────

  describe('getStats()', () => {
    it('should return all counts and recent items', async () => {
      mockPrisma.device.count.mockImplementation((...args: any[]) => {
        // First call: totalDevices (no args), second call: onlineDevices (with where)
        if (args.length === 0 || !args[0]?.where) return Promise.resolve(10);
        return Promise.resolve(3);
      });
      mockPrisma.screenDesign.count.mockResolvedValue(5);
      mockPrisma.playlist.count.mockResolvedValue(2);

      const recentDevices = [
        { id: 1, name: 'Dev1', macAddress: 'AA:BB', lastSeenAt: new Date(), createdAt: new Date(), battery: 90, wifi: -30 },
      ];
      const recentScreens = [
        { id: 1, name: 'Screen1', description: null, createdAt: new Date() },
      ];
      mockPrisma.device.findMany.mockResolvedValue(recentDevices);
      mockPrisma.screenDesign.findMany.mockResolvedValue(recentScreens);

      const stats = await service.getStats();
      expect(stats.totalDevices).toBe(10);
      expect(stats.onlineDevices).toBe(3);
      expect(stats.totalScreens).toBe(5);
      expect(stats.totalPlaylists).toBe(2);
      expect(stats.recentDevices).toHaveLength(1);
      expect(stats.recentDevices[0].status).toBe('online');
      expect(stats.recentScreens).toHaveLength(1);
    });
  });

  // ─── getDeviceStatus (private) ──────────────────────────────────────

  describe('getDeviceStatus()', () => {
    const getStatus = (lastSeenAt: Date | null, threshold: Date) =>
      (service as any).getDeviceStatus(lastSeenAt, threshold);

    it('should return offline when lastSeenAt is null', () => {
      const threshold = new Date();
      expect(getStatus(null, threshold)).toBe('offline');
    });

    it('should return online when lastSeenAt is recent', () => {
      const now = new Date();
      const threshold = new Date(now.getTime() - 5 * 60 * 1000);
      expect(getStatus(now, threshold)).toBe('online');
    });

    it('should return offline when lastSeenAt is older than threshold', () => {
      const threshold = new Date(Date.now() - 5 * 60 * 1000);
      const oldDate = new Date(Date.now() - 10 * 60 * 1000);
      expect(getStatus(oldDate, threshold)).toBe('offline');
    });
  });
});
