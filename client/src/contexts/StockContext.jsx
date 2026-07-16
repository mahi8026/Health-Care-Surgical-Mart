/**
 * Stock Context
 * 
 * Centralized stock state management with real-time SSE updates
 * Provides stock snapshots, batches, and alerts to all components
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import api from '../config/api';
import useStockEvents from '../hooks/useStockEvents';
import { useAuth } from './AuthContext';

const StockContext = createContext(null);

// eslint-disable-next-line react-refresh/only-export-components
export const useStock = () => {
  const context = useContext(StockContext);
  if (!context) {
    throw new Error('useStock must be used within StockProvider');
  }
  return context;
};

export const StockProvider = ({ children }) => {
  const { user } = useAuth(); // Get user from AuthContext
  
  // Stock snapshots (current stock levels)
  const [snapshots, setSnapshots] = useState([]);
  const [snapshotsLoading, setSnapshotsLoading] = useState(false);

  // Alerts
  const [lowStockAlerts, setLowStockAlerts] = useState([]);
  const [expiryAlerts, setExpiryAlerts] = useState([]);
  const [alertsLoading, setAlertsLoading] = useState(false);

  // Valuation
  const [valuation, setValuation] = useState(null);
  const [valuationLoading, setValuationLoading] = useState(false);

  // Real-time connection status
  const [realtimeConnected, setRealtimeConnected] = useState(false);

  /**
   * Fetch stock snapshots
   */
  const fetchSnapshots = useCallback(async (filters = {}) => {
    setSnapshotsLoading(true);
    try {
      const response = await api.get('/stock/snapshots', { params: filters });
      if (response.success) {
        setSnapshots(response.data || []);
        return response;
      }
    } catch (error) {
      console.error('Failed to fetch stock snapshots:', error);
      throw error;
    } finally {
      setSnapshotsLoading(false);
    }
  }, []);

  /**
   * Fetch single snapshot
   */
  const fetchSnapshot = useCallback(async (productId) => {
    try {
      const response = await api.get(`/stock/snapshots/${productId}`);
      if (response.success) {
        return response.data;
      }
    } catch (error) {
      console.error('Failed to fetch snapshot:', error);
      throw error;
    }
  }, []);

  /**
   * Fetch low stock alerts
   */
  const fetchLowStockAlerts = useCallback(async () => {
    setAlertsLoading(true);
    try {
      const response = await api.get('/stock/reorder-alerts');
      if (response.success) {
        setLowStockAlerts(response.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch low stock alerts:', error);
    } finally {
      setAlertsLoading(false);
    }
  }, []);

  /**
   * Fetch expiry alerts
   */
  const fetchExpiryAlerts = useCallback(async (days = 30) => {
    setAlertsLoading(true);
    try {
      const response = await api.get(`/stock/expiry-alerts?days=${days}`);
      if (response.success) {
        setExpiryAlerts(response.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch expiry alerts:', error);
    } finally {
      setAlertsLoading(false);
    }
  }, []);

  /**
   * Fetch stock valuation
   */
  const fetchValuation = useCallback(async () => {
    setValuationLoading(true);
    try {
      const response = await api.get('/stock/valuation');
      if (response.success) {
        setValuation(response.data);
        return response.data;
      }
    } catch (error) {
      console.error('Failed to fetch valuation:', error);
      throw error;
    } finally {
      setValuationLoading(false);
    }
  }, []);

  /**
   * Fetch product batches
   */
  const fetchProductBatches = useCallback(async (productId) => {
    try {
      const response = await api.get(`/stock/${productId}/batches`);
      if (response.success) {
        return response.data || [];
      }
    } catch (error) {
      console.error('Failed to fetch product batches:', error);
      throw error;
    }
  }, []);

  /**
   * Fetch movement history (ledger)
   */
  const fetchMovementHistory = useCallback(async (productId, filters = {}) => {
    try {
      const response = await api.get(`/stock/${productId}/ledger`, { params: filters });
      if (response.success) {
        return response;
      }
    } catch (error) {
      console.error('Failed to fetch movement history:', error);
      throw error;
    }
  }, []);

  /**
   * Handle real-time SSE updates
   */
  const handleStockEvent = useCallback((event) => {
    console.log('Stock event received:', event);

    switch (event.type) {
      case 'CONNECTED':
        setRealtimeConnected(true);
        break;

      case 'STOCK_UPDATE':
        // Update snapshot in local state
        setSnapshots((prev) =>
          prev.map((item) =>
            item.productId === event.productId
              ? {
                  ...item,
                  onHandQty: event.onHandQty,
                  availableQty: event.availableQty,
                  reservedQty: event.reservedQty,
                  lastMovementType: event.lastMovementType,
                  updatedAt: event.updatedAt,
                }
              : item
          )
        );
        break;

      case 'EXPIRY_ALERT':
        // Add to expiry alerts if not already present
        setExpiryAlerts((prev) => {
          const exists = prev.find((alert) => alert.batchId === event.batchId);
          if (exists) return prev;
          return [...prev, event];
        });
        break;

      case 'LOW_STOCK_ALERT':
        // Add to low stock alerts if not already present
        setLowStockAlerts((prev) => {
          const exists = prev.find((alert) => alert.productId === event.productId);
          if (exists) return prev;
          return [...prev, event];
        });
        break;

      case 'SERVER_SHUTDOWN':
        setRealtimeConnected(false);
        break;

      default:
        console.log('Unknown event type:', event.type);
    }
  }, []);

  // Setup SSE connection - ONLY when user is logged in
  const { connected, error: sseError } = useStockEvents(user ? handleStockEvent : null);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) setRealtimeConnected(connected);
    });
    return () => { cancelled = true; };
  }, [connected]);

  // Don't auto-fetch on mount to prevent rate limiting
  // Components should explicitly call fetch methods when needed
  // useEffect(() => {
  //   if (user) {
  //     fetchLowStockAlerts();
  //     fetchExpiryAlerts();
  //     fetchValuation();
  //   }
  // }, [user, fetchLowStockAlerts, fetchExpiryAlerts, fetchValuation]);

  const value = {
    // State
    snapshots,
    snapshotsLoading,
    lowStockAlerts,
    expiryAlerts,
    alertsLoading,
    valuation,
    valuationLoading,
    realtimeConnected,
    sseError,

    // Methods
    fetchSnapshots,
    fetchSnapshot,
    fetchLowStockAlerts,
    fetchExpiryAlerts,
    fetchValuation,
    fetchProductBatches,
    fetchMovementHistory,
  };

  return <StockContext.Provider value={value}>{children}</StockContext.Provider>;
};

export default StockContext;
