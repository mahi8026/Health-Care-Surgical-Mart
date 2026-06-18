/**
 * Smart Polling Hook
 * Polls an API endpoint at regular intervals with optimizations:
 * - Stops polling when tab is hidden (saves API calls)
 * - Immediate fetch on mount and tab visibility change
 * - Configurable interval
 * - Error handling with retry logic
 * - Loading states
 */

import { useEffect, useRef, useState } from 'react';

/**
 * usePolling hook
 * @param {Function} fetchFn - Async function that fetches data
 * @param {number} interval - Polling interval in milliseconds (default: 30000 = 30s)
 * @param {Array} deps - Dependency array (like useEffect)
 * @returns {Object} { data, loading, error, refetch }
 */
export function usePolling(fetchFn, interval = 30000, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);
  const retryCountRef = useRef(0);
  const maxRetries = 3;

  const poll = async () => {
    try {
      const result = await fetchFn();
      setData(result);
      setError(null);
      retryCountRef.current = 0; // Reset retry count on success
    } catch (err) {
      console.error('Polling error:', err);
      setError(err.message);
      
      // Exponential backoff for retries
      if (retryCountRef.current < maxRetries) {
        retryCountRef.current++;
        const backoffDelay = Math.min(1000 * Math.pow(2, retryCountRef.current), 10000);
        setTimeout(poll, backoffDelay);
      }
    } finally {
      setLoading(false);
    }
  };

  const startPolling = () => {
    stopPolling();
    poll(); // Initial fetch
    intervalRef.current = setInterval(poll, interval);
  };

  const stopPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => {
    // Start polling when component mounts
    startPolling();

    // Stop polling when tab is hidden (saves API calls and battery)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        // Tab became visible — immediately fetch and resume polling
        startPolling();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup
    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  // Manual refetch function
  const refetch = () => {
    setLoading(true);
    poll();
  };

  return { data, loading, error, refetch };
}

/**
 * useConditionalPolling hook
 * Polls only when a condition is met (e.g., user is on a specific page)
 */
export function useConditionalPolling(fetchFn, condition, interval = 30000, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!condition) {
      // Stop polling if condition is false
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const poll = async () => {
      try {
        setLoading(true);
        const result = await fetchFn();
        setData(result);
        setError(null);
      } catch (err) {
        console.error('Conditional polling error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    poll(); // Initial fetch
    intervalRef.current = setInterval(poll, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [condition, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, loading, error };
}

export default usePolling;
