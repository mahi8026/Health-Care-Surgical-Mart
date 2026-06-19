/**
 * Stock Adjustment Modal
 * 
 * Allows manual stock corrections with audit trail
 * - Add stock (found extra inventory)
 * - Subtract stock (damage, theft, loss)
 * - Set exact quantity (physical count correction)
 */

import React, { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import api from '../config/api';

const StockAdjustmentModal = ({ isOpen, onClose, product, onSuccess }) => {
  const [adjustmentType, setAdjustmentType] = useState('ADD');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const reasons = [
    'Physical count correction',
    'Damaged goods writeoff',
    'Theft/Loss',
    'Found extra inventory',
    'Supplier return',
    'System migration',
    'Expiry writeoff',
    'Other'
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await api.post('/stock/adjust', {
        productId: product._id || product.productId,
        adjustmentType,
        quantity: parseFloat(quantity),
        reason,
        notes
      });

      if (response.success) {
        // Success callback
        onSuccess?.(response.data);
        
        // Reset form
        setQuantity('');
        setReason('');
        setNotes('');
        
        // Close modal
        onClose();
      } else {
        setError(response.message || 'Adjustment failed');
      }
    } catch (err) {
      console.error('Adjustment error:', err);
      setError(err.response?.data?.message || err.message || 'Failed to adjust stock');
    } finally {
      setLoading(false);
    }
  };

  const calculateNewQuantity = () => {
    const currentQty = product?.onHandQty || product?.currentQty || 0;
    const qty = parseFloat(quantity) || 0;
    
    switch (adjustmentType) {
      case 'ADD':
        return currentQty + qty;
      case 'SUBTRACT':
        return Math.max(0, currentQty - qty);
      case 'SET':
        return qty;
      default:
        return currentQty;
    }
  };

  const getChangeAmount = () => {
    const currentQty = product?.onHandQty || product?.currentQty || 0;
    const newQty = calculateNewQuantity();
    return newQty - currentQty;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Adjust Stock</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Product Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm font-medium text-blue-900">Product</p>
            <p className="text-lg font-semibold text-blue-900">
              {product?.productName || product?.name}
            </p>
            <p className="text-sm text-blue-700">
              SKU: {product?.sku || 'N/A'}
            </p>
            <p className="text-sm text-blue-700">
              Current Stock: <span className="font-semibold">{product?.onHandQty || product?.currentQty || 0}</span> {product?.unit || 'units'}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Adjustment Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Adjustment Type *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'ADD', label: 'Add (+)', color: 'green' },
                { value: 'SUBTRACT', label: 'Subtract (-)', color: 'red' },
                { value: 'SET', label: 'Set (=)', color: 'blue' }
              ].map(type => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setAdjustmentType(type.value)}
                  className={`px-3 py-2 rounded-lg border-2 transition font-medium ${
                    adjustmentType === type.value
                      ? `border-${type.color}-500 bg-${type.color}-50 text-${type.color}-700`
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {adjustmentType === 'SET' ? 'New Quantity *' : `Quantity to ${adjustmentType.toLowerCase()} *`}
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter quantity"
              required
            />
            {quantity && (
              <div className="mt-2 p-2 bg-gray-50 rounded border border-gray-200">
                <p className="text-sm text-gray-600">
                  New quantity: <span className="font-semibold text-gray-900">
                    {calculateNewQuantity()}
                  </span>
                </p>
                <p className={`text-sm font-medium ${
                  getChangeAmount() >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  Change: {getChangeAmount() >= 0 ? '+' : ''}{getChangeAmount()}
                </p>
              </div>
            )}
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason *
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            >
              <option value="">Select reason</option>
              {reasons.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows="3"
              placeholder="Additional details about this adjustment..."
            />
          </div>

          {/* Footer */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading || !quantity || !reason}
            >
              {loading ? 'Adjusting...' : 'Adjust Stock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StockAdjustmentModal;
