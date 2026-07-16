/**
 * Expiry Alerts Widget
 * 
 * Dashboard widget showing batches expiring soon
 * Phase 3: FEFO Batch Tracking
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../config/api';
import LoadingSpinner from './LoadingSpinner';

const ExpiryAlertsWidget = ({ daysThreshold = 30 }) => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const response = await api.get(`/stock/expiry-alerts?days=${daysThreshold}`);
        if (!cancelled && response.success) {
          setAlerts(response.data || []);
          setError('');
        } else if (!cancelled) {
          setError(response.message || 'Failed to load expiry alerts');
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load expiry alerts');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    const interval = setInterval(async () => {
      try {
        const response = await api.get(`/stock/expiry-alerts?days=${daysThreshold}`);
        if (!cancelled && response.success) {
          setAlerts(response.data || []);
          setError('');
        } else if (!cancelled) {
          setError(response.message || 'Failed to load expiry alerts');
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load expiry alerts');
      }
    }, 5 * 60 * 1000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [daysThreshold]);

  const formatDate = (date) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    });
  };

  const getDaysToExpiry = (expiryDate) => {
    if (!expiryDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDate);
    expiry.setHours(0, 0, 0, 0);
    return Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
  };

  const getAlertClass = (days) => {
    if (days === null) return 'bg-gray-100 border-gray-300';
    if (days < 0) return 'bg-red-100 border-red-300';
    if (days <= 7) return 'bg-red-50 border-red-200';
    if (days <= 14) return 'bg-orange-50 border-orange-200';
    return 'bg-yellow-50 border-yellow-200';
  };

  const getAlertIcon = (days) => {
    if (days === null) return 'fa-info-circle text-gray-500';
    if (days < 0) return 'fa-exclamation-circle text-red-600';
    if (days <= 7) return 'fa-exclamation-triangle text-red-500';
    if (days <= 14) return 'fa-exclamation-triangle text-orange-500';
    return 'fa-clock text-yellow-600';
  };

  if (loading) {
    return (
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            <i className="fas fa-calendar-times mr-2 text-red-500"></i>
            Expiry Alerts
          </h3>
        </div>
        <div className="flex justify-center items-center py-8">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          <i className="fas fa-calendar-times mr-2 text-red-500"></i>
          Expiry Alerts
        </h3>
        {alerts.length > 0 && (
          <span className="bg-red-100 text-red-700 text-xs font-medium px-2.5 py-1 rounded-full">
            {alerts.length} item{alerts.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm mb-4">
          <i className="fas fa-exclamation-circle mr-2"></i>
          {error}
        </div>
      )}

      {alerts.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <i className="fas fa-check-circle text-4xl text-green-500 mb-2"></i>
          <p className="text-sm">No batches expiring within {daysThreshold} days</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {alerts.map((alert) => {
            const days = getDaysToExpiry(alert.expiryDate);
            const daysLabel = days === null
              ? 'No expiry'
              : days < 0
              ? `Expired ${Math.abs(days)}d ago`
              : days === 0
              ? 'Expires today!'
              : `${days}d left`;

            return (
              <div
                key={alert._id}
                className={`border rounded-lg p-3 ${getAlertClass(days)} hover:shadow-md transition-shadow`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <i className={`fas ${getAlertIcon(days)}`}></i>
                      <h4 className="text-sm font-semibold text-gray-900 truncate">
                        {alert.product?.name || 'Unknown Product'}
                      </h4>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                      <div>
                        <span className="font-medium">SKU:</span>{' '}
                        {alert.product?.sku || '—'}
                      </div>
                      <div>
                        <span className="font-medium">Batch:</span>{' '}
                        {alert.batchNo}
                      </div>
                      <div>
                        <span className="font-medium">Qty:</span>{' '}
                        <span className="font-semibold text-gray-900">{alert.quantity}</span>
                      </div>
                      <div>
                        <span className="font-medium">Expiry:</span>{' '}
                        {formatDate(alert.expiryDate)}
                      </div>
                    </div>
                  </div>
                  <div className="ml-3 flex-shrink-0">
                    <span className={`inline-flex px-2 py-1 text-xs font-bold rounded-full ${
                      days < 0
                        ? 'bg-red-600 text-white'
                        : days <= 7
                        ? 'bg-red-500 text-white'
                        : days <= 14
                        ? 'bg-orange-500 text-white'
                        : 'bg-yellow-500 text-white'
                    }`}>
                      {daysLabel}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {alerts.length > 0 && (
        <div className="mt-4 pt-4 border-t">
          <Link
            to="/stock-report?status=expiring_30d"
            className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center justify-center gap-2"
          >
            View All Expiring Items
            <i className="fas fa-arrow-right"></i>
          </Link>
        </div>
      )}
    </div>
  );
};

export default ExpiryAlertsWidget;
