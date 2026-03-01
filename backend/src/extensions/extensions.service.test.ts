import { describe, it, expect, beforeEach } from 'bun:test';
import { NotFoundException } from '@nestjs/common';
import { ExtensionsService } from './extensions.service';
import { createMockPrisma, MockPrisma } from '../test/mocks/prisma.mock';

describe('ExtensionsService', () => {
  let service: ExtensionsService;
  let mockPrisma: MockPrisma;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    service = new ExtensionsService(mockPrisma as any);
  });

  // ─── create ──────────────────────────────────────────────────────────

  describe('create()', () => {
    it('should create an extension and return it', async () => {
      const dto = { name: 'Weather', type: 'widget', description: 'Weather ext' };
      const created = { id: 1, ...dto, config: {}, isActive: true };
      mockPrisma.extension.create.mockResolvedValue(created);

      const result = await service.create(dto as any);
      expect(result).toEqual(created);
      expect(mockPrisma.extension.create.calls).toHaveLength(1);
    });
  });

  // ─── findOne ─────────────────────────────────────────────────────────

  describe('findOne()', () => {
    it('should return extension when found', async () => {
      const ext = { id: 1, name: 'Weather', isActive: true };
      mockPrisma.extension.findUnique.mockResolvedValue(ext);

      const result = await service.findOne(1);
      expect(result).toEqual(ext);
    });

    it('should throw NotFoundException when not found', async () => {
      mockPrisma.extension.findUnique.mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── update ──────────────────────────────────────────────────────────

  describe('update()', () => {
    it('should throw NotFoundException when extension does not exist', async () => {
      mockPrisma.extension.findUnique.mockResolvedValue(null);
      await expect(service.update(999, { name: 'X' } as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should update extension and return it', async () => {
      mockPrisma.extension.findUnique.mockResolvedValue({ id: 1, name: 'Old' });
      const updated = { id: 1, name: 'New', isActive: true };
      mockPrisma.extension.update.mockResolvedValue(updated);

      const result = await service.update(1, { name: 'New' } as any);
      expect(result).toEqual(updated);
    });
  });

  // ─── remove ──────────────────────────────────────────────────────────

  describe('remove()', () => {
    it('should throw NotFoundException when extension does not exist', async () => {
      mockPrisma.extension.findUnique.mockResolvedValue(null);
      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });

    it('should delete extension successfully', async () => {
      mockPrisma.extension.findUnique.mockResolvedValue({ id: 1, name: 'Ext' });
      mockPrisma.extension.delete.mockResolvedValue({});

      const result = await service.remove(1);
      expect(result).toEqual({ message: 'Extension deleted successfully' });
      expect(mockPrisma.extension.delete.calls).toHaveLength(1);
    });
  });

  // ─── toggleActive ────────────────────────────────────────────────────

  describe('toggleActive()', () => {
    it('should throw NotFoundException when extension does not exist', async () => {
      mockPrisma.extension.findUnique.mockResolvedValue(null);
      await expect(service.toggleActive(999)).rejects.toThrow(NotFoundException);
    });

    it('should toggle isActive from true to false', async () => {
      mockPrisma.extension.findUnique.mockResolvedValue({ id: 1, name: 'Ext', isActive: true });
      const toggled = { id: 1, name: 'Ext', isActive: false };
      mockPrisma.extension.update.mockResolvedValue(toggled);

      const result = await service.toggleActive(1);
      expect(result.isActive).toBe(false);
      const updateCall = mockPrisma.extension.update.calls[0][0];
      expect(updateCall.data.isActive).toBe(false);
    });

    it('should toggle isActive from false to true', async () => {
      mockPrisma.extension.findUnique.mockResolvedValue({ id: 2, name: 'Ext2', isActive: false });
      const toggled = { id: 2, name: 'Ext2', isActive: true };
      mockPrisma.extension.update.mockResolvedValue(toggled);

      const result = await service.toggleActive(2);
      expect(result.isActive).toBe(true);
      const updateCall = mockPrisma.extension.update.calls[0][0];
      expect(updateCall.data.isActive).toBe(true);
    });
  });
});
