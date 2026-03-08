import { useEffect, useRef, useCallback, useState } from 'react';
import { EditorView, keymap, placeholder } from '@codemirror/view';
import { EditorState, Compartment } from '@codemirror/state';
import { javascript } from '@codemirror/lang-javascript';
import {
  autocompletion,
  type CompletionContext,
  type Completion,
} from '@codemirror/autocomplete';
import {
  defaultKeymap,
  history,
  historyKeymap,
} from '@codemirror/commands';
import {
  syntaxHighlighting,
  HighlightStyle,
  bracketMatching,
} from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { lineNumbers, highlightActiveLineGutter, highlightActiveLine } from '@codemirror/view';
import type { FieldMeta } from '../../types';

// Custom syntax highlighting with readable colors
const customHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: '#c678dd', fontWeight: 'bold' },           // purple - var, let, const, return
  { tag: tags.operator, color: '#56b6c2' },                              // cyan - =, +, -, *, /
  { tag: tags.variableName, color: '#e06c75' },                          // red - variable names
  { tag: tags.propertyName, color: '#e5c07b' },                          // yellow - property access
  { tag: tags.string, color: '#98c379' },                                // green - strings
  { tag: tags.number, color: '#d19a66' },                                // orange - numbers
  { tag: tags.bool, color: '#d19a66' },                                  // orange - true/false
  { tag: tags.null, color: '#d19a66' },                                  // orange - null
  { tag: tags.comment, color: '#7f848e', fontStyle: 'italic' },          // gray - comments
  { tag: tags.function(tags.variableName), color: '#61afef' },           // blue - function names
  { tag: tags.definition(tags.variableName), color: '#e06c75' },         // red - variable definitions
  { tag: tags.punctuation, color: '#abb2bf' },                           // light gray - brackets, commas
  { tag: tags.bracket, color: '#abb2bf' },                               // light gray - [], {}
]);

export interface ScriptExecutionResult {
  success: boolean;
  output?: unknown;
  variables?: Record<string, unknown>;
  error?: string;
}

interface ScriptEditorProps {
  value: string;
  onChange: (value: string) => void;
  availableFields: FieldMeta[];
  sampleData: unknown;
  outputMode: 'value' | 'template';
  template?: string;
  prefix?: string;
  suffix?: string;
  placeholder?: string;
  onExecutionResult?: (result: ScriptExecutionResult | null) => void;
}

// Safe globals for script execution (mirrors backend)
const SAFE_GLOBALS = {
  Math,
  String,
  Number,
  Boolean,
  Array: {
    isArray: Array.isArray,
    from: Array.from,
  },
  Object: {
    keys: Object.keys,
    values: Object.values,
    entries: Object.entries,
  },
  JSON: {
    parse: JSON.parse,
    stringify: JSON.stringify,
  },
  Date,
  parseInt,
  parseFloat,
  isNaN,
  isFinite,
  encodeURIComponent,
  decodeURIComponent,
};

export function ScriptEditor({
  value,
  onChange,
  availableFields,
  sampleData,
  outputMode,
  template,
  prefix = '',
  suffix = '',
  placeholder: placeholderText,
  onExecutionResult,
}: ScriptEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const completionCompartment = useRef(new Compartment());
  const [executionResult, setExecutionResult] = useState<ScriptExecutionResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  // Build completions from available fields
  const buildCompletions = useCallback((): Completion[] => {
    const completions: Completion[] = [];

    // Add field completions ($.fieldName)
    availableFields.forEach((field) => {
      const sampleValue = field.sample !== undefined
        ? (typeof field.sample === 'string'
            ? `"${field.sample.substring(0, 30)}${field.sample.length > 30 ? '...' : ''}"`
            : String(field.sample))
        : field.type;

      completions.push({
        label: `$.${field.path}`,
        type: 'variable',
        info: `${field.type}${field.isImageUrl ? ' (image URL)' : ''}${field.isLink ? ' (link)' : ''}`,
        detail: sampleValue,
        boost: 1,
      });
    });

    // Add common JavaScript helpers
    const helpers: { label: string; type: string; info: string }[] = [
      { label: 'Math.round', type: 'function', info: 'Round to nearest integer' },
      { label: 'Math.floor', type: 'function', info: 'Round down' },
      { label: 'Math.ceil', type: 'function', info: 'Round up' },
      { label: 'Math.abs', type: 'function', info: 'Absolute value' },
      { label: 'Math.min', type: 'function', info: 'Minimum of values' },
      { label: 'Math.max', type: 'function', info: 'Maximum of values' },
      { label: 'Number.toFixed', type: 'method', info: 'Format decimal places' },
      { label: 'String.toUpperCase', type: 'method', info: 'Convert to uppercase' },
      { label: 'String.toLowerCase', type: 'method', info: 'Convert to lowercase' },
      { label: 'String.trim', type: 'method', info: 'Remove whitespace' },
      { label: 'String.substring', type: 'method', info: 'Extract substring' },
      { label: 'JSON.stringify', type: 'function', info: 'Convert to JSON string' },
      { label: 'JSON.parse', type: 'function', info: 'Parse JSON string' },
      { label: 'parseInt', type: 'function', info: 'Parse integer' },
      { label: 'parseFloat', type: 'function', info: 'Parse float' },
      { label: 'isNaN', type: 'function', info: 'Check if NaN' },
      { label: 'new Date', type: 'constructor', info: 'Create date object' },
      { label: 'Date.now', type: 'function', info: 'Current timestamp' },
    ];

    helpers.forEach((h) => {
      completions.push({
        label: h.label,
        type: h.type,
        info: h.info,
        boost: 0,
      });
    });

    return completions;
  }, [availableFields]);

  // Custom completion source
  const completionSource = useCallback((context: CompletionContext) => {
    const word = context.matchBefore(/[\w$.[\]]+/);
    if (!word) return null;

    const completions = buildCompletions();

    // Filter completions based on current word
    const filtered = completions.filter((c) =>
      c.label.toLowerCase().includes(word.text.toLowerCase())
    );

    return {
      from: word.from,
      options: filtered,
      validFor: /^[\w$.[\]]*$/,
    };
  }, [buildCompletions]);

  // Execute JavaScript code safely in browser
  const executeScript = useCallback((code: string, data: unknown): ScriptExecutionResult => {
    if (!code.trim()) {
      return { success: false, error: 'No code to execute' };
    }

    try {
      // Create $ proxy object for data access
      const createDataProxy = (obj: unknown): unknown => {
        if (obj === null || obj === undefined) return obj;
        if (typeof obj !== 'object') return obj;

        return new Proxy(obj as object, {
          get(target, prop) {
            if (typeof prop === 'string') {
              const value = (target as Record<string, unknown>)[prop];
              if (typeof value === 'object' && value !== null) {
                return createDataProxy(value);
              }
              return value;
            }
            return undefined;
          },
        });
      };

      const $ = createDataProxy(data);

      // Build function body
      let functionBody: string;

      if (outputMode === 'template') {
        // Template mode: collect variables
        functionBody = `
          ${code}
          return {
            ${code.match(/(?:var|let|const)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g)
              ?.map(match => match.replace(/(?:var|let|const)\s+/, ''))
              .filter(v => !v.startsWith('__'))
              .join(', ') || ''}
          };
        `;
      } else {
        // Value mode: expect return statement
        functionBody = code;
      }

      // Create sandboxed function
      const fn = new Function(
        '$',
        'Math',
        'String',
        'Number',
        'Boolean',
        'Array',
        'Object',
        'JSON',
        'Date',
        'parseInt',
        'parseFloat',
        'isNaN',
        'isFinite',
        'encodeURIComponent',
        'decodeURIComponent',
        functionBody
      );

      // Execute with timeout protection
      const startTime = Date.now();
      const result = fn(
        $,
        SAFE_GLOBALS.Math,
        SAFE_GLOBALS.String,
        SAFE_GLOBALS.Number,
        SAFE_GLOBALS.Boolean,
        SAFE_GLOBALS.Array,
        SAFE_GLOBALS.Object,
        SAFE_GLOBALS.JSON,
        SAFE_GLOBALS.Date,
        SAFE_GLOBALS.parseInt,
        SAFE_GLOBALS.parseFloat,
        SAFE_GLOBALS.isNaN,
        SAFE_GLOBALS.isFinite,
        SAFE_GLOBALS.encodeURIComponent,
        SAFE_GLOBALS.decodeURIComponent
      );
      const duration = Date.now() - startTime;

      if (duration > 1000) {
        return { success: false, error: 'Script took too long to execute' };
      }

      if (outputMode === 'template') {
        return { success: true, variables: result as Record<string, unknown> };
      } else {
        return { success: true, output: result };
      }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }, [outputMode]);

  // Run script when code or data changes
  useEffect(() => {
    if (!value || !sampleData) {
      setExecutionResult(null);
      onExecutionResult?.(null);
      return;
    }

    setIsExecuting(true);
    // Small delay to avoid running on every keystroke
    const timer = setTimeout(() => {
      const result = executeScript(value, sampleData);
      setExecutionResult(result);
      onExecutionResult?.(result);
      setIsExecuting(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [value, sampleData, executeScript, onExecutionResult]);

  // Initialize CodeMirror
  useEffect(() => {
    if (!editorRef.current || viewRef.current) return;

    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        history(),
        bracketMatching(),
        syntaxHighlighting(customHighlightStyle),
        javascript(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        completionCompartment.current.of(
          autocompletion({
            override: [completionSource],
            activateOnTyping: true,
            icons: true,
          })
        ),
        placeholder(placeholderText || ''),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChange(update.state.doc.toString());
          }
        }),
        // Custom dark theme with readable colors
        EditorView.theme({
          '&': {
            height: '220px',
            fontSize: '14px',
            backgroundColor: '#1e1e2e',
            color: '#cdd6f4',
          },
          '.cm-scroller': {
            overflow: 'auto',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          },
          '.cm-content': {
            padding: '12px 0',
            caretColor: '#f5e0dc',
          },
          '.cm-cursor': {
            borderLeftColor: '#f5e0dc',
            borderLeftWidth: '2px',
          },
          '.cm-gutters': {
            backgroundColor: '#181825',
            color: '#6c7086',
            border: 'none',
            borderRight: '1px solid #313244',
          },
          '.cm-activeLineGutter': {
            backgroundColor: '#313244',
            color: '#cdd6f4',
          },
          '.cm-activeLine': {
            backgroundColor: '#313244',
          },
          '.cm-selectionBackground': {
            backgroundColor: '#45475a !important',
          },
          '&.cm-focused .cm-selectionBackground': {
            backgroundColor: '#45475a !important',
          },
          '.cm-matchingBracket': {
            backgroundColor: '#585b70',
            color: '#f5e0dc',
            outline: '1px solid #f5e0dc',
          },
          '.cm-placeholder': {
            color: '#6c7086',
            fontStyle: 'italic',
          },
          // Autocomplete tooltip styling
          '.cm-tooltip': {
            backgroundColor: '#1e1e2e',
            border: '1px solid #45475a',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          },
          '.cm-tooltip.cm-tooltip-autocomplete': {
            backgroundColor: '#1e1e2e',
          },
          '.cm-tooltip-autocomplete ul': {
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          },
          '.cm-tooltip-autocomplete ul li': {
            padding: '6px 12px',
            color: '#cdd6f4',
          },
          '.cm-tooltip-autocomplete ul li[aria-selected]': {
            backgroundColor: '#45475a',
            color: '#f5e0dc',
          },
          '.cm-completionLabel': {
            color: '#89b4fa',
          },
          '.cm-completionIcon': {
            marginRight: '8px',
            color: '#cba6f7',
          },
          '.cm-completionDetail': {
            marginLeft: '12px',
            color: '#a6adc8',
            fontStyle: 'italic',
          },
          '.cm-completionInfo': {
            padding: '8px 12px',
            backgroundColor: '#181825',
            borderLeft: '1px solid #45475a',
            color: '#bac2de',
          },
        }, { dark: true }),
      ],
    });

    viewRef.current = new EditorView({
      state,
      parent: editorRef.current,
    });

    return () => {
      viewRef.current?.destroy();
      viewRef.current = null;
    };
  // Only run once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update completion source when fields change
  useEffect(() => {
    if (viewRef.current) {
      viewRef.current.dispatch({
        effects: completionCompartment.current.reconfigure(
          autocompletion({
            override: [completionSource],
            activateOnTyping: true,
            icons: true,
          })
        ),
      });
    }
  }, [completionSource]);

  // Update editor content when value changes externally
  useEffect(() => {
    if (viewRef.current) {
      const currentValue = viewRef.current.state.doc.toString();
      if (currentValue !== value) {
        viewRef.current.dispatch({
          changes: {
            from: 0,
            to: currentValue.length,
            insert: value,
          },
        });
      }
    }
  }, [value]);

  // Render final output with template substitution
  const renderOutput = () => {
    if (!executionResult?.success) return null;

    if (outputMode === 'template' && executionResult.variables) {
      let output = template || '';
      Object.entries(executionResult.variables).forEach(([key, val]) => {
        output = output.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(val));
      });
      return output;
    } else if (outputMode === 'value' && executionResult.output !== undefined) {
      return `${prefix}${String(executionResult.output)}${suffix}`;
    }
    return null;
  };

  return (
    <div className="space-y-3">
      {/* Editor */}
      <div className="border border-border-dark rounded-lg overflow-hidden">
        <div ref={editorRef} />
      </div>

      {/* Hint about $ access */}
      <p className="text-xs text-text-muted">
        Type <code className="bg-bg-muted px-1 rounded">$.</code> to see available fields from API.
        Press <kbd className="bg-bg-muted px-1 rounded text-xs">Ctrl+Space</kbd> for autocomplete.
      </p>

      {/* Live Execution Result */}
      <div className="border border-border-light rounded-lg overflow-hidden">
        <div className="px-3 py-2 bg-bg-muted border-b border-border-light flex items-center justify-between">
          <span className="text-sm font-medium text-text-secondary">Live Output</span>
          {isExecuting && (
            <svg className="w-4 h-4 animate-spin text-accent" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
        </div>
        <div className="p-3 bg-bg-card min-h-[60px]">
          {!sampleData ? (
            <span className="text-text-placeholder text-sm">Select a data source to see live output</span>
          ) : !value ? (
            <span className="text-text-placeholder text-sm">Write JavaScript code to see output</span>
          ) : executionResult?.success ? (
            <div className="space-y-2">
              {/* Final rendered output */}
              <div className="p-3 bg-status-success-bg border border-status-success-border rounded-lg">
                <div className="text-xs text-status-success-text mb-1 font-medium">Result:</div>
                <div className="font-mono text-status-success-text text-lg">
                  {renderOutput()}
                </div>
              </div>

              {/* Variables in template mode */}
              {outputMode === 'template' && executionResult.variables && (
                <div className="text-xs space-y-1">
                  <div className="text-text-muted font-medium">Variables:</div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(executionResult.variables).map(([key, val]) => (
                      <div key={key} className="px-2 py-1 bg-bg-muted rounded font-mono">
                        <span className="text-accent">{key}</span>
                        <span className="text-text-placeholder"> = </span>
                        <span className="text-text-secondary">{String(val)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Raw return value in value mode */}
              {outputMode === 'value' && (
                <div className="text-xs text-text-muted">
                  Raw: <code className="bg-bg-muted px-1 rounded">{JSON.stringify(executionResult.output)}</code>
                </div>
              )}
            </div>
          ) : executionResult?.error ? (
            <div className="p-3 bg-status-error-bg border border-status-error-border rounded-lg">
              <div className="text-xs text-status-error-text mb-1 font-medium">Error:</div>
              <div className="font-mono text-status-error-text text-sm">{executionResult.error}</div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
