import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { config } from '../config';

const SESSION_KEY = 'inker_session';

/**
 * Custom hook for monitoring server health and status
 */

interface ServerStatus {
  isOnline: boolean;
  apiUrl: string;
  localIp: string;
  port: string;
  lastChecked: Date | null;
  error: string | null;
}

interface UseServerStatusResult {
  status: ServerStatus;
  isChecking: boolean;
  checkStatus: () => Promise<void>;
}

export function useServerStatus(): UseServerStatusResult {
  // Use dynamic config - gets IP from window.location.hostname
  const [status, setStatus] = useState<ServerStatus>({
    isOnline: false,
    apiUrl: config.apiUrl,
    localIp: config.hostname, // Dynamic: gets actual server IP from browser URL
    port: config.backendPort, // Backend port (3002)
    lastChecked: null,
    error: null,
  });
  const [isChecking, setIsChecking] = useState<boolean>(false);

  /**
   * Check if the backend API is responding
   * Per synchronizing-with-effects.md, we use async functions in effects
   * to synchronize with external systems (the backend API)
   */
  const checkStatus = useCallback(async () => {
    setIsChecking(true);

    try {
      // Try to ping the health endpoint or dashboard stats
      const response = await axios.get('/api/dashboard/stats', {
        timeout: 5000, // 5 second timeout
        headers: {
          Authorization: `Bearer ${localStorage.getItem(SESSION_KEY)}`,
        },
      });

      setStatus((prev) => ({
        ...prev,
        isOnline: response.status === 200,
        lastChecked: new Date(),
        error: null,
      }));
    } catch (error) {
      let errorMessage = 'Server is offline or unreachable';

      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          errorMessage = 'Connection timeout';
        } else if (error.code === 'ERR_NETWORK') {
          errorMessage = 'Network error - check if backend is running';
        } else if (error.response?.status === 401) {
          // 401 means server is online, just not authenticated for this specific endpoint
          // But we know the server is responding
          setStatus((prev) => ({
            ...prev,
            isOnline: true,
            lastChecked: new Date(),
            error: 'Authenticated endpoint (server is online)',
          }));
          setIsChecking(false);
          return;
        }
      }

      setStatus((prev) => ({
        ...prev,
        isOnline: false,
        lastChecked: new Date(),
        error: errorMessage,
      }));
    } finally {
      setIsChecking(false);
    }
  }, []);

  /**
   * Check server status on mount and set up periodic checks
   * Per synchronizing-with-effects.md, effects run after render
   * to synchronize with external systems
   */
  useEffect(() => {
    // Initial check
    checkStatus();

    // Set up periodic checks every 30 seconds
    const interval = setInterval(() => {
      checkStatus();
    }, 30000);

    // Cleanup function to clear interval
    // Per synchronizing-with-effects.md, return cleanup function
    return () => {
      clearInterval(interval);
    };
  }, [checkStatus]);

  return {
    status,
    isChecking,
    checkStatus,
  };
}
