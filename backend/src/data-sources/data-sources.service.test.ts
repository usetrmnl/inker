import { describe, it, expect, beforeEach } from 'bun:test';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSourcesService } from './data-sources.service';
import { createMockPrisma, MockPrisma } from '../test/mocks/prisma.mock';
import { createMock } from '../test/mocks/helpers';

describe('DataSourcesService', () => {
  let service: DataSourcesService;
  let mockPrisma: MockPrisma;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    service = new DataSourcesService(mockPrisma as any);
  });

  // ─── extractFieldsWithMeta ───────────────────────────────────────────

  describe('extractFieldsWithMeta()', () => {
    it('should extract flat object fields', () => {
      const fields = service.extractFieldsWithMeta({ price: 100, name: 'widget' });
      expect(fields).toContainEqual({ path: 'price', type: 'number', sample: 100 });
      expect(fields).toContainEqual({ path: 'name', type: 'string', sample: 'widget' });
    });

    it('should extract nested object fields', () => {
      const fields = service.extractFieldsWithMeta({ a: { b: 1 } });
      expect(fields).toContainEqual({ path: 'a.b', type: 'number', sample: 1 });
    });

    it('should handle array of primitives', () => {
      const fields = service.extractFieldsWithMeta([10, 20, 30]);
      expect(fields).toContainEqual({ path: '[0]', type: 'number', sample: 10 });
      expect(fields).toContainEqual({ path: '[1]', type: 'number', sample: 20 });
      expect(fields).toContainEqual({ path: '[2]', type: 'number', sample: 30 });
    });

    it('should handle array of objects', () => {
      const fields = service.extractFieldsWithMeta([{ name: 'test', value: 42 }]);
      expect(fields).toContainEqual({ path: '[0].name', type: 'string', sample: 'test' });
      expect(fields).toContainEqual({ path: '[0].value', type: 'number', sample: 42 });
    });

    it('should handle RSS feed structure with items array', () => {
      const rss = {
        title: 'My Feed',
        description: 'A feed',
        link: 'https://example.com',
        items: [{ title: 'Post 1' }],
      };
      const fields = service.extractFieldsWithMeta(rss);
      expect(fields).toContainEqual({ path: 'title', type: 'string', sample: 'My Feed' });
      expect(fields).toContainEqual({ path: 'description', type: 'string', sample: 'A feed' });
      expect(fields).toContainEqual({ path: 'link', type: 'string', sample: 'https://example.com', isLink: true });
      expect(fields).toContainEqual({ path: 'items', type: 'array', sample: 'Array(1)' });
      expect(fields).toContainEqual({ path: 'items[0].title', type: 'string', sample: 'Post 1' });
    });

    it('should detect image URLs', () => {
      const fields = service.extractFieldsWithMeta({ avatar: 'https://example.com/photo.jpg' });
      expect(fields[0].isImageUrl).toBe(true);
    });

    it('should detect plain links', () => {
      const fields = service.extractFieldsWithMeta({ url: 'https://example.com/page' });
      expect(fields[0].isLink).toBe(true);
      expect(fields[0].isImageUrl).toBeUndefined();
    });

    it('should truncate string samples at 100 characters', () => {
      const longString = 'x'.repeat(150);
      const fields = service.extractFieldsWithMeta({ text: longString });
      expect(fields[0].sample).toBe('x'.repeat(100) + '...');
    });

    it('should return empty array for null input', () => {
      expect(service.extractFieldsWithMeta(null)).toEqual([]);
    });

    it('should return empty array for undefined input', () => {
      expect(service.extractFieldsWithMeta(undefined)).toEqual([]);
    });

    it('should return empty array for empty array input', () => {
      expect(service.extractFieldsWithMeta([])).toEqual([]);
    });

    it('should handle nested arrays inside objects', () => {
      const data = { tags: ['a', 'b'] };
      const fields = service.extractFieldsWithMeta(data);
      expect(fields).toContainEqual({ path: 'tags', type: 'array', sample: 'Array(2)' });
      expect(fields).toContainEqual({ path: 'tags[0]', type: 'string', sample: 'a' });
    });
  });

  // ─── extractWithJsonPath ─────────────────────────────────────────────

  describe('extractWithJsonPath()', () => {
    const extract = (data: unknown, path: string) =>
      (service as any).extractWithJsonPath(data, path);

    it('should return full data for empty path', () => {
      const data = { a: 1 };
      expect(extract(data, '')).toEqual({ a: 1 });
    });

    it('should return full data for "$"', () => {
      const data = { a: 1 };
      expect(extract(data, '$')).toEqual({ a: 1 });
    });

    it('should extract simple field with $.field', () => {
      expect(extract({ price: 100 }, '$.price')).toBe(100);
    });

    it('should extract nested field with $.a.b', () => {
      expect(extract({ a: { b: 42 } }, '$.a.b')).toBe(42);
    });

    it('should extract array element with $.arr[0]', () => {
      expect(extract({ arr: [10, 20] }, '$.arr[0]')).toBe(10);
    });

    it('should return full array with wildcard $.arr[*]', () => {
      expect(extract({ arr: [1, 2, 3] }, '$.arr[*]')).toEqual([1, 2, 3]);
    });

    it('should map field name over array with $.items.title', () => {
      const data = { items: [{ title: 'A' }, { title: 'B' }] };
      expect(extract(data, '$.items.title')).toEqual(['A', 'B']);
    });

    it('should return null when traversing through null', () => {
      expect(extract({ a: null }, '$.a.b.c')).toBeNull();
    });
  });

  // ─── parseRss ────────────────────────────────────────────────────────

  describe('parseRss()', () => {
    const parseRss = (xml: string) => (service as any).parseRss(xml);

    it('should parse standard RSS feed with <item> tags', () => {
      const xml = `
        <rss>
          <channel>
            <title>My Blog</title>
            <description>A blog</description>
            <item>
              <title>Post 1</title>
              <link>https://example.com/1</link>
              <pubDate>Mon, 01 Jan 2024</pubDate>
            </item>
            <item>
              <title>Post 2</title>
            </item>
          </channel>
        </rss>`;
      const result = parseRss(xml);
      expect(result.title).toBe('My Blog');
      expect(result.description).toBe('A blog');
      expect(result.items).toHaveLength(2);
      expect(result.items[0].title).toBe('Post 1');
      expect(result.items[0].link).toBe('https://example.com/1');
      expect(result.items[1].title).toBe('Post 2');
    });

    it('should parse Atom feed with <entry> tags', () => {
      const xml = `
        <feed>
          <title>Atom Feed</title>
          <entry>
            <title>Entry 1</title>
            <summary>Summary here</summary>
            <link href="https://example.com/entry1"/>
          </entry>
        </feed>`;
      const result = parseRss(xml);
      expect(result.title).toBe('Atom Feed');
      expect(result.items).toHaveLength(1);
      expect(result.items[0].title).toBe('Entry 1');
      expect(result.items[0].description).toBe('Summary here');
      expect(result.items[0].link).toBe('https://example.com/entry1');
    });

    it('should handle CDATA content', () => {
      const xml = `
        <rss>
          <channel>
            <title><![CDATA[CDATA Title]]></title>
            <item>
              <title><![CDATA[Item CDATA]]></title>
            </item>
          </channel>
        </rss>`;
      const result = parseRss(xml);
      expect(result.title).toBe('CDATA Title');
      expect(result.items[0].title).toBe('Item CDATA');
    });

    it('should return empty items for feed with no items', () => {
      const xml = `<rss><channel><title>Empty</title></channel></rss>`;
      const result = parseRss(xml);
      expect(result.title).toBe('Empty');
      expect(result.items).toEqual([]);
    });

    it('should truncate item description to 500 chars', () => {
      const longDesc = 'a'.repeat(600);
      const xml = `<rss><channel><item><description>${longDesc}</description></item></channel></rss>`;
      const result = parseRss(xml);
      expect(result.items[0].description!.length).toBe(500);
    });
  });

  // ─── cleanXmlText ────────────────────────────────────────────────────

  describe('cleanXmlText()', () => {
    const clean = (text: string) => (service as any).cleanXmlText(text);

    it('should strip HTML tags', () => {
      expect(clean('<p>Hello <b>world</b></p>')).toBe('Hello world');
    });

    it('should decode XML entities', () => {
      expect(clean('&amp; &lt; &gt; &quot; &apos;')).toBe('& < > " \'');
    });

    it('should trim and collapse whitespace', () => {
      expect(clean('  hello   world  ')).toBe('hello world');
    });
  });

  // ─── looksLikeImageUrl / looksLikeUrl ────────────────────────────────

  describe('looksLikeImageUrl()', () => {
    const isImage = (v: string) => (service as any).looksLikeImageUrl(v);

    it('should detect .jpg extension', () => {
      expect(isImage('https://example.com/photo.jpg')).toBe(true);
    });

    it('should detect .png with query string', () => {
      expect(isImage('https://example.com/img.png?w=200')).toBe(true);
    });

    it('should detect /image/ path pattern', () => {
      expect(isImage('https://cdn.example.com/image/abc123')).toBe(true);
    });

    it('should reject plain URL without image indicators', () => {
      expect(isImage('https://example.com/api/data')).toBe(false);
    });
  });

  describe('looksLikeUrl()', () => {
    const isUrl = (v: string) => (service as any).looksLikeUrl(v);

    it('should detect http:// URLs', () => {
      expect(isUrl('http://example.com')).toBe(true);
    });

    it('should detect https:// URLs', () => {
      expect(isUrl('https://example.com')).toBe(true);
    });

    it('should reject non-URL strings', () => {
      expect(isUrl('just a string')).toBe(false);
    });
  });

  // ─── CRUD with mocked Prisma ─────────────────────────────────────────

  describe('findOne()', () => {
    it('should return data source when found', async () => {
      const ds = { id: 1, name: 'Test', customWidgets: [], headers: null };
      mockPrisma.dataSource.findUnique.mockResolvedValue(ds);
      const result = await service.findOne(1);
      expect(result).toEqual(ds);
    });

    it('should throw NotFoundException when not found', async () => {
      mockPrisma.dataSource.findUnique.mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove()', () => {
    it('should throw NotFoundException when data source does not exist', async () => {
      mockPrisma.dataSource.findUnique.mockResolvedValue(null);
      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when widgets are using it', async () => {
      mockPrisma.dataSource.findUnique.mockResolvedValue({
        id: 1,
        name: 'Used Source',
        _count: { customWidgets: 3 },
      });
      await expect(service.remove(1)).rejects.toThrow(BadRequestException);
    });

    it('should delete successfully when no widgets reference it', async () => {
      mockPrisma.dataSource.findUnique.mockResolvedValue({
        id: 1,
        name: 'Unused Source',
        _count: { customWidgets: 0 },
      });
      mockPrisma.dataSource.delete.mockResolvedValue({});
      const result = await service.remove(1);
      expect(result).toEqual({ message: 'Data source deleted successfully' });
      expect(mockPrisma.dataSource.delete.calls).toHaveLength(1);
    });
  });

  describe('getCachedData()', () => {
    it('should throw NotFoundException when data source does not exist', async () => {
      mockPrisma.dataSource.findUnique.mockResolvedValue(null);
      await expect(service.getCachedData(999)).rejects.toThrow(NotFoundException);
    });

    it('should return cached data when still fresh', async () => {
      const cachedData = { price: 100 };
      mockPrisma.dataSource.findUnique.mockResolvedValue({
        id: 1,
        lastData: cachedData,
        lastFetchedAt: new Date(), // just fetched
        refreshInterval: 300,
        headers: null,
      });
      const result = await service.getCachedData(1);
      expect(result).toEqual(cachedData);
    });

    it('should return stale cached data when refresh fails', async () => {
      const staleData = { price: 50 };
      mockPrisma.dataSource.findUnique.mockResolvedValue({
        id: 1,
        lastData: staleData,
        lastFetchedAt: new Date(0), // very old
        refreshInterval: 300,
        type: 'json',
        url: 'https://fail.example.com',
        method: 'GET',
        headers: null,
      });

      // Override fetchDataFromSource to simulate failure
      (service as any).fetchDataFromSource = createMock().mockRejectedValue(
        new Error('Network error'),
      );

      const result = await service.getCachedData(1);
      expect(result).toEqual(staleData);
    });

    it('should fetch fresh data when cache is stale', async () => {
      const freshData = { price: 200 };
      mockPrisma.dataSource.findUnique.mockResolvedValue({
        id: 1,
        lastData: null,
        lastFetchedAt: null,
        refreshInterval: 300,
        type: 'json',
        url: 'https://api.example.com',
        method: 'GET',
        headers: null,
      });
      mockPrisma.dataSource.update.mockResolvedValue({});

      (service as any).fetchDataFromSource = createMock().mockResolvedValue(freshData);

      const result = await service.getCachedData(1);
      expect(result).toEqual(freshData);
      expect(mockPrisma.dataSource.update.calls).toHaveLength(1);
    });
  });
});
