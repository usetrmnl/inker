/**
 * CustomWidgetPreviewRenderer Component
 * Shared component for rendering custom widget previews.
 * Used in both CustomWidgetForm (Live Preview) and Extensions page (widget cards).
 */
import { EInkImage } from './EInkImage';
import type { FieldDisplayType } from '../../types';

interface GridCellConfig {
  field: string;
  fieldType?: FieldDisplayType;
  label?: string;
  prefix?: string;
  suffix?: string;
  useScript?: boolean;
  script?: string;
  align?: 'left' | 'center' | 'right';
}

interface CustomWidgetPreviewRendererProps {
  displayType: string;
  config: Record<string, unknown>;
  sampleData: unknown;
  scriptResult?: {
    success: boolean;
    output?: unknown;
    variables?: Record<string, unknown>;
    error?: string;
  } | null;
  template?: string;
  fontSize?: number;
}

/**
 * Extract value from nested object using dot notation path
 * Supports: field, nested.field, array[0].field, rates[0].mid
 */
function getFieldValue(data: unknown, path: string): unknown {
  if (!data || !path) return undefined;

  const parts = path.split('.');
  let current: unknown = data;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;

    // Handle array notation like "items[0]" or just "[0]"
    const arrayMatch = part.match(/^(.+?)?\[(\d+)\]$/);
    if (arrayMatch) {
      const [, key, index] = arrayMatch;
      if (key) {
        current = (current as Record<string, unknown>)[key];
      }
      if (Array.isArray(current)) {
        current = current[parseInt(index, 10)];
      } else {
        return undefined;
      }
    } else {
      current = (current as Record<string, unknown>)[part];
    }
  }

  return current;
}

/**
 * Render a field value based on its type
 */
function renderFieldValue(value: unknown, fieldType: FieldDisplayType, fontSize: number): React.ReactNode {
  if (value === undefined || value === null) {
    return <span style={{ opacity: 0.5 }}>--</span>;
  }

  switch (fieldType) {
    case 'image':
      return (
        <EInkImage
          src={String(value)}
          alt="Preview"
          fit="contain"
          maxHeight="100px"
        />
      );
    case 'number': {
      const num = Number(value);
      const displayValue = isNaN(num) ? String(value) : num.toLocaleString();
      return <span style={{ fontSize: `${fontSize}px` }}>{displayValue}</span>;
    }
    case 'link':
      return (
        <span style={{ fontSize: `${fontSize}px`, textDecoration: 'underline' }}>
          {String(value)}
        </span>
      );
    default:
      return <span style={{ fontSize: `${fontSize}px` }}>{String(value)}</span>;
  }
}

export function CustomWidgetPreviewRenderer({
  displayType,
  config,
  sampleData,
  scriptResult,
  template,
  fontSize = 24,
}: CustomWidgetPreviewRendererProps) {
  if (!sampleData) {
    return (
      <div className="text-text-placeholder text-sm">
        No data available
      </div>
    );
  }

  try {
    switch (displayType) {
      case 'value': {
        const field = (config.field as string) || '';
        const fieldType = (config.fieldType as FieldDisplayType) || 'text';
        const prefix = (config.prefix as string) || '';
        const suffix = (config.suffix as string) || '';
        const label = (config.label as string) || '';
        const value = getFieldValue(sampleData, field);

        // For image type, don't show prefix/suffix/label
        if (fieldType === 'image') {
          return (
            <div className="flex items-center justify-center w-full h-full">
              {renderFieldValue(value, fieldType, fontSize)}
            </div>
          );
        }

        return (
          <div className="text-center w-full">
            {label && (
              <div style={{ fontSize: `${fontSize * 0.6}px`, opacity: 0.6 }}>
                {label}
              </div>
            )}
            <div className="flex items-center justify-center gap-1 font-bold">
              {prefix && <span style={{ fontSize: `${fontSize}px` }}>{prefix}</span>}
              {renderFieldValue(value, fieldType, fontSize)}
              {suffix && <span style={{ fontSize: `${fontSize}px` }}>{suffix}</span>}
            </div>
          </div>
        );
      }

      case 'list': {
        const arrayPath = (config.arrayPath as string) || '';
        const itemField = (config.itemField as string) || '';
        const maxItems = (config.maxItems as number) || 5;
        const listStyle = (config.listStyle as string) || 'bullet';

        // Get array from data using path
        let arrayData: unknown[] = [];
        if (arrayPath) {
          const extracted = getFieldValue(sampleData, arrayPath);
          if (Array.isArray(extracted)) {
            arrayData = extracted;
          }
        } else if (Array.isArray(sampleData)) {
          arrayData = sampleData;
        } else if (typeof sampleData === 'object' && sampleData !== null && 'items' in sampleData) {
          arrayData = (sampleData as { items: unknown[] }).items || [];
        }

        // Extract item field from each item
        const items = arrayData.slice(0, maxItems).map((item) => {
          if (itemField && typeof item === 'object' && item !== null) {
            const value = (item as Record<string, unknown>)[itemField];
            return value !== undefined ? String(value) : JSON.stringify(item);
          }
          return typeof item === 'object' ? JSON.stringify(item) : String(item);
        });

        // Get prefix based on style
        const getPrefix = (index: number) => {
          switch (listStyle) {
            case 'number': return `${index + 1}. `;
            case 'dash': return '- ';
            case 'none': return '';
            default: return '• ';
          }
        };

        return (
          <ul className="text-left space-y-1 w-full" style={{ fontSize: `${fontSize * 0.5}px` }}>
            {items.length > 0 ? (
              items.map((item, i) => (
                <li key={i} className="truncate">{getPrefix(i)}{item}</li>
              ))
            ) : (
              <li className="text-text-placeholder">No items found</li>
            )}
          </ul>
        );
      }

      case 'script': {
        const code = (config.scriptCode as string) || '';
        const outputMode = (config.scriptOutputMode as string) || 'value';
        const prefix = (config.prefix as string) || '';
        const suffix = (config.suffix as string) || '';

        if (!code) {
          return <div className="text-text-placeholder text-sm">No script configured</div>;
        }

        // Show live execution result
        if (scriptResult?.success) {
          let displayValue: string;

          if (outputMode === 'template' && scriptResult.variables) {
            // Template mode: substitute variables
            displayValue = template || '';
            Object.entries(scriptResult.variables).forEach(([key, val]) => {
              displayValue = displayValue.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(val));
            });
          } else if (scriptResult.output !== undefined) {
            // Value mode: show with prefix/suffix
            displayValue = `${prefix}${String(scriptResult.output)}${suffix}`;
          } else {
            displayValue = '[no output]';
          }

          return (
            <div className="text-center w-full">
              <div style={{ fontSize: `${fontSize}px`, fontWeight: 'bold' }}>
                {displayValue}
              </div>
            </div>
          );
        } else if (scriptResult?.error) {
          return (
            <div className="text-center w-full">
              <div className="text-status-error-text text-sm">
                {scriptResult.error}
              </div>
            </div>
          );
        }

        return (
          <div className="text-text-placeholder text-sm">
            Script not executed
          </div>
        );
      }

      case 'grid': {
        const gridCols = (config.gridCols as number) || 2;
        const gridRows = (config.gridRows as number) || 2;
        const gridGap = (config.gridGap as number) || 8;
        const cells = (config.gridCells as Record<string, GridCellConfig>) || {};

        // Helper to execute cell script in browser sandbox
        const executeCellScript = (script: string): { value: unknown; error?: string } => {
          if (!script || !sampleData) return { value: '', error: 'No script or data' };
          try {
            const safeGlobals = {
              Math,
              String,
              Number,
              Boolean,
              Array: { isArray: Array.isArray, from: Array.from },
              Object: { keys: Object.keys, values: Object.values, entries: Object.entries },
              JSON: { parse: JSON.parse, stringify: JSON.stringify },
              Date,
              parseInt,
              parseFloat,
              isNaN,
              isFinite,
            };
            const fn = new Function('$', ...Object.keys(safeGlobals), script);
            const result = fn(sampleData, ...Object.values(safeGlobals));
            return { value: result };
          } catch (err) {
            return { value: '', error: err instanceof Error ? err.message : 'Script error' };
          }
        };

        return (
          <div
            className="grid w-full h-full overflow-hidden"
            style={{
              gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
              gridTemplateRows: `repeat(${gridRows}, 1fr)`,
              gap: `${gridGap}px`,
            }}
          >
            {Array.from({ length: gridRows * gridCols }).map((_, index) => {
              const row = Math.floor(index / gridCols);
              const col = index % gridCols;
              const cellKey = `${row}-${col}`;
              const cellConfig = cells[cellKey];

              if (!cellConfig?.field && !cellConfig?.useScript) {
                return <div key={cellKey} />;
              }

              const cellFontSize = fontSize * 0.7;

              // Get cell value - either from script or field
              let displayValue: unknown;
              let hasError = false;

              if (cellConfig.useScript && cellConfig.script) {
                const result = executeCellScript(cellConfig.script);
                displayValue = result.value;
                hasError = !!result.error;
              } else {
                displayValue = getFieldValue(sampleData, cellConfig.field);
              }

              const cellAlign = cellConfig.align || 'center';
              const alignItems = cellAlign === 'left' ? 'items-start' : cellAlign === 'right' ? 'items-end' : 'items-center';
              const textAlign = cellAlign === 'left' ? 'text-left' : cellAlign === 'right' ? 'text-right' : 'text-center';
              const justifyContent = cellAlign === 'left' ? 'justify-start' : cellAlign === 'right' ? 'justify-end' : 'justify-center';

              return (
                <div
                  key={cellKey}
                  className={`flex flex-col ${alignItems} justify-center ${textAlign} p-1 overflow-hidden`}
                >
                  {cellConfig.label && (
                    <div
                      className="truncate w-full"
                      style={{ fontSize: `${cellFontSize * 0.6}px`, opacity: 0.6, textAlign: cellAlign }}
                    >
                      {cellConfig.label}
                    </div>
                  )}
                  <div className={`flex ${alignItems} ${justifyContent} gap-0.5 font-bold ${hasError ? 'text-status-error-text' : ''}`}>
                    {!cellConfig.useScript && cellConfig.prefix && (
                      <span style={{ fontSize: `${cellFontSize}px` }}>{cellConfig.prefix}</span>
                    )}
                    {renderFieldValue(displayValue, cellConfig.fieldType || 'text', cellFontSize)}
                    {!cellConfig.useScript && cellConfig.suffix && (
                      <span style={{ fontSize: `${cellFontSize}px` }}>{cellConfig.suffix}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
      }

      default:
        return <div className="text-text-placeholder">Unknown display type</div>;
    }
  } catch {
    return <div className="text-status-error-text text-sm">Error rendering preview</div>;
  }
}
