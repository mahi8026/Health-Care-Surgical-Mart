/**
 * Stock Routes (New Event-Sourced System)
 * 
 * Read endpoints for stock management:
 * - GET /snapshots - All products with current stock
 * - GET /snapshots/:id - Single product snapshot
 * - GET /:productId/ledger - Movement history
 * - GET /batches - All batches (FEFO)
 * - GET /:productId/batches - Batches for product
 * - GET /expiry-alerts - Expiring batches
 * - GET /reorder-alerts - Low stock products
 * - GET /valuation - Total stock value
 * - GET /events - SSE real-time updates
 */

const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const {
  authenticate,
  checkShopStatus,
} = require('../middleware/auth-multi-tenant');
const { requirePermission } = require('../utils/rbac');
const { PERMISSIONS } = require('../utils/rbac');
const { getShopDatabase } = require('../config/database');
const { asyncHandler, createError } = require('../config/error-handling');
const { logger } = require('../config/logging');
const stockCommand = require('../services/stock-command.service');

// Apply authentication to all routes
router.use(authenticate);
router.use(checkShopStatus);

/**
 * GET /api/stock/snapshots
 * Get all stock snapshots with filtering and pagination
 */
router.get(
  '/snapshots',
  requirePermission(PERMISSIONS.VIEW_STOCK),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const {
      page = 1,
      limit = 25,
      search = '',
      category = '',
      status = '',
      sortBy = 'productName',
      sortOrder = 'asc',
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    let query = { shopId: req.user.shopId };

    // Search filter
    if (search) {
      query.$or = [
        { productName: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
      ];
    }

    // Category filter
    if (category) {
      query.category = category;
    }

    // Status filter
    if (status === 'low_stock') {
      query.$expr = { $lte: ['$availableQty', '$reorderPoint'] };
    } else if (status === 'out_of_stock') {
      query.availableQty = 0;
    } else if (status === 'in_stock') {
      query.availableQty = { $gt: 0 };
    }

    // Sorting
    const sortDirection = sortOrder === 'desc' ? -1 : 1;
    const sort = { [sortBy]: sortDirection };

    const snapshots = await shopDb
      .collection('stock_snapshots')
      .find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();

    const total = await shopDb.collection('stock_snapshots').countDocuments(query);

    res.json({
      success: true,
      data: snapshots,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
      meta: {
        generatedAt: new Date().toISOString(),
        shopId: req.user.shopId,
      },
    });
  })
);

/**
 * GET /api/stock/snapshots/:id
 * Get single product snapshot
 */
router.get(
  '/snapshots/:id',
  requirePermission(PERMISSIONS.VIEW_STOCK),
  asyncHandler(async (req, res) => {
    const snapshot = await stockCommand.getSnapshot(req.params.id, req.user.shopId);

    if (!snapshot) {
      throw createError.notFound(`Stock snapshot not found for product ${req.params.id}`);
    }

    res.json({
      success: true,
      data: snapshot,
    });
  })
);

/**
 * GET /api/stock/:productId/ledger
 * Get movement history for a product
 */
router.get(
  '/:productId/ledger',
  requirePermission(PERMISSIONS.VIEW_STOCK),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const { page = 1, limit = 50, startDate, endDate, movementType } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    let query = {
      productId: new ObjectId(req.params.productId),
      shopId: req.user.shopId,
    };

    // Date range filter
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    // Movement type filter
    if (movementType) {
      query.movementType = movementType;
    }

    const movements = await shopDb
      .collection('stock_ledger')
      .find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();

    const total = await shopDb.collection('stock_ledger').countDocuments(query);

    res.json({
      success: true,
      data: movements,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  })
);

/**
 * GET /api/stock/batches
 * Get all batches with filtering
 */
router.get(
  '/batches',
  requirePermission(PERMISSIONS.VIEW_STOCK),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const {
      page = 1,
      limit = 50,
      productId,
      status = 'ACTIVE',
      expiryBefore,
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    let query = { shopId: req.user.shopId };

    if (productId) {
      query.productId = new ObjectId(productId);
    }

    if (status) {
      query.status = status;
    }

    if (expiryBefore) {
      query.expiryDate = { $lte: new Date(expiryBefore) };
    }

    const batches = await shopDb
      .collection('stock_batches')
      .find(query)
      .sort({ expiryDate: 1 }) // FEFO: earliest expiry first
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();

    const total = await shopDb.collection('stock_batches').countDocuments(query);

    res.json({
      success: true,
      data: batches,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  })
);

/**
 * GET /api/stock/:productId/batches
 * Get batches for a specific product (FEFO sorted)
 */
router.get(
  '/:productId/batches',
  requirePermission(PERMISSIONS.VIEW_STOCK),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);

    const batches = await shopDb
      .collection('stock_batches')
      .find({
        productId: new ObjectId(req.params.productId),
        shopId: req.user.shopId,
        status: 'ACTIVE',
        quantity: { $gt: 0 },
      })
      .sort({ expiryDate: 1 }) // FEFO: earliest expiry first
      .toArray();

    res.json({
      success: true,
      data: batches,
    });
  })
);

/**
 * GET /api/stock/expiry-alerts
 * Get batches expiring within specified days
 */
router.get(
  '/expiry-alerts',
  requirePermission(PERMISSIONS.VIEW_STOCK),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const daysThreshold = parseInt(req.query.days) || 30;

    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);

    const batches = await shopDb
      .collection('stock_batches')
      .aggregate([
        {
          $match: {
            shopId: req.user.shopId,
            status: 'ACTIVE',
            quantity: { $gt: 0 },
            expiryDate: { $lte: thresholdDate },
          },
        },
        {
          $lookup: {
            from: shopDb.getCollectionName('products'),
            localField: 'productId',
            foreignField: '_id',
            as: 'product',
          },
        },
        {
          $unwind: {
            path: '$product',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $addFields: {
            daysToExpiry: {
              $divide: [{ $subtract: ['$expiryDate', new Date()] }, 1000 * 60 * 60 * 24],
            },
          },
        },
        { $sort: { expiryDate: 1 } },
      ])
      .toArray();

    res.json({
      success: true,
      data: batches,
      meta: {
        daysThreshold,
        count: batches.length,
      },
    });
  })
);

/**
 * GET /api/stock/reorder-alerts
 * Get products below reorder point
 */
router.get(
  '/reorder-alerts',
  requirePermission(PERMISSIONS.VIEW_STOCK),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);

    const lowStockProducts = await shopDb
      .collection('stock_snapshots')
      .find({
        shopId: req.user.shopId,
        $expr: { $lte: ['$availableQty', '$reorderPoint'] },
      })
      .sort({ availableQty: 1 })
      .toArray();

    res.json({
      success: true,
      data: lowStockProducts,
      meta: {
        count: lowStockProducts.length,
      },
    });
  })
);

/**
 * GET /api/stock/valuation
 * Get total stock valuation (cost and retail)
 */
router.get(
  '/valuation',
  requirePermission(PERMISSIONS.VIEW_STOCK),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);

    const snapshots = await shopDb
      .collection('stock_snapshots')
      .find({ shopId: req.user.shopId })
      .toArray();

    // Get product details for pricing
    const productIds = snapshots.map((s) => s.productId);
    const products = await shopDb
      .collection('products')
      .find({ _id: { $in: productIds } })
      .toArray();

    const productMap = new Map(products.map((p) => [p._id.toString(), p]));

    let costValue = 0;
    let retailValue = 0;
    let totalItems = 0;

    snapshots.forEach((snapshot) => {
      const product = productMap.get(snapshot.productId.toString());
      if (product && snapshot.onHandQty > 0) {
        const cost = product.purchasePrice || product.costPrice || 0;
        const retail = product.sellingPrice || 0;

        costValue += snapshot.onHandQty * cost;
        retailValue += snapshot.onHandQty * retail;
        totalItems += snapshot.onHandQty;
      }
    });

    res.json({
      success: true,
      data: {
        costValue: Math.round(costValue * 100) / 100,
        retailValue: Math.round(retailValue * 100) / 100,
        potentialProfit: Math.round((retailValue - costValue) * 100) / 100,
        totalItems,
        totalProducts: snapshots.length,
      },
    });
  })
);

/**
 * GET /api/stock/events
 * SSE endpoint for real-time stock updates
 * 
 * Note: EventSource API doesn't support custom headers,
 * so we accept token via query parameter for this endpoint only
 */
router.get(
  '/events',
  (req, res, next) => {
    // Special handling for SSE: extract token from query param and set as Authorization header
    // This allows EventSource to connect (it can't send custom headers)
    if (req.query.token) {
      req.headers.authorization = `Bearer ${req.query.token}`;
    }
    next();
  },
  authenticate,
  asyncHandler(async (req, res) => {
    const sseManager = require('../services/sse-manager.service');
    sseManager.handleConnection(req, res);
  })
);

/**
 * POST /api/stock/batches
 * Create a new batch (called from purchase receipt)
 * Phase 3: FEFO Batch Tracking
 */
router.post(
  '/batches',
  requirePermission(PERMISSIONS.MANAGE_STOCK),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const {
      productId,
      batchNo,
      quantity,
      expiryDate,
      costPrice,
      purchaseId,
      lotNo,
      manufactureDate,
      supplierId,
      sourceDocument,
      notes,
    } = req.body;

    // Validation
    if (!productId || !batchNo || !quantity || !expiryDate || !costPrice) {
      throw createError.badRequest('Missing required fields: productId, batchNo, quantity, expiryDate, costPrice');
    }

    if (quantity <= 0) {
      throw createError.badRequest('Quantity must be greater than 0');
    }

    // Check if batch number already exists for this product
    const existingBatch = await shopDb.collection('stock_batches').findOne({
      productId: new ObjectId(productId),
      batchNo,
      shopId: req.user.shopId,
    });

    if (existingBatch) {
      throw createError.conflict(`Batch ${batchNo} already exists for this product`);
    }

    const batch = {
      productId: new ObjectId(productId),
      shopId: req.user.shopId,
      batchNo,
      lotNo: lotNo || null,
      quantity: parseInt(quantity),
      originalQuantity: parseInt(quantity),
      expiryDate: new Date(expiryDate),
      manufactureDate: manufactureDate ? new Date(manufactureDate) : null,
      receivedDate: new Date(),
      supplierId: supplierId ? new ObjectId(supplierId) : null,
      purchaseId: purchaseId ? new ObjectId(purchaseId) : null,
      costPrice: parseFloat(costPrice),
      status: 'ACTIVE',
      sourceDocument: sourceDocument || null,
      notes: notes || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await shopDb.collection('stock_batches').insertOne(batch);

    logger.info('Batch created', {
      shopId: req.user.shopId,
      batchId: result.insertedId,
      productId,
      batchNo,
      quantity,
    });

    res.status(201).json({
      success: true,
      data: { _id: result.insertedId, ...batch },
    });
  })
);

/**
 * PUT /api/stock/batches/:batchId
 * Update batch quantity (for adjustments)
 */
router.put(
  '/batches/:batchId',
  requirePermission(PERMISSIONS.MANAGE_STOCK),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const { quantity, status, notes } = req.body;

    const updateFields = {
      updatedAt: new Date(),
    };

    if (quantity !== undefined) {
      updateFields.quantity = parseInt(quantity);
    }

    if (status !== undefined) {
      if (!['ACTIVE', 'CONSUMED', 'EXPIRED', 'RETURNED'].includes(status)) {
        throw createError.badRequest('Invalid status. Must be: ACTIVE, CONSUMED, EXPIRED, or RETURNED');
      }
      updateFields.status = status;
    }

    if (notes !== undefined) {
      updateFields.notes = notes;
    }

    const result = await shopDb.collection('stock_batches').findOneAndUpdate(
      {
        _id: new ObjectId(req.params.batchId),
        shopId: req.user.shopId,
      },
      { $set: updateFields },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      throw createError.notFound('Batch not found');
    }

    logger.info('Batch updated', {
      shopId: req.user.shopId,
      batchId: req.params.batchId,
      changes: updateFields,
    });

    res.json({
      success: true,
      data: result.value,
    });
  })
);

module.exports = router;
