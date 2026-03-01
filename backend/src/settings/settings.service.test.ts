import { describe, it, expect, beforeEach } from 'bun:test';
import { SettingsService, SETTING_KEYS } from './settings.service';
import { createMockPrisma, MockPrisma } from '../test/mocks/prisma.mock';

describe('SettingsService', () => {
  let service: SettingsService;
  let mockPrisma: MockPrisma;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    service = new SettingsService(mockPrisma as any);
  });

  // ─── get ────────────────────────────────────────────────────────────

  describe('get()', () => {
    it('should return value when setting is found', async () => {
      mockPrisma.setting.findUnique.mockResolvedValue({
        key: 'github_token',
        value: 'ghp_test123',
      });

      const result = await service.get('github_token');

      expect(result).toBe('ghp_test123');
      expect(mockPrisma.setting.findUnique.calls[0][0].where.key).toBe('github_token');
    });

    it('should return null when setting is not found', async () => {
      mockPrisma.setting.findUnique.mockResolvedValue(null);

      const result = await service.get('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ─── set ────────────────────────────────────────────────────────────

  describe('set()', () => {
    it('should call prisma.setting.upsert with correct params', async () => {
      mockPrisma.setting.upsert.mockResolvedValue({});

      await service.set('github_token', 'ghp_new_token');

      expect(mockPrisma.setting.upsert.calls).toHaveLength(1);
      const call = mockPrisma.setting.upsert.calls[0][0];
      expect(call.where.key).toBe('github_token');
      expect(call.update.value).toBe('ghp_new_token');
      expect(call.create.key).toBe('github_token');
      expect(call.create.value).toBe('ghp_new_token');
    });
  });

  // ─── delete ─────────────────────────────────────────────────────────

  describe('delete()', () => {
    it('should call prisma.setting.deleteMany with correct key', async () => {
      mockPrisma.setting.deleteMany.mockResolvedValue({ count: 1 });

      await service.delete('github_token');

      expect(mockPrisma.setting.deleteMany.calls).toHaveLength(1);
      expect(mockPrisma.setting.deleteMany.calls[0][0].where.key).toBe('github_token');
    });
  });

  // ─── getAll ─────────────────────────────────────────────────────────

  describe('getAll()', () => {
    it('should initialize all known keys with null', async () => {
      mockPrisma.setting.findMany.mockResolvedValue([]);

      const result = await service.getAll();

      for (const key of Object.values(SETTING_KEYS)) {
        expect(result).toHaveProperty(key);
        expect(result[key]).toBeNull();
      }
    });

    it('should mask sensitive values (github_token)', async () => {
      mockPrisma.setting.findMany.mockResolvedValue([
        { key: 'github_token', value: 'ghp_supersecrettoken123' },
      ]);

      const result = await service.getAll();

      expect(result.github_token).toBe('••••••••');
    });

    it('should return null for sensitive key with no value', async () => {
      mockPrisma.setting.findMany.mockResolvedValue([
        { key: 'github_token', value: '' },
      ]);

      const result = await service.getAll();

      expect(result.github_token).toBeNull();
    });

    it('should show non-sensitive values as-is', async () => {
      mockPrisma.setting.findMany.mockResolvedValue([
        { key: 'some_setting', value: 'visible-value' },
      ]);

      const result = await service.getAll();

      expect(result.some_setting).toBe('visible-value');
    });
  });

  // ─── isSensitive (private) ─────────────────────────────────────────

  describe('isSensitive()', () => {
    const isSensitive = (key: string) => (service as any).isSensitive(key);

    it('should detect "token" in key name', () => {
      expect(isSensitive('github_token')).toBe(true);
    });

    it('should detect "key" in key name', () => {
      expect(isSensitive('api_key')).toBe(true);
    });

    it('should detect "secret" in key name', () => {
      expect(isSensitive('client_secret')).toBe(true);
    });

    it('should detect "password" in key name', () => {
      expect(isSensitive('db_password')).toBe(true);
    });

    it('should be case-insensitive', () => {
      expect(isSensitive('GitHub_TOKEN')).toBe(true);
      expect(isSensitive('API_KEY')).toBe(true);
    });

    it('should return false for non-sensitive keys', () => {
      expect(isSensitive('theme')).toBe(false);
      expect(isSensitive('language')).toBe(false);
      expect(isSensitive('refresh_interval')).toBe(false);
    });
  });

  // ─── getGitHubToken ────────────────────────────────────────────────

  describe('getGitHubToken()', () => {
    it('should delegate to get() with github_token key', async () => {
      mockPrisma.setting.findUnique.mockResolvedValue({
        key: 'github_token',
        value: 'ghp_abc',
      });

      const result = await service.getGitHubToken();

      expect(result).toBe('ghp_abc');
      expect(mockPrisma.setting.findUnique.calls[0][0].where.key).toBe('github_token');
    });
  });
});
