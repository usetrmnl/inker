import { Injectable, Logger } from '@nestjs/common';
import * as vm from 'vm';

export interface ScriptResult {
  success: boolean;
  value?: unknown;
  variables?: Record<string, unknown>;
  error?: string;
}

@Injectable()
export class ScriptExecutorService {
  private readonly logger = new Logger(ScriptExecutorService.name);
  private readonly TIMEOUT_MS = 1000;
  private readonly MAX_SCRIPT_LENGTH = 10_000;

  /**
   * Blocked keywords that could be used to escape the VM sandbox.
   * Checked via word-boundary regex to avoid false positives in data strings.
   */
  private readonly BLOCKED_PATTERNS: readonly RegExp[] = [
    /\bconstructor\b/,
    /\b__proto__\b/,
    /\bprototype\b/,
    /\bFunction\b/,
    /\beval\b/,
    /\bimport\b/,
    /\bglobalThis\b/,
    /\bprocess\b/,
    /\brequire\b/,
    /\bProxy\b/,
    /\bReflect\b/,
    /\bSymbol\b/,
    /\bWeakRef\b/,
    /\bFinalizationRegistry\b/,
  ];

  /**
   * Execute user script with $ proxy for data access
   * @param code - User JavaScript code
   * @param data - API data accessible via $.fieldName
   * @param mode - 'value' returns script result, 'template' extracts declared variables
   */
  execute(
    code: string,
    data: unknown,
    mode: 'value' | 'template',
  ): ScriptResult {
    try {
      // Validate script before execution
      this.validateScript(code);

      // Build context with no prototype chain.
      // After vm.createContext(), V8 populates the context with its own
      // isolated builtins (Math, JSON, parseInt, etc.) that are safe —
      // their prototype chains lead to the VM's own Function, not the host's.
      const context: vm.Context = Object.create(null);
      vm.createContext(context);

      // Remove dangerous VM globals that aren't needed for data transformation
      context.Function = undefined;
      context.eval = undefined;
      context['constructor'] = undefined;
      context['__proto__'] = undefined;
      context.WeakRef = undefined;
      context.FinalizationRegistry = undefined;
      context.Proxy = undefined;
      context.Reflect = undefined;
      context.Symbol = undefined;

      // Inject $ data safely: serialize to JSON, parse INSIDE the VM.
      // This ensures all data objects have VM-realm prototypes, not host prototypes.
      // Even if an attacker traverses $.constructor, they reach the VM's Function,
      // which cannot access the host's process/require.
      const dataJson = JSON.stringify(data ?? null);
      const initScript = new vm.Script(
        `var $ = JSON.parse(${JSON.stringify(dataJson)});`,
      );
      initScript.runInContext(context, { timeout: this.TIMEOUT_MS });

      if (mode === 'value') {
        return this.executeValueMode(context, code);
      } else {
        return this.executeTemplateMode(context, code);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Script execution failed: ${message}`);
      return { success: false, error: message };
    }
  }

  /**
   * Validate script for dangerous patterns and size limits.
   * This is defense-in-depth — the primary protection is VM-realm isolation.
   */
  private validateScript(code: string): void {
    if (code.length > this.MAX_SCRIPT_LENGTH) {
      throw new Error(
        `Script too large: ${code.length} characters (max ${this.MAX_SCRIPT_LENGTH})`,
      );
    }

    for (const pattern of this.BLOCKED_PATTERNS) {
      if (pattern.test(code)) {
        throw new Error(
          `Script contains forbidden keyword: ${pattern.source.replace(/\\b/g, '')}`,
        );
      }
    }
  }

  /**
   * Execute script in value mode - returns the result of the script
   */
  private executeValueMode(context: vm.Context, code: string): ScriptResult {
    // Wrap code in IIFE to capture return value
    const wrappedCode = `(function() { ${code} })()`;

    try {
      const script = new vm.Script(wrappedCode);
      const result = script.runInContext(context, { timeout: this.TIMEOUT_MS });
      return { success: true, value: result };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }

  /**
   * Execute script in template mode - extracts all declared variables
   */
  private executeTemplateMode(context: vm.Context, code: string): ScriptResult {
    // Extract variable names declared with var, let, or const
    const variableNames = this.extractVariableNames(code);

    // Build code that executes user script and collects variables
    const collectVarsCode = variableNames
      .map((v) => `if (typeof ${v} !== 'undefined') __vars['${v}'] = ${v};`)
      .join('\n');

    const wrappedCode = `
      (function() {
        var __vars = {};
        ${code}
        ${collectVarsCode}
        return __vars;
      })()
    `;

    try {
      const script = new vm.Script(wrappedCode);
      const variables = script.runInContext(context, {
        timeout: this.TIMEOUT_MS,
      }) as Record<string, unknown>;
      return { success: true, variables };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }

  /**
   * Extract variable names from code (var, let, const declarations)
   */
  private extractVariableNames(code: string): string[] {
    const varRegex = /(?:var|let|const)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
    const names: string[] = [];
    let match;
    while ((match = varRegex.exec(code)) !== null) {
      // Skip internal variables
      if (!match[1].startsWith('__')) {
        names.push(match[1]);
      }
    }
    return [...new Set(names)]; // Remove duplicates
  }
}
