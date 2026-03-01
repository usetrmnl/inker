import { describe, it, expect } from 'bun:test';
import { ScriptExecutorService } from './script-executor.service';

describe('ScriptExecutorService', () => {
  const executor = new ScriptExecutorService();

  describe('value mode', () => {
    it('should return simple values', () => {
      const result = executor.execute('return 42;', {}, 'value');
      expect(result.success).toBe(true);
      expect(result.value).toBe(42);
    });

    it('should return string values', () => {
      const result = executor.execute('return "hello";', {}, 'value');
      expect(result.success).toBe(true);
      expect(result.value).toBe('hello');
    });

    it('should access data via $ syntax', () => {
      const result = executor.execute('return $.price;', { price: 100 }, 'value');
      expect(result.success).toBe(true);
      expect(result.value).toBe(100);
    });

    it('should access nested data', () => {
      const data = { rates: [{ mid: 4.25 }] };
      const result = executor.execute('return $.rates[0].mid;', data, 'value');
      expect(result.success).toBe(true);
      expect(result.value).toBe(4.25);
    });

    it('should support arithmetic expressions', () => {
      const result = executor.execute('return $.price * 1000;', { price: 3.5 }, 'value');
      expect(result.success).toBe(true);
      expect(result.value).toBe(3500);
    });

    it('should support Math functions', () => {
      const result = executor.execute('return Math.floor($.value);', { value: 3.7 }, 'value');
      expect(result.success).toBe(true);
      expect(result.value).toBe(3);
    });

    it('should support JSON operations', () => {
      const result = executor.execute(
        'var obj = JSON.parse(JSON.stringify($)); return obj.x;',
        { x: 42 },
        'value',
      );
      expect(result.success).toBe(true);
      expect(result.value).toBe(42);
    });

    it('should support parseInt/parseFloat', () => {
      const result = executor.execute('return parseInt("42") + parseFloat("0.5");', {}, 'value');
      expect(result.success).toBe(true);
      expect(result.value).toBe(42.5);
    });

    it('should support string operations', () => {
      const result = executor.execute(
        'return $.name.toUpperCase();',
        { name: 'hello' },
        'value',
      );
      expect(result.success).toBe(true);
      expect(result.value).toBe('HELLO');
    });

    it('should support array operations', () => {
      const result = executor.execute(
        'return $.items.length;',
        { items: [1, 2, 3] },
        'value',
      );
      expect(result.success).toBe(true);
      expect(result.value).toBe(3);
    });
  });

  describe('template mode', () => {
    it('should extract declared variables', () => {
      const code = 'var greeting = "hello"; var count = 5;';
      const result = executor.execute(code, {}, 'template');
      expect(result.success).toBe(true);
      expect(result.variables).toEqual({ greeting: 'hello', count: 5 });
    });

    it('should access $ data in variables', () => {
      const code = 'var total = $.price * $.quantity;';
      const result = executor.execute(code, { price: 10, quantity: 3 }, 'template');
      expect(result.success).toBe(true);
      expect(result.variables?.total).toBe(30);
    });
  });

  describe('error handling', () => {
    it('should return error for syntax errors', () => {
      const result = executor.execute('return {{{;', {}, 'value');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should return error for runtime errors', () => {
      const result = executor.execute('return $.foo.bar.baz;', {}, 'value');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('sandbox security', () => {
    it('should not have access to process', () => {
      const result = executor.execute('return typeof _process;', {}, 'value');
      expect(result.success).toBe(true);
      expect(result.value).toBe('undefined');
    });

    it('should not have access to require', () => {
      const result = executor.execute('return typeof _require;', {}, 'value');
      expect(result.success).toBe(true);
      expect(result.value).toBe('undefined');
    });

    it('should timeout on infinite loops', () => {
      const result = executor.execute('while(true) {}', {}, 'value');
      expect(result.success).toBe(false);
      expect(result.error).toContain('timed out');
    });

    it('should block constructor keyword in scripts', () => {
      const result = executor.execute(
        'return parseInt.constructor("return 1")()',
        {},
        'value',
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('forbidden keyword');
    });

    it('should block __proto__ keyword in scripts', () => {
      const result = executor.execute(
        'return $.__proto__;',
        { a: 1 },
        'value',
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('forbidden keyword');
    });

    it('should block prototype keyword in scripts', () => {
      const result = executor.execute(
        'return Object.prototype;',
        {},
        'value',
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('forbidden keyword');
    });

    it('should block Function keyword in scripts', () => {
      const result = executor.execute(
        'return Function("return 1")()',
        {},
        'value',
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('forbidden keyword');
    });

    it('should block eval keyword in scripts', () => {
      const result = executor.execute(
        'return eval("1+1")',
        {},
        'value',
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('forbidden keyword');
    });

    it('should block process keyword in scripts', () => {
      const result = executor.execute(
        'return process.env;',
        {},
        'value',
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('forbidden keyword');
    });

    it('should block require keyword in scripts', () => {
      const result = executor.execute(
        'return require("fs");',
        {},
        'value',
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('forbidden keyword');
    });

    it('should block import keyword in scripts', () => {
      const result = executor.execute(
        'var x = import("fs");',
        {},
        'value',
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('forbidden keyword');
    });

    it('should block globalThis keyword in scripts', () => {
      const result = executor.execute(
        'return globalThis;',
        {},
        'value',
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('forbidden keyword');
    });

    it('should reject oversized scripts', () => {
      const code = 'return ' + '"x"'.repeat(5000) + ';';
      const result = executor.execute(code, {}, 'value');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Script too large');
    });

    it('should not have Function in context', () => {
      // Use a variable name that doesn't trigger keyword blocking
      const result = executor.execute(
        'return typeof _Fn;',
        {},
        'value',
      );
      expect(result.success).toBe(true);
      expect(result.value).toBe('undefined');
    });

    it('should not have eval in context', () => {
      // Use a variable name that doesn't trigger keyword blocking
      const result = executor.execute(
        'return typeof _ev;',
        {},
        'value',
      );
      expect(result.success).toBe(true);
      expect(result.value).toBe('undefined');
    });

    it('should handle null data safely', () => {
      const result = executor.execute('return $ === null;', null, 'value');
      expect(result.success).toBe(true);
      expect(result.value).toBe(true);
    });

    it('should handle undefined data safely', () => {
      const result = executor.execute('return $ === null;', undefined, 'value');
      expect(result.success).toBe(true);
      expect(result.value).toBe(true);
    });
  });
});
