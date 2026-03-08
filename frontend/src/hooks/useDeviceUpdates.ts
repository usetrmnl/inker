import { useEffect, useRef, useCallback, useState } from 'react';

/**
 * Event types that can trigger device refresh
 */
export type DeviceEventType =
  | 'screen:updated'
  | 'screen:deleted'
  | 'playlist:updated'
  | 'playlist:deleted'
  | 'screen_design:updated'
  | 'screen_design:deleted'
  | 'device:refresh'
  | 'heartbeat';

export interface DeviceEvent {
  type: DeviceEventType;
  payload?: {
    id?: number;
    deviceIds?: number[];
    playlistId?: number;
    screenId?: number;
    screenDesignId?: number;
    timestamp: number;
  };
  timestamp?: number;
}

interface UseDeviceUpdatesOptions {
  /** Callback when an update event is received */
  onUpdate?: (event: DeviceEvent) => void;
  /** Whether to automatically reconnect on disconnect (default: true) */
  autoReconnect?: boolean;
  /** Reconnection delay in ms (default: 3000) */
  reconnectDelay?: number;
  /** Whether to connect (default: true) */
  enabled?: boolean;
}

interface UseDeviceUpdatesResult {
  /** Whether currently connected to the event stream */
  isConnected: boolean;
  /** Last received event */
  lastEvent: DeviceEvent | null;
  /** Manually reconnect to the stream */
  reconnect: () => void;
  /** Disconnect from the stream */
  disconnect: () => void;
}

const API_URL = import.meta.env.VITE_API_URL || '/api';
const SESSION_KEY = 'inker_session';

/**
 * Custom hook for subscribing to real-time device update notifications via SSE
 *
 * Usage:
 * ```tsx
 * const { isConnected, lastEvent } = useDeviceUpdates({
 *   onUpdate: (event) => {
 *     if (event.type === 'playlist:updated') {
 *       refetchData();
 *     }
 *   }
 * });
 * ```
 */
export function useDeviceUpdates(
  options: UseDeviceUpdatesOptions = {}
): UseDeviceUpdatesResult {
  const {
    onUpdate,
    autoReconnect = true,
    reconnectDelay = 3000,
    enabled = true,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<DeviceEvent | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Store connect function in a ref to allow recursive calls without dependency issues
  const connectRef = useRef<() => void>(() => {});

  // Store latest callback in ref to avoid re-connecting on callback change
  const onUpdateRef = useRef(onUpdate);
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  const connect = useCallback(() => {
    // Clean up existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const token = localStorage.getItem(SESSION_KEY);
    if (!token) {
      return;
    }

    // SSE endpoint with auth token as query param (SSE doesn't support custom headers)
    const sseUrl = `${API_URL}/events/stream?token=${encodeURIComponent(token)}`;

    const eventSource = new EventSource(sseUrl);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const data: DeviceEvent = JSON.parse(event.data);

        // Skip heartbeat events for lastEvent state
        if (data.type !== 'heartbeat') {
          setLastEvent(data);
        }

        // Call the callback if provided
        if (onUpdateRef.current) {
          onUpdateRef.current(data);
        }
      } catch (error) {
        console.error('[useDeviceUpdates] Failed to parse event:', error);
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);

      eventSource.close();
      eventSourceRef.current = null;

      // Auto-reconnect using ref to avoid accessing variable before declaration
      if (autoReconnect) {
        reconnectTimeoutRef.current = setTimeout(() => {
          connectRef.current();
        }, reconnectDelay);
      }
    };
  }, [autoReconnect, reconnectDelay]);

  // Keep the ref updated with the latest connect function
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setIsConnected(false);
  }, []);

  // Connect/disconnect based on enabled flag
  // These setState calls are necessary for SSE connection management
  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Connection state management
      disconnect();
    }

    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  return {
    isConnected,
    lastEvent,
    reconnect: connect,
    disconnect,
  };
}

export default useDeviceUpdates;
