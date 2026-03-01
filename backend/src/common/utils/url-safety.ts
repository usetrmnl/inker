/**
 * URL Safety Utility
 * Shared SSRF validation for any HTTP fetch in the application.
 * Prevents requests to internal services, private IPs, and non-HTTP protocols.
 */
import * as dns from 'dns';
import * as http from 'http';
import * as https from 'https';
import { promisify } from 'util';

const dnsResolve4 = promisify(dns.resolve4);
const dnsResolve6 = promisify(dns.resolve6);

/** Hostnames that must never be accessed by user-initiated fetches */
const BLOCKED_HOSTNAMES = [
  'localhost',
  'inker-backend',
  'inker-frontend',
  'inker-postgres',
  'inker-redis',
  'host.docker.internal',
  'metadata.google.internal',
];

/**
 * Check whether an IP address belongs to a private/reserved range.
 */
export function isPrivateIp(ip: string): boolean {
  // Handle IPv4-mapped IPv6 (e.g., ::ffff:127.0.0.1)
  const ipv4Mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (ipv4Mapped) return isPrivateIp(ipv4Mapped[1]);

  // IPv4 private ranges
  const parts = ip.split('.').map(Number);
  if (parts.length === 4 && parts.every((p) => !isNaN(p))) {
    const [a, b] = parts;
    return (
      a === 127 ||                          // 127.0.0.0/8 (loopback)
      a === 10 ||                            // 10.0.0.0/8
      (a === 172 && b >= 16 && b <= 31) ||   // 172.16.0.0/12
      (a === 192 && b === 168) ||            // 192.168.0.0/16
      (a === 169 && b === 254) ||            // 169.254.0.0/16 (link-local / cloud metadata)
      a === 0                                // 0.0.0.0/8
    );
  }

  // IPv6 private/reserved ranges
  const normalized = ip.toLowerCase();
  if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') return true;
  if (/^f[cd]/.test(normalized)) return true;   // fc00::/7 (Unique Local Addresses)
  if (/^fe[89ab]/.test(normalized)) return true; // fe80::/10 (Link-Local)

  return false;
}

/**
 * Validate a URL for safe external fetching.
 * Throws an Error if the URL is unsafe (private IP, blocked hostname, bad protocol).
 */
export async function validateUrlSafety(url: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid URL format');
  }

  // Only allow http/https
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only HTTP and HTTPS URLs are allowed');
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block internal hostnames
  if (BLOCKED_HOSTNAMES.includes(hostname)) {
    throw new Error('URLs pointing to internal services are not allowed');
  }

  // Check if hostname is directly an IP address in private range
  if (isPrivateIp(hostname)) {
    throw new Error('URLs pointing to private IP addresses are not allowed');
  }

  // Resolve DNS and check resolved IPs
  try {
    const [ipv4Addresses, ipv6Addresses] = await Promise.all([
      dnsResolve4(hostname).catch(() => [] as string[]),
      dnsResolve6(hostname).catch(() => [] as string[]),
    ]);
    const allAddresses = [...ipv4Addresses, ...ipv6Addresses];
    for (const addr of allAddresses) {
      if (isPrivateIp(addr)) {
        throw new Error('URL resolves to a private IP address');
      }
    }
  } catch (err) {
    if (err instanceof Error && (
      err.message.includes('private IP') ||
      err.message.includes('internal services') ||
      err.message.includes('Only HTTP')
    )) {
      throw err;
    }
    // Other DNS errors (e.g., ENOTFOUND) are fine — the fetch will handle them
  }
}

/**
 * Create an http.Agent that validates DNS resolution against private IPs.
 * This prevents DNS rebinding attacks (TOCTOU between validateUrlSafety and actual fetch).
 */
export function createSafeHttpAgent(): http.Agent {
  return new http.Agent({
    lookup: (hostname: string, options: dns.LookupOptions, callback: (err: NodeJS.ErrnoException | null, address: string, family: number) => void) => {
      dns.resolve4(hostname, (err, addresses) => {
        if (err) {
          // Fall back to dns.lookup for non-A-record hostnames
          dns.lookup(hostname, { family: 4 }, (lookupErr, addr, fam) => {
            if (lookupErr) return callback(lookupErr, '', 4);
            if (isPrivateIp(addr)) {
              return callback(
                Object.assign(new Error(`DNS resolved to private IP: ${addr}`), { code: 'ECONNREFUSED' }),
                '', 4,
              );
            }
            callback(null, addr, fam);
          });
          return;
        }
        const addr = addresses[0];
        if (isPrivateIp(addr)) {
          return callback(
            Object.assign(new Error(`DNS resolved to private IP: ${addr}`), { code: 'ECONNREFUSED' }),
            '', 4,
          );
        }
        callback(null, addr, 4);
      });
    },
  } as any);
}

/**
 * Create an https.Agent that validates DNS resolution against private IPs.
 */
export function createSafeHttpsAgent(): https.Agent {
  return new https.Agent({
    lookup: (hostname: string, options: dns.LookupOptions, callback: (err: NodeJS.ErrnoException | null, address: string, family: number) => void) => {
      dns.resolve4(hostname, (err, addresses) => {
        if (err) {
          dns.lookup(hostname, { family: 4 }, (lookupErr, addr, fam) => {
            if (lookupErr) return callback(lookupErr, '', 4);
            if (isPrivateIp(addr)) {
              return callback(
                Object.assign(new Error(`DNS resolved to private IP: ${addr}`), { code: 'ECONNREFUSED' }),
                '', 4,
              );
            }
            callback(null, addr, fam);
          });
          return;
        }
        const addr = addresses[0];
        if (isPrivateIp(addr)) {
          return callback(
            Object.assign(new Error(`DNS resolved to private IP: ${addr}`), { code: 'ECONNREFUSED' }),
            '', 4,
          );
        }
        callback(null, addr, 4);
      });
    },
  } as any);
}
