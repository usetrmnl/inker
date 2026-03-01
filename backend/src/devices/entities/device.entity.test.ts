import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import {
  isDeviceOnline,
  calculateDeviceStatus,
  getOfflineThresholdMs,
  serializeDevice,
  serializeDevices,
} from './device.entity';

describe('device.entity', () => {
  const originalEnv = process.env.DEVICE_OFFLINE_THRESHOLD;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.DEVICE_OFFLINE_THRESHOLD;
    } else {
      process.env.DEVICE_OFFLINE_THRESHOLD = originalEnv;
    }
  });

  describe('getOfflineThresholdMs', () => {
    it('should return 5 minutes by default', () => {
      delete process.env.DEVICE_OFFLINE_THRESHOLD;
      expect(getOfflineThresholdMs()).toBe(300000);
    });

    it('should use environment variable when set', () => {
      process.env.DEVICE_OFFLINE_THRESHOLD = '60000';
      expect(getOfflineThresholdMs()).toBe(60000);
    });

    it('should fall back to default for invalid env value', () => {
      process.env.DEVICE_OFFLINE_THRESHOLD = 'abc';
      expect(getOfflineThresholdMs()).toBe(300000);
    });

    it('should fall back to default for negative value', () => {
      process.env.DEVICE_OFFLINE_THRESHOLD = '-1';
      expect(getOfflineThresholdMs()).toBe(300000);
    });
  });

  describe('isDeviceOnline', () => {
    it('should return false when device is not active', () => {
      expect(isDeviceOnline({ isActive: false, lastSeenAt: new Date() })).toBe(false);
    });

    it('should return false when lastSeenAt is null', () => {
      expect(isDeviceOnline({ isActive: true, lastSeenAt: null })).toBe(false);
    });

    it('should return true when seen recently', () => {
      const recentDate = new Date(Date.now() - 60000); // 1 min ago
      expect(isDeviceOnline({ isActive: true, lastSeenAt: recentDate })).toBe(true);
    });

    it('should return false when seen too long ago', () => {
      const staleDate = new Date(Date.now() - 600000); // 10 min ago
      expect(isDeviceOnline({ isActive: true, lastSeenAt: staleDate })).toBe(false);
    });
  });

  describe('calculateDeviceStatus', () => {
    it('should return online for active recent device', () => {
      expect(calculateDeviceStatus({ isActive: true, lastSeenAt: new Date() })).toBe('online');
    });

    it('should return offline for inactive device', () => {
      expect(calculateDeviceStatus({ isActive: false, lastSeenAt: new Date() })).toBe('offline');
    });
  });

  describe('serializeDevice', () => {
    it('should add status and isOnline fields', () => {
      const device = { id: 1, isActive: true, lastSeenAt: new Date() };
      const result = serializeDevice(device);
      expect(result.status).toBe('online');
      expect(result.isOnline).toBe(true);
      expect(result.id).toBe(1);
    });
  });

  describe('serializeDevices', () => {
    it('should serialize array of devices', () => {
      const devices = [
        { id: 1, isActive: true, lastSeenAt: new Date() },
        { id: 2, isActive: false, lastSeenAt: null },
      ];
      const result = serializeDevices(devices);
      expect(result).toHaveLength(2);
      expect(result[0].isOnline).toBe(true);
      expect(result[1].isOnline).toBe(false);
    });
  });
});
