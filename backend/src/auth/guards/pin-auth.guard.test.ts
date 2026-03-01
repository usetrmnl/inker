import { describe, it, expect, beforeEach } from 'bun:test';
import { PinAuthGuard } from './pin-auth.guard';
import { createMock } from '../../test/mocks/helpers';
import { UnauthorizedException } from '@nestjs/common';

describe('PinAuthGuard', () => {
  let guard: PinAuthGuard;
  let mockReflector: any;
  let mockPinAuthService: any;

  beforeEach(() => {
    mockReflector = {
      getAllAndOverride: createMock().mockReturnValue(false),
    };
    mockPinAuthService = {
      validateSession: createMock().mockReturnValue(true),
    };
    guard = new PinAuthGuard(mockReflector, mockPinAuthService);
  });

  const createMockContext = (authHeader?: string) => ({
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({
        headers: authHeader ? { authorization: authHeader } : {},
      }),
    }),
  });

  it('should allow public routes', () => {
    mockReflector.getAllAndOverride.mockReturnValue(true);
    const context = createMockContext();
    expect(guard.canActivate(context as any)).toBe(true);
  });

  it('should throw when no authorization header', () => {
    const context = createMockContext();
    expect(() => guard.canActivate(context as any)).toThrow(UnauthorizedException);
  });

  it('should throw when token format is invalid', () => {
    const context = createMockContext('InvalidFormat');
    expect(() => guard.canActivate(context as any)).toThrow(UnauthorizedException);
  });

  it('should throw when session is invalid', () => {
    mockPinAuthService.validateSession.mockReturnValue(false);
    const context = createMockContext('Bearer invalid-token');
    expect(() => guard.canActivate(context as any)).toThrow(UnauthorizedException);
  });

  it('should allow valid session token', () => {
    const context = createMockContext('Bearer valid-token');
    expect(guard.canActivate(context as any)).toBe(true);
    expect(mockPinAuthService.validateSession.calls[0][0]).toBe('valid-token');
  });
});
