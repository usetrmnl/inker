import { describe, it, expect } from 'bun:test';
import { generateApiKey, generateToken } from './crypto.util';

describe('crypto.util', () => {
  describe('generateApiKey', () => {
    it('should return a hex string of correct length', () => {
      const key = generateApiKey();
      expect(key).toMatch(/^[a-f0-9]+$/);
      expect(key).toHaveLength(64); // 32 bytes = 64 hex chars
    });

    it('should respect custom length', () => {
      const key = generateApiKey(16);
      expect(key).toHaveLength(32); // 16 bytes = 32 hex chars
    });

    it('should generate unique keys', () => {
      const key1 = generateApiKey();
      const key2 = generateApiKey();
      expect(key1).not.toBe(key2);
    });
  });

  describe('generateToken', () => {
    it('should return a base64url string', () => {
      const token = generateToken();
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('should generate unique tokens', () => {
      const token1 = generateToken();
      const token2 = generateToken();
      expect(token1).not.toBe(token2);
    });
  });
});
