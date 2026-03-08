/**
 * Test helper utilities for bun:test
 */

export interface MockFn<T = any> {
  (...args: any[]): T;
  calls: any[][];
  mockReturnValue(val: T): MockFn<T>;
  mockResolvedValue(val: any): MockFn<Promise<any>>;
  mockRejectedValue(val: any): MockFn<Promise<any>>;
  mockImplementation(fn: (...args: any[]) => T): MockFn<T>;
  mockReset(): void;
}

/**
 * Creates a trackable mock function (replacement for jest.fn())
 */
export function createMock<T = any>(defaultReturn?: T): MockFn<T> {
  let impl: ((...args: any[]) => T) | null = null;
  let returnValue: T = defaultReturn as T;

  const fn = ((...args: any[]) => {
    fn.calls.push(args);
    if (impl) return impl(...args);
    return returnValue;
  }) as MockFn<T>;

  fn.calls = [];

  fn.mockReturnValue = (val: T) => {
    returnValue = val;
    impl = null;
    return fn;
  };

  fn.mockResolvedValue = (val: any) => {
    returnValue = Promise.resolve(val) as any;
    impl = null;
    return fn as any;
  };

  fn.mockRejectedValue = (val: any) => {
    returnValue = Promise.reject(val) as any;
    impl = null;
    return fn as any;
  };

  fn.mockImplementation = (newImpl: (...args: any[]) => T) => {
    impl = newImpl;
    return fn;
  };

  fn.mockReset = () => {
    fn.calls = [];
    impl = null;
    returnValue = defaultReturn as T;
  };

  return fn;
}

/**
 * Creates a mock object where every property is a mock function
 */
export function createMockObject<T>(methods: (keyof T)[]): { [K in keyof T]: MockFn } {
  const obj = {} as any;
  for (const method of methods) {
    obj[method] = createMock();
  }
  return obj;
}
