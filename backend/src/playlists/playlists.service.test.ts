import { describe, it, expect, beforeEach } from 'bun:test';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PlaylistsService } from './playlists.service';
import { createMockPrisma, MockPrisma } from '../test/mocks/prisma.mock';
import { createMock } from '../test/mocks/helpers';

describe('PlaylistsService', () => {
  let service: PlaylistsService;
  let mockPrisma: MockPrisma;
  let mockEventsService: {
    notifyDevicesRefresh: ReturnType<typeof createMock>;
    notifyPlaylistUpdate: ReturnType<typeof createMock>;
  };

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    // Add createMany (not in default mock) - used by playlist item batch creation
    (mockPrisma.playlistItem as any).createMany = createMock();
    mockEventsService = {
      notifyDevicesRefresh: createMock().mockResolvedValue(undefined),
      notifyPlaylistUpdate: createMock().mockResolvedValue(undefined),
    };
    service = new PlaylistsService(mockPrisma as any, mockEventsService as any);
  });

  // ─── create ─────────────────────────────────────────────────────────

  describe('create()', () => {
    it('should create a basic playlist without screens', async () => {
      const playlist = {
        id: 1,
        name: 'My Playlist',
        description: 'Test',
        isActive: true,
        items: [],
      };
      mockPrisma.playlist.create.mockResolvedValue(playlist);

      const result = await service.create({ name: 'My Playlist', description: 'Test' } as any);

      expect(result).toEqual(playlist);
      expect(mockPrisma.playlist.create.calls).toHaveLength(1);
    });

    it('should create playlist with screens and verify items', async () => {
      const playlist = { id: 1, name: 'With Screens', isActive: true, items: [] };
      mockPrisma.playlist.create.mockResolvedValue(playlist);
      mockPrisma.screen.findMany.mockResolvedValue([{ id: 10 }]);
      mockPrisma.screenDesign.findMany.mockResolvedValue([]);
      mockPrisma.playlistItem.createMany.mockResolvedValue({ count: 1 });
      mockPrisma.playlist.findUnique.mockResolvedValue({
        ...playlist,
        items: [{ screen: { id: 10, name: 'Screen 1' }, order: 0, duration: 60 }],
      });

      const result = await service.create({
        name: 'With Screens',
        screens: [{ screenId: 10, order: 0, duration: 60 }],
      } as any);

      expect(mockPrisma.playlistItem.createMany.calls).toHaveLength(1);
      expect(result.items).toHaveLength(1);
    });
  });

  // ─── findOne ────────────────────────────────────────────────────────

  describe('findOne()', () => {
    it('should throw NotFoundException when playlist not found', async () => {
      mockPrisma.playlist.findUnique.mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });

    it('should transform screenDesign items to screens array', async () => {
      mockPrisma.playlist.findUnique.mockResolvedValue({
        id: 1,
        name: 'Test',
        items: [
          {
            screenDesign: { id: 5, name: 'Design Screen', description: 'A design' },
            screen: null,
            duration: 30,
            order: 0,
          },
        ],
        devices: [],
      });

      const result = await service.findOne(1);

      expect(result.screens).toHaveLength(1);
      expect(result.screens[0].id).toBe('design-5');
      expect(result.screens[0].isDesigned).toBe(true);
      expect(result.screens[0].imageUrl).toContain('/api/device-images/design/5');
    });

    it('should transform regular screen items to screens array', async () => {
      mockPrisma.playlist.findUnique.mockResolvedValue({
        id: 1,
        name: 'Test',
        items: [
          {
            screenDesign: null,
            screen: {
              id: 10,
              name: 'Regular Screen',
              description: 'desc',
              thumbnailUrl: '/thumb.png',
              imageUrl: '/image.png',
            },
            duration: 60,
            order: 0,
          },
        ],
        devices: [],
      });

      const result = await service.findOne(1);

      expect(result.screens).toHaveLength(1);
      expect(result.screens[0].id).toBe(10);
      expect(result.screens[0].isDesigned).toBe(false);
      expect(result.screens[0].imageUrl).toBe('/image.png');
    });
  });

  // ─── update ─────────────────────────────────────────────────────────

  describe('update()', () => {
    it('should throw NotFoundException when playlist not found', async () => {
      mockPrisma.playlist.findUnique.mockResolvedValue(null);
      await expect(service.update(999, { name: 'Updated' } as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should prevent deactivation when devices are assigned', async () => {
      mockPrisma.playlist.findUnique.mockResolvedValue({
        id: 1,
        name: 'Active Playlist',
        _count: { devices: 3 },
      });

      await expect(
        service.update(1, { isActive: false } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should update screens by deleting old and creating new items', async () => {
      mockPrisma.playlist.findUnique
        .mockImplementation((...args: any[]) => {
          // First call: check existence
          if (mockPrisma.playlist.findUnique.calls.length <= 1) {
            return Promise.resolve({
              id: 1,
              name: 'Playlist',
              _count: { devices: 0 },
            });
          }
          // Second call: refetch after update
          return Promise.resolve({
            id: 1,
            name: 'Playlist',
            items: [
              {
                screen: { id: 20, name: 'New Screen', description: null, thumbnailUrl: null, imageUrl: '/new.png' },
                screenDesign: null,
                duration: 45,
                order: 0,
              },
            ],
          });
        });

      mockPrisma.playlist.update.mockResolvedValue({
        id: 1,
        name: 'Playlist',
        items: [],
      });
      mockPrisma.playlistItem.deleteMany.mockResolvedValue({ count: 2 });
      mockPrisma.screen.findMany.mockResolvedValue([{ id: 20 }]);
      mockPrisma.screenDesign.findMany.mockResolvedValue([]);
      mockPrisma.playlistItem.createMany.mockResolvedValue({ count: 1 });

      await service.update(1, {
        name: 'Playlist',
        screens: [{ screenId: 20, order: 0, duration: 45 }],
      } as any);

      expect(mockPrisma.playlistItem.deleteMany.calls).toHaveLength(1);
      expect(mockPrisma.playlistItem.createMany.calls).toHaveLength(1);
      expect(mockEventsService.notifyPlaylistUpdate.calls).toHaveLength(1);
    });

    it('should notify playlist update even without screen changes', async () => {
      mockPrisma.playlist.findUnique.mockResolvedValue({
        id: 1,
        name: 'Playlist',
        _count: { devices: 0 },
      });
      mockPrisma.playlist.update.mockResolvedValue({
        id: 1,
        name: 'Renamed',
        items: [],
      });

      await service.update(1, { name: 'Renamed' } as any);

      expect(mockEventsService.notifyPlaylistUpdate.calls).toHaveLength(1);
    });
  });

  // ─── remove ─────────────────────────────────────────────────────────

  describe('remove()', () => {
    it('should throw NotFoundException when playlist not found', async () => {
      mockPrisma.playlist.findUnique.mockResolvedValue(null);
      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when devices assigned without force', async () => {
      mockPrisma.playlist.findUnique.mockResolvedValue({
        id: 1,
        name: 'In Use',
        devices: [{ id: 1 }],
        _count: { devices: 1 },
      });

      await expect(service.remove(1, false)).rejects.toThrow(BadRequestException);
    });

    it('should force-delete by unassigning devices first', async () => {
      mockPrisma.playlist.findUnique.mockResolvedValue({
        id: 1,
        name: 'Force Delete',
        devices: [{ id: 10 }, { id: 20 }],
        _count: { devices: 2 },
      });
      mockPrisma.device.updateMany.mockResolvedValue({ count: 2 });
      mockPrisma.playlist.delete.mockResolvedValue({});

      const result = await service.remove(1, true);

      expect(mockPrisma.device.updateMany.calls).toHaveLength(1);
      expect(mockPrisma.device.updateMany.calls[0][0].data.playlistId).toBeNull();
      expect(mockEventsService.notifyDevicesRefresh.calls).toHaveLength(1);
      expect(mockEventsService.notifyDevicesRefresh.calls[0][0]).toEqual([10, 20]);
      expect(mockPrisma.playlist.delete.calls).toHaveLength(1);
      expect(result.unassignedDevices).toBe(2);
    });

    it('should delete playlist with no assigned devices', async () => {
      mockPrisma.playlist.findUnique.mockResolvedValue({
        id: 1,
        name: 'Empty',
        devices: [],
        _count: { devices: 0 },
      });
      mockPrisma.playlist.delete.mockResolvedValue({});

      const result = await service.remove(1);

      expect(mockPrisma.playlist.delete.calls).toHaveLength(1);
      expect(result.message).toBe('Playlist deleted successfully');
      expect(result.unassignedDevices).toBe(0);
    });
  });

  // ─── addItem ────────────────────────────────────────────────────────

  describe('addItem()', () => {
    it('should throw NotFoundException when playlist not found', async () => {
      mockPrisma.playlist.findUnique.mockResolvedValue(null);

      await expect(
        service.addItem(999, { screenId: 1 } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when screen not found', async () => {
      mockPrisma.playlist.findUnique.mockResolvedValue({
        id: 1,
        name: 'Playlist',
        items: [],
      });
      mockPrisma.screen.findUnique.mockResolvedValue(null);

      await expect(
        service.addItem(1, { screenId: 999 } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when screen already in playlist', async () => {
      mockPrisma.playlist.findUnique.mockResolvedValue({
        id: 1,
        name: 'Playlist',
        items: [],
      });
      mockPrisma.screen.findUnique.mockResolvedValue({ id: 10, name: 'Screen' });
      mockPrisma.playlistItem.findFirst.mockResolvedValue({
        id: 1,
        playlistId: 1,
        screenId: 10,
      });

      await expect(
        service.addItem(1, { screenId: 10 } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── reorderItems ──────────────────────────────────────────────────

  describe('reorderItems()', () => {
    it('should throw NotFoundException when playlist not found', async () => {
      mockPrisma.playlist.findUnique.mockResolvedValue(null);

      await expect(
        service.reorderItems(999, [{ id: 1, order: 0 }]),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update order via transaction', async () => {
      mockPrisma.playlist.findUnique.mockResolvedValue({
        id: 1,
        name: 'Playlist',
      });
      // $transaction receives an array of promises when called with array argument
      mockPrisma.$transaction.mockResolvedValue([{}, {}]);

      const result = await service.reorderItems(1, [
        { id: 10, order: 0 },
        { id: 20, order: 1 },
      ]);

      expect(mockPrisma.$transaction.calls).toHaveLength(1);
      expect(result.message).toBe('Playlist items reordered successfully');
      expect(mockEventsService.notifyPlaylistUpdate.calls).toHaveLength(1);
    });
  });
});
