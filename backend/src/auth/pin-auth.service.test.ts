import { describe, it, expect, beforeEach } from 'bun:test';
import { PinAuthService } from './pin-auth.service';

// Mock ConfigService
const createMockConfigService = (pin?: string) => ({
  get: (key: string) => {
    if (key === 'admin.pin') return pin;
    return undefined;
  },
});

describe('PinAuthService', () => {
  let service: PinAuthService;

  beforeEach(() => {
    service = new PinAuthService(createMockConfigService('1234') as any);
  });

  describe('validatePin', () => {
    it('should return true for correct PIN', () => {
      expect(service.validatePin('1234')).toBe(true);
    });

    it('should return false for incorrect PIN', () => {
      expect(service.validatePin('0000')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(service.validatePin('')).toBe(false);
    });

    it('should return false when stored PIN is undefined', () => {
      const serviceNoPin = new PinAuthService(createMockConfigService(undefined) as any);
      expect(serviceNoPin.validatePin('1234')).toBe(false);
    });
  });

  describe('generateSessionToken', () => {
    it('should return a 64-character hex string', () => {
      const token = service.generateSessionToken();
      expect(token).toHaveLength(64);
      expect(token).toMatch(/^[a-f0-9]+$/);
    });

    it('should generate unique tokens', () => {
      const token1 = service.generateSessionToken();
      const token2 = service.generateSessionToken();
      expect(token1).not.toBe(token2);
    });
  });

  describe('validateSession', () => {
    it('should return true for a generated token', () => {
      const token = service.generateSessionToken();
      expect(service.validateSession(token)).toBe(true);
    });

    it('should return false for unknown token', () => {
      expect(service.validateSession('nonexistent')).toBe(false);
    });
  });

  describe('invalidateSession', () => {
    it('should remove the session', () => {
      const token = service.generateSessionToken();
      expect(service.validateSession(token)).toBe(true);
      service.invalidateSession(token);
      expect(service.validateSession(token)).toBe(false);
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('should remove sessions older than 30 days', () => {
      const token = service.generateSessionToken();
      expect(service.validateSession(token)).toBe(true);

      // Manipulate the session's createdAt to be 31 days ago
      const sessions = (service as any).sessions as Map<string, { createdAt: Date }>;
      const session = sessions.get(token)!;
      session.createdAt = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);

      service.cleanupExpiredSessions();
      expect(service.validateSession(token)).toBe(false);
    });

    it('should keep sessions younger than 30 days', () => {
      const token = service.generateSessionToken();
      service.cleanupExpiredSessions();
      expect(service.validateSession(token)).toBe(true);
    });
  });
});
