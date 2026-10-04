import { describe, it, expect, beforeEach } from 'bun:test';
import type { Response } from 'express';
import { PluginsController } from './plugins.controller';
import type { PluginsService } from './plugins.service';
import type { OAuthService } from './oauth/oauth.service';
import { createMock, type MockFn } from '../test/mocks/helpers';

describe('PluginsController — GET instances/:id/render', () => {
  let controller: PluginsController;
  let renderInstance: MockFn;
  let previewPaletteForInstance: MockFn;
  let res: Response;

  beforeEach(() => {
    renderInstance = createMock().mockResolvedValue(Buffer.from('PNG'));
    previewPaletteForInstance = createMock().mockResolvedValue(undefined);
    controller = new PluginsController(
      { renderInstance, previewPaletteForInstance } as unknown as PluginsService,
      {} as unknown as OAuthService,
    );
    // Minimal express Response stub: the handler only calls set() and send().
    res = { set: createMock(), send: createMock() } as unknown as Response;
  });

  it('threads palette=spectra6 to the plugin renderer', async () => {
    await controller.renderInstance(3, 'full', 'device', 'spectra6', res);
    expect(renderInstance.calls[0]).toEqual([3, 'full', 'device', 'spectra6']);
  });

  it('ignores unknown palette values', async () => {
    await controller.renderInstance(3, 'full', 'device', 'acep7', res);
    expect(renderInstance.calls[0]).toEqual([3, 'full', 'device', undefined]);
  });

  it('renders without a palette when none is given', async () => {
    await controller.renderInstance(3, 'full', 'device', undefined as unknown as string, res);
    expect(renderInstance.calls[0]).toEqual([3, 'full', 'device', undefined]);
  });

  it('einkPreview without palette uses spectra6 when the instance is on a colour device', async () => {
    previewPaletteForInstance.mockResolvedValue('spectra6');
    await controller.renderInstance(3, 'full', 'einkPreview', undefined as unknown as string, res);
    expect(previewPaletteForInstance.calls).toEqual([[3]]);
    expect(renderInstance.calls[0]).toEqual([3, 'full', 'einkPreview', 'spectra6']);
  });

  it('einkPreview without palette stays mono when the instance is only on mono devices', async () => {
    await controller.renderInstance(3, 'full', 'einkPreview', undefined as unknown as string, res);
    expect(previewPaletteForInstance.calls).toEqual([[3]]);
    expect(renderInstance.calls[0]).toEqual([3, 'full', 'einkPreview', undefined]);
  });

  it('device mode without palette never consults the device lookup', async () => {
    previewPaletteForInstance.mockResolvedValue('spectra6');
    await controller.renderInstance(3, 'full', 'device', undefined as unknown as string, res);
    expect(previewPaletteForInstance.calls).toEqual([]);
    expect(renderInstance.calls[0]).toEqual([3, 'full', 'device', undefined]);
  });

  it('preview mode without palette never consults the device lookup', async () => {
    previewPaletteForInstance.mockResolvedValue('spectra6');
    await controller.renderInstance(3, 'full', 'preview', undefined as unknown as string, res);
    expect(previewPaletteForInstance.calls).toEqual([]);
    expect(renderInstance.calls[0]).toEqual([3, 'full', 'preview', undefined]);
  });

  it('an explicit palette wins over the device lookup in einkPreview', async () => {
    await controller.renderInstance(3, 'full', 'einkPreview', 'spectra6', res);
    expect(previewPaletteForInstance.calls).toEqual([]);
    expect(renderInstance.calls[0]).toEqual([3, 'full', 'einkPreview', 'spectra6']);
  });
});
