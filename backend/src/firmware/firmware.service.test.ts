import { describe, it, expect, beforeEach } from 'bun:test';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { FirmwareService } from './firmware.service';
import { createMockPrisma, MockPrisma } from '../test/mocks/prisma.mock';

describe('FirmwareService', () => {
  let service: FirmwareService;
  let mockPrisma: MockPrisma;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    service = new FirmwareService(mockPrisma as any);
  });

  // ─── create ──────────────────────────────────────────────────────────

  describe('create()', () => {
    it('should throw ConflictException when version already exists', async () => {
      mockPrisma.firmware.findUnique.mockResolvedValue({ id: 1, version: '1.0.0' });
      await expect(
        service.create({ version: '1.0.0', downloadUrl: 'https://example.com/fw' } as any),
      ).rejects.toThrow(ConflictException);
    });

    it('should create firmware when version is new', async () => {
      mockPrisma.firmware.findUnique.mockResolvedValue(null);
      const created = { id: 1, version: '2.0.0', isStable: false };
      mockPrisma.firmware.create.mockResolvedValue(created);

      const result = await service.create({
        version: '2.0.0',
        downloadUrl: 'https://example.com/fw',
      } as any);
      expect(result).toEqual(created);
      expect(mockPrisma.firmware.create.calls).toHaveLength(1);
    });
  });

  // ─── findLatestStable ────────────────────────────────────────────────

  describe('findLatestStable()', () => {
    it('should throw NotFoundException when no stable firmware exists', async () => {
      mockPrisma.firmware.findFirst.mockResolvedValue(null);
      await expect(service.findLatestStable()).rejects.toThrow(NotFoundException);
    });

    it('should return the latest stable firmware', async () => {
      const fw = { id: 3, version: '1.5.0', isStable: true };
      mockPrisma.firmware.findFirst.mockResolvedValue(fw);

      const result = await service.findLatestStable();
      expect(result).toEqual(fw);
    });
  });

  // ─── findOne ─────────────────────────────────────────────────────────

  describe('findOne()', () => {
    it('should throw NotFoundException when not found', async () => {
      mockPrisma.firmware.findUnique.mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── update ──────────────────────────────────────────────────────────

  describe('update()', () => {
    it('should throw NotFoundException when firmware does not exist', async () => {
      mockPrisma.firmware.findUnique.mockResolvedValue(null);
      await expect(service.update(999, { version: '3.0.0' } as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException when changing to an existing version', async () => {
      // First call: find the firmware being updated
      // Second call: find firmware with the target version
      let callCount = 0;
      mockPrisma.firmware.findUnique.mockImplementation((...args: any[]) => {
        callCount++;
        if (callCount === 1) return Promise.resolve({ id: 1, version: '1.0.0' });
        return Promise.resolve({ id: 2, version: '2.0.0' }); // conflict
      });

      await expect(service.update(1, { version: '2.0.0' } as any)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // ─── remove ──────────────────────────────────────────────────────────

  describe('remove()', () => {
    it('should throw NotFoundException when firmware does not exist', async () => {
      mockPrisma.firmware.findUnique.mockResolvedValue(null);
      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });

    it('should delete firmware successfully', async () => {
      mockPrisma.firmware.findUnique.mockResolvedValue({ id: 1, version: '1.0.0' });
      mockPrisma.firmware.delete.mockResolvedValue({});

      const result = await service.remove(1);
      expect(result).toEqual({ message: 'Firmware deleted successfully' });
      expect(mockPrisma.firmware.delete.calls).toHaveLength(1);
    });
  });

  // ─── markAsStable ────────────────────────────────────────────────────

  describe('markAsStable()', () => {
    it('should throw NotFoundException when firmware does not exist', async () => {
      mockPrisma.firmware.findUnique.mockResolvedValue(null);
      await expect(service.markAsStable(999)).rejects.toThrow(NotFoundException);
    });

    it('should update isStable to true', async () => {
      mockPrisma.firmware.findUnique.mockResolvedValue({ id: 1, version: '1.0.0' });
      const updated = { id: 1, version: '1.0.0', isStable: true };
      mockPrisma.firmware.update.mockResolvedValue(updated);

      const result = await service.markAsStable(1);
      expect(result).toEqual(updated);
      expect(mockPrisma.firmware.update.calls).toHaveLength(1);
    });
  });
});
