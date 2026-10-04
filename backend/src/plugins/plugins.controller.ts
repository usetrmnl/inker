import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  Res,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { PluginsService } from './plugins.service';
import { OAuthService } from './oauth/oauth.service';
import { PluginLayout } from './plugin-renderer.service';
import { parsePalette } from '../common/utils/spectra6.util';
import {
  CreatePluginDto,
  UpdatePluginDto,
  CreatePluginInstanceDto,
  UpdatePluginInstanceDto,
} from './dto/create-plugin.dto';

@ApiTags('plugins')
@Controller('plugins')
export class PluginsController {
  private readonly logger = new Logger(PluginsController.name);

  constructor(
    private readonly pluginsService: PluginsService,
    private readonly oauthService: OAuthService,
  ) {}

  // ========================
  // Plugin definitions
  // ========================

  @Get()
  @ApiOperation({ summary: 'List all available plugins' })
  async findAll() {
    return this.pluginsService.findAllPlugins();
  }

  @Get('diagnostics')
  @ApiOperation({ summary: 'Diagnose all plugins' })
  async diagnostics() {
    return this.pluginsService.diagnosePlugins();
  }

  // ========================
  // TRMNL GitHub Plugin Templates
  // ========================

  private static readonly GITHUB_PLUGINS = [
    'chatgpt', 'days_left_until', 'eight_sleep', 'email_meter', 'github_commit_graph',
    'google_analytics', 'hacker_news', 'lunar_calendar', 'lunch_money', 'mondrian',
    'nano_banana_dashboard', 'notion', 'parcel', 'route_planner', 'shopify',
    'stock_price', 'tempest_weather_station', 'todoist', 'withings', 'youtube_analytics',
  ];

  @Get('github-plugins')
  @ApiOperation({ summary: 'List known TRMNL plugin slugs available on GitHub' })
  async githubPlugins() {
    return PluginsController.GITHUB_PLUGINS;
  }

  @Get('github-plugin/:slug')
  @ApiOperation({ summary: 'Fetch and convert a TRMNL plugin template from GitHub' })
  async githubPlugin(@Param('slug') slug: string) {
    if (!PluginsController.GITHUB_PLUGINS.includes(slug)) {
      return { found: false };
    }

    const base = `https://raw.githubusercontent.com/usetrmnl/plugins/master/lib/${slug}`;

    try {
      // Fetch ERB template + Ruby source in parallel
      const [erbRes, rbRes] = await Promise.all([
        fetch(`${base}/views/full.html.erb`, { signal: AbortSignal.timeout(10000) }).then(r => r.ok ? r.text() : null).catch(() => null),
        fetch(`${base}/${slug}.rb`, { signal: AbortSignal.timeout(10000) }).then(r => r.ok ? r.text() : null).catch(() => null),
      ]);

      if (!erbRes) return { found: false };

      // Convert ERB → Liquid
      const template = this.convertErbToLiquid(erbRes);

      // Extract API URLs from Ruby source
      let apiUrl = '';
      if (rbRes) {
        const urls: string[] = [];
        // HTTParty.get/post('url')
        for (const m of rbRes.matchAll(/HTTParty\.\w+\(\s*['"]([^'"]+)['"]/g)) urls.push(m[1]);
        // fetch('url')
        for (const m of rbRes.matchAll(/(?:^|\s)fetch\(\s*['"]([^'"]+)['"]/gm)) urls.push(m[1]);
        // URI.parse('url')
        for (const m of rbRes.matchAll(/URI(?:\.parse)?\(\s*['"]([^'"]+)['"]/g)) urls.push(m[1]);
        // String constant URLs
        for (const m of rbRes.matchAll(/['"]+(https?:\/\/[^'"]+)['"]+/g)) {
          if (!urls.includes(m[1])) urls.push(m[1]);
        }
        // Pick the first non-GitHub, non-rubygems URL as likely API endpoint
        apiUrl = urls.find(u => !u.includes('github.com') && !u.includes('rubygems')) || urls[0] || '';
      }

      // Extract settings keys from Ruby source
      const settingsKeys: string[] = [];
      if (rbRes) {
        for (const m of rbRes.matchAll(/settings\[['"](\w+)['"]\]/g)) {
          if (!settingsKeys.includes(m[1])) settingsKeys.push(m[1]);
        }
        for (const m of rbRes.matchAll(/settings\.fetch\(\s*['"](\w+)['"]/g)) {
          if (!settingsKeys.includes(m[1])) settingsKeys.push(m[1]);
        }
        for (const m of rbRes.matchAll(/settings\[:(\w+)\]/g)) {
          if (!settingsKeys.includes(m[1])) settingsKeys.push(m[1]);
        }
      }

      const sensitivePatterns = ['token', 'key', 'secret', 'password', 'api_key', 'access_token'];
      const settingsSchema = settingsKeys.map(key => ({
        key,
        label: key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        type: 'text',
        encrypted: sensitivePatterns.some(p => key.toLowerCase().includes(p)),
        required: false,
      }));

      return { found: true, template, apiUrl, settingsSchema, slug };
    } catch (error) {
      this.logger.warn(`GitHub plugin fetch failed for ${slug}: ${error.message}`);
      return { found: false };
    }
  }

  private convertErbToLiquid(erb: string): string {
    let liquid = erb;

    // Pre-process: normalize ERB whitespace-trimming dashes
    // <%- → <%, -%> → %>  (keep = for output tags)
    liquid = liquid.replace(/<%-/g, '<%');
    liquid = liquid.replace(/-%>/g, '%>');

    // Handle array slices BEFORE each conversion: array[0..5] → array
    // We'll handle limit in the for tag
    // Track slices for limit info
    const sliceLimits = new Map<string, number>();

    // Each with slice + index: <% stories[0..5].each_with_index do |post, idx| %>
    liquid = liquid.replace(/<%\s*(\w+)\[(\d+)\.\.(\d+)\]\.each_with_index\s+do\s*\|\s*(\w+)\s*,\s*(\w+)\s*\|\s*%>/g,
      (_, arr, start, end, item, _idx) => {
        const limit = parseInt(end) - parseInt(start) + 1;
        const offset = parseInt(start);
        sliceLimits.set(item, offset);
        return `{% for ${item} in ${arr} limit:${limit} offset:${offset} %}`;
      });

    // Each with slice: <% array[0..5].each do |item| %>
    liquid = liquid.replace(/<%\s*(\w+)\[(\d+)\.\.(\d+)\]\.each\s+do\s*\|\s*(\w+)\s*\|\s*%>/g,
      (_, arr, start, end, item) => {
        const limit = parseInt(end) - parseInt(start) + 1;
        const offset = parseInt(start);
        return `{% for ${item} in ${arr} limit:${limit} offset:${offset} %}`;
      });

    // Each with index (no slice): <% array.each_with_index do |item, idx| %>
    liquid = liquid.replace(/<%\s*(\w[\w.]*?)\.each_with_index\s+do\s*\|\s*(\w+)\s*,\s*(\w+)\s*\|\s*%>/g,
      '{% for $2 in $1 %}');

    // Simple each: <% array.each do |item| %>
    liquid = liquid.replace(/<%\s*(\w[\w.]*?)\.each\s+do\s*\|\s*(\w+)\s*\|\s*%>/g,
      '{% for $2 in $1 %}');

    // first/last N: <% array.first(5).each do |item| %>
    liquid = liquid.replace(/<%\s*(\w+)\.first\((\d+)\)\.each\s+do\s*\|\s*(\w+)\s*\|\s*%>/g,
      '{% for $3 in $1 limit:$2 %}');

    // N.times do: <% 5.times do %> or <% 5.times do |i| %>
    liquid = liquid.replace(/<%\s*(\d+)\.times\s+do(?:\s*\|\s*\w+\s*\|)?\s*%>/g,
      '{% for i in (1..$1) %}');

    // If statements: <% if condition %>
    liquid = liquid.replace(/<%\s*if\s+(.+?)\s*%>/g, (_, cond) => {
      return `{% if ${this.cleanRubyCondition(cond)} %}`;
    });

    // Unless
    liquid = liquid.replace(/<%\s*unless\s+(.+?)\s*%>/g, (_, cond) => {
      return `{% unless ${this.cleanRubyCondition(cond)} %}`;
    });

    // Elsif
    liquid = liquid.replace(/<%\s*elsif\s+(.+?)\s*%>/g, (_, cond) => {
      return `{% elsif ${this.cleanRubyCondition(cond)} %}`;
    });

    // Else
    liquid = liquid.replace(/<%\s*else\s*%>/g, '{% else %}');

    // End → track as generic, fix later
    liquid = liquid.replace(/<%\s*end\s*%>/g, '{% end %}');

    // render partial (control tag)
    liquid = liquid.replace(/<%\s*render\s+['"]([^'"]+)['"].*?%>/g, '<!-- partial: $1 -->');
    liquid = liquid.replace(/<%\s*render\s*\(.*?\)\s*%>/g, '<!-- partial -->');

    // render partial (output tag)
    liquid = liquid.replace(/<%=\s*render\s+['"]([^'"]+)['"].*?%>/g, '<!-- partial: $1 -->');
    liquid = liquid.replace(/<%=\s*render\s*\(.*?\)\s*%>/g, '<!-- partial -->');

    // Output tags: <%= expr %>
    liquid = liquid.replace(/<%=\s*(.*?)\s*%>/g, (_, expr) => {
      let cleaned = this.cleanRubyExpression(expr);
      if (!cleaned || cleaned === '""' || cleaned === "''") return '';
      return `{{ ${cleaned} }}`;
    });

    // Clean up any remaining <% ... %> tags
    liquid = liquid.replace(/<%\s*.*?\s*%>/g, '');

    // Fix end tags using stack tracking
    const lines = liquid.split('\n');
    const stack: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/\{%\s*for\s/.test(line)) stack.push('for');
      else if (/\{%\s*if\s/.test(line) || /\{%\s*unless\s/.test(line)) stack.push('if');
      else if (/\{%\s*end\s*%\}/.test(line)) {
        const type = stack.pop();
        if (type === 'for') lines[i] = line.replace(/\{%\s*end\s*%\}/, '{% endfor %}');
        else if (type === 'if') lines[i] = line.replace(/\{%\s*end\s*%\}/, '{% endif %}');
        else lines[i] = line.replace(/\{%\s*end\s*%\}/, '{% endif %}');
      }
    }
    liquid = lines.join('\n');

    // Post-process: fix idx + N references → forloop.index + offset
    liquid = liquid.replace(/\{\{\s*\w+\s*\+\s*\d+\s*\}\}/g, '{{ forloop.index }}');
    // Also plain idx references
    liquid = liquid.replace(/\{\{\s*idx\s*\}\}/g, '{{ forloop.index0 }}');

    // Clean Rails references
    liquid = liquid.replace(/\{\{[^}]*Rails\.application[^}]*\}\}/g, '');
    liquid = liquid.replace(/\{\{[^}]*credentials[^}]*\}\}/g, '');

    // Clean t() i18n calls
    liquid = liquid.replace(/\{\{\s*t\(['"][^'"]+['"]\)\s*\}\}/g, '');

    // Clean empty {{ }} tags
    liquid = liquid.replace(/\{\{\s*\}\}/g, '');

    // Clean double blank lines
    liquid = liquid.replace(/\n{3,}/g, '\n\n');

    return liquid.trim();
  }

  private cleanRubyExpression(expr: string): string {
    return expr
      // hash[:key] → hash.key
      .replace(/(\w+)\[:(\w+)\]/g, '$1.$2')
      // hash["key"] or hash['key'] → hash.key
      .replace(/(\w+)\[['"](\w+)['"]\]/g, '$1.$2')
      // .html_safe, .present?, .to_s, .to_i, .to_f → remove
      .replace(/\.(html_safe|present\?|to_s|to_i|to_f|freeze)/g, '')
      // .strip → | strip
      .replace(/\.strip/g, ' | strip')
      .replace(/\.capitalize/g, ' | capitalize')
      .replace(/\.downcase/g, ' | downcase')
      .replace(/\.upcase/g, ' | upcase')
      .replace(/\.round(\(\d+\))?/g, '')
      // number_with_delimiter(x) → x | number_with_delimiter
      .replace(/number_with_delimiter\(([^)]+)\)/g, '$1 | number_with_delimiter')
      .replace(/number_to_currency\(([^)]+)\)/g, '$1 | number_to_currency')
      .replace(/truncate\(([^,]+),\s*length:\s*(\d+)\)/g, '$1 | truncate: $2')
      .replace(/pluralize\(([^,]+),\s*['"]([^'"]+)['"]\)/g, '"$2" | pluralize: $1')
      // simple_format → remove wrapper
      .replace(/simple_format\(([^)]+)\)/g, '$1')
      // distance_of_time_in_words → remove
      .replace(/distance_of_time_in_words\([^)]*\)/g, '""')
      .trim();
  }

  private cleanRubyCondition(cond: string): string {
    return cond
      .replace(/(\w+)\[:(\w+)\]/g, '$1.$2')
      .replace(/(\w+)\[['"](\w+)['"]\]/g, '$1.$2')
      .replace(/\.present\?/g, '')
      .replace(/\.nil\?/g, ' == nil')
      .replace(/\.blank\?/g, ' == blank')
      .replace(/\.any\?/g, '.size > 0')
      .replace(/\.empty\?/g, '.size == 0')
      .replace(/&&/g, 'and')
      .replace(/\|\|/g, 'or')
      .trim();
  }

  // ========================
  // TRMNL Recipe Gallery (public proxy)
  // ========================

  @Get('recipes')
  @ApiOperation({ summary: 'Browse TRMNL recipe gallery' })
  async recipes(@Query('search') search?: string, @Query('page') page?: string) {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (page) params.set('page', page);
    const url = `https://trmnl.app/recipes.json${params.toString() ? '?' + params.toString() : ''}`;
    try {
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'Inker' },
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) return { data: [], total: 0 };
      return response.json();
    } catch (error) {
      this.logger.warn(`Recipe gallery fetch failed: ${error.message}`);
      return { data: [], total: 0 };
    }
  }

  @Get('recipes/:recipeId')
  @ApiOperation({ summary: 'Get a single TRMNL recipe' })
  async recipe(@Param('recipeId') recipeId: string) {
    try {
      const response = await fetch(`https://trmnl.app/recipes/${recipeId}.json`, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'Inker' },
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new NotFoundException('Recipe not found');
      return response.json();
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.warn(`Recipe fetch failed: ${error.message}`);
      throw new NotFoundException('Recipe not found');
    }
  }

  @Get('recipe-image')
  @Public()
  @ApiOperation({ summary: 'Proxy a recipe screenshot image (avoids signed URL expiry)' })
  async recipeImage(@Query('url') imageUrl: string, @Res() res: Response) {
    if (!imageUrl || (!imageUrl.includes('trmnl') && !imageUrl.includes('amazonaws.com'))) {
      res.status(400).send('Invalid URL');
      return;
    }
    try {
      const response = await fetch(imageUrl, {
        headers: { 'User-Agent': 'Inker' },
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) {
        res.status(response.status).send('Image not available');
        return;
      }
      const contentType = response.headers.get('content-type') || 'image/png';
      const buffer = Buffer.from(await response.arrayBuffer());
      res.set({
        'Content-Type': contentType,
        'Content-Length': buffer.length,
        'Cache-Control': 'public, max-age=3600',
      });
      res.send(buffer);
    } catch {
      res.status(502).send('Failed to fetch image');
    }
  }

  @Get('recipe-categories')
  @ApiOperation({ summary: 'List TRMNL recipe categories' })
  async recipeCategories() {
    try {
      const response = await fetch('https://trmnl.app/api/categories', {
        headers: { 'Accept': 'application/json', 'User-Agent': 'Inker' },
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) return { data: [] };
      return response.json();
    } catch {
      return { data: [] };
    }
  }

  @Post(':id/install')
  @ApiOperation({ summary: 'Install a plugin (adds to widget library)' })
  async install(@Param('id', ParseIntPipe) id: number) {
    return this.pluginsService.installPlugin(id);
  }

  @Post(':id/uninstall')
  @ApiOperation({ summary: 'Uninstall a plugin (removes from widget library)' })
  async uninstall(@Param('id', ParseIntPipe) id: number) {
    return this.pluginsService.uninstallPlugin(id);
  }

  @Post('preview-template')
  @ApiOperation({ summary: 'Preview a Liquid template with mock data (for plugin creator)' })
  async previewTemplate(@Body() body: { markup: string; data?: Record<string, any> }, @Res() res: Response) {
    try {
      const imageBuffer = await this.pluginsService.previewMarkup(body.markup, body.data || {});
      res.set({
        'Content-Type': 'image/png',
        'Content-Length': imageBuffer.length,
        'Cache-Control': 'no-store',
      });
      res.send(imageBuffer);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  @Get(':id/preview')
  @Public()
  @ApiOperation({ summary: 'Preview a plugin template with empty data' })
  async previewPlugin(
    @Param('id', ParseIntPipe) id: number,
    @Query('layout') layout: string,
    @Res() res: Response,
  ) {
    const plugin = await this.pluginsService.findPluginById(id);
    const validLayout = (['full', 'half_horizontal', 'half_vertical', 'quadrant'].includes(layout)
      ? layout
      : 'full') as 'full' | 'half_horizontal' | 'half_vertical' | 'quadrant';

    const imageBuffer = await this.pluginsService.previewPlugin(plugin, validLayout);

    res.set({
      'Content-Type': 'image/png',
      'Content-Length': imageBuffer.length,
      'Cache-Control': 'public, max-age=60',
    });
    res.send(imageBuffer);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get plugin by ID' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.pluginsService.findPluginById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new plugin' })
  async create(@Body() dto: CreatePluginDto) {
    return this.pluginsService.createPlugin(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a plugin' })
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePluginDto) {
    return this.pluginsService.updatePlugin(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a plugin' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.pluginsService.deletePlugin(id);
  }

  // ========================
  // Plugin instances
  // ========================

  @Get('instances/all')
  @ApiOperation({ summary: 'List all plugin instances' })
  async findAllInstances() {
    return this.pluginsService.findAllInstances();
  }

  @Get('instances/:id')
  @ApiOperation({ summary: 'Get plugin instance by ID' })
  async findInstance(@Param('id', ParseIntPipe) id: number) {
    return this.pluginsService.findInstanceByIdMasked(id);
  }

  @Post('instances')
  @ApiOperation({ summary: 'Create a plugin instance (install a plugin)' })
  async createInstance(@Body() dto: CreatePluginInstanceDto) {
    return this.pluginsService.createInstance(dto);
  }

  @Put('instances/:id')
  @ApiOperation({ summary: 'Update plugin instance settings' })
  async updateInstance(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePluginInstanceDto) {
    return this.pluginsService.updateInstance(id, dto);
  }

  @Delete('instances/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a plugin instance' })
  async removeInstance(@Param('id', ParseIntPipe) id: number) {
    await this.pluginsService.deleteInstance(id);
  }

  // ========================
  // Data & Rendering
  // ========================

  @Get('instances/:id/data')
  @ApiOperation({ summary: 'Fetch fresh data for a plugin instance' })
  async fetchData(@Param('id', ParseIntPipe) id: number) {
    return this.pluginsService.fetchData(id);
  }

  @Get('instances/:id/render')
  @Public()
  @ApiOperation({ summary: 'Render a plugin instance to PNG' })
  async renderInstance(
    @Param('id', ParseIntPipe) id: number,
    @Query('layout') layout: string,
    @Query('mode') mode: string,
    @Query('palette') palette: string,
    @Res() res: Response,
  ) {
    const validLayout = (['full', 'half_horizontal', 'half_vertical', 'quadrant'].includes(layout)
      ? layout
      : 'full') as PluginLayout;
    const validMode = (['device', 'preview', 'einkPreview'].includes(mode)
      ? mode
      : 'preview') as 'device' | 'preview' | 'einkPreview';

    // palette=spectra6 → 6-colour indexed PNG for Spectra 6 panels; unknown values are ignored.
    // Admin previews (einkPreview) carry no palette, so derive it from the devices showing this
    // instance; an explicit palette always wins and device/preview modes are never inferred.
    let validPalette = parsePalette(palette);
    if (!validPalette && validMode === 'einkPreview') {
      validPalette = await this.pluginsService.previewPaletteForInstance(id);
    }
    const imageBuffer = await this.pluginsService.renderInstance(id, validLayout, validMode, validPalette);

    res.set({
      'Content-Type': 'image/png',
      'Content-Length': imageBuffer.length,
      'Cache-Control': 'no-store',
    });
    res.send(imageBuffer);
  }

  // ========================
  // OAuth
  // ========================

  @Get('oauth/providers')
  @ApiOperation({ summary: 'List available OAuth providers' })
  async listOAuthProviders() {
    return this.oauthService.getAvailableProviders();
  }

  @Get('instances/:id/oauth/authorize')
  @ApiOperation({ summary: 'Get OAuth authorization URL for a plugin instance' })
  async getOAuthUrl(
    @Param('id', ParseIntPipe) id: number,
    @Query('provider') provider: string,
  ) {
    const instance: any = await this.pluginsService.findInstanceById(id);
    const oauthProvider = provider || instance.plugin.oauthProvider;
    if (!oauthProvider) {
      throw new NotFoundException('This plugin does not require OAuth');
    }
    return { url: this.oauthService.getAuthorizationUrl(id, oauthProvider) };
  }

  @Get('oauth/callback')
  @Public()
  @ApiOperation({ summary: 'OAuth callback handler' })
  async oauthCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const { instanceId } = await this.oauthService.handleCallback(code, state);
    // Redirect to the plugin instance settings page
    res.redirect(`/plugins/instances/${instanceId}?oauth=connected`);
  }

  @Post('instances/:id/oauth/disconnect')
  @ApiOperation({ summary: 'Disconnect OAuth for a plugin instance' })
  async disconnectOAuth(@Param('id', ParseIntPipe) id: number) {
    await this.oauthService.disconnectOAuth(id);
    return { message: 'OAuth disconnected' };
  }

  // ========================
  // Webhooks
  // ========================

  @Post('webhooks/:slug')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Receive webhook data for a plugin' })
  async receiveWebhook(
    @Param('slug') slug: string,
    @Body() body: any,
  ) {
    return this.pluginsService.handleWebhook(slug, body);
  }

  // ========================
  // Grafana proxy
  // ========================

  @Post('grafana/dashboards')
  @ApiOperation({ summary: 'List Grafana dashboards via parent instance' })
  async grafanaDashboards(@Body() body: { instanceId: number }) {
    const conn = await this.pluginsService.getGrafanaConnectionById(body.instanceId);
    if (!conn.grafana_url || !conn.api_key) throw new NotFoundException('Grafana connection not configured');
    const baseUrl = conn.grafana_url.replace(/\/+$/, '');
    const resp = await fetch(`${baseUrl}/api/search?limit=1000`, {
      headers: { Authorization: `Bearer ${conn.api_key}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) throw new NotFoundException(`Grafana returned ${resp.status}: ${resp.statusText}`);
    const results = await resp.json();
    return results
      .filter((d: any) => d.type === 'dash-db')
      .map((d: any) => ({ uid: d.uid, title: d.folderTitle ? `${d.folderTitle} / ${d.title}` : d.title, uri: d.uri }));
  }

  @Post('grafana/panels')
  @ApiOperation({ summary: 'List panels for a Grafana dashboard' })
  async grafanaPanels(@Body() body: { instanceId: number; dashboard_uid: string }) {
    const conn = await this.pluginsService.getGrafanaConnectionById(body.instanceId);
    if (!conn.grafana_url || !conn.api_key) throw new NotFoundException('Grafana connection not configured');
    const baseUrl = conn.grafana_url.replace(/\/+$/, '');
    const resp = await fetch(`${baseUrl}/api/dashboards/uid/${body.dashboard_uid}`, {
      headers: { Authorization: `Bearer ${conn.api_key}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) throw new NotFoundException(`Grafana returned ${resp.status}: ${resp.statusText}`);
    const data = await resp.json();
    const panels: { id: string | number; title: string; type: string; section: string | null }[] = [];
    const extractPanels = (list: any[]) => {
      for (const p of list || []) {
        if (p.type === 'row') {
          const rowTitle = p.title || `Row ${p.id}`;
          panels.push({ id: `row-${p.id}`, title: `${rowTitle} (entire section)`, type: 'row', section: rowTitle });
          for (const child of p.panels || []) {
            panels.push({ id: child.id, title: child.title || `Panel ${child.id}`, type: child.type, section: rowTitle });
          }
        } else {
          panels.push({ id: p.id, title: p.title || `Panel ${p.id}`, type: p.type, section: null });
        }
      }
    };
    extractPanels(data.dashboard?.panels);
    return panels;
  }

  @Post('grafana/generate-screen')
  @ApiOperation({ summary: 'Generate a Grafana screen (child instance)' })
  async grafanaGenerateScreen(@Body() body: {
    parentInstanceId: number;
    dashboard_uid: string;
    panel_id: number | string;
    time_range?: string;
    screen_width?: number;
    screen_height?: number;
    name?: string;
  }) {
    const parent = await this.pluginsService.findInstanceById(body.parentInstanceId);
    return this.pluginsService.createInstance({
      pluginId: parent.pluginId,
      name: body.name || 'Grafana Screen',
      settings: {
        parentInstanceId: body.parentInstanceId,
        dashboard_uid: body.dashboard_uid,
        panel_id: body.panel_id,
        time_range: body.time_range || 'now-6h',
        screen_width: body.screen_width || 800,
        screen_height: body.screen_height || 480,
      },
    });
  }
}
