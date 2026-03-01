import { describe, it, expect, beforeEach } from 'bun:test';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { CustomWidgetsService } from './custom-widgets.service';
import { ScriptExecutorService } from './services/script-executor.service';
import { createMockPrisma } from '../test/mocks/prisma.mock';
import { createMock } from '../test/mocks/helpers';
import { CUSTOM_WIDGET_TEMPLATE_OFFSET } from '../common/constants/widget.constants';

describe('CustomWidgetsService', () => {
  let service: CustomWidgetsService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;
  let mockDataSourcesService: { getCachedData: ReturnType<typeof createMock> };
  let scriptExecutor: ScriptExecutorService;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    mockDataSourcesService = { getCachedData: createMock() };
    scriptExecutor = new ScriptExecutorService();
    service = new CustomWidgetsService(
      mockPrisma as any,
      mockDataSourcesService as any,
      scriptExecutor,
    );
  });

  // ─── extractField() ─────────────────────────────────────────────────

  describe('extractField()', () => {
    const extract = (data: unknown, path: string) =>
      (service as any).extractField(data, path);

    it('should extract a simple top-level field', () => {
      expect(extract({ price: 100 }, 'price')).toBe(100);
    });

    it('should extract a nested field with dot notation', () => {
      expect(extract({ a: { b: 1 } }, 'a.b')).toBe(1);
    });

    it('should extract a field from an array index', () => {
      const data = { items: [{ name: 'test' }] };
      expect(extract(data, 'items[0].name')).toBe('test');
    });

    it('should return null for a missing path', () => {
      expect(extract({ price: 100 }, 'missing.path')).toBeNull();
    });

    it('should return data as-is when path is empty', () => {
      const data = { price: 100 };
      expect(extract(data, '')).toEqual(data);
    });

    it('should return null/undefined when data is null', () => {
      expect(extract(null, 'field')).toBeNull();
    });

    it('should return undefined when data is undefined', () => {
      expect(extract(undefined, 'field')).toBeUndefined();
    });

    it('should handle deeply nested array access', () => {
      const data = { a: { b: [{ c: [{ d: 'deep' }] }] } };
      expect(extract(data, 'a.b[0].c[0].d')).toBe('deep');
    });

    it('should return null when array index is out of bounds', () => {
      const data = { items: [{ name: 'only' }] };
      expect(extract(data, 'items[5].name')).toBeNull();
    });
  });

  // ─── renderValue() ──────────────────────────────────────────────────

  describe('renderValue()', () => {
    const renderValue = (config: Record<string, unknown>, data: unknown) =>
      (service as any).renderValue(config, data);

    it('should render a string value with prefix and suffix', () => {
      const config = { field: 'price', prefix: '$', suffix: ' USD' };
      expect(renderValue(config, { price: 42 })).toBe('$42 USD');
    });

    it('should JSON.stringify an object value', () => {
      const config = { field: 'meta', prefix: '', suffix: '' };
      const data = { meta: { a: 1 } };
      expect(renderValue(config, data)).toBe('{"a":1}');
    });

    it('should return { label, value } when label is set', () => {
      const config = { field: 'temp', prefix: '', suffix: 'C', label: 'Temperature' };
      const result = renderValue(config, { temp: 23 });
      expect(result).toEqual({ label: 'Temperature', value: '23C' });
    });

    it('should return formatted string when label is empty', () => {
      const config = { field: 'count', prefix: '', suffix: '' };
      expect(renderValue(config, { count: 7 })).toBe('7');
    });

    it('should show empty string for null value', () => {
      const config = { field: 'missing', prefix: '(', suffix: ')' };
      expect(renderValue(config, {})).toBe('()');
    });

    it('should handle missing prefix/suffix gracefully', () => {
      const config = { field: 'val' };
      expect(renderValue(config, { val: 'hello' })).toBe('hello');
    });
  });

  // ─── renderList() ───────────────────────────────────────────────────

  describe('renderList()', () => {
    const renderList = (config: Record<string, unknown>, data: unknown) =>
      (service as any).renderList(config, data);

    it('should render list from arrayPath with itemField', () => {
      const config = { arrayPath: 'rates', itemField: 'mid', maxItems: 5, listStyle: 'bullet' };
      const data = { rates: [{ mid: 4.25 }, { mid: 3.80 }] };
      const result = renderList(config, data);
      expect(result).toEqual(['• 4.25', '• 3.8']);
    });

    it('should use root array data when no arrayPath', () => {
      const config = { itemField: '', maxItems: 3, listStyle: 'bullet' };
      const data = ['alpha', 'beta', 'gamma'];
      const result = renderList(config, data);
      expect(result).toEqual(['• alpha', '• beta', '• gamma']);
    });

    it('should fall back to data.items for RSS feed structure', () => {
      const config = { itemField: 'title', maxItems: 2, listStyle: 'none' };
      const data = { items: [{ title: 'Article 1' }, { title: 'Article 2' }, { title: 'Article 3' }] };
      const result = renderList(config, data);
      expect(result).toEqual(['Article 1', 'Article 2']);
    });

    it('should apply different list styles', () => {
      const data = ['a', 'b', 'c'];
      expect(renderList({ maxItems: 3, listStyle: 'number' }, data)).toEqual([
        '1. a', '2. b', '3. c',
      ]);
      expect(renderList({ maxItems: 3, listStyle: 'dash' }, data)).toEqual([
        '- a', '- b', '- c',
      ]);
      expect(renderList({ maxItems: 3, listStyle: 'none' }, data)).toEqual([
        'a', 'b', 'c',
      ]);
      expect(renderList({ maxItems: 3, listStyle: 'bullet' }, data)).toEqual([
        '• a', '• b', '• c',
      ]);
    });

    it('should cap results with maxItems', () => {
      const data = [1, 2, 3, 4, 5, 6, 7];
      const result = renderList({ maxItems: 3, listStyle: 'none' }, data);
      expect(result).toHaveLength(3);
    });

    it('should JSON.stringify objects when no itemField is given', () => {
      const config = { maxItems: 1, listStyle: 'none' };
      const data = [{ a: 1 }];
      expect(renderList(config, data)).toEqual(['{"a":1}']);
    });

    it('should return empty array when arrayPath resolves to non-array', () => {
      const config = { arrayPath: 'notAnArray', maxItems: 5, listStyle: 'bullet' };
      expect(renderList(config, { notAnArray: 'string' })).toEqual([]);
    });
  });

  // ─── renderScript() ─────────────────────────────────────────────────

  describe('renderScript()', () => {
    const renderScript = (
      config: Record<string, unknown>,
      template: string | null,
      data: unknown,
    ) => (service as any).renderScript(config, template, data);

    it('should render value mode with prefix and suffix', () => {
      const config = {
        scriptCode: 'return $.price * 1000;',
        scriptOutputMode: 'value',
        prefix: '$',
        suffix: ' PLN',
      };
      expect(renderScript(config, null, { price: 4.25 })).toBe('$4250 PLN');
    });

    it('should render template mode with {{variables}}', () => {
      const config = {
        scriptCode: 'var greeting = "Hello"; var name = $.user;',
        scriptOutputMode: 'template',
      };
      const template = '{{greeting}}, {{name}}!';
      expect(renderScript(config, template, { user: 'World' })).toBe('Hello, World!');
    });

    it('should return error string on script failure', () => {
      const config = {
        scriptCode: 'return $.foo.bar.baz;',
        scriptOutputMode: 'value',
      };
      const result = renderScript(config, null, {});
      expect(result).toContain('Error:');
    });

    it('should return "No script defined" when scriptCode is empty', () => {
      const config = { scriptCode: '', scriptOutputMode: 'value' };
      expect(renderScript(config, null, {})).toBe('No script defined');
    });

    it('should keep unmatched {{placeholders}} in template mode', () => {
      const config = {
        scriptCode: 'var x = 1;',
        scriptOutputMode: 'template',
      };
      const template = '{{x}} and {{missing}}';
      expect(renderScript(config, template, {})).toBe('1 and {{missing}}');
    });

    it('should default to value mode when scriptOutputMode is not set', () => {
      const config = { scriptCode: 'return 42;' };
      expect(renderScript(config, null, {})).toBe('42');
    });
  });

  // ─── renderGrid() ───────────────────────────────────────────────────

  describe('renderGrid()', () => {
    const renderGrid = (config: Record<string, unknown>, data: unknown) =>
      (service as any).renderGrid(config, data);

    it('should render a grid with field extraction', () => {
      const config = {
        gridCols: 2,
        gridRows: 1,
        gridGap: 4,
        gridCells: {
          '0-0': { field: 'price', prefix: '$', suffix: '', fieldType: 'number' },
          '0-1': { field: 'name', prefix: '', suffix: '', fieldType: 'text' },
        },
      };
      const data = { price: 99, name: 'Widget' };
      const result = renderGrid(config, data);

      expect(result.type).toBe('grid');
      expect(result.gridCols).toBe(2);
      expect(result.gridRows).toBe(1);
      expect(result.gridGap).toBe(4);
      expect(result.cells).toHaveLength(2);
      expect(result.cells[0].formattedValue).toBe('$99');
      expect(result.cells[1].formattedValue).toBe('Widget');
    });

    it('should render a grid cell with script execution', () => {
      const config = {
        gridCols: 1,
        gridRows: 1,
        gridCells: {
          '0-0': { field: '', useScript: true, script: 'return $.a + $.b;', fieldType: 'number' },
        },
      };
      const result = renderGrid(config, { a: 10, b: 20 });
      expect(result.cells).toHaveLength(1);
      expect(result.cells[0].formattedValue).toBe('30');
      expect(result.cells[0].useScript).toBe(true);
    });

    it('should skip empty/missing cells', () => {
      const config = {
        gridCols: 2,
        gridRows: 2,
        gridCells: {
          '0-0': { field: 'val', fieldType: 'text' },
          // 0-1, 1-0, 1-1 are missing
        },
      };
      const result = renderGrid(config, { val: 'only' });
      expect(result.cells).toHaveLength(1);
      expect(result.cells[0].row).toBe(0);
      expect(result.cells[0].col).toBe(0);
    });

    it('should handle script error in grid cell gracefully', () => {
      const config = {
        gridCols: 1,
        gridRows: 1,
        gridCells: {
          '0-0': { field: '', useScript: true, script: 'return $.x.y.z;', fieldType: 'text' },
        },
      };
      const result = renderGrid(config, {});
      expect(result.cells[0].formattedValue).toContain('Error:');
      expect(result.cells[0].value).toBeNull();
    });

    it('should use default grid dimensions when not specified', () => {
      const result = renderGrid({ gridCells: {} }, {});
      expect(result.gridCols).toBe(2);
      expect(result.gridRows).toBe(2);
      expect(result.gridGap).toBe(8);
      expect(result.cells).toHaveLength(0);
    });

    it('should include alignment settings on cells', () => {
      const config = {
        gridCols: 1,
        gridRows: 1,
        gridCells: {
          '0-0': { field: 'x', fieldType: 'text', align: 'right', verticalAlign: 'top' },
        },
      };
      const result = renderGrid(config, { x: 'hi' });
      expect(result.cells[0].align).toBe('right');
      expect(result.cells[0].verticalAlign).toBe('top');
    });
  });

  // ─── renderContent() ────────────────────────────────────────────────

  describe('renderContent()', () => {
    const renderContent = (
      displayType: string,
      template: string | null,
      config: Record<string, unknown>,
      data: unknown,
    ) => (service as any).renderContent(displayType, template, config, data);

    it('should dispatch to renderValue for "value" type', () => {
      const result = renderContent('value', null, { field: 'x' }, { x: 'ok' });
      expect(result).toBe('ok');
    });

    it('should dispatch to renderList for "list" type', () => {
      const result = renderContent('list', null, { maxItems: 2, listStyle: 'none' }, ['a', 'b']);
      expect(result).toEqual(['a', 'b']);
    });

    it('should dispatch to renderScript for "script" type', () => {
      const result = renderContent(
        'script',
        null,
        { scriptCode: 'return 1;', scriptOutputMode: 'value' },
        {},
      );
      expect(result).toBe('1');
    });

    it('should dispatch to renderGrid for "grid" type', () => {
      const result = renderContent('grid', null, { gridCells: {} }, {});
      expect(result.type).toBe('grid');
    });

    it('should stringify data for unknown display type', () => {
      const result = renderContent('unknown', null, {}, 'raw');
      expect(result).toBe('raw');
    });
  });

  // ─── CRUD / Integration tests ───────────────────────────────────────

  describe('create()', () => {
    it('should throw BadRequestException if data source does not exist', async () => {
      mockPrisma.dataSource.findUnique.mockResolvedValue(null);

      await expect(
        service.create({
          name: 'Test',
          dataSourceId: 999,
          displayType: 'value',
          template: null,
          config: {},
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create widget when data source exists', async () => {
      mockPrisma.dataSource.findUnique.mockResolvedValue({ id: 1 });
      const widget = { id: 1, name: 'Test', dataSource: { id: 1 } };
      mockPrisma.customWidget.create.mockResolvedValue(widget);

      const result = await service.create({
        name: 'Test',
        dataSourceId: 1,
        displayType: 'value',
        template: null,
        config: {},
      } as any);

      expect(result).toEqual(widget);
      expect(mockPrisma.customWidget.create.calls).toHaveLength(1);
    });
  });

  describe('findOne()', () => {
    it('should throw NotFoundException when widget is not found', async () => {
      mockPrisma.customWidget.findUnique.mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });

    it('should return widget when found', async () => {
      const widget = { id: 1, name: 'W1' };
      mockPrisma.customWidget.findUnique.mockResolvedValue(widget);
      const result = await service.findOne(1);
      expect(result).toEqual(widget);
    });
  });

  describe('remove()', () => {
    it('should throw NotFoundException when widget does not exist', async () => {
      mockPrisma.customWidget.findUnique.mockResolvedValue(null);
      await expect(service.remove(42)).rejects.toThrow(NotFoundException);
    });

    it('should delete and return success message', async () => {
      mockPrisma.customWidget.findUnique.mockResolvedValue({ id: 1, name: 'W' });
      mockPrisma.customWidget.delete.mockResolvedValue({});

      const result = await service.remove(1);
      expect(result).toEqual({ message: 'Custom widget deleted successfully' });
      expect(mockPrisma.customWidget.delete.calls).toHaveLength(1);
    });
  });

  describe('update()', () => {
    it('should throw NotFoundException when widget does not exist', async () => {
      mockPrisma.customWidget.findUnique.mockResolvedValue(null);
      await expect(service.update(99, { name: 'New' } as any)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when changing to non-existent data source', async () => {
      mockPrisma.customWidget.findUnique.mockResolvedValue({ id: 1 });
      mockPrisma.dataSource.findUnique.mockResolvedValue(null);

      await expect(
        service.update(1, { dataSourceId: 999 } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should update widget successfully', async () => {
      const existing = { id: 1, name: 'Old' };
      const updated = { id: 1, name: 'New', dataSource: { id: 1 } };
      mockPrisma.customWidget.findUnique.mockResolvedValue(existing);
      mockPrisma.customWidget.update.mockResolvedValue(updated);

      const result = await service.update(1, { name: 'New' } as any);
      expect(result).toEqual(updated);
    });
  });

  describe('getAsWidgetTemplates()', () => {
    it('should map custom widgets to templates with offset IDs', async () => {
      const widgets = [
        {
          id: 3,
          name: 'Currency',
          description: 'Shows currency rates',
          displayType: 'value',
          template: null,
          config: { field: 'rate' },
          minWidth: 120,
          minHeight: 60,
          dataSource: { id: 1, name: 'NBP API', type: 'json', isActive: true },
        },
        {
          id: 7,
          name: 'News',
          description: null,
          displayType: 'list',
          template: null,
          config: {},
          minWidth: 200,
          minHeight: 100,
          dataSource: { id: 2, name: 'RSS Feed', type: 'rss', isActive: true },
        },
      ];
      mockPrisma.customWidget.findMany.mockResolvedValue(widgets);

      const result = await service.getAsWidgetTemplates();

      expect(result).toHaveLength(2);

      // First widget
      expect(result[0].id).toBe(CUSTOM_WIDGET_TEMPLATE_OFFSET + 3);
      expect(result[0].name).toBe('custom-3');
      expect(result[0].label).toBe('Currency');
      expect(result[0].description).toBe('Shows currency rates');
      expect(result[0].category).toBe('custom');
      expect(result[0].minWidth).toBe(120);
      expect(result[0].minHeight).toBe(60);
      expect(result[0].defaultConfig.customWidgetId).toBe(3);
      expect(result[0].defaultConfig.displayType).toBe('value');
      expect(result[0].defaultConfig.field).toBe('rate');
      expect(result[0].defaultConfig.fontSize).toBe(24);

      // Second widget - null description uses data source name fallback
      expect(result[1].id).toBe(CUSTOM_WIDGET_TEMPLATE_OFFSET + 7);
      expect(result[1].description).toBe('Custom widget using RSS Feed');
    });

    it('should return empty array when no custom widgets exist', async () => {
      mockPrisma.customWidget.findMany.mockResolvedValue([]);
      const result = await service.getAsWidgetTemplates();
      expect(result).toEqual([]);
    });
  });

  describe('getWithData()', () => {
    it('should throw NotFoundException when widget not found', async () => {
      mockPrisma.customWidget.findUnique.mockResolvedValue(null);
      await expect(service.getWithData(999)).rejects.toThrow(NotFoundException);
    });

    it('should return widget with rendered content', async () => {
      const widget = {
        id: 1,
        name: 'Test',
        dataSourceId: 5,
        displayType: 'value',
        template: null,
        config: { field: 'price', prefix: '$', suffix: '' },
        dataSource: { id: 5 },
      };
      mockPrisma.customWidget.findUnique.mockResolvedValue(widget);
      mockDataSourcesService.getCachedData.mockResolvedValue({ price: 100 });

      const result = await service.getWithData(1);

      expect(result.widget).toEqual(widget);
      expect(result.data).toEqual({ price: 100 });
      expect(result.renderedContent).toBe('$100');
    });
  });
});
