import { randomBytes } from 'crypto';

/**
 * Generate a random API key
 */
export function generateApiKey(length: number = 32): string {
  return randomBytes(length).toString('hex');
}

/**
 * Generate a random token
 */
export function generateToken(length: number = 32): string {
  return randomBytes(length).toString('base64url');
}