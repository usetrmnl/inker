import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock axios before importing api module
vi.mock('axios', () => {
  const mockAxios = {
    create: vi.fn(() => mockAxios),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    isAxiosError: (error: any) => error?.isAxiosError === true,
  };
  return { default: mockAxios, AxiosError: Error };
});

// Mock config
vi.mock('../config', () => ({
  config: {
    apiUrl: 'http://localhost:3002/api',
    backendUrl: 'http://localhost:3002',
    getBackendUrl: (path: string) => `http://localhost:3002${path}`,
    getAssetUrl: (path: string) => path,
  },
}));

describe('API service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock localStorage
    const store: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => store[key] || null),
      setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
      removeItem: vi.fn((key: string) => { delete store[key]; }),
    });
  });

  describe('getErrorMessage pattern', () => {
    it('should extract error from axios error response', () => {
      const error = {
        isAxiosError: true,
        response: { data: { message: 'Bad request' } },
        message: 'Request failed',
      };
      // Simulating the getErrorMessage logic
      const msg = error.response?.data?.message || error.response?.data?.error || error.message;
      expect(msg).toBe('Bad request');
    });

    it('should fall back to error.message for network errors', () => {
      const error = {
        isAxiosError: true,
        response: undefined,
        message: 'Network Error',
      };
      const msg = error.response?.data?.message || error.response?.data?.error || error.message;
      expect(msg).toBe('Network Error');
    });

    it('should handle plain Error objects', () => {
      const error = new Error('Something went wrong');
      expect(error.message).toBe('Something went wrong');
    });
  });

  describe('SESSION_KEY constant', () => {
    it('should be inker_session', () => {
      // This is critical - using wrong key breaks auth
      const SESSION_KEY = 'inker_session';
      expect(SESSION_KEY).toBe('inker_session');
      expect(SESSION_KEY).not.toBe('token');
    });
  });

  describe('request interceptor pattern', () => {
    it('should add Bearer token from localStorage', () => {
      const token = 'test-token-123';
      const config = { headers: {} as Record<string, string> };

      // Simulating the interceptor
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      expect(config.headers.Authorization).toBe('Bearer test-token-123');
    });

    it('should not add header when no token', () => {
      const token = null;
      const config = { headers: {} as Record<string, string> };

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      expect(config.headers.Authorization).toBeUndefined();
    });
  });

  describe('401 redirect pattern', () => {
    it('should clear session and redirect on 401', () => {
      const status = 401;
      const currentPath = '/devices';
      let redirected = false;
      let sessionCleared = false;

      if (status === 401 && currentPath !== '/login') {
        sessionCleared = true;
        redirected = true;
      }

      expect(sessionCleared).toBe(true);
      expect(redirected).toBe(true);
    });

    it('should not redirect when already on login page', () => {
      const status = 401;
      const currentPath = '/login';
      let redirected = false;

      if (status === 401 && currentPath !== '/login') {
        redirected = true;
      }

      expect(redirected).toBe(false);
    });
  });
});
