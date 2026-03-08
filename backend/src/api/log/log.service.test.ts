import { describe, it, expect, beforeEach } from 'bun:test';
import { NotFoundException } from '@nestjs/common';
import { LogService } from './log.service';
import { createMockPrisma, MockPrisma } from '../../test/mocks/prisma.mock';

describe('LogService', () => {
  let service: LogService;
  let mockPrisma: MockPrisma;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    service = new LogService(mockPrisma as any);
  });

  // ─── createLog ───────────────────────────────────────────────────────

  describe('createLog()', () => {
    it('should throw NotFoundException when device is not found', async () => {
      mockPrisma.device.findFirst.mockResolvedValue(null);
      await expect(
        service.createLog('bad-key', { level: 'info', message: 'test' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create a single log entry', async () => {
      mockPrisma.device.findFirst.mockResolvedValue({ id: 1, name: 'Device1' });
      mockPrisma.deviceLog.create.mockResolvedValue({ id: 1, level: 'info', message: 'hello' });

      const result = await service.createLog('valid-key', {
        level: 'info',
        message: 'hello',
      } as any);

      expect(result.status).toBe('ok');
      expect(result.message).toBe('Log created successfully');
      expect(mockPrisma.deviceLog.create.calls).toHaveLength(1);
    });

    it('should create multiple logs from batch format', async () => {
      mockPrisma.device.findFirst.mockResolvedValue({ id: 1, name: 'Device1' });
      mockPrisma.deviceLog.create.mockResolvedValue({ id: 1 });

      const result = await service.createLog('valid-key', {
        logs: [
          { level: 'info', message: 'msg1' },
          { level: 'warn', message: 'msg2' },
          { level: 'error', message: 'msg3' },
        ],
      } as any);

      expect(result.status).toBe('ok');
      expect(result.count).toBe(3);
      expect(mockPrisma.deviceLog.create.calls).toHaveLength(3);
    });

    it('should update device battery and wifi when metadata is provided', async () => {
      mockPrisma.device.findFirst.mockResolvedValue({ id: 5, name: 'Device5' });
      mockPrisma.deviceLog.create.mockResolvedValue({ id: 1, level: 'info', message: '' });
      mockPrisma.device.update.mockResolvedValue({});

      await service.createLog('valid-key', {
        level: 'info',
        message: 'status',
        metadata: { battery: 85, wifi: -42 },
      } as any);

      expect(mockPrisma.device.update.calls).toHaveLength(1);
      const updateCall = mockPrisma.device.update.calls[0][0];
      expect(updateCall.data.battery).toBe(85);
      expect(updateCall.data.wifi).toBe(-42);
      expect(updateCall.data.lastSeenAt).toBeInstanceOf(Date);
    });
  });
});
