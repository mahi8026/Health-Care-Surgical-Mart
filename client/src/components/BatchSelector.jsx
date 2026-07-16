/**
 * Batch Selector Component
 * 
 * Allows users to select specific batches when making a sale
 * Displays FEFO-sorted batches with expiry dates and quantities
 * 
 * Phase 3: FEFO Batch Tracking
 */

import React, { useState, useEffect, useCallback } from 'react';
import api from '../config/api';
import LoadingSpinner from './LoadingSpinner';

const BatchSelector = ({ productId, requiredQty, onBatchesSelected, onClose }) => {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedBatches, setSelectedBatches] = useState([]);

  const autoSelectFEFO = useCallback(() => {
    const selections = [];
    let remaining = requiredQty;

    for (const batch of batches) {
      if (remaining <= 0) break;
      
      const take = Math.min(batch.quantity, remaining);
      if (take > 0) {
        selections.push({
          batchId: batch._id,
          batchNo: batch.batchNo,
          expiryDate: batch.expiryDate,
          quantity: take,
          availableQty: batch.quantity,
          costPrice: batch.costPrice,
        });
        remaining -= take;
      }
    }

    setSelectedBatches(selections);
  }, [batches, requiredQty]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError('');
        const response = await api.get(`/stock/${productId}/batches`);
        if (!cancelled && response.success) {
          setBatches(response.data || []);
        } else if (!cancelled) {
          setError(response.message || 'Failed to load batches');
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load batches');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [productId]);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled && batches.length > 0 && requiredQty > 0) {
        autoSelectFEFO();
      }
    });
    return () => { cancelled = true; };
  }, [batches, requiredQty, autoSelectFEFO]);

  const handleQuantityChange = (batchId, newQty) => {
    const batch = batches.find(b => b._id === batchId);
    if (!batch) return;

    const qty = Math.max(0, Math.min(parseInt(newQty) || 0, batch.quantity));

    setSelectedBatches(prev => {
      const existing = prev.find(s => s.batchId === batchId);
      
      if (qty === 0) {
        // Remove if quantity is 0
        return prev.filter(s => s.batchId !== batchId);
      }
      
      if (existing) {
        // Update existing
        return prev.map(s =>
          s.batchId === batchId ? { ...s, quantity: qty } : s
        );
      } else {
        // Add new
        return [
          ...prev,
          {
            batchId: batch._id,
            batchNo: batch.batchNo,
            expiryDate: batch.expiryDate,
            quantity: qty,
            availableQty: batch.quantity,
            costPrice: batch.costPrice,
          },
        ];
      }
    });
  };

  const getTotalSelected = () => {
    return selectedBatches.reduce((sum, s) => sum + s.quantity, 0);
  };

  const handleConfirm = () => {
    const totalSelected = getTotalSelected();
    
    if (totalSelected === 0) {
      setError('Please select at least one batch');
      return;
    }

    if (totalSelected !== requiredQty) {
      setError(`Selected quantity (${totalSelected}) must equal required quantity (${requiredQty})`);
      return;
    }

    onBatchesSelected(selectedBatches);
    onClose();
  };

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

  const getExpiryBadgeClass = (expiryDate) => {
    const days = getDaysToExpiry(expiryDate);
    if (days === null) return 'bg-gray-100 text-gray-600';
    if (days < 0) return 'bg-red-600 text-white';
    if (days <= 30) return 'bg-orange-100 text-orange-700';
    if (days <= 60) return 'bg-yellow-100 text-yellow-700';
    return 'bg-green-100 text-green-700';
  };

  const getExpiryLabel = (expiryDate) => {
    const days = getDaysToExpiry(expiryDate);
    if (days === null) return 'No expiry';
    if (days < 0) return `Expired ${Math.abs(days)}d ago`;
    return `${days}d left`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <LoadingSpinner />
      </div>
    );
  }

  if (error && batches.length === 0) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
        <i className="fas fa-exclamation-circle mr-2"></i>
        {error}
      </div>
    );
  }

  if (batches.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <i className="fas fa-inbox text-4xl mb-2"></i>
        <p>No batches available for this product</p>
      </div>
    );
  }

  const totalSelected = getTotalSelected();
  const isValid = totalSelected === requiredQty;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Select Batches (FEFO)</h3>
          <p className="text-sm text-gray-600 mt-1">
            Required: <span className="font-semibold">{requiredQty}</span> units
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-600">Selected:</p>
          <p className={`text-2xl font-bold ${
            isValid ? 'text-green-600' : totalSelected > requiredQty ? 'text-red-600' : 'text-orange-600'
          }`}>
            {totalSelected}
          </p>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          <i className="fas fa-exclamation-circle mr-2"></i>
          {error}
        </div>
      )}

      {/* Batches Table */}
      <div className="overflow-x-auto max-h-96 border rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Batch No
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Expiry Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Available
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Take Qty
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {batches.map((batch) => {
              const selected = selectedBatches.find(s => s.batchId === batch._id);
              const isSelected = !!selected;
              const selectedQty = selected?.quantity || 0;

              return (
                <tr
                  key={batch._id}
                  className={`${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'} transition-colors`}
                >
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {batch.batchNo}
                    {batch.lotNo && (
                      <span className="text-xs text-gray-500 ml-1">({batch.lotNo})</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {formatDate(batch.expiryDate)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      getExpiryBadgeClass(batch.expiryDate)
                    }`}>
                      {getExpiryLabel(batch.expiryDate)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                    {batch.quantity}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <input
                      type="number"
                      min="0"
                      max={batch.quantity}
                      value={selectedQty}
                      onChange={(e) => handleQuantityChange(batch._id, e.target.value)}
                      className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-right"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-gray-600">Required</p>
            <p className="text-xl font-bold text-gray-900">{requiredQty}</p>
          </div>
          <div>
            <p className="text-xs text-gray-600">Selected</p>
            <p className={`text-xl font-bold ${
              isValid ? 'text-green-600' : 'text-orange-600'
            }`}>
              {totalSelected}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600">Remaining</p>
            <p className={`text-xl font-bold ${
              isValid ? 'text-green-600' : 'text-orange-600'
            }`}>
              {requiredQty - totalSelected}
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <button
          type="button"
          onClick={onClose}
          className="btn-secondary"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={autoSelectFEFO}
          className="btn-secondary"
        >
          <i className="fas fa-magic mr-2"></i>
          Auto-Select FEFO
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!isValid}
          className={`btn-primary ${!isValid ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <i className="fas fa-check mr-2"></i>
          Confirm Selection
        </button>
      </div>
    </div>
  );
};

export default BatchSelector;
