import { Injectable, ExecutionContext, CanActivate, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { PinAuthService } from '../pin-auth.service';

/**
 * PIN Authentication Guard
 * Protects routes by default unless marked with @Public() decorator
 * Validates session token from Authorization header
 */
@Injectable()
export class PinAuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private pinAuthService: PinAuthService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // Extract token from Authorization header
    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('No session token provided');
    }

    // Validate session token
    const isValid = this.pinAuthService.validateSession(token);
    if (!isValid) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    return true;
  }

  private extractToken(request: any): string | null {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      return null;
    }

    const [type, token] = authHeader.split(' ');
    if (type !== 'Bearer' || !token) {
      return null;
    }

    return token;
  }
}
