/**
 * useStockEvents Hook
 * 
 * Real-time stock updates via Server-Sent Events (SSE)
 * Automatically reconnects on disconnect
 * 
 * Usage:
 * ```javascript
 * const { connected, lastUpdate } = useStockEvents((event) => {
 *   console.log('Stock update:', event);
 *   // Update local state based on event type
 * });
 * ```
 */

import { useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from '../config/constants';
import api from '../config/api';

/**
 * Fetch a short-lived SSE token so the full session JWT is never placed in
 * a URL (URLs leak into proxy/access logs).
 */
const getSSEToken = async () => {
  const response = await api.post('/auth/sse-token', {});
  return response?.data?.token;
};

const useStockEvents = (onEvent) => {
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [error, setError] = useState(null);
  const eventSourceRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    // Don't connect if no callback provided (user not logged in)
    if (!onEvent) {
      Promise.resolve().then(() => {
        if (!cancelled) {
          setConnected(false);
          setError(null);
        }
      });
      return () => { cancelled = true; };
    }

    // Get auth token from localStorage
    const token = localStorage.getItem('token');
    if (!token) {
      console.warn('[SSE] No token found, skipping connection');
      Promise.resolve().then(() => {
        if (!cancelled) {
          setError('Authentication required');
          setConnected(false);
        }
      });
      return;
    }

    const connect = async () => {
      try {
        // Close existing connection if any
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
        }

        // Fetch a short-lived SSE-scoped token (2 min) so the full session
        // JWT is never placed in a URL (Note: EventSource doesn't support
        // custom headers, so we pass the token as a query param)
        const sseToken = await getSSEToken();
        if (cancelled || !sseToken) {
          return;
        }

        const url = `${API_BASE_URL}/stock/events?token=${sseToken}`;
        const eventSource = new EventSource(url);

        eventSource.onopen = () => {
          console.log('[SSE] Connected to stock updates');
          setConnected(true);
          setError(null);
          reconnectAttemptsRef.current = 0; // Reset reconnect counter
        };

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('[SSE] Event received:', data.type);
            setLastUpdate(data);

            // Call the provided callback
            if (onEvent && typeof onEvent === 'function') {
              onEvent(data);
            }
          } catch (err) {
            console.error('[SSE] Failed to parse event:', err);
          }
        };

        eventSource.onerror = (err) => {
          console.error('[SSE] Connection error:', err);
          setConnected(false);
          setError('Connection lost');
          eventSource.close();

          // Exponential backoff for reconnection
          reconnectAttemptsRef.current += 1;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          
          console.log(`[SSE] Reconnecting in ${delay}ms... (attempt ${reconnectAttemptsRef.current})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        };

        eventSourceRef.current = eventSource;
      } catch (err) {
        console.error('[SSE] Failed to create connection:', err);
        if (cancelled) {
          return;
        }
        setError(err.message);
        // Retry with backoff
        reconnectAttemptsRef.current += 1;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      }
    };

    // Delay initial connection to avoid rate limiting on page load (wait 3 seconds)
    const connectTimeoutId = setTimeout(() => {
      connect();
    }, 3000);

    // Cleanup on unmount
    return () => {
      cancelled = true;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (connectTimeoutId) {
        clearTimeout(connectTimeoutId);
      }
    };
  }, [onEvent]);

  return {
    connected,
    lastUpdate,
    error,
  };
};

export default useStockEvents;
