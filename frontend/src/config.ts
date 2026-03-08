/**
 * Dynamic Configuration
 *
 * This file provides dynamic configuration that adapts to the server's IP/hostname.
 *
 * HOW IT WORKS:
 * - For domain access (e.g., your-domain.com): Uses relative URLs via Vite proxy
 * - For IP access (e.g., 192.168.1.100:5173): Uses direct port 3002
 */

// Get the current hostname from the browser
const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';

// Port configuration
const BACKEND_PORT = import.meta.env.VITE_BACKEND_PORT || '3002';

// Backend public URL for external domain access (e.g., https://api.your-domain.com)
// When set, /uploads/* paths will be prefixed with this URL
const BACKEND_PUBLIC_URL = import.meta.env.VITE_BACKEND_PUBLIC_URL || '';

// Check if accessing via domain (not IP or localhost)
const isIPAddress = (host: string) => /^(\d{1,3}\.){3}\d{1,3}$/.test(host) || host === 'localhost';
// In production with nginx proxy, always use relative URLs
const useDirect = import.meta.env.PROD ? false : isIPAddress(hostname);

/**
 * Application configuration object
 * - Domain access: Uses relative URLs (goes through Vite proxy)
 * - IP access: Uses direct backend port
 */
export const config = {
  // Current hostname (e.g., "192.168.1.100" or "your-domain.com")
  hostname,

  // Backend port
  backendPort: BACKEND_PORT,

  // API base URL
  // Domain: relative URL (proxy) | IP: direct port
  apiUrl: useDirect ? `http://${hostname}:${BACKEND_PORT}/api` : '/api',

  // Full backend URL (for images, downloads, etc.)
  // Domain: use current origin | IP: direct port
  backendUrl: useDirect ? `http://${hostname}:${BACKEND_PORT}` : '',

  // Helper to construct backend URLs
  getBackendUrl: (path: string = '') => {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return useDirect ? `http://${hostname}:${BACKEND_PORT}${cleanPath}` : cleanPath;
  },

  // Helper to construct asset URLs (images, uploads)
  // Transforms /uploads/* paths to use VITE_BACKEND_PUBLIC_URL when configured
  getAssetUrl: (path: string) => {
    if (!path) return path;
    // Only transform /uploads/ paths when backend public URL is configured
    if (path.startsWith('/uploads/') && BACKEND_PUBLIC_URL) {
      // Remove trailing slash from URL if present
      const baseUrl = BACKEND_PUBLIC_URL.replace(/\/$/, '');
      return `${baseUrl}${path}`;
    }
    // For IP access, use direct backend URL
    if (path.startsWith('/uploads/') && useDirect) {
      return `http://${hostname}:${BACKEND_PORT}${path}`;
    }
    return path;
  },
};

// Log configuration in development for debugging
if (import.meta.env.DEV) {
  console.log('Dynamic Config:', {
    hostname: config.hostname,
    apiUrl: config.apiUrl,
    backendUrl: config.backendUrl,
    backendPublicUrl: BACKEND_PUBLIC_URL || '(not set)',
  });
}

export default config;
