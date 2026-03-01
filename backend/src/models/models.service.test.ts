import { describe, it, expect, beforeEach } from 'bun:test';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ModelsService } from './models.service';
import { createMockPrisma, MockPrisma } from '../test/mocks/prisma.mock';

describe('ModelsService', () => {
  let service: ModelsService;
  let mockPrisma: MockPrisma;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    service = new ModelsService(mockPrisma as any);
  });

  // ─── create ──────────────────────────────────────────────────────────

  describe('create()', () => {
    it('should throw BadRequestException when name already exists', async () => {
      mockPrisma.model.findUnique.mockResolvedValue({ id: 1, name: 'TRMNL' });
      await expect(
        service.create({ name: 'TRMNL', width: 800, height: 480 } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create model when name is unique', async () => {
      mockPrisma.model.findUnique.mockResolvedValue(null);
      const created = { id: 1, name: 'NewModel', width: 800, height: 480 };
      mockPrisma.model.create.mockResolvedValue(created);

      const result = await service.create({
        name: 'NewModel',
        width: 800,
        height: 480,
      } as any);
      expect(result).toEqual(created);
      expect(mockPrisma.model.create.calls).toHaveLength(1);
    });
  });

  // ─── findOne ─────────────────────────────────────────────────────────

  describe('findOne()', () => {
    it('should throw NotFoundException when not found', async () => {
      mockPrisma.model.findUnique.mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });

    it('should return model when found', async () => {
      const model = { id: 1, name: 'TRMNL', devices: [], screens: [], _count: { devices: 0, screens: 0 } };
      mockPrisma.model.findUnique.mockResolvedValue(model);

      const result = await service.findOne(1);
      expect(result).toEqual(model);
    });
  });

  // ─── update ──────────────────────────────────────────────────────────

  describe('update()', () => {
    it('should throw NotFoundException when model does not exist', async () => {
      mockPrisma.model.findUnique.mockResolvedValue(null);
      await expect(service.update(999, { name: 'X' } as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when changing to an existing name', async () => {
      let callCount = 0;
      mockPrisma.model.findUnique.mockImplementation((...args: any[]) => {
        callCount++;
        if (callCount === 1) return Promise.resolve({ id: 1, name: 'OldName' });
        return Promise.resolve({ id: 2, name: 'TakenName' }); // conflict
      });

      await expect(service.update(1, { name: 'TakenName' } as any)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─── remove ──────────────────────────────────────────────────────────

  describe('remove()', () => {
    it('should throw NotFoundException when model does not exist', async () => {
      mockPrisma.model.findUnique.mockResolvedValue(null);
      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when devices are using the model', async () => {
      mockPrisma.model.findUnique.mockResolvedValue({
        id: 1,
        name: 'InUse',
        _count: { devices: 3 },
      });
      await expect(service.remove(1)).rejects.toThrow(BadRequestException);
    });

    it('should delete model when no devices reference it', async () => {
      mockPrisma.model.findUnique.mockResolvedValue({
        id: 1,
        name: 'Unused',
        _count: { devices: 0 },
      });
      mockPrisma.model.delete.mockResolvedValue({});

      const result = await service.remove(1);
      expect(result).toEqual({ message: 'Model deleted successfully' });
      expect(mockPrisma.model.delete.calls).toHaveLength(1);
    });
  });
});
