/**
 * Stock Command Service
 *
 * Handles all stock mutations through event sourcing pattern
 * - Validates stock operations
 * - Records immutable events to ledger
 * - Updates materialized snapshots with optimistic locking
 * - Broadcasts real-time updates via SSE
 *
 * IMPORTANT: All stock writes MUST go through this service
 */

const { ObjectId } = require('mongodb');
const { getShopDatabase } = require('../config/database');
const { logger } = require('../config/logging');

// Movement type configurations
const MOVEMENT_DIRECTIONS = {
  SALE: 'OUT',
  PURCHASE: 'IN',
  RETURN_IN: 'IN',
  RETURN_OUT: 'OUT',
  ADJUSTMENT_ADD: 'IN',
  ADJUSTMENT_SUB: 'OUT',
  ADJUSTMENT_SET: 'IN', // Special case: handled separately
  OPENING_STOCK: 'IN',
  EXPIRY_WRITEOFF: 'OUT',
  DAMAGE_WRITEOFF: 'OUT',
  TRANSFER_OUT: 'OUT',
  TRANSFER_IN: 'IN'
};

class InsufficientStockError extends Error {
  constructor(message, available, requested) {
    super(message);
    this.name = 'InsufficientStockError';
    this.available = available;
    this.requested = requested;
  }
}

class ConcurrencyConflictError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConcurrencyConflictError';
  }
}

class StockCommandService {
  /**
   * Record a stock movement
   *
   * @param {Object} params
   * @param {string} params.shopId - Shop identifier
   * @param {ObjectId|string} params.productId - Product ID
   * @param {string} params.movementType - Type of movement (SALE, PURCHASE, etc.)
   * @param {number} params.quantity - Quantity (always positive)
   * @param {ObjectId|string} params.userId - User performing the action
   * @param {string} [params.referenceType] - Type of source document
   * @param {ObjectId|string} [params.referenceId] - Source document ID
   * @param {string} [params.batchNo] - Batch number
   * @param {string} [params.lotNo] - Lot number
   * @param {Date} [params.expiryDate] - Expiry date
   * @param {number} [params.costPrice] - Cost price at time of movement
   * @param {string} [params.note] - Optional note
   * @param {Array} [params.batchAllocations] - FEFO batch allocations
   * @param {Object} [params.metadata] - Additional metadata
   * @returns {Promise<Object>} Result with ledgerEntry and snapshot
   */
  async recordMovement({
    shopId,
    productId,
    movementType,
    quantity,
    userId,
    referenceType = null,
    referenceId = null,
    batchNo = null,
    lotNo = null,
    expiryDate = null,
    costPrice = null,
    note = '',
    batchAllocations = [],
    metadata = {}
  }) {
    // Validate required parameters
    if (!shopId || !productId || !movementType || !quantity) {
      throw new Error('Missing required parameters: shopId, productId, movementType, quantity');
    }

    if (quantity <= 0) {
      throw new Error('Quantity must be positive');
    }

    const shopDb = getShopDatabase(shopId);

    // Note: MongoDB transactions require replica set
    // For local dev without replica set, operations run without transaction
    // For production MongoDB Atlas, transactions work automatically

    let ledgerEntry, updatedSnapshot;

    try {
      // 1. Get current snapshot with optimistic lock check
      const snapshot = await shopDb.collection('stock_snapshots').findOne({
        productId: ObjectId.isValid(productId) ? new ObjectId(productId) : productId,
        shopId
      });

      if (!snapshot) {
        throw new Error(`No stock snapshot found for product ${productId}`);
      }

      // 2. Calculate new balance
      const direction = MOVEMENT_DIRECTIONS[movementType];
      if (!direction) {
        throw new Error(`Invalid movement type: ${movementType}`);
      }

      let newBalance;
      if (movementType === 'ADJUSTMENT_SET') {
        // Special case: set exact quantity
        newBalance = quantity;
      } else {
        newBalance = direction === 'IN'
          ? snapshot.onHandQty + quantity
          : snapshot.onHandQty - quantity;
      }

      // 3. Validate stock availability (prevent negative stock)
      if (newBalance < 0) {
        throw new InsufficientStockError(
          `Insufficient stock. Available: ${snapshot.onHandQty}, Requested: ${quantity}`,
          snapshot.onHandQty,
          quantity
        );
      }

      // 4. Prepare ledger entry
      const ledgerData = {
        productId: snapshot.productId,
        shopId,
        movementType,
        direction: movementType === 'ADJUSTMENT_SET' ? 'SET' : direction,
        quantity,
        runningBalance: newBalance,
        version: snapshot.lastLedgerVersion + 1,
        referenceType,
        referenceId: referenceId ? (ObjectId.isValid(referenceId) ? new ObjectId(referenceId) : referenceId) : null,
        batchNo,
        lotNo,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        costPrice,
        userId: userId ? (ObjectId.isValid(userId) ? new ObjectId(userId) : userId) : null,
        timestamp: new Date(),
        note,
        metadata
      };

      // 5. Insert ledger entry (immutable)
      const ledgerResult = await shopDb.collection('stock_ledger').insertOne(ledgerData);
      ledgerEntry = { _id: ledgerResult.insertedId, ...ledgerData };

      // 6. Update snapshot atomically with optimistic lock
      const snapshotUpdate = {
        $set: {
          onHandQty: newBalance,
          availableQty: newBalance - snapshot.reservedQty,
          lastLedgerEntryId: ledgerResult.insertedId,
          lastLedgerVersion: snapshot.lastLedgerVersion + 1,
          lastMovementAt: new Date(),
          lastMovementType: movementType,
          updatedAt: new Date()
        }
      };

      const snapshotResult = await shopDb.collection('stock_snapshots').findOneAndUpdate(
        {
          productId: snapshot.productId,
          shopId,
          lastLedgerVersion: snapshot.lastLedgerVersion // Optimistic lock
        },
        snapshotUpdate,
        { returnDocument: 'after' }
      );

      if (!snapshotResult) {
        // Concurrent modification detected
        throw new ConcurrencyConflictError(
          'Stock snapshot was modified by another transaction. Please retry.'
        );
      }

      updatedSnapshot = snapshotResult;

      // 7. Update batch quantities if FEFO allocations provided
      if (batchAllocations && batchAllocations.length > 0) {
        for (const alloc of batchAllocations) {
          const batchUpdate = direction === 'IN'
            ? { $inc: { quantity: alloc.quantity } }
            : { $inc: { quantity: -alloc.quantity } };

          await shopDb.collection('stock_batches').updateOne(
            { _id: new ObjectId(alloc.batchId), shopId },
            batchUpdate
          );
        }
      }

      // 8. Emit real-time event (fire-and-forget)
      this.emitStockUpdate(shopId, productId, updatedSnapshot);

      logger.info(`Stock movement recorded: ${movementType} ${quantity} for product ${productId}`, {
        shopId,
        movementType,
        quantity,
        newBalance,
        version: ledgerEntry.version
      });

      return {
        success: true,
        ledgerEntry,
        snapshot: updatedSnapshot
      };

    } catch (error) {
      logger.error('Stock movement failed:', error);
      throw error;
    }
  }

  /**
   * Allocate batches using FEFO (First Expiry First Out)
   *
   * @param {ObjectId|string} productId
   * @param {number} qtyNeeded
   * @param {string} shopId
   * @returns {Promise<Array>} Array of batch allocations
   */
  async allocateBatchesFEFO(productId, qtyNeeded, shopId) {
    const shopDb = getShopDatabase(shopId);

    const batches = await shopDb.collection('stock_batches')
      .find({
        productId: ObjectId.isValid(productId) ? new ObjectId(productId) : productId,
        shopId,
        status: 'ACTIVE',
        quantity: { $gt: 0 }
      })
      .sort({ expiryDate: 1 }) // Earliest expiry first
      .toArray();

    const allocations = [];
    let remaining = qtyNeeded;

    for (const batch of batches) {
      if (remaining <= 0) {break;}

      const take = Math.min(batch.quantity, remaining);
      allocations.push({
        batchId: batch._id,
        batchNo: batch.batchNo,
        expiryDate: batch.expiryDate,
        quantity: take,
        costPrice: batch.costPrice
      });

      remaining -= take;
    }

    if (remaining > 0) {
      throw new InsufficientStockError(
        `Insufficient stock across all batches. Needed: ${qtyNeeded}, Available: ${qtyNeeded - remaining}`,
        qtyNeeded - remaining,
        qtyNeeded
      );
    }

    return allocations;
  }

  /**
   * Emit stock update via SSE
   *
   * @param {string} shopId
   * @param {ObjectId|string} productId
   * @param {Object} snapshot
   */
  emitStockUpdate(shopId, productId, snapshot) {
    try {
      const sseManager = require('./sse-manager.service');
      sseManager.broadcastStockUpdate(shopId, productId, snapshot);

      logger.debug('Stock update event broadcast', {
        shopId,
        productId: productId.toString(),
        onHandQty: snapshot.onHandQty,
        availableQty: snapshot.availableQty
      });
    } catch (error) {
      // Non-critical - don't fail the stock operation if SSE fails
      logger.warn('Failed to emit stock update event:', error);
    }
  }

  /**
   * Get current stock snapshot for a product
   *
   * @param {ObjectId|string} productId
   * @param {string} shopId
   * @returns {Promise<Object>} Stock snapshot
   */
  async getSnapshot(productId, shopId) {
    const shopDb = getShopDatabase(shopId);
    return await shopDb.collection('stock_snapshots').findOne({
      productId: ObjectId.isValid(productId) ? new ObjectId(productId) : productId,
      shopId
    });
  }

  /**
   * Get movement history for a product
   *
   * @param {ObjectId|string} productId
   * @param {string} shopId
   * @param {Object} options - Query options (limit, startDate, endDate)
   * @returns {Promise<Array>} Movement history
   */
  async getMovementHistory(productId, shopId, options = {}) {
    const shopDb = getShopDatabase(shopId);
    const { limit = 50, startDate, endDate } = options;

    const query = {
      productId: ObjectId.isValid(productId) ? new ObjectId(productId) : productId,
      shopId
    };

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) {query.timestamp.$gte = new Date(startDate);}
      if (endDate) {query.timestamp.$lte = new Date(endDate);}
    }

    return await shopDb.collection('stock_ledger')
      .find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
  }
}

// Export singleton instance
module.exports = new StockCommandService();
module.exports.StockCommandService = StockCommandService;
module.exports.InsufficientStockError = InsufficientStockError;
module.exports.ConcurrencyConflictError = ConcurrencyConflictError;
