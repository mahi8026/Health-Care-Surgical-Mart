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
   * @param {Object} [params.session] - MongoDB client session (transactional writes)
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
    metadata = {},
    session = null
  }) {
    // Validate required parameters
    if (!shopId || !productId || !movementType || quantity === undefined || quantity === null) {
      throw new Error('Missing required parameters: shopId, productId, movementType, quantity');
    }

    // Reject NaN/Infinity — NaN passes `quantity <= 0` checks and would
    // silently corrupt the snapshot balance (NaN spreads through every $inc).
    if (typeof quantity !== 'number' || !Number.isFinite(quantity)) {
      throw new Error('Quantity must be a finite number');
    }

    // For SET type, allow quantity of 0 (setting stock to zero is valid)
    // For ADD/SUBTRACT, quantity must be positive
    if (movementType === 'ADJUSTMENT_SET') {
      if (quantity < 0) {
        throw new Error('Quantity cannot be negative for SET adjustment');
      }
    } else {
      if (quantity <= 0) {
        throw new Error('Quantity must be positive');
      }
    }

    const shopDb = getShopDatabase(shopId);

    // Note: MongoDB transactions require replica set
    // For local dev without replica set, operations run without transaction
    // For production MongoDB Atlas, transactions work automatically

    let ledgerEntry, updatedSnapshot;

    try {
      // 1. Get current snapshot with optimistic lock check
      let snapshot = await shopDb.collection('stock_snapshots').findOne({
        productId: ObjectId.isValid(productId) ? new ObjectId(productId) : productId,
      }, { session });

      // AUTO-FIX: If no snapshot exists, create one initialized to zero
      if (!snapshot) {
        logger.warn(`No stock snapshot found for product ${productId}, initializing to zero`);

        const productObjId = ObjectId.isValid(productId) ? new ObjectId(productId) : productId;
        snapshot = {
          productId: productObjId,
          onHandQty: 0,
          availableQty: 0,
          reservedQty: 0,
          lastLedgerEntryId: null,
          lastLedgerVersion: 0,
          lastMovementAt: new Date(),
          lastMovementType: 'OPENING_STOCK',
          createdAt: new Date(),
          updatedAt: new Date()
        };

        try {
          await shopDb.collection('stock_snapshots').insertOne(snapshot, { session });
          logger.info(`Created missing stock snapshot for product ${productId}`);
        } catch (snapshotError) {
          // Concurrent creation (unique index on productId): re-read the
          // winner's snapshot and continue with it
          if (snapshotError.code === 11000) {
            snapshot = await shopDb.collection('stock_snapshots').findOne(
              { productId: productObjId },
              { session },
            );
            if (!snapshot) {
              throw snapshotError;
            }
            logger.info(`Reused concurrently-created stock snapshot for product ${productId}`);
          } else {
            throw snapshotError;
          }
        }
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
        movementType,
        direction: movementType === 'ADJUSTMENT_SET' ? 'SET' : direction,
        quantity,
        runningBalance: newBalance,
        version: (snapshot.lastLedgerVersion || 0) + 1,
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

      // 5. Update snapshot atomically with optimistic lock FIRST so a
      //    concurrency-conflict loser never leaves a phantom ledger row.
      //    (Previously the ledger was inserted first, so the loser of the
      //    optimistic-lock race committed an orphan ledger entry.)
      // Step 5: Update the snapshot atomically with an optimistic lock.
      // (Previously the ledger was inserted first, so the loser of the
      // optimistic-lock race committed an orphan ledger entry.)
      const snapshotResult = await shopDb.collection('stock_snapshots').findOneAndUpdate(
        {
          productId: snapshot.productId,
          lastLedgerVersion: snapshot.lastLedgerVersion // Optimistic lock
        },
        { $set: { onHandQty: newBalance, availableQty: newBalance - snapshot.reservedQty, lastLedgerVersion: snapshot.lastLedgerVersion + 1, lastMovementAt: new Date(), lastMovementType: movementType, updatedAt: new Date() } },
        { returnDocument: 'after', session }
      );

      if (!snapshotResult) {
        // Concurrent modification detected — nothing was persisted
        throw new ConcurrencyConflictError(
          'Stock snapshot was modified by another transaction. Please retry.'
        );
      }

      // 6. Insert ledger entry (immutable), then link the snapshot to it
      const ledgerResult = await shopDb.collection('stock_ledger').insertOne(
        { ...ledgerData, snapshotId: snapshotResult._id },
        { session },
      );
      ledgerEntry = { _id: ledgerResult.insertedId, ...ledgerData };

      await shopDb.collection('stock_snapshots').updateOne(
        { _id: snapshotResult._id },
        { $set: { lastLedgerEntryId: ledgerResult.insertedId, updatedAt: new Date() } },
        { session },
      );
      updatedSnapshot = { ...snapshotResult, lastLedgerEntryId: ledgerResult.insertedId };

      // 7. Update batch quantities if FEFO allocations provided
      if (batchAllocations && batchAllocations.length > 0) {
        for (const alloc of batchAllocations) {
          if (!alloc.batchId) {
            // Un-batched stock: nothing to update at batch level (recorded in
            // the ledger + snapshot only).
            continue;
          }

          const filter = direction === 'OUT'
            ? { _id: new ObjectId(alloc.batchId), quantity: { $gte: alloc.quantity } }
            : { _id: new ObjectId(alloc.batchId) };
          const batchUpdate = direction === 'IN'
            ? { $inc: { quantity: alloc.quantity } }
            : { $inc: { quantity: -alloc.quantity } };

          const batchResult = await shopDb.collection('stock_batches').updateOne(
            filter,
            batchUpdate,
            { session }
          );

          // OUT decrement with a precondition prevents driving a batch negative.
          if (direction === 'OUT' && batchResult.matchedCount === 0) {
            throw new InsufficientStockError(
              `Batch ${alloc.batchId} does not have enough quantity for this allocation (${alloc.quantity})`,
              0,
              alloc.quantity
            );
          }
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
        status: 'ACTIVE',
        quantity: { $gt: 0 },
        expiryDate: { $gte: new Date() }
      })
      .sort({ expiryDate: 1 })
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
      const productObjId = ObjectId.isValid(productId) ? new ObjectId(productId) : productId;

      // Everything the snapshot holds that is NOT tracked in an active batch is
      // unbatched stock (opening stock, bulk import, batch-less purchases).
      // Active batches include expired ones, so subtracting the total active
      // batch quantity from the snapshot yields the true unbatched amount.
      const allActiveBatches = await shopDb.collection('stock_batches')
        .find({
          productId: productObjId,
          status: 'ACTIVE',
          quantity: { $gt: 0 },
        })
        .toArray();

      const snapshot = await shopDb.collection('stock_snapshots').findOne({
        productId: productObjId,
      });

      const batchedQty = allActiveBatches.reduce((sum, b) => sum + b.quantity, 0);
      const unbatchedQty = Math.max(0, (snapshot?.onHandQty || 0) - batchedQty);

      // Prefer the unbatched fallback (never sell expired stock).
      if (unbatchedQty >= remaining) {
        // If batch numbers were entered on the sale, they're ignored here —
        // the inventory is unbatched. recordMovement handles the ledger.
        allocations.push({
          batchId: null,
          batchNo: null,
          expiryDate: snapshot?.lastExpiryDate || null,
          quantity: remaining,
          costPrice: null
        });
        return allocations;
      }

      // Only the expired batches hold stock — nothing sellable remains.
      const expiredBatches = allActiveBatches.filter(
        (b) => b.expiryDate && new Date(b.expiryDate) < new Date()
      );
      if (expiredBatches.length > 0) {
        const sellableQty = unbatchedQty + allActiveBatches
          .filter((b) => !b.expiryDate || new Date(b.expiryDate) >= new Date())
          .reduce((sum, b) => sum + b.quantity, 0);
        throw new InsufficientStockError(
          `Cannot complete sale: remaining stock is expired or insufficient. Sellable: ${sellableQty}, Needed: ${qtyNeeded}`,
          sellableQty,
          qtyNeeded
        );
      }

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
