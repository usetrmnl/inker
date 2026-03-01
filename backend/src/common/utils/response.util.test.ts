import { describe, it, expect } from 'bun:test';
import {
  wrapListResponse,
  wrapPaginatedResponse,
  wrapSingleResponse,
  wrapMessageResponse,
} from './response.util';

describe('response.util', () => {
  describe('wrapListResponse', () => {
    it('should wrap items with total count', () => {
      const items = [{ id: 1 }, { id: 2 }];
      const result = wrapListResponse(items);
      expect(result).toEqual({
        data: { items, total: 2 },
      });
    });

    it('should handle empty array', () => {
      const result = wrapListResponse([]);
      expect(result).toEqual({
        data: { items: [], total: 0 },
      });
    });
  });

  describe('wrapPaginatedResponse', () => {
    it('should include pagination metadata', () => {
      const items = [{ id: 1 }];
      const result = wrapPaginatedResponse(items, 10, 1, 5);
      expect(result.data.items).toEqual(items);
      expect(result.data.total).toBe(10);
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(5);
    });

    it('should set hasMore true when more pages exist', () => {
      const result = wrapPaginatedResponse([], 10, 1, 5);
      expect(result.data.hasMore).toBe(true);
    });

    it('should set hasMore false on last page', () => {
      const result = wrapPaginatedResponse([], 10, 2, 5);
      expect(result.data.hasMore).toBe(false);
    });

    it('should set hasMore false when total equals page*limit', () => {
      const result = wrapPaginatedResponse([], 6, 2, 3);
      expect(result.data.hasMore).toBe(false);
    });
  });

  describe('wrapSingleResponse', () => {
    it('should wrap a single item', () => {
      const item = { id: 1, name: 'test' };
      expect(wrapSingleResponse(item)).toEqual({ data: item });
    });
  });

  describe('wrapMessageResponse', () => {
    it('should wrap a message string', () => {
      expect(wrapMessageResponse('ok')).toEqual({ message: 'ok' });
    });
  });
});
