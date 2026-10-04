import { Injectable, Logger } from '@nestjs/common';
import { Liquid } from 'liquidjs';
import * as sharp from 'sharp';
import { ScreenRendererService } from '../screen-designer/services/screen-renderer.service';
import type { ColorPalette } from '../common/utils/spectra6.util';
import { TRMNL_CSS } from './sync/trmnl-css';

export type PluginLayout = 'full' | 'half_horizontal' | 'half_vertical' | 'quadrant';

/**
 * Plugin Renderer Service
 * Renders plugin Liquid templates into e-ink PNG images using the existing
 * Puppeteer-based rendering pipeline from ScreenRendererService.
 */
@Injectable()
export class PluginRendererService {
  private readonly logger = new Logger(PluginRendererService.name);
  private readonly liquid: Liquid;

  constructor(
    readonly screenRenderer: ScreenRendererService,
  ) {
    this.liquid = new Liquid({
      strictVariables: false,
      strictFilters: false,
    });
    this.registerTrmnlFilters();
  }

  /**
   * Register TRMNL-compatible Liquid filters (ported from trmnl-liquid gem)
   */
  private registerTrmnlFilters() {
    // number_with_delimiter: {{ 1234567 | number_with_delimiter }} → "1,234,567"
    this.liquid.registerFilter('number_with_delimiter', (value: any, delimiter = ',', separator = '.') => {
      if (value == null) return '';
      const parts = String(value).split('.');
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, delimiter);
      return parts.join(separator);
    });

    // number_to_currency: {{ 10420 | number_to_currency: "£" }} → "£10,420.00"
    this.liquid.registerFilter('number_to_currency', (value: any, unit = '$', delimiter = ',', separator = '.', precision = 2) => {
      if (value == null) return '';
      const num = Number(value);
      if (isNaN(num)) return String(value);
      const fixed = num.toFixed(precision);
      const parts = fixed.split('.');
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, delimiter);
      return `${unit}${parts.join(separator)}`;
    });

    // days_ago: {{ 3 | days_ago }} → "2026-03-23"
    this.liquid.registerFilter('days_ago', (value: any, timezone = 'UTC') => {
      const days = Number(value) || 0;
      const d = new Date();
      d.setDate(d.getDate() - days);
      return d.toISOString().split('T')[0];
    });

    // pluralize: {{ "book" | pluralize: 2 }} → "2 books"
    this.liquid.registerFilter('pluralize', (singular: any, count: any, options?: any) => {
      const n = Number(count) || 0;
      const plural = options?.plural || `${singular}s`;
      return `${n} ${n === 1 ? singular : plural}`;
    });

    // group_by: {{ items | group_by: "category" }}
    this.liquid.registerFilter('group_by', (collection: any, key: string) => {
      if (!Array.isArray(collection)) return {};
      const groups: Record<string, any[]> = {};
      for (const item of collection) {
        const k = String(item?.[key] ?? '');
        if (!groups[k]) groups[k] = [];
        groups[k].push(item);
      }
      return groups;
    });

    // find_by: {{ items | find_by: "name", "Ryan" }}
    this.liquid.registerFilter('find_by', (collection: any, key: string, value: any, fallback?: any) => {
      if (!Array.isArray(collection)) return fallback ?? null;
      return collection.find(item => item?.[key] == value) ?? fallback ?? null;
    });

    // json: {{ data | json }}
    this.liquid.registerFilter('json', (value: any) => {
      try { return JSON.stringify(value); } catch { return ''; }
    });

    // parse_json: {% assign obj = data | parse_json %}
    this.liquid.registerFilter('parse_json', (value: any) => {
      try { return JSON.parse(String(value)); } catch { return null; }
    });

    // append_random: {{ "chart-" | append_random }} → "chart-a3f1"
    this.liquid.registerFilter('append_random', (value: any) => {
      const hex = Math.random().toString(16).slice(2, 6);
      return `${value ?? ''}${hex}`;
    });

    // sample: {{ items | sample }} → random element
    this.liquid.registerFilter('sample', (arr: any) => {
      if (!Array.isArray(arr) || arr.length === 0) return null;
      return arr[Math.floor(Math.random() * arr.length)];
    });

    // map_to_i: {{ "5, 4, 3" | split: ", " | map_to_i }}
    this.liquid.registerFilter('map_to_i', (arr: any) => {
      if (!Array.isArray(arr)) return arr;
      return arr.map(v => parseInt(String(v), 10) || 0);
    });

    // ordinalize: {{ "2025-10-02" | ordinalize: "%A, %B <<ordinal_day>>, %Y" }}
    this.liquid.registerFilter('ordinalize', (value: any, format?: string) => {
      const d = new Date(String(value));
      if (isNaN(d.getTime())) return String(value);
      const day = d.getDate();
      const suffix = [11,12,13].includes(day % 100) ? 'th'
        : day % 10 === 1 ? 'st' : day % 10 === 2 ? 'nd' : day % 10 === 3 ? 'rd' : 'th';
      if (!format) return `${day}${suffix}`;
      const weekdays = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
      const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      return format
        .replace('<<ordinal_day>>', `${day}${suffix}`)
        .replace('%A', weekdays[d.getDay()])
        .replace('%B', months[d.getMonth()])
        .replace('%Y', String(d.getFullYear()))
        .replace('%y', String(d.getFullYear()).slice(-2))
        .replace('%m', String(d.getMonth() + 1).padStart(2, '0'))
        .replace('%d', String(day).padStart(2, '0'));
    });

    // l_date: {{ "2025-01-11" | l_date: "%y %b" }}
    this.liquid.registerFilter('l_date', (value: any, format?: string, locale = 'en') => {
      let d: Date;
      if (value === 'now' || value === 'today') d = new Date();
      else if (typeof value === 'number' && value > 1e9) d = new Date(value * 1000);
      else d = new Date(String(value));
      if (isNaN(d.getTime())) return String(value);
      if (!format) return d.toLocaleDateString(locale);
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const fullMonths = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      const weekdays = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
      return format
        .replace('%Y', String(d.getFullYear()))
        .replace('%y', String(d.getFullYear()).slice(-2))
        .replace('%B', fullMonths[d.getMonth()])
        .replace('%b', months[d.getMonth()])
        .replace('%A', ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d.getDay()])
        .replace('%a', weekdays[d.getDay()])
        .replace('%m', String(d.getMonth() + 1).padStart(2, '0'))
        .replace('%d', String(d.getDate()).padStart(2, '0'))
        .replace('%H', String(d.getHours()).padStart(2, '0'))
        .replace('%M', String(d.getMinutes()).padStart(2, '0'))
        .replace('%S', String(d.getSeconds()).padStart(2, '0'))
        .replace('%I', String(d.getHours() % 12 || 12).padStart(2, '0'))
        .replace('%p', d.getHours() >= 12 ? 'PM' : 'AM');
    });

    // where_exp: {{ items | where_exp: "item", "item.active == true" }}
    this.liquid.registerFilter('where_exp', (collection: any, variable: string, expression: string) => {
      if (!Array.isArray(collection)) return [];
      return collection.filter(item => {
        try {
          // Simple expression evaluator for common patterns
          const expr = expression
            .replace(new RegExp(`${variable}\\.`, 'g'), 'item.')
            .replace(/\bnil\b/g, 'null')
            .replace(/\band\b/g, '&&')
            .replace(/\bor\b/g, '||')
            .replace(/\bnot\b/g, '!')
            .replace(/(?<!=)=(?!=)/g, '==');
          const fn = new Function('item', `try { return !!(${expr}); } catch { return false; }`);
          return fn(item);
        } catch { return false; }
      });
    });
  }

  /**
   * Render a plugin's Liquid template with data to HTML string
   */
  async renderToHtml(
    markup: string,
    locals: Record<string, any>,
    settings: Record<string, any> = {},
  ): Promise<string> {
    try {
      const context = { ...locals, settings };
      const html = await this.liquid.parseAndRender(markup, context);
      return html;
    } catch (error) {
      this.logger.warn(`Liquid render failed: ${error.message}`);
      // Return a fallback HTML instead of throwing
      return `<div style="padding:16px;font-family:sans-serif"><p style="font-size:14px;font-weight:bold;margin-bottom:8px">Template Error</p><p style="font-size:11px;color:#666">${error.message?.split('\n')[0] || 'Unknown error'}</p></div>`;
    }
  }

  /**
   * Render a plugin instance to a full HTML page (with CSS) ready for Puppeteer
   */
  buildFullPage(innerHtml: string, width: number, height: number): string {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { width: ${width}px; height: ${height}px; }
  ${TRMNL_CSS}
</style>
</head>
<body>
${innerHtml}
</body>
</html>`;
  }

  /**
   * Render a plugin to a PNG buffer using the existing Puppeteer pipeline
   */
  async renderToPng(
    markup: string,
    locals: Record<string, any>,
    settings: Record<string, any> = {},
    width: number = 800,
    height: number = 480,
    mode: 'device' | 'preview' | 'einkPreview' = 'device',
    palette?: ColorPalette,
  ): Promise<Buffer> {
    const innerHtml = await this.renderToHtml(markup, locals, settings);
    const fullPage = this.buildFullPage(innerHtml, width, height);

    // Render HTML to raw PNG via Puppeteer
    const rawPng = await this.screenRenderer.renderHtmlToPng(fullPage, width, height);

    // For preview mode, return without e-ink processing
    if (mode === 'preview') {
      return rawPng;
    }

    // Apply e-ink processing (dithering + optional inversion, or colour for a palette)
    const shouldNegate = mode === 'device';
    return this.screenRenderer.applyEinkProcessing(rawPng, width, height, shouldNegate, 'png', 1, palette);
  }

  /**
   * Screenshot an external URL with custom headers (e.g. Grafana panel with auth)
   */
  async renderUrlToPng(
    url: string,
    headers: Record<string, string>,
    width: number = 800,
    height: number = 480,
    mode: 'device' | 'preview' | 'einkPreview' = 'device',
    evaluateScript?: string,
    palette?: ColorPalette,
  ): Promise<Buffer> {
    const browser = await this.screenRenderer.getBrowser();
    const page = await browser.newPage();

    try {
      await page.setViewport({ width, height, deviceScaleFactor: 1 });
      await page.setExtraHTTPHeaders(headers);
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

      if (evaluateScript) {
        await page.evaluate(evaluateScript);
        // Wait for layout to settle after DOM changes
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      const rawPng = Buffer.from(await page.screenshot({ type: 'png', fullPage: false }));

      if (mode === 'preview') return rawPng;

      const shouldNegate = mode === 'device';
      return this.screenRenderer.applyEinkProcessing(rawPng, width, height, shouldNegate, 'png', 1, palette);
    } finally {
      await page.close();
    }
  }

  /**
   * Select the appropriate template based on layout size
   */
  selectMarkup(
    plugin: {
      markupFull?: string | null;
      markupHalfHorizontal?: string | null;
      markupHalfVertical?: string | null;
      markupQuadrant?: string | null;
    },
    layout: PluginLayout = 'full',
  ): string | null {
    switch (layout) {
      case 'full':
        return plugin.markupFull || null;
      case 'half_horizontal':
        return plugin.markupHalfHorizontal || plugin.markupFull || null;
      case 'half_vertical':
        return plugin.markupHalfVertical || plugin.markupFull || null;
      case 'quadrant':
        return plugin.markupQuadrant || plugin.markupFull || null;
      default:
        return plugin.markupFull || null;
    }
  }
}
