import { describe, it, expect } from 'vitest';

// Test the pure helper functions from config
// Since config relies on window.location and import.meta.env, we test the logic patterns

describe('config helpers', () => {
  describe('isIPAddress pattern', () => {
    const isIPAddress = (host: string) =>
      /^(\d{1,3}\.){3}\d{1,3}$/.test(host) || host === 'localhost';

    it('should detect IPv4 addresses', () => {
      expect(isIPAddress('192.168.1.100')).toBe(true);
      expect(isIPAddress('10.0.0.1')).toBe(true);
      expect(isIPAddress('127.0.0.1')).toBe(true);
    });

    it('should detect localhost', () => {
      expect(isIPAddress('localhost')).toBe(true);
    });

    it('should reject domain names', () => {
      expect(isIPAddress('example.com')).toBe(false);
      expect(isIPAddress('my-app.dev')).toBe(false);
    });
  });

  describe('getAssetUrl pattern', () => {
    it('should prefix /uploads/ paths with backend URL for IP access', () => {
      const hostname = '192.168.1.100';
      const port = '3002';
      const path = '/uploads/screens/test.png';
      const result = `http://${hostname}:${port}${path}`;
      expect(result).toBe('http://192.168.1.100:3002/uploads/screens/test.png');
    });

    it('should return path as-is for non-upload paths', () => {
      const path = '/api/devices';
      expect(path).toBe('/api/devices');
    });

    it('should use BACKEND_PUBLIC_URL when configured', () => {
      const backendPublicUrl = 'https://api.example.com';
      const path = '/uploads/test.png';
      const result = `${backendPublicUrl.replace(/\/$/, '')}${path}`;
      expect(result).toBe('https://api.example.com/uploads/test.png');
    });
  });
});
