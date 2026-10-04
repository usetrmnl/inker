import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as sharp from 'sharp';
import { PrismaService } from '../prisma/prisma.service';
import { PluginRendererService, PluginLayout } from './plugin-renderer.service';
import type { ColorPalette } from '../common/utils/spectra6.util';
import { EncryptionService } from '../common/services/encryption.service';
import { OAuthService } from './oauth/oauth.service';
import {
  CreatePluginDto,
  UpdatePluginDto,
  CreatePluginInstanceDto,
  UpdatePluginInstanceDto,
} from './dto/create-plugin.dto';

const SETTINGS_MASK = '••••••••';
const MAX_FETCHES_PER_MINUTE = 30;

@Injectable()
export class PluginsService {
  private readonly logger = new Logger(PluginsService.name);
  private fetchCounter = 0;
  private fetchCounterResetAt = Date.now() + 60000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly pluginRenderer: PluginRendererService,
    private readonly encryption: EncryptionService,
    private readonly oauthService: OAuthService,
  ) {}

  // ========================
  // Plugin CRUD
  // ========================

  async findAllPlugins() {
    return this.prisma.plugin.findMany({
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      include: {
        _count: { select: { instances: true } },
        instances: { select: { id: true, settings: true }, orderBy: { id: 'asc' } },
      },
    });
  }

  async findPluginById(id: number) {
    const plugin = await this.prisma.plugin.findUnique({
      where: { id },
      include: { instances: true },
    });
    if (!plugin) throw new NotFoundException(`Plugin ${id} not found`);
    return {
      ...plugin,
      instances: plugin.instances.map((i) => this.maskEncryptedSettings(i)),
    };
  }

  async findPluginBySlug(slug: string) {
    return this.prisma.plugin.findUnique({ where: { slug } });
  }

  async createPlugin(dto: CreatePluginDto) {
    return this.prisma.plugin.create({ data: dto });
  }

  async updatePlugin(id: number, dto: UpdatePluginDto) {
    return this.prisma.plugin.update({ where: { id }, data: dto });
  }

  async deletePlugin(id: number) {
    return this.prisma.plugin.delete({ where: { id } });
  }

  // ========================
  // Install / Uninstall
  // ========================

  async installPlugin(id: number) {
    return this.prisma.plugin.update({
      where: { id },
      data: { isInstalled: true },
    });
  }

  async uninstallPlugin(id: number) {
    return this.prisma.plugin.update({
      where: { id },
      data: { isInstalled: false },
    });
  }

  // ========================
  // Plugin Instances
  // ========================

  async findAllInstances() {
    const instances = await this.prisma.pluginInstance.findMany({
      include: { plugin: true },
      orderBy: { createdAt: 'desc' },
    });
    return instances.map((i) => this.maskEncryptedSettings(i));
  }

  async findInstanceById(id: number) {
    const instance = await this.prisma.pluginInstance.findUnique({
      where: { id },
      include: { plugin: true },
    });
    if (!instance) throw new NotFoundException(`Plugin instance ${id} not found`);
    return instance;
  }

  async createInstance(dto: CreatePluginInstanceDto) {
    const plugin = await this.findPluginById(dto.pluginId);
    const { plain, encrypted } = this.separateEncryptedFields(
      dto.settings || {},
      (plugin.settingsSchema as any[]) || [],
    );

    return this.prisma.pluginInstance.create({
      data: {
        pluginId: dto.pluginId,
        name: dto.name,
        settings: plain,
        settingsEncrypted: encrypted,
      },
      include: { plugin: true },
    });
  }

  async updateInstance(id: number, dto: UpdatePluginInstanceDto) {
    const instance = await this.prisma.pluginInstance.findUnique({
      where: { id },
      include: { plugin: true },
    });
    if (!instance) throw new NotFoundException(`Plugin instance ${id} not found`);

    if (dto.settings) {
      const existingEncrypted = (instance.settingsEncrypted || {}) as Record<string, string>;
      const schema = (instance.plugin.settingsSchema as any[]) || [];
      const encryptedKeys = new Set(schema.filter(f => f.encrypted).map(f => f.key));

      for (const key of encryptedKeys) {
        if (dto.settings[key] === SETTINGS_MASK && existingEncrypted[key]) {
          delete dto.settings[key];
        }
      }

      const { plain, encrypted } = this.separateEncryptedFields(dto.settings, schema);

      return this.prisma.pluginInstance.update({
        where: { id },
        data: {
          name: dto.name,
          settings: plain,
          settingsEncrypted: { ...existingEncrypted, ...encrypted },
          lastData: Prisma.DbNull,
          lastFetchedAt: null,
          lastError: null,
        },
        include: { plugin: true },
      });
    }

    return this.prisma.pluginInstance.update({
      where: { id },
      data: { name: dto.name },
      include: { plugin: true },
    });
  }

  async findInstanceByIdMasked(id: number) {
    const instance = await this.findInstanceById(id);
    return this.maskEncryptedSettings(instance);
  }

  getDecryptedSettings(instance: any): Record<string, any> {
    const plain = (instance.settings || {}) as Record<string, any>;
    const encrypted = (instance.settingsEncrypted || {}) as Record<string, string>;
    if (Object.keys(encrypted).length === 0) return plain;
    return { ...plain, ...this.encryption.decryptObject(encrypted) };
  }

  private separateEncryptedFields(
    settings: Record<string, any>,
    schema: any[],
  ): { plain: Record<string, any>; encrypted: Record<string, string> } {
    const encryptedKeys = new Set(schema.filter(f => f.encrypted).map(f => f.key));
    const plain: Record<string, any> = {};
    const toEncrypt: Record<string, any> = {};

    for (const [key, value] of Object.entries(settings)) {
      if (encryptedKeys.has(key) && value !== undefined && value !== null && value !== '') {
        toEncrypt[key] = value;
      } else {
        plain[key] = value;
      }
    }

    const encrypted = Object.keys(toEncrypt).length > 0
      ? this.encryption.encryptObject(toEncrypt)
      : {};

    return { plain, encrypted };
  }

  private maskEncryptedSettings(instance: any): any {
    const encrypted = (instance.settingsEncrypted || {}) as Record<string, string>;
    if (Object.keys(encrypted).length === 0) return instance;

    const maskedSettings = { ...(instance.settings as Record<string, any>) };
    for (const key of Object.keys(encrypted)) {
      maskedSettings[key] = SETTINGS_MASK;
    }

    return { ...instance, settings: maskedSettings, settingsEncrypted: undefined };
  }

  async deleteInstance(id: number) {
    return this.prisma.pluginInstance.delete({ where: { id } });
  }

  private validateSettings(settings: Record<string, any>, schema: any[]): void {
    for (const field of schema) {
      const value = settings[field.key];
      if (field.required && (value === undefined || value === null || value === '')) {
        throw new Error(`Setting "${field.label || field.key}" is required`);
      }
      if (value === undefined || value === null || value === '') continue;
      if (field.type === 'number' && typeof value !== 'number' && isNaN(Number(value))) {
        throw new Error(`Setting "${field.label || field.key}" must be a number`);
      }
      if (field.type === 'select' && field.options?.length > 0) {
        const validOptions = field.options.map((o: any) => typeof o === 'object' ? o.value : o);
        if (!validOptions.includes(value)) {
          throw new Error(`Setting "${field.label || field.key}" must be one of: ${validOptions.join(', ')}`);
        }
      }
    }
  }

  // ========================
  // Data Fetching
  // ========================

  async fetchData(instanceId: number): Promise<Record<string, any>> {
    const instance = await this.findInstanceById(instanceId);
    const plugin = instance.plugin;
    const settings = this.getDecryptedSettings(instance);

    // Check cache
    if (instance.lastFetchedAt && instance.lastData) {
      const age = (Date.now() - instance.lastFetchedAt.getTime()) / 1000;
      if (age < plugin.refreshInterval) {
        return instance.lastData as Record<string, any>;
      }
    }

    // Rate limiting
    if (Date.now() > this.fetchCounterResetAt) {
      this.fetchCounter = 0;
      this.fetchCounterResetAt = Date.now() + 60000;
    }
    if (this.fetchCounter >= MAX_FETCHES_PER_MINUTE) {
      this.logger.warn(`Rate limit reached (${MAX_FETCHES_PER_MINUTE}/min), returning cached data`);
      return (instance.lastData as Record<string, any>) || {};
    }
    this.fetchCounter++;

    // Pre-flight: check required/encrypted settings before making external requests
    const schema = (plugin.settingsSchema as any[]) || [];
    const missingFields = schema
      .filter(f => (f.encrypted || f.required) && !settings[f.key])
      .map(f => f.label || f.key);
    if (missingFields.length > 0) {
      const errorMsg = `[settings] Missing required: ${missingFields.join(', ')}`;
      this.logger.warn(`Plugin ${plugin.slug}: ${errorMsg}`);
      await this.prisma.pluginInstance.update({
        where: { id: instanceId },
        data: { lastError: errorMsg },
      });
      return (instance.lastData as Record<string, any>) || {};
    }

    try {
      // Inject OAuth access token if available
      if ((plugin as any).oauthProvider) {
        const accessToken = await this.oauthService.getAccessToken(instanceId);
        if (accessToken) {
          settings.oauth_access_token = accessToken;
        }
      }

      const data = await this.executePlugin(plugin, settings);

      await this.prisma.pluginInstance.update({
        where: { id: instanceId },
        data: { lastData: data, lastFetchedAt: new Date(), lastError: null },
      });

      return data;
    } catch (error) {
      const msg = error.message || String(error);
      const prefix = msg.includes('HTTP ') || msg.includes('timeout') ? '[network]' : '[plugin]';
      const errorMsg = msg.startsWith('[') ? msg : `${prefix} ${msg}`;
      this.logger.error(`Plugin ${plugin.slug} fetch failed: ${errorMsg}`);
      await this.prisma.pluginInstance.update({
        where: { id: instanceId },
        data: { lastError: errorMsg },
      });
      return (instance.lastData as Record<string, any>) || {};
    }
  }

  async fetchDataForPlugin(pluginId: number, settings: Record<string, any> = {}): Promise<Record<string, any>> {
    const plugin = await this.findPluginById(pluginId);
    try {
      return await this.executePlugin(plugin, settings);
    } catch (error) {
      this.logger.error(`Plugin ${plugin.slug} execute failed: ${error.message}`);
      return {};
    }
  }

  /**
   * Execute a plugin's data pipeline.
   * Priority: 1) JS adapter, 2) URL fetch
   */
  private async executePlugin(plugin: any, settings: Record<string, any>): Promise<Record<string, any>> {
    // JS adapter (for user-created plugins with dataTransform)
    if (plugin.dataTransform) {
      return this.runAsyncTransform(plugin.dataTransform, settings, plugin.slug);
    }

    // URL fetch (for URL-based custom plugins)
    if (plugin.dataUrl) {
      const url = this.interpolate(plugin.dataUrl, settings);
      const headers: Record<string, string> = { 'Accept': 'application/json' };
      if (plugin.dataHeaders) {
        for (const [key, value] of Object.entries(plugin.dataHeaders as Record<string, string>)) {
          headers[key] = this.interpolate(value, settings);
        }
      }
      const response = await fetch(url, {
        method: plugin.dataMethod || 'GET',
        headers,
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      let data = await response.json();
      if (plugin.dataPath) data = this.extractByPath(data, plugin.dataPath);
      return data;
    }

    return {};
  }

  private async runAsyncTransform(
    script: string,
    settings: Record<string, any>,
    slug: string,
  ): Promise<Record<string, any>> {
    try {
      const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
      const fn = new AsyncFunction('settings', 'fetch', script);
      const result = await Promise.race([
        fn(settings, globalThis.fetch),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Plugin timeout (10s)')), 10000)),
      ]);
      return (result && typeof result === 'object') ? result : {};
    } catch (error) {
      this.logger.error(`Plugin ${slug} JS adapter failed: ${error.message}`);
      throw error;
    }
  }

  // ========================
  // Rendering
  // ========================

  /**
   * Preview a plugin with mock data or placeholder card.
   */
  async previewPlugin(
    plugin: any,
    layout: PluginLayout = 'full',
  ): Promise<Buffer> {
    const { width, height } = this.getDimensionsForLayout(layout);

    // For custom plugins with Liquid markup, render with mock data
    const markup = this.pluginRenderer.selectMarkup(plugin, layout);
    if (markup) {
      try {
        const mockData = this.generateMockData(markup);
        return await this.pluginRenderer.renderToPng(markup, mockData, {}, width, height, 'preview');
      } catch (e) {
        this.logger.warn(`Plugin ${plugin.slug} Liquid preview failed: ${e.message}`);
      }
    }

    // Fallback: placeholder card
    return this.renderPluginPlaceholder(plugin, width, height);
  }

  /**
   * Preview raw Liquid markup with provided or auto-generated mock data (for plugin creator).
   */
  async previewMarkup(markup: string, data: Record<string, any> = {}): Promise<Buffer> {
    const mockData = Object.keys(data).length > 0 ? data : this.generateMockData(markup);
    return this.pluginRenderer.renderToPng(markup, mockData, {}, 800, 480, 'preview');
  }

  /**
   * Palette for admin previews of an instance: 'spectra6' when any device whose playlist
   * shows this instance is a Spectra 6 (6-colour, PNG) model, so previews match the panel.
   */
  async previewPaletteForInstance(instanceId: number): Promise<ColorPalette | undefined> {
    const colourDevice = await this.prisma.device.findFirst({
      where: {
        model: { is: { colors: 6, mimeType: { not: 'image/bmp' } } },
        playlist: { is: { items: { some: { pluginInstanceId: instanceId } } } },
      },
      select: { id: true },
    });
    return colourDevice ? 'spectra6' : undefined;
  }

  /**
   * Render a plugin instance to PNG for device display.
   * `palette` (e.g. 'spectra6') keeps colour for colour e-ink panels in device/einkPreview modes.
   */
  async renderInstance(
    instanceId: number,
    layout: PluginLayout = 'full',
    mode: 'device' | 'preview' | 'einkPreview' = 'device',
    palette?: ColorPalette,
  ): Promise<Buffer> {
    const instance = await this.findInstanceById(instanceId);
    const plugin = instance.plugin;
    const settings = this.getDecryptedSettings(instance);
    const { width, height } = this.getDimensionsForLayout(layout);

    // Grafana: screenshot the panel URL directly via Puppeteer
    if (plugin.slug === 'grafana_panel' && settings.dashboard_uid && settings.panel_id) {
      const conn = await this.getGrafanaConnection(instance);
      if (conn.grafana_url && conn.api_key) {
        const rw = Number(settings.screen_width) || width;
        const rh = Number(settings.screen_height) || height;
        const baseUrl = conn.grafana_url.replace(/\/+$/, '');
        const from = settings.time_range || 'now-6h';
        const panelId = String(settings.panel_id);
        let panelUrl: string;
        let evaluateScript: string | undefined;

        // Script to strip all Grafana UI chrome
        const stripChromeScript = `
          // Hide dashboard controls (time picker, refresh, variables, links)
          document.querySelectorAll('[data-testid*="dashboard controls"], [data-testid*="template variable"], [data-testid*="Dashboard link"], [data-testid="public-dashboard-footer"]').forEach(el => el.style.display = 'none');
          // Hide all panel menu buttons (three-dot menus)
          document.querySelectorAll('[data-testid*="Panel menu"]').forEach(el => el.style.display = 'none');
          // Hide info icons in panel headers
          document.querySelectorAll('[data-testid*="icon-info-circle"]').forEach(el => el.style.display = 'none');
          document.body.style.overflow = 'hidden';
        `;

        if (panelId === 'full') {
          panelUrl = `${baseUrl}/d/${settings.dashboard_uid}?orgId=1&from=${from}&to=now&theme=light&kiosk`;
          evaluateScript = stripChromeScript;
        } else if (panelId.startsWith('row-')) {
          // Entire section: render each panel individually then compose into a grid
          const rowIdNum = parseInt(panelId.replace('row-', ''), 10);
          const dashResp = await fetch(`${baseUrl}/api/dashboards/uid/${settings.dashboard_uid}`, {
            headers: { Authorization: `Bearer ${conn.api_key}`, Accept: 'application/json' },
            signal: AbortSignal.timeout(10000),
          });
          if (!dashResp.ok) throw new Error(`Grafana returned ${dashResp.status}`);
          const dashData = await dashResp.json();
          const allPanels = dashData.dashboard?.panels || [];
          const row = allPanels.find((p: any) => p.id === rowIdNum && p.type === 'row');
          if (!row) throw new Error(`Row ${rowIdNum} not found`);

          // Collect child panel IDs — they may be nested (collapsed row) or siblings (expanded row)
          let childPanelIds: number[] = [];
          if (row.panels?.length) {
            // Collapsed row: panels are nested
            childPanelIds = row.panels.map((p: any) => p.id);
          } else {
            // Expanded row: panels are siblings between this row and the next row
            const rowIndex = allPanels.indexOf(row);
            for (let i = rowIndex + 1; i < allPanels.length; i++) {
              if (allPanels[i].type === 'row') break;
              childPanelIds.push(allPanels[i].id);
            }
          }

          if (childPanelIds.length === 0) throw new Error(`Row ${rowIdNum} has no panels`);
          this.logger.log(`[GrafanaSectionGrid] Row "${row.title}" has ${childPanelIds.length} panels: [${childPanelIds.join(', ')}]`);
          return this.renderGrafanaSectionGrid(baseUrl, settings.dashboard_uid, conn.api_key, childPanelIds, from, rw, rh, mode, palette);
        } else {
          // Single panel
          panelUrl = `${baseUrl}/d-solo/${settings.dashboard_uid}?orgId=1&panelId=${panelId}&from=${from}&to=now&width=${rw}&height=${rh}&theme=light`;
          evaluateScript = `
            document.querySelectorAll('span').forEach(span => {
              if (/^Powered by$/i.test(span.textContent?.trim() || '')) {
                const container = span.parentElement;
                if (container) container.remove();
              }
            });
            document.querySelectorAll('[data-testid*="icon-info-circle"]').forEach(el => el.style.display = 'none');
          `;
        }

        return this.pluginRenderer.renderUrlToPng(
          panelUrl,
          { Authorization: `Bearer ${conn.api_key}` },
          rw,
          rh,
          mode,
          evaluateScript,
          palette,
        );
      }
    }

    // Fetch fresh data
    const locals = await this.fetchData(instanceId);

    // Liquid rendering (for custom plugins with markup in DB)
    const markup = this.pluginRenderer.selectMarkup(plugin, layout);
    if (!markup) {
      throw new NotFoundException(`Plugin ${plugin.slug} has no template for layout ${layout}`);
    }

    return this.pluginRenderer.renderToPng(markup, locals, settings, width, height, mode, palette);
  }

  /**
   * Render a Grafana section by screenshotting each panel individually
   * via /d-solo/ and compositing them into a grid that fills the target resolution.
   */
  private async renderGrafanaSectionGrid(
    baseUrl: string,
    dashboardUid: string,
    apiKey: string,
    panelIds: number[],
    timeRange: string,
    targetWidth: number,
    targetHeight: number,
    mode: 'device' | 'preview' | 'einkPreview',
    palette?: ColorPalette,
  ): Promise<Buffer> {
    const count = panelIds.length;
    if (count === 0) throw new Error('No panels in section');

    // Calculate optimal grid that fills the target resolution with minimal waste.
    // Prefer grids where cells are close to square and there are few empty cells.
    const targetAspect = targetWidth / targetHeight;
    let bestCols = 1;
    let bestScore = Infinity;
    for (let cols = 1; cols <= count; cols++) {
      const rows = Math.ceil(count / cols);
      const emptyCells = (cols * rows) - count;
      const cellW = targetWidth / cols;
      const cellH = targetHeight / rows;
      const cellAspect = cellW / cellH;
      // Penalize: deviation from square cells + wasted cells
      const aspectPenalty = Math.abs(Math.log(cellAspect)); // 0 when square
      const wastePenalty = emptyCells / count; // fraction of wasted cells
      const score = aspectPenalty + wastePenalty * 2;
      if (score < bestScore) {
        bestScore = score;
        bestCols = cols;
      }
    }
    const cols = bestCols;
    const rows = Math.ceil(count / cols);
    const cellWidth = Math.floor(targetWidth / cols);
    const cellHeight = Math.floor(targetHeight / rows);

    this.logger.log(`[GrafanaSectionGrid] ${count} panels → ${cols}x${rows} grid, cell ${cellWidth}x${cellHeight}, target ${targetWidth}x${targetHeight}`);

    // Screenshot panels with limited concurrency (max 4 parallel pages)
    const browser = await this.pluginRenderer.screenRenderer.getBrowser();
    const MAX_CONCURRENT = 4;
    const panelBuffers: Buffer[] = [];
    for (let i = 0; i < panelIds.length; i += MAX_CONCURRENT) {
      const batch = panelIds.slice(i, i + MAX_CONCURRENT);
      const batchResults = await Promise.all(
        batch.map(async (panelId) => {
          const page = await browser.newPage();
        try {
          await page.setViewport({ width: cellWidth, height: cellHeight, deviceScaleFactor: 1 });
          await page.setExtraHTTPHeaders({ Authorization: `Bearer ${apiKey}` });
          const url = `${baseUrl}/d-solo/${dashboardUid}?orgId=1&panelId=${panelId}&from=${timeRange}&to=now&width=${cellWidth}&height=${cellHeight}&theme=light`;
          await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
          // Strip "Powered by Grafana" overlay and other chrome
          await page.evaluate(() => {
            // The "Powered by" overlay is a div with a span containing "Powered by" + a Grafana logo img
            // It's positioned absolute with top/right. Find and remove it.
            document.querySelectorAll('span').forEach(span => {
              if (/^Powered by$/i.test(span.textContent?.trim() || '')) {
                const container = span.parentElement;
                if (container) container.remove();
              }
            });
            // Also hide info icons in panel headers
            document.querySelectorAll('[data-testid*="icon-info-circle"]').forEach(el => (el as HTMLElement).style.display = 'none');
          });
          await new Promise((resolve) => setTimeout(resolve, 500));
          const png = Buffer.from(await page.screenshot({ type: 'png' }));
          // Resize to exact cell size
          return sharp(png).resize(cellWidth, cellHeight, { fit: 'fill' }).png().toBuffer();
        } finally {
          await page.close();
        }
      }),
    );
      panelBuffers.push(...batchResults);
    }

    // Composite all panels into the grid
    const composites: sharp.OverlayOptions[] = panelBuffers.map((buf, i) => ({
      input: buf,
      left: (i % cols) * cellWidth,
      top: Math.floor(i / cols) * cellHeight,
    }));

    const result = await sharp({
      create: { width: targetWidth, height: targetHeight, channels: 3, background: { r: 255, g: 255, b: 255 } },
    })
      .composite(composites)
      .png()
      .toBuffer();

    if (mode === 'preview') return result;

    const shouldNegate = mode === 'device';
    return this.pluginRenderer.screenRenderer.applyEinkProcessing(result, targetWidth, targetHeight, shouldNegate, 'png', 1, palette);
  }

  private async renderPluginPlaceholder(plugin: any, width: number, height: number): Promise<Buffer> {
    const category = (plugin.category || 'custom').charAt(0).toUpperCase() + (plugin.category || 'custom').slice(1);
    const source = (plugin.source || 'inker').toUpperCase();
    const description = plugin.description || 'No description available';
    const needsConfig = plugin.settingsSchema && (plugin.settingsSchema as any[]).some((f: any) => f.encrypted);

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: ${width}px; height: ${height}px; font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif; background: #fff; color: #000; }
  .card { width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: space-between; }
  .main { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px; text-align: center; }
  .name { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
  .desc { font-size: 14px; color: #666; max-width: 500px; line-height: 1.4; margin-bottom: 16px; }
  .badges { display: flex; gap: 8px; justify-content: center; }
  .badge { padding: 4px 12px; border-radius: 12px; font-size: 11px; font-weight: 600; border: 1px solid #ddd; }
  .badge--cat { background: #f5f5f5; }
  .badge--src { background: #e8f4fd; color: #1976d2; }
  .config { font-size: 12px; color: #999; margin-top: 12px; }
  .footer { padding: 12px 24px; border-top: 2px solid #000; display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 700; }
  .footer .instance { margin-left: auto; font-weight: 400; color: #999; }
</style></head><body>
<div class="card">
  <div class="main">
    <div class="name">${plugin.name}</div>
    <div class="desc">${description.slice(0, 120)}</div>
    <div class="badges">
      <span class="badge badge--cat">${category}</span>
      <span class="badge badge--src">${source}</span>
    </div>
    ${needsConfig ? '<div class="config">Requires API key to show live data</div>' : ''}
  </div>
  <div class="footer">
    <span>${plugin.name}</span>
    <span class="instance">Preview</span>
  </div>
</div>
</body></html>`;

    return this.pluginRenderer.screenRenderer.renderHtmlToPng(html, width, height);
  }

  private generateMockData(template: string): Record<string, any> {
    const data: Record<string, any> = {};
    const forMatches = template.matchAll(/\{%\s*for\s+(\w+)\s+in\s+(\w+)/g);
    for (const match of forMatches) {
      const itemVar = match[1];
      const collectionVar = match[2];
      if (!data[collectionVar]) {
        data[collectionVar] = Array.from({ length: 3 }, (_, i) => ({
          title: `Sample ${itemVar} ${i + 1}`,
          name: `Sample ${i + 1}`,
          value: (i + 1) * 100,
          score: (i + 1) * 10,
          label: `Label ${i + 1}`,
          description: `Description for item ${i + 1}`,
        }));
      }
    }
    const varMatches = template.matchAll(/\{\{\s*(\w+)\s*[|}]/g);
    for (const match of varMatches) {
      const varName = match[1];
      if (!data[varName] && !['for', 'if', 'unless', 'else', 'endif', 'endfor', 'forloop', 'settings'].includes(varName)) {
        data[varName] = `${varName.replace(/_/g, ' ')}`;
      }
    }
    data.instance_name = 'Preview';
    return data;
  }

  // ========================
  // Webhooks
  // ========================

  async handleWebhook(slug: string, data: Record<string, any>): Promise<{ updated: number }> {
    const plugin = await this.findPluginBySlug(slug);
    if (!plugin) throw new NotFoundException(`Plugin "${slug}" not found`);

    const instances = await this.prisma.pluginInstance.findMany({
      where: { pluginId: plugin.id },
    });

    let updated = 0;
    for (const instance of instances) {
      await this.prisma.pluginInstance.update({
        where: { id: instance.id },
        data: { lastData: data, lastFetchedAt: new Date(), lastError: null },
      });
      updated++;
    }

    this.logger.log(`Webhook for ${slug}: updated ${updated} instances`);
    return { updated };
  }

  // ========================
  // Helpers
  // ========================

  private interpolate(template: string, settings: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      return settings[key] !== undefined ? String(settings[key]) : '';
    });
  }

  private extractByPath(data: any, dataPath: string): any {
    const parts = dataPath.split('.');
    let result = data;
    for (const part of parts) {
      if (result == null) return null;
      const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
      if (arrayMatch) {
        result = result[arrayMatch[1]]?.[parseInt(arrayMatch[2])];
      } else {
        result = result[part];
      }
    }
    return result;
  }

  private getDimensionsForLayout(layout: PluginLayout): { width: number; height: number } {
    switch (layout) {
      case 'full': return { width: 800, height: 480 };
      case 'half_horizontal': return { width: 800, height: 240 };
      case 'half_vertical': return { width: 400, height: 480 };
      case 'quadrant': return { width: 400, height: 240 };
      default: return { width: 800, height: 480 };
    }
  }

  // ========================
  // Diagnostics
  // ========================

  async diagnosePlugins(): Promise<any[]> {
    const plugins = await this.prisma.plugin.findMany({
      orderBy: { name: 'asc' },
    });

    return plugins.map(plugin => {
      const schema = (plugin.settingsSchema as any[]) || [];
      const hasEncrypted = schema.some(f => f.encrypted);
      const hasRequired = schema.some(f => f.required);
      const configRequirement = (plugin as any).oauthProvider
        ? 'oauth'
        : (hasEncrypted || hasRequired) ? 'api_key' : 'none';
      const hasMarkup = !!(plugin.markupFull || (plugin as any).dataUrl);

      return {
        slug: plugin.slug,
        name: plugin.name,
        id: plugin.id,
        status: hasMarkup ? (configRequirement !== 'none' ? 'needs_config' : 'ready') : 'no_template',
        configRequirement,
        settingsCount: schema.length,
      };
    });
  }

  // ========================
  // Widget Templates Integration
  // ========================

  async getAsWidgetTemplates(): Promise<any[]> {
    const plugins = await this.prisma.plugin.findMany({
      where: { isInstalled: true },
    });

    return plugins.map((plugin, index) => ({
      id: 20000 + plugin.id,
      name: plugin.name,
      description: plugin.description || '',
      category: 'Plugins',
      icon: plugin.icon || 'puzzle',
      config: {
        type: 'plugin',
        pluginId: plugin.id,
        pluginSlug: plugin.slug,
      },
    }));
  }

  // ========================
  // Grafana helpers
  // ========================

  /**
   * Resolve Grafana connection settings for an instance.
   * Child instances have parentInstanceId → fetch parent's credentials.
   * Parent instances have credentials directly.
   */
  async getGrafanaConnection(instance: any): Promise<{ grafana_url: string; api_key: string }> {
    const settings = this.getDecryptedSettings(instance);
    // If this instance has its own connection (parent)
    if (settings.grafana_url && settings.api_key) {
      return { grafana_url: settings.grafana_url, api_key: settings.api_key };
    }
    // Child instance — resolve from parent
    const parentId = (instance.settings as any)?.parentInstanceId;
    if (parentId) {
      const parent = await this.findInstanceById(parentId);
      const parentSettings = this.getDecryptedSettings(parent);
      return { grafana_url: parentSettings.grafana_url, api_key: parentSettings.api_key };
    }
    return { grafana_url: '', api_key: '' };
  }

  /**
   * Get Grafana connection from a parent instance ID (for controller use).
   */
  async getGrafanaConnectionById(instanceId: number): Promise<{ grafana_url: string; api_key: string }> {
    const instance = await this.findInstanceById(instanceId);
    return this.getGrafanaConnection(instance);
  }

  // ========================
  // Builtin Plugins
  // ========================

  async seedBuiltinPlugins(): Promise<void> {
    const builtins = [this.grafanaPluginDefinition()];
    for (const def of builtins) {
      await this.prisma.plugin.upsert({
        where: { slug: def.slug },
        create: def,
        update: {
          dataTransform: def.dataTransform,
          markupFull: def.markupFull,
          settingsSchema: def.settingsSchema,
          refreshInterval: def.refreshInterval,
          description: def.description,
          icon: def.icon,
          version: def.version,
        },
      });
    }
    this.logger.log(`Seeded ${builtins.length} builtin plugin(s)`);
  }

  private grafanaPluginDefinition() {
    return {
      name: 'Grafana Panel',
      slug: 'grafana_panel',
      description: 'Display a Grafana dashboard panel on your e-ink screen. Requires the Grafana Image Renderer plugin.',
      icon: 'grafana',
      category: 'monitoring',
      source: 'inker',
      isBuiltin: true,
      dataStrategy: 'polling',
      refreshInterval: 300,
      version: '1.0.0',

      settingsSchema: [
        {
          key: 'grafana_url',
          label: 'Grafana URL',
          type: 'text',
          required: true,
          description: 'Base URL of your Grafana instance (e.g. http://localhost:3000)',
        },
        {
          key: 'api_key',
          label: 'API Key / Service Account Token',
          type: 'password',
          required: true,
          encrypted: true,
          description: 'Grafana API key or service account token with Viewer role',
        },
        {
          key: 'dashboard_uid',
          label: 'Dashboard UID',
          type: 'text',
          required: false,
          description: 'Found in the dashboard URL: /d/<uid>/...',
        },
        {
          key: 'panel_id',
          label: 'Panel ID',
          type: 'number',
          required: false,
          description: 'Found in panel URL parameter: viewPanel=<id>',
        },
        {
          key: 'time_range',
          label: 'Time Range',
          type: 'select',
          default: 'now-6h',
          options: [
            { label: 'Last 1 hour', value: 'now-1h' },
            { label: 'Last 6 hours', value: 'now-6h' },
            { label: 'Last 12 hours', value: 'now-12h' },
            { label: 'Last 24 hours', value: 'now-24h' },
            { label: 'Last 7 days', value: 'now-7d' },
            { label: 'Last 30 days', value: 'now-30d' },
          ],
        },
      ],

      dataTransform: [
        '// Rendering is handled by Puppeteer screenshot of Grafana panel URL',
        'return { dashboard_uid: settings.dashboard_uid, panel_id: settings.panel_id };',
      ].join('\n'),

      markupFull: [
        '<div class="view view--full">',
        '  <div class="layout" style="padding:0; justify-content:center; align-items:center;">',
        '    {% if image_base64 %}',
        '      <img src="{{ image_base64 }}" style="width:800px; height:452px; object-fit:contain;" />',
        '    {% else %}',
        '      <div style="text-align:center; padding:32px;">',
        '        <div class="title" style="font-size:24px;">Grafana Panel</div>',
        '        <div class="label" style="margin-top:8px;">Configure your Grafana connection in plugin settings</div>',
        '      </div>',
        '    {% endif %}',
        '  </div>',
        '  <div class="title_bar">',
        '    <span class="title">Grafana</span>',
        '    <span class="instance">{{ dashboard_uid }} / panel {{ panel_id }}</span>',
        '  </div>',
        '</div>',
      ].join('\n'),
    };
  }

  // ========================
  // Cleanup
  // ========================

  async cleanupStalePlugins(): Promise<void> {
    // Clean up stale TRMNL-synced plugins and mirror (Ruby pipeline removed)
    const deleted = await this.prisma.plugin.deleteMany({
      where: { OR: [{ source: 'trmnl' }, { slug: 'trmnl_mirror' }] },
    });
    if (deleted.count > 0) {
      this.logger.log(`Cleaned up ${deleted.count} stale plugins`);
    }
  }
}
