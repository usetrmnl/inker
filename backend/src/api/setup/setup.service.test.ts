import { describe, it, expect, beforeEach } from 'bun:test';
import { BadRequestException } from '@nestjs/common';
import { SetupService } from './setup.service';
import { createMockPrisma, MockPrisma } from '../../test/mocks/prisma.mock';
import { createMock } from '../../test/mocks/helpers';

describe('SetupService', () => {
  let service: SetupService;
  let mockPrisma: MockPrisma;
  let mockSetupScreenService: { getSetupScreenUrl: ReturnType<typeof createMock> };

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    mockSetupScreenService = {
      getSetupScreenUrl: createMock().mockReturnValue('/uploads/setup.png'),
    };
    service = new SetupService(mockPrisma as any, mockSetupScreenService as any);
  });

  // ─── isValidMacAddress (private) ────────────────────────────────────

  describe('isValidMacAddress()', () => {
    const isValid = (mac: string) => (service as any).isValidMacAddress(mac);

    it('should accept colon-separated format (AA:BB:CC:DD:EE:FF)', () => {
      expect(isValid('AA:BB:CC:DD:EE:FF')).toBe(true);
    });

    it('should accept hyphen-separated format (AA-BB-CC-DD-EE-FF)', () => {
      expect(isValid('AA-BB-CC-DD-EE-FF')).toBe(true);
    });

    it('should accept compact format (AABBCCDDEEFF)', () => {
      expect(isValid('AABBCCDDEEFF')).toBe(true);
    });

    it('should accept lowercase hex characters', () => {
      expect(isValid('aa:bb:cc:dd:ee:ff')).toBe(true);
    });

    it('should reject MAC with wrong length', () => {
      expect(isValid('AA:BB:CC:DD:EE')).toBe(false);
    });

    it('should reject MAC with invalid characters', () => {
      expect(isValid('GG:HH:II:JJ:KK:LL')).toBe(false);
    });

    it('should reject empty string', () => {
      expect(isValid('')).toBe(false);
    });

    it('should reject random string', () => {
      expect(isValid('not-a-mac')).toBe(false);
    });
  });

  // ─── generateFriendlyId (private) ──────────────────────────────────

  describe('generateFriendlyId()', () => {
    it('should return adjective-noun-number format', () => {
      const id = (service as any).generateFriendlyId();
      const parts = id.split('-');
      expect(parts).toHaveLength(3);
      expect(parts[0]).toBeString();
      expect(parts[1]).toBeString();
      expect(Number(parts[2])).toBeFinite();
    });

    it('should return a string containing only lowercase letters and digits', () => {
      const id = (service as any).generateFriendlyId();
      expect(id).toMatch(/^[a-z]+-[a-z]+-\d+$/);
    });
  });

  // ─── provisionDevice ───────────────────────────────────────────────

  describe('provisionDevice()', () => {
    it('should throw BadRequestException for invalid MAC address', async () => {
      await expect(service.provisionDevice('invalid-mac')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should return reset_firmware and delete blocked device', async () => {
      mockPrisma.blockedDevice.findUnique.mockResolvedValue({
        id: 1,
        macAddress: 'AA:BB:CC:DD:EE:FF',
      });
      mockPrisma.blockedDevice.delete.mockResolvedValue({});

      const result = await service.provisionDevice('AA:BB:CC:DD:EE:FF');

      expect(result).toEqual({
        status: 200,
        api_key: '',
        friendly_id: '',
        image_url: '',
        message: 'Device was removed from server',
        reset_firmware: true,
      });
      expect(mockPrisma.blockedDevice.delete.calls).toHaveLength(1);
    });

    it('should return existing API key and update firmware for existing device', async () => {
      const existingDevice = {
        id: 1,
        apiKey: 'existing-key-123',
        friendlyId: 'swift-fox-42',
        macAddress: 'AA:BB:CC:DD:EE:FF',
        firmwareVersion: '1.0.0',
        battery: 80,
        wifi: -50,
        model: { name: 'og_png' },
      };

      mockPrisma.blockedDevice.findUnique.mockResolvedValue(null);
      mockPrisma.device.findUnique.mockResolvedValue(existingDevice);
      mockPrisma.device.update.mockResolvedValue({
        ...existingDevice,
        firmwareVersion: '2.0.0',
      });

      const result = await service.provisionDevice(
        'AA:BB:CC:DD:EE:FF',
        '2.0.0',
        { battery: 90, wifi: -45 },
        'http://localhost:3002',
      );

      expect(result.api_key).toBe('existing-key-123');
      expect(mockPrisma.device.update.calls).toHaveLength(1);
    });

    it('should create new device with default model when device does not exist', async () => {
      const defaultModel = { id: 1, name: 'og_png' };
      const newDevice = {
        id: 2,
        apiKey: 'new-key-456',
        friendlyId: 'bold-hawk-7',
        macAddress: 'AA:BB:CC:DD:EE:FF',
        model: defaultModel,
      };

      mockPrisma.blockedDevice.findUnique.mockResolvedValue(null);
      mockPrisma.device.findUnique.mockResolvedValue(null);
      mockPrisma.model.findFirst.mockResolvedValue(defaultModel);
      mockPrisma.device.create.mockResolvedValue(newDevice);

      const result = await service.provisionDevice(
        'AA:BB:CC:DD:EE:FF',
        '1.0.0',
        { battery: 100, wifi: -30 },
        'http://localhost:3002',
      );

      expect(result.api_key).toBe('new-key-456');
      expect(result.friendly_id).toBe('bold-hawk-7');
      expect(mockPrisma.device.create.calls).toHaveLength(1);
    });

    it('should auto-create default model if it does not exist', async () => {
      const createdModel = { id: 1, name: 'og_png' };
      const newDevice = {
        id: 1,
        apiKey: 'key-789',
        friendlyId: 'calm-wolf-3',
        macAddress: 'AA:BB:CC:DD:EE:FF',
        model: createdModel,
      };

      mockPrisma.blockedDevice.findUnique.mockResolvedValue(null);
      mockPrisma.device.findUnique.mockResolvedValue(null);
      mockPrisma.model.findFirst.mockResolvedValue(null);
      mockPrisma.model.create.mockResolvedValue(createdModel);
      mockPrisma.device.create.mockResolvedValue(newDevice);

      await service.provisionDevice('AA:BB:CC:DD:EE:FF');

      expect(mockPrisma.model.create.calls).toHaveLength(1);
      expect(mockPrisma.model.create.calls[0][0].data.name).toBe('og_png');
    });
  });

  // ─── buildSetupResponse (private) ──────────────────────────────────

  describe('buildSetupResponse()', () => {
    it('should include api_key, friendly_id, image_url, and message', () => {
      const device = {
        apiKey: 'test-api-key',
        friendlyId: 'keen-eagle-55',
      };

      const result = (service as any).buildSetupResponse(device, 'http://myhost:3002');

      expect(result.api_key).toBe('test-api-key');
      expect(result.friendly_id).toBe('keen-eagle-55');
      expect(result.image_url).toBe('http://myhost:3002/uploads/setup.png');
      expect(result.message).toBe('Welcome to Inker!');
    });

    it('should fall back to API_URL env or localhost when no base URL set', () => {
      const originalApiUrl = process.env.API_URL;
      delete process.env.API_URL;

      const result = (service as any).buildSetupResponse({
        apiKey: 'key',
        friendlyId: 'id',
      });

      expect(result.image_url).toContain('http://localhost:3002');

      if (originalApiUrl !== undefined) {
        process.env.API_URL = originalApiUrl;
      }
    });
  });
});
