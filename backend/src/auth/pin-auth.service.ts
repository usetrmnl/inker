import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, timingSafeEqual } from 'crypto';

/**
 * Simple PIN-based authentication service
 * Replaces complex user/JWT auth with a single shared PIN
 */
@Injectable()
export class PinAuthService implements OnModuleInit, OnModuleDestroy {
  // In-memory session storage (simple approach for single-instance)
  private sessions = new Map<string, { createdAt: Date }>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  // Cleanup interval: 1 hour
  private static readonly CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
  // Session max age: 30 days
  private static readonly SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

  constructor(private configService: ConfigService) {}

  /**
   * Start periodic session cleanup on module init
   */
  onModuleInit() {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, PinAuthService.CLEANUP_INTERVAL_MS);
  }

  /**
   * Clear cleanup interval on module destroy
   */
  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Validate PIN against configured admin PIN
   * Uses timing-safe comparison to prevent timing attacks
   */
  validatePin(pin: string): boolean {
    const storedPin = this.configService.get<string>('admin.pin');

    // Guard against undefined/null storedPin
    if (!storedPin) {
      return false;
    }

    // Use timing-safe comparison to prevent timing attacks
    // Pad both strings to the same length to avoid length-based timing leaks
    const maxLen = Math.max(pin.length, storedPin.length);
    const paddedPin = pin.padEnd(maxLen, '\0');
    const paddedStored = storedPin.padEnd(maxLen, '\0');

    try {
      return timingSafeEqual(Buffer.from(paddedPin), Buffer.from(paddedStored));
    } catch {
      return false;
    }
  }

  /**
   * Generate a new session token
   */
  generateSessionToken(): string {
    const token = randomBytes(32).toString('hex');
    this.sessions.set(token, { createdAt: new Date() });
    return token;
  }

  /**
   * Validate session token (also checks expiry on every request)
   */
  validateSession(token: string): boolean {
    const session = this.sessions.get(token);
    if (!session) return false;

    // Check expiry on every validation, not just during cleanup
    if (session.createdAt.getTime() < Date.now() - PinAuthService.SESSION_MAX_AGE_MS) {
      this.sessions.delete(token);
      return false;
    }

    return true;
  }

  /**
   * Invalidate session token (logout)
   */
  invalidateSession(token: string): void {
    this.sessions.delete(token);
  }

  /**
   * Clean up expired sessions (optional, for memory management)
   * Sessions older than 30 days are removed
   */
  cleanupExpiredSessions(): void {
    const cutoff = new Date(Date.now() - PinAuthService.SESSION_MAX_AGE_MS);
    for (const [token, session] of this.sessions.entries()) {
      if (session.createdAt < cutoff) {
        this.sessions.delete(token);
      }
    }
  }
}
