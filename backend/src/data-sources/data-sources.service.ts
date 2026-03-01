import {
  Injectable,
  NotFoundException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDataSourceDto } from './dto/create-data-source.dto';
import { UpdateDataSourceDto } from './dto/update-data-source.dto';
import { TestUrlDto } from './dto/test-url.dto';
import { wrapListResponse, wrapPaginatedResponse } from '../common/utils/response.util';
import axios from 'axios';
import {
  validateUrlSafety,
  isPrivateIp,
  createSafeHttpAgent,
  createSafeHttpsAgent,
} from '../common/utils/url-safety';

/**
 * Field metadata extracted from API response.
 * Used to show users what fields are available before creating a data source.
 */
export interface FieldMeta {
  path: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null';
  sample: unknown;
  isImageUrl?: boolean;
  isLink?: boolean;
}

@Injectable()
export class DataSourcesService {
  private readonly logger = new Logger(DataSourcesService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Create a new data source and auto-test it
   */
  async create(createDataSourceDto: CreateDataSourceDto) {
    const dataSource = await this.prisma.dataSource.create({
      data: {
        name: createDataSourceDto.name,
        description: createDataSourceDto.description,
        type: createDataSourceDto.type,
        url: createDataSourceDto.url,
        method: createDataSourceDto.method || 'GET',
        headers: (createDataSourceDto.headers || undefined) as object | undefined,
        refreshInterval: createDataSourceDto.refreshInterval || 300,
        jsonPath: createDataSourceDto.jsonPath,
        isActive: createDataSourceDto.isActive ?? true,
      },
    });

    this.logger.log(`Data source created: ${dataSource.name}`);

    // Auto-test the new data source to set initial status
    try {
      const data = await this.fetchDataFromSource({
        ...dataSource,
        headers: dataSource.headers as object | null,
      });
      return await this.prisma.dataSource.update({
        where: { id: dataSource.id },
        data: {
          lastData: data as object,
          lastFetchedAt: new Date(),
          lastError: null,
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return await this.prisma.dataSource.update({
        where: { id: dataSource.id },
        data: {
          lastError: errorMessage,
          lastFetchedAt: new Date(),
        },
      });
    }
  }

  /**
   * Find all data sources with pagination
   */
  async findAll(page = 1, limit = 20, activeOnly = false) {
    const where = activeOnly ? { isActive: true } : {};
    const skip = (page - 1) * limit;

    const [dataSources, total] = await Promise.all([
      this.prisma.dataSource.findMany({
        where,
        include: {
          _count: {
            select: { customWidgets: true },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.dataSource.count({ where }),
    ]);

    const masked = dataSources.map(ds => ({
      ...ds,
      headers: this.maskSensitiveHeaders(ds.headers as Record<string, string> | null),
    }));

    return wrapPaginatedResponse(masked, total, page, limit);
  }

  /**
   * Find one data source by ID
   */
  async findOne(id: number) {
    const dataSource = await this.prisma.dataSource.findUnique({
      where: { id },
      include: {
        customWidgets: true,
      },
    });

    if (!dataSource) {
      throw new NotFoundException('Data source not found');
    }

    return {
      ...dataSource,
      headers: this.maskSensitiveHeaders(dataSource.headers as Record<string, string> | null),
    };
  }

  /**
   * Test a URL without saving - allows users to preview available fields
   * before creating a data source.
   */
  async testUrl(dto: TestUrlDto) {
    try {
      const data = await this.fetchDataFromSource({
        type: dto.type,
        url: dto.url,
        method: dto.method || 'GET',
        headers: dto.headers || null,
      });

      // Extract all field paths with types and sample values
      const fields = this.extractFieldsWithMeta(data);

      return {
        success: true,
        data,
        fields,
        fetchedAt: new Date().toISOString(),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: errorMessage,
        fields: [],
        fetchedAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Extract all field paths from data with their types and sample values.
   * This helps users understand what fields are available from an API.
   *
   * For arrays, generates paths for ALL indices:
   * - arrayName (the array itself)
   * - arrayName[0], arrayName[1], arrayName[2], etc.
   * - arrayName[0].field (for object arrays)
   */
  extractFieldsWithMeta(data: unknown, prefix = ''): FieldMeta[] {
    const fields: FieldMeta[] = [];

    if (data === null || data === undefined) {
      return fields;
    }

    if (Array.isArray(data)) {
      // For arrays, show ALL indices
      data.forEach((item, index) => {
        const itemPath = prefix ? `${prefix}[${index}]` : `[${index}]`;

        if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
          // Object in array - add fields from this object
          Object.entries(item as Record<string, unknown>).forEach(
            ([key, value]) => {
              const fullPath = `${itemPath}.${key}`;
              if (
                typeof value === 'object' &&
                value !== null &&
                !Array.isArray(value)
              ) {
                // Nested object inside array item
                fields.push(...this.extractFieldsWithMeta(value, fullPath));
              } else if (Array.isArray(value)) {
                // Nested array inside array item
                fields.push({
                  path: fullPath,
                  type: 'array',
                  sample: `Array(${value.length})`,
                });
                if (value.length > 0) {
                  fields.push(...this.extractFieldsWithMeta(value, fullPath));
                }
              } else {
                // Primitive field in array item
                fields.push(this.createFieldMeta(fullPath, value));
              }
            },
          );
        } else if (Array.isArray(item)) {
          // Nested array
          fields.push({
            path: itemPath,
            type: 'array',
            sample: `Array(${item.length})`,
          });
          fields.push(...this.extractFieldsWithMeta(item, itemPath));
        } else {
          // Primitive value in array
          fields.push(this.createFieldMeta(itemPath, item));
        }
      });
    } else if (typeof data === 'object') {
      const obj = data as Record<string, unknown>;

      // Handle RSS feed structure specially
      if ('items' in obj && Array.isArray(obj.items)) {
        // Add feed-level fields
        if (obj.title) {
          fields.push(this.createFieldMeta('title', obj.title));
        }
        if (obj.description) {
          fields.push(this.createFieldMeta('description', obj.description));
        }
        if (obj.link) {
          fields.push(this.createFieldMeta('link', obj.link));
        }

        // Add items array
        fields.push({
          path: 'items',
          type: 'array',
          sample: `Array(${obj.items.length})`,
        });

        // Add ALL item fields with full paths
        fields.push(...this.extractFieldsWithMeta(obj.items, 'items'));
      } else {
        // Regular object - extract all fields recursively
        Object.entries(obj).forEach(([key, value]) => {
          const path = prefix ? `${prefix}.${key}` : key;

          if (
            typeof value === 'object' &&
            value !== null &&
            !Array.isArray(value)
          ) {
            // Nested object - recurse
            fields.push(...this.extractFieldsWithMeta(value, path));
          } else if (Array.isArray(value)) {
            // Array - add the array path and recurse
            fields.push({
              path,
              type: 'array',
              sample: `Array(${value.length})`,
            });
            if (value.length > 0) {
              fields.push(...this.extractFieldsWithMeta(value, path));
            }
          } else {
            // Primitive value
            fields.push(this.createFieldMeta(path, value));
          }
        });
      }
    }

    return fields;
  }

  /**
   * Create field metadata from a path and value
   */
  private createFieldMeta(path: string, value: unknown): FieldMeta {
    const type = this.getValueType(value);
    const meta: FieldMeta = {
      path,
      type,
      sample: this.truncateSample(value),
    };

    // Detect if string looks like an image URL
    if (type === 'string' && typeof value === 'string') {
      if (this.looksLikeImageUrl(value)) {
        meta.isImageUrl = true;
      } else if (this.looksLikeUrl(value)) {
        meta.isLink = true;
      }
    }

    return meta;
  }

  /**
   * Get the type of a value
   */
  private getValueType(
    value: unknown,
  ): 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null' {
    if (value === null || value === undefined) return 'null';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object') return 'object';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    return 'string';
  }

  /**
   * Truncate sample value for display
   */
  private truncateSample(value: unknown): unknown {
    if (typeof value === 'string' && value.length > 100) {
      return value.substring(0, 100) + '...';
    }
    if (Array.isArray(value)) {
      return `Array(${value.length})`;
    }
    if (typeof value === 'object' && value !== null) {
      return '{...}';
    }
    return value;
  }

  /**
   * Check if a string looks like an image URL
   */
  private looksLikeImageUrl(value: string): boolean {
    const imageExtensions = /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)(\?.*)?$/i;
    const imagePatterns =
      /\/(image|img|photo|picture|media)\//i;

    return (
      imageExtensions.test(value) ||
      (imagePatterns.test(value) && value.startsWith('http'))
    );
  }

  /**
   * Check if a string looks like a URL
   */
  private looksLikeUrl(value: string): boolean {
    return /^https?:\/\//i.test(value);
  }

  /**
   * Update data source
   */
  async update(id: number, updateDataSourceDto: UpdateDataSourceDto) {
    const dataSource = await this.prisma.dataSource.findUnique({
      where: { id },
    });

    if (!dataSource) {
      throw new NotFoundException('Data source not found');
    }

    const updatedDataSource = await this.prisma.dataSource.update({
      where: { id },
      data: {
        name: updateDataSourceDto.name,
        description: updateDataSourceDto.description,
        type: updateDataSourceDto.type,
        url: updateDataSourceDto.url,
        method: updateDataSourceDto.method,
        headers: updateDataSourceDto.headers,
        refreshInterval: updateDataSourceDto.refreshInterval,
        jsonPath: updateDataSourceDto.jsonPath,
        isActive: updateDataSourceDto.isActive,
      },
    });

    this.logger.log(`Data source updated: ${updatedDataSource.name}`);

    return updatedDataSource;
  }

  /**
   * Delete data source
   */
  async remove(id: number) {
    const dataSource = await this.prisma.dataSource.findUnique({
      where: { id },
      include: {
        _count: {
          select: { customWidgets: true },
        },
      },
    });

    if (!dataSource) {
      throw new NotFoundException('Data source not found');
    }

    if (dataSource._count.customWidgets > 0) {
      throw new BadRequestException(
        `Cannot delete data source with ${dataSource._count.customWidgets} widget(s) using it`,
      );
    }

    await this.prisma.dataSource.delete({
      where: { id },
    });

    this.logger.log(`Data source deleted: ${dataSource.name}`);

    return { message: 'Data source deleted successfully' };
  }

  /**
   * Test fetch data from the source and update status
   * Returns the data along with extracted fields for the widget editor
   */
  async testFetch(id: number) {
    const dataSource = await this.prisma.dataSource.findUnique({
      where: { id },
    });

    if (!dataSource) {
      throw new NotFoundException('Data source not found');
    }

    try {
      const data = await this.fetchDataFromSource({
        ...dataSource,
        headers: dataSource.headers as object | null,
      });
      // Extract fields from the data so the widget editor can show a dropdown
      const fields = this.extractFieldsWithMeta(data);

      // Update status to show API is working
      await this.prisma.dataSource.update({
        where: { id },
        data: {
          lastData: data as object,
          lastFetchedAt: new Date(),
          lastError: null,
        },
      });

      return {
        success: true,
        data,
        fields,
        fetchedAt: new Date().toISOString(),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      // Update status to show API error
      await this.prisma.dataSource.update({
        where: { id },
        data: {
          lastError: errorMessage,
          lastFetchedAt: new Date(),
        },
      });

      return {
        success: false,
        error: errorMessage,
        fetchedAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Force refresh data and cache it
   */
  async refresh(id: number) {
    const dataSource = await this.prisma.dataSource.findUnique({
      where: { id },
    });

    if (!dataSource) {
      throw new NotFoundException('Data source not found');
    }

    try {
      const data = await this.fetchDataFromSource({
        ...dataSource,
        headers: dataSource.headers as object | null,
      });

      // Update cached data
      const updatedDataSource = await this.prisma.dataSource.update({
        where: { id },
        data: {
          lastData: data as object,
          lastFetchedAt: new Date(),
          lastError: null,
        },
      });

      this.logger.log(`Data source refreshed: ${dataSource.name}`);

      return {
        success: true,
        data,
        dataSource: updatedDataSource,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      // Update error status
      await this.prisma.dataSource.update({
        where: { id },
        data: {
          lastError: errorMessage,
          lastFetchedAt: new Date(),
        },
      });

      this.logger.error(`Data source fetch failed: ${dataSource.name} - ${errorMessage}`);

      throw new BadRequestException(`Failed to fetch data: ${errorMessage}`);
    }
  }

  /**
   * Fetch data from a data source
   */
  async fetchDataFromSource(dataSource: {
    type: string;
    url: string;
    method: string;
    headers?: object | null;
    jsonPath?: string | null;
  }): Promise<unknown> {
    try {
      await validateUrlSafety(dataSource.url);
    } catch (err) {
      throw new BadRequestException(err instanceof Error ? err.message : 'Invalid URL');
    }
    const headers = (dataSource.headers as Record<string, string>) || {};

    if (dataSource.type === 'json') {
      return this.fetchJson(dataSource.url, dataSource.method, headers, dataSource.jsonPath);
    } else if (dataSource.type === 'rss') {
      return this.fetchRss(dataSource.url, headers);
    }

    throw new Error(`Unknown data source type: ${dataSource.type}`);
  }

  /**
   * Mask sensitive values in headers to prevent leaking API keys/tokens in responses
   */
  private maskSensitiveHeaders(headers: Record<string, string> | null): Record<string, string> | null {
    if (!headers) return null;
    const sensitiveKeys = ['authorization', 'x-api-key', 'api-key', 'token', 'bearer', 'secret'];
    const masked = { ...headers };
    for (const key of Object.keys(masked)) {
      if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
        const val = masked[key];
        masked[key] = val && val.length > 4 ? val.slice(0, 4) + '••••••••' : '••••••••';
      }
    }
    return masked;
  }

  /**
   * Fetch JSON data from an API
   */
  private async fetchJson(
    url: string,
    method: string,
    headers: Record<string, string>,
    jsonPath?: string | null,
  ): Promise<unknown> {
    // Use DNS-pinning agents to prevent DNS rebinding attacks (TOCTOU)
    const response = await axios({
      method: method as 'GET' | 'POST',
      url,
      headers,
      timeout: 30000,
      maxContentLength: 5 * 1024 * 1024,
      maxBodyLength: 5 * 1024 * 1024,
      httpAgent: createSafeHttpAgent(),
      httpsAgent: createSafeHttpsAgent(),
    });

    let data = response.data;

    // Apply JSONPath extraction if specified
    if (jsonPath) {
      data = this.extractWithJsonPath(data, jsonPath);
    }

    return data;
  }

  /**
   * Fetch and parse RSS/Atom feed
   */
  private async fetchRss(
    url: string,
    headers: Record<string, string>,
  ): Promise<unknown> {
    // Use DNS-pinning agents to prevent DNS rebinding attacks (TOCTOU)
    const response = await axios({
      method: 'GET',
      url,
      headers: {
        ...headers,
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml',
      },
      timeout: 30000,
      responseType: 'text',
      maxContentLength: 1 * 1024 * 1024,
      maxBodyLength: 1 * 1024 * 1024,
      httpAgent: createSafeHttpAgent(),
      httpsAgent: createSafeHttpsAgent(),
    });

    return this.parseRss(response.data);
  }

  /**
   * Parse RSS/Atom XML to normalized JSON
   */
  private parseRss(xml: string): {
    title?: string;
    description?: string;
    link?: string;
    items: Array<{
      title?: string;
      description?: string;
      link?: string;
      pubDate?: string;
    }>;
  } {
    // Simple RSS/Atom parser without external dependencies
    const result: {
      title?: string;
      description?: string;
      link?: string;
      items: Array<{
        title?: string;
        description?: string;
        link?: string;
        pubDate?: string;
      }>;
    } = { items: [] };

    // Extract channel/feed info
    const titleMatch = xml.match(/<title[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/i);
    if (titleMatch) {
      result.title = this.cleanXmlText(titleMatch[1]);
    }

    const descMatch = xml.match(/<description[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/description>/i);
    if (descMatch) {
      result.description = this.cleanXmlText(descMatch[1]);
    }

    // Extract items (RSS) or entries (Atom)
    const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>|<entry[^>]*>([\s\S]*?)<\/entry>/gi;
    let itemMatch;

    while ((itemMatch = itemRegex.exec(xml)) !== null) {
      const itemContent = itemMatch[1] || itemMatch[2];
      const item: {
        title?: string;
        description?: string;
        link?: string;
        pubDate?: string;
      } = {};

      // Title
      const itemTitle = itemContent.match(/<title[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/i);
      if (itemTitle) {
        item.title = this.cleanXmlText(itemTitle[1]);
      }

      // Description/Summary/Content
      const itemDesc = itemContent.match(
        /<(?:description|summary|content)[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/(?:description|summary|content)>/i,
      );
      if (itemDesc) {
        item.description = this.cleanXmlText(itemDesc[1]).substring(0, 500);
      }

      // Link
      const itemLink = itemContent.match(/<link[^>]*>([^<]*)<\/link>|<link[^>]*href=["']([^"']+)["']/i);
      if (itemLink) {
        item.link = itemLink[1] || itemLink[2];
      }

      // Publication date
      const itemDate = itemContent.match(
        /<(?:pubDate|published|updated)[^>]*>([^<]*)<\/(?:pubDate|published|updated)>/i,
      );
      if (itemDate) {
        item.pubDate = itemDate[1];
      }

      result.items.push(item);
    }

    return result;
  }

  /**
   * Clean XML text content
   */
  private cleanXmlText(text: string): string {
    return text
      .replace(/<[^>]+>/g, '') // Remove HTML tags
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Extract data using JSONPath-like syntax
   * Supports: $.field, $.nested.field, $.array[0], $.array[*].field
   */
  private extractWithJsonPath(data: unknown, path: string): unknown {
    if (!path || path === '$') {
      return data;
    }

    // Remove leading $. if present
    const cleanPath = path.replace(/^\$\.?/, '');
    const parts = cleanPath.split(/\.|\[|\]/).filter(Boolean);

    let current: unknown = data;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return null;
      }

      if (part === '*' && Array.isArray(current)) {
        // Wildcard for arrays - return all items
        return current;
      }

      if (Array.isArray(current)) {
        const index = parseInt(part, 10);
        if (!isNaN(index)) {
          current = current[index];
        } else {
          // Map over array to extract field from each item
          current = current.map((item) =>
            typeof item === 'object' && item !== null
              ? (item as Record<string, unknown>)[part]
              : undefined,
          );
        }
      } else if (typeof current === 'object' && current !== null) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return null;
      }
    }

    return current;
  }

  /**
   * Get cached data for a data source, refreshing if stale
   */
  async getCachedData(id: number): Promise<unknown> {
    const dataSource = await this.prisma.dataSource.findUnique({
      where: { id },
    });

    if (!dataSource) {
      throw new NotFoundException('Data source not found');
    }

    // Check if data is stale
    const isStale =
      !dataSource.lastFetchedAt ||
      Date.now() - dataSource.lastFetchedAt.getTime() >
        dataSource.refreshInterval * 1000;

    if (isStale || !dataSource.lastData) {
      try {
        const data = await this.fetchDataFromSource({
          ...dataSource,
          headers: dataSource.headers as object | null,
        });
        await this.prisma.dataSource.update({
          where: { id },
          data: {
            lastData: data as object,
            lastFetchedAt: new Date(),
            lastError: null,
          },
        });
        return data;
      } catch (error) {
        // Return cached data if available, even if stale
        if (dataSource.lastData) {
          return dataSource.lastData;
        }
        throw error;
      }
    }

    return dataSource.lastData;
  }
}
