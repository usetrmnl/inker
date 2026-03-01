import { describe, it, expect, beforeEach } from 'bun:test';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { DevicesService } from './devices.service';
import { createMockPrisma, MockPrisma } from '../test/mocks/prisma.mock';
import { createMock } from '../test/mocks/helpers';

describe('DevicesService', () => {
  let service: DevicesService;
  let mockPrisma: MockPrisma;
  let mockEventsService: {
    notifyDevicesRefresh: ReturnType<typeof createMock>;
    notifyPlaylistUpdate: ReturnType<typeof createMock>;
  };

  // Helper to build a device-like object that serializeDevice can process
  const makeDevice = (overrides: Record<string, any> = {}) => ({
    id: 1,
    name: 'Test Device',
    macAddress: 'AA:BB:CC:DD:EE:FF',
    apiKey: 'test-api-key',
    isActive: true,
    lastSeenAt: new Date(),
    refreshRate: 900,
    model: { name: 'og_png' },
    playlist: null,
    ...overrides,
  });

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    mockEventsService = {
      notifyDevicesRefresh: createMock().mockResolvedValue(undefined),
      notifyPlaylistUpdate: createMock().mockResolvedValue(undefined),
    };
    service = new DevicesService(mockPrisma as any, mockEventsService as any);
  });

  // ─── create ─────────────────────────────────────────────────────────

  describe('create()', () => {
    it('should throw BadRequestException when MAC already exists', async () => {
      mockPrisma.device.findUnique.mockResolvedValue(makeDevice());

      await expect(
        service.create({ name: 'New', macAddress: 'AA:BB:CC:DD:EE:FF' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should clean up blocked device before creating', async () => {
      mockPrisma.device.findUnique.mockResolvedValue(null);
      mockPrisma.blockedDevice.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.device.create.mockResolvedValue(makeDevice());

      await service.create({
        name: 'New Device',
        macAddress: 'AA:BB:CC:DD:EE:FF',
      } as any);

      expect(mockPrisma.blockedDevice.deleteMany.calls).toHaveLength(1);
      expect(mockPrisma.blockedDevice.deleteMany.calls[0][0].where.macAddress).toBe(
        'AA:BB:CC:DD:EE:FF',
      );
    });

    it('should create device with generated API key', async () => {
      mockPrisma.device.findUnique.mockResolvedValue(null);
      mockPrisma.blockedDevice.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.device.create.mockResolvedValue(makeDevice());

      const result = await service.create({
        name: 'New Device',
        macAddress: 'AA:BB:CC:DD:EE:FF',
      } as any);

      expect(mockPrisma.device.create.calls).toHaveLength(1);
      // serializeDevice adds status and isOnline
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('isOnline');
    });
  });

  // ─── findOne ────────────────────────────────────────────────────────

  describe('findOne()', () => {
    it('should throw NotFoundException when device not found', async () => {
      mockPrisma.device.findUnique.mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });

    it('should return serialized device when found', async () => {
      const device = makeDevice();
      mockPrisma.device.findUnique.mockResolvedValue(device);

      const result = await service.findOne(1);

      expect(result.id).toBe(1);
      expect(result.name).toBe('Test Device');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('isOnline');
    });
  });

  // ─── update ─────────────────────────────────────────────────────────

  describe('update()', () => {
    it('should throw NotFoundException when device not found', async () => {
      mockPrisma.device.findUnique.mockResolvedValue(null);

      await expect(service.update(999, { name: 'Updated' } as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when changing to existing MAC', async () => {
      const device = makeDevice();
      mockPrisma.device.findUnique
        .mockImplementation((...args: any[]) => {
          const where = args[0]?.where;
          if (where?.id) return Promise.resolve(device);
          if (where?.macAddress) return Promise.resolve(makeDevice({ id: 2 }));
          return Promise.resolve(null);
        });

      await expect(
        service.update(1, { macAddress: '11:22:33:44:55:66' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should set refreshPending when playlist changes', async () => {
      const device = makeDevice({ playlistId: 1 });
      const updatedDevice = makeDevice({ playlistId: 2, refreshPending: true });

      mockPrisma.device.findUnique.mockResolvedValue(device);
      mockPrisma.device.update.mockResolvedValue(updatedDevice);

      await service.update(1, { playlistId: 2 } as any);

      const updateCall = mockPrisma.device.update.calls[0][0];
      expect(updateCall.data.refreshPending).toBe(true);
    });

    it('should call eventsService.notifyDevicesRefresh on playlist change', async () => {
      const device = makeDevice({ playlistId: 1 });
      const updatedDevice = makeDevice({ playlistId: 2 });

      mockPrisma.device.findUnique.mockResolvedValue(device);
      mockPrisma.device.update.mockResolvedValue(updatedDevice);

      await service.update(1, { playlistId: 2 } as any);

      expect(mockEventsService.notifyDevicesRefresh.calls).toHaveLength(1);
      expect(mockEventsService.notifyDevicesRefresh.calls[0][0]).toEqual([1]);
    });

    it('should NOT notify when playlist does not change', async () => {
      const device = makeDevice({ playlistId: 1 });
      mockPrisma.device.findUnique.mockResolvedValue(device);
      mockPrisma.device.update.mockResolvedValue(makeDevice({ name: 'Renamed' }));

      await service.update(1, { name: 'Renamed' } as any);

      expect(mockEventsService.notifyDevicesRefresh.calls).toHaveLength(0);
    });
  });

  // ─── remove ─────────────────────────────────────────────────────────

  describe('remove()', () => {
    it('should throw NotFoundException when device not found', async () => {
      mockPrisma.device.findUnique.mockResolvedValue(null);
      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });

    it('should add MAC to blocked list', async () => {
      mockPrisma.device.findUnique.mockResolvedValue(makeDevice());
      mockPrisma.blockedDevice.upsert.mockResolvedValue({});
      mockPrisma.device.delete.mockResolvedValue({});

      await service.remove(1);

      expect(mockPrisma.blockedDevice.upsert.calls).toHaveLength(1);
      expect(mockPrisma.blockedDevice.upsert.calls[0][0].where.macAddress).toBe(
        'AA:BB:CC:DD:EE:FF',
      );
    });

    it('should delete the device', async () => {
      mockPrisma.device.findUnique.mockResolvedValue(makeDevice());
      mockPrisma.blockedDevice.upsert.mockResolvedValue({});
      mockPrisma.device.delete.mockResolvedValue({});

      const result = await service.remove(1);

      expect(mockPrisma.device.delete.calls).toHaveLength(1);
      expect(result.message).toBe('Device deleted successfully');
    });
  });

  // ─── triggerRefresh ─────────────────────────────────────────────────

  describe('triggerRefresh()', () => {
    it('should throw NotFoundException when device not found', async () => {
      mockPrisma.device.findUnique.mockResolvedValue(null);
      await expect(service.triggerRefresh(999)).rejects.toThrow(NotFoundException);
    });

    it('should set refreshPending and call notifyDevicesRefresh', async () => {
      mockPrisma.device.findUnique.mockResolvedValue(makeDevice());
      mockPrisma.device.update.mockResolvedValue({});

      const result = await service.triggerRefresh(1);

      expect(mockPrisma.device.update.calls).toHaveLength(1);
      expect(mockPrisma.device.update.calls[0][0].data.refreshPending).toBe(true);
      expect(mockEventsService.notifyDevicesRefresh.calls).toHaveLength(1);
      expect(mockEventsService.notifyDevicesRefresh.calls[0][0]).toEqual([1]);
      expect(result.message).toBe('Device refresh triggered');
    });
  });

  // ─── unassignPlaylist ───────────────────────────────────────────────

  describe('unassignPlaylist()', () => {
    it('should throw NotFoundException when device not found', async () => {
      mockPrisma.device.findUnique.mockResolvedValue(null);
      await expect(service.unassignPlaylist(999)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when no playlist assigned', async () => {
      mockPrisma.device.findUnique.mockResolvedValue(
        makeDevice({ playlistId: null, playlist: null }),
      );

      await expect(service.unassignPlaylist(1)).rejects.toThrow(BadRequestException);
    });

    it('should unassign playlist and trigger refresh', async () => {
      const device = makeDevice({
        playlistId: 5,
        playlist: { id: 5, name: 'My Playlist' },
      });

      mockPrisma.device.findUnique.mockResolvedValue(device);
      mockPrisma.device.update.mockResolvedValue(
        makeDevice({ playlistId: null, playlist: null }),
      );

      const result = await service.unassignPlaylist(1);

      expect(mockPrisma.device.update.calls[0][0].data.playlistId).toBeNull();
      expect(mockPrisma.device.update.calls[0][0].data.refreshPending).toBe(true);
      expect(mockEventsService.notifyDevicesRefresh.calls).toHaveLength(1);
      expect(result.message).toBe('Playlist unassigned successfully');
    });
  });

  // ─── getDisplayContent ──────────────────────────────────────────────

  describe('getDisplayContent()', () => {
    it('should throw NotFoundException when device not found', async () => {
      mockPrisma.device.findUnique.mockResolvedValue(null);
      await expect(service.getDisplayContent('bad-key')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when device is inactive', async () => {
      mockPrisma.device.findUnique.mockResolvedValue(
        makeDevice({ isActive: false }),
      );

      await expect(service.getDisplayContent('test-api-key')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
