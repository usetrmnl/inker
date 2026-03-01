import { describe, it, expect, beforeEach } from 'bun:test';
import { NotFoundException } from '@nestjs/common';
import { ScreensService } from './screens.service';
import { createMockPrisma, MockPrisma } from '../test/mocks/prisma.mock';
import { createMock, MockFn } from '../test/mocks/helpers';

describe('ScreensService', () => {
  let service: ScreensService;
  let mockPrisma: MockPrisma;
  let mockScreenRenderer: { renderHtmlToPng: MockFn; renderUrlToPng: MockFn };
  let mockImageProcessor: { processForEinkWithDithering: MockFn; createThumbnail: MockFn };
  let mockEventsService: { notifyScreenUpdate: MockFn; notifyPlaylistUpdate: MockFn };

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    mockScreenRenderer = {
      renderHtmlToPng: createMock().mockResolvedValue(Buffer.from('png')),
      renderUrlToPng: createMock().mockResolvedValue(Buffer.from('png')),
    };
    mockImageProcessor = {
      processForEinkWithDithering: createMock(),
      createThumbnail: createMock(),
    };
    mockEventsService = {
      notifyScreenUpdate: createMock().mockResolvedValue(undefined),
      notifyPlaylistUpdate: createMock().mockResolvedValue(undefined),
    };

    service = new ScreensService(
      mockPrisma as any,
      mockScreenRenderer as any,
      mockImageProcessor as any,
      mockEventsService as any,
    );
  });

  // ─── create ──────────────────────────────────────────────────────────

  describe('create()', () => {
    it('should create a screen and return it', async () => {
      const dto = { name: 'Test Screen', description: 'desc', modelId: 1 };
      const created = { id: 1, ...dto };
      mockPrisma.screen.create.mockResolvedValue(created);

      const result = await service.create(dto as any);
      expect(result).toEqual(created);
      expect(mockPrisma.screen.create.calls).toHaveLength(1);
    });
  });

  // ─── findOne ─────────────────────────────────────────────────────────

  describe('findOne()', () => {
    it('should return screen when found', async () => {
      const screen = { id: 1, name: 'Screen', playlistItems: [] };
      mockPrisma.screen.findUnique.mockResolvedValue(screen);

      const result = await service.findOne(1);
      expect(result).toEqual(screen);
    });

    it('should throw NotFoundException when not found', async () => {
      mockPrisma.screen.findUnique.mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── update ──────────────────────────────────────────────────────────

  describe('update()', () => {
    it('should throw NotFoundException when screen does not exist', async () => {
      mockPrisma.screen.findUnique.mockResolvedValue(null);
      await expect(service.update(999, { name: 'New' } as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should update screen and notify', async () => {
      mockPrisma.screen.findUnique.mockResolvedValue({ id: 1 });
      const updated = { id: 1, name: 'Updated' };
      mockPrisma.screen.update.mockResolvedValue(updated);

      const result = await service.update(1, { name: 'Updated' } as any);
      expect(result).toEqual(updated);
      expect(mockEventsService.notifyScreenUpdate.calls).toHaveLength(1);
      expect(mockEventsService.notifyScreenUpdate.calls[0][0]).toBe(1);
    });
  });

  // ─── remove ──────────────────────────────────────────────────────────

  describe('remove()', () => {
    it('should throw NotFoundException when screen does not exist', async () => {
      mockPrisma.screen.findUnique.mockResolvedValue(null);
      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });

    it('should delete screen and notify affected playlists', async () => {
      mockPrisma.screen.findUnique.mockResolvedValue({
        id: 1,
        name: 'Screen',
        imageUrl: null,
        thumbnailUrl: null,
        _count: { playlistItems: 2 },
        playlistItems: [
          { playlistId: 10 },
          { playlistId: 20 },
          { playlistId: 10 }, // duplicate — should be deduplicated
        ],
      });
      mockPrisma.screen.delete.mockResolvedValue({});

      const result = await service.remove(1);
      expect(result.message).toBe('Screen deleted successfully');
      expect(result.affectedPlaylists).toBe(2);
      expect(mockPrisma.screen.delete.calls).toHaveLength(1);
      // Should notify each unique playlist
      expect(mockEventsService.notifyPlaylistUpdate.calls).toHaveLength(2);
      expect(mockEventsService.notifyPlaylistUpdate.calls[0][0]).toBe(10);
      expect(mockEventsService.notifyPlaylistUpdate.calls[1][0]).toBe(20);
    });

    it('should handle screen with no playlist items', async () => {
      mockPrisma.screen.findUnique.mockResolvedValue({
        id: 2,
        name: 'Orphan',
        imageUrl: null,
        thumbnailUrl: null,
        _count: { playlistItems: 0 },
        playlistItems: [],
      });
      mockPrisma.screen.delete.mockResolvedValue({});

      const result = await service.remove(2);
      expect(result.affectedPlaylists).toBe(0);
      expect(mockEventsService.notifyPlaylistUpdate.calls).toHaveLength(0);
    });
  });
});
