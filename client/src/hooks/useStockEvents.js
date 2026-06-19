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

const useStockEvents = (onEvent) => {
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [error, setError] = useState(null);
  const eventSourceRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);

  useEffect(() => {
    // Don't connect if no callback provided (user not logged in)
    if (!onEvent) {
      setConnected(false);
      setError(null);
      return;
    }

    // Get auth token from localStorage
    const token = localStorage.getItem('token');
    if (!token) {
      console.warn('[SSE] No token found, skipping connection');
      setError('Authentication required');
      setConnected(false);
      return;
    }

    const connect = () => {
      try {
        // Close existing connection if any
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
        }

        // Create EventSource connection
        // Note: EventSource doesn't support custom headers, so we pass token as query param
        const url = `${API_BASE_URL}/stock/events?token=${token}`;
        const eventSource = new EventSource(url);

        eventSource.onopen = () => {
          console.log('SSE connected to stock updates');
          setConnected(true);
          setError(null);
          reconnectAttemptsRef.current = 0; // Reset reconnect counter
        };

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            setLastUpdate(data);

            // Call the provided callback
            if (onEvent && typeof onEvent === 'function') {
              onEvent(data);
            }
          } catch (err) {
            console.error('Failed to parse SSE event:', err);
          }
        };

        eventSource.onerror = (err) => {
          console.error('SSE connection error:', err);
          setConnected(false);
          setError('Connection lost');
          eventSource.close();

          // Exponential backoff for reconnection
          reconnectAttemptsRef.current += 1;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          
          console.log(`Reconnecting in ${delay}ms... (attempt ${reconnectAttemptsRef.current})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        };

        eventSourceRef.current = eventSource;
      } catch (err) {
        console.error('Failed to create SSE connection:', err);
        setError(err.message);
      }
    };

    // Initial connection
    connect();

    // Cleanup on unmount
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
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
