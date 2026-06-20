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

    // Build match stage
    const matchStage = {};

    if (search) {
      matchStage.$or = [
        { productName: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
      ];
    }

    if (category) {
      matchStage.category = category;
    }

    // Status filters — resolved after we know qty vs reorderPoint
    // These are applied as a $match after $addFields
    const postMatchStage = {};
    if (status === 'low_stock') {
      postMatchStage.$expr = { $and: [
        { $gt: ['$onHandQty', 0] },
        { $lte: ['$onHandQty', '$reorderPoint'] },
      ]};
    } else if (status === 'out_of_stock') {
      postMatchStage.onHandQty = 0;
    } else if (status === 'in_stock') {
      postMatchStage.$expr = { $gt: ['$onHandQty', '$reorderPoint'] };
    } else if (status === 'expiring_30d') {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() + 30);
      postMatchStage['product.expiryDate'] = { $lte: cutoff, $gte: new Date() };
    } else if (status === 'expiring_60d') {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() + 60);
      postMatchStage['product.expiryDate'] = { $lte: cutoff, $gte: new Date() };
    } else if (status === 'expired') {
      postMatchStage['product.expiryDate'] = { $lt: new Date() };
    }

    const sortDirection = sortOrder === 'desc' ? -1 : 1;

    const pipeline = [
      { $match: matchStage },
      // Join product details
      {
        $lookup: {
          from: 'products',
          localField: 'productId',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
      // Merge useful product fields into the snapshot for easy access
      {
        $addFields: {
          purchasePrice: { $ifNull: ['$product.purchasePrice', '$avgCostPrice', 0] },
          sellingPrice: { $ifNull: ['$product.sellingPrice', 0] },
          batchNo: { $ifNull: ['$product.batchNo', '$batchNo', ''] },
          lotNo: { $ifNull: ['$product.lotNo', '$lotNo', ''] },
          expiryDate: { $ifNull: ['$product.expiryDate', null] },
          maxStock: { $ifNull: ['$product.maxStock', null] },
          stockValue: {
            $multiply: [
              '$onHandQty',
              { $ifNull: ['$product.purchasePrice', '$avgCostPrice', 0] },
            ],
          },
        },
      },
    ];

    // Apply status post-filter if set
    if (Object.keys(postMatchStage).length > 0) {
      pipeline.push({ $match: postMatchStage });
    }

    // Count total before pagination
    const countPipeline = [...pipeline, { $count: 'total' }];
    const countResult = await shopDb.collection('stock_snapshots').aggregate(countPipeline).toArray();
    const total = countResult[0]?.total || 0;

    // Sort, paginate, and remove embedded product sub-doc
    pipeline.push(
      { $sort: { [sortBy]: sortDirection } },
      { $skip: skip },
      { $limit: parseInt(limit) },
      { $project: { product: 0 } },  // strip raw product sub-doc — fields are merged above
    );

    const snapshots = await shopDb.collection('stock_snapshots').aggregate(pipeline).toArray();

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
    // No shopId filter needed — already scoped to the correct shop DB
    const query = {
      productId: new ObjectId(req.params.productId),
    };

    // Date range filter
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) {query.timestamp.$gte = new Date(startDate);}
      if (endDate) {query.timestamp.$lte = new Date(endDate);}
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
    const query = {};

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
            from: 'products',
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
      .find({})
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
 * so we accept token via query parameter for this endpoint only.
 * The authenticate middleware will check req.query.token automatically.
 */
router.get(
  '/events',
  authenticate, // Reads token from query param (see auth-multi-tenant.js)
  checkShopStatus,
  asyncHandler(async (req, res) => {
    const sseManager = require('../services/sse-manager.service');
    sseManager.handleConnection(req, res);
  })
);

/**
 * GET /api/stock/expired
 * Get expired items (for backward compatibility with Dashboard)
 * Alias for /expiry-alerts with past date
 */
router.get(
  '/expired',
  requirePermission(PERMISSIONS.VIEW_STOCK),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);

    const batches = await shopDb
      .collection('stock_batches')
      .aggregate([
        {
          $match: {
            shopId: req.user.shopId,
            status: 'ACTIVE',
            quantity: { $gt: 0 },
            expiryDate: { $lt: new Date() }, // Already expired
          },
        },
        {
          $lookup: {
            from: 'products',
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
            productName: '$product.name',
            currentQty: '$quantity',
            daysLeft: 0,
          },
        },
        { $sort: { expiryDate: -1 } },
      ])
      .toArray();

    res.json({
      success: true,
      data: batches,
      meta: {
        count: batches.length,
      },
    });
  })
);

/**
 * GET /api/stock/expiring-soon
 * Get items expiring within specified days (for backward compatibility with Dashboard)
 * Alias for /expiry-alerts
 */
router.get(
  '/expiring-soon',
  requirePermission(PERMISSIONS.VIEW_STOCK),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const daysThreshold = parseInt(req.query.days) || 30;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);
    thresholdDate.setHours(23, 59, 59, 999);

    const batches = await shopDb
      .collection('stock_batches')
      .aggregate([
        {
          $match: {
            shopId: req.user.shopId,
            status: 'ACTIVE',
            quantity: { $gt: 0 },
            expiryDate: {
              $gte: today, // Not yet expired
              $lte: thresholdDate, // Within threshold
            },
          },
        },
        {
          $lookup: {
            from: 'products',
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
            productName: '$product.name',
            currentQty: '$quantity',
            daysLeft: {
              $ceil: {
                $divide: [{ $subtract: ['$expiryDate', new Date()] }, 1000 * 60 * 60 * 24],
              },
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


/**
 * POST /api/stock/adjust
 * Manual stock adjustment (add, subtract, or set exact quantity)
 * Phase 5: Stock management features
 */
router.post(
  '/adjust',
  requirePermission(PERMISSIONS.MANAGE_STOCK),
  asyncHandler(async (req, res) => {
    const { productId, adjustmentType, quantity, reason, notes } = req.body;

    // Validation
    if (!productId || !adjustmentType || quantity === undefined) {
      throw createError.badRequest('Missing required fields: productId, adjustmentType, quantity');
    }

    if (!['ADD', 'SUBTRACT', 'SET'].includes(adjustmentType)) {
      throw createError.badRequest('Invalid adjustmentType. Must be: ADD, SUBTRACT, or SET');
    }

    if (adjustmentType !== 'SET' && quantity <= 0) {
      throw createError.badRequest('Quantity must be positive for ADD/SUBTRACT');
    }

    if (adjustmentType === 'SET' && quantity < 0) {
      throw createError.badRequest('Quantity cannot be negative for SET');
    }

    // Map adjustment type to movement type
    const movementType = {
      'ADD': 'ADJUSTMENT_ADD',
      'SUBTRACT': 'ADJUSTMENT_SUB',
      'SET': 'ADJUSTMENT_SET'
    }[adjustmentType];

    // Record adjustment
    const result = await stockCommand.recordMovement({
      shopId: req.user.shopId,
      productId: new ObjectId(productId),
      movementType,
      quantity: parseFloat(quantity),
      userId: req.user._id,
      referenceType: 'ADJUSTMENT',
      note: `${reason || 'Manual adjustment'}: ${notes || ''}`,
      metadata: {
        reason: reason || 'Manual adjustment',
        adjustmentType,
        adjustedBy: req.user.name
      }
    });

    logger.info('Stock adjustment recorded', {
      shopId: req.user.shopId,
      productId,
      adjustmentType,
      quantity,
      user: req.user.name
    });

    res.json({
      success: true,
      message: 'Stock adjusted successfully',
      data: {
        ledgerEntry: result.ledgerEntry,
        newQuantity: result.snapshot.onHandQty
      }
    });
  })
);

/**
 * POST /api/stock/opening-stock
 * Create opening stock for products (bulk initialization)
 * Phase 5: For initial inventory setup
 */
router.post(
  '/opening-stock',
  requirePermission(PERMISSIONS.MANAGE_STOCK),
  asyncHandler(async (req, res) => {
    const { items } = req.body; // Array of { productId, quantity, costPrice, notes }

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw createError.badRequest('Items array is required');
    }

    const results = [];
    const errors = [];

    for (const item of items) {
      try {
        if (!item.productId || item.quantity === undefined) {
          throw new Error('Missing productId or quantity');
        }

        const result = await stockCommand.recordMovement({
          shopId: req.user.shopId,
          productId: new ObjectId(item.productId),
          movementType: 'OPENING_STOCK',
          quantity: parseFloat(item.quantity),
          userId: req.user._id,
          referenceType: 'OPENING_STOCK',
          costPrice: item.costPrice ? parseFloat(item.costPrice) : null,
          note: item.notes || 'Opening stock entry',
          metadata: {
            source: 'bulk_opening_stock',
            importedBy: req.user.name
          }
        });

        results.push({
          productId: item.productId,
          success: true,
          newQuantity: result.snapshot.onHandQty
        });
      } catch (error) {
        errors.push({
          productId: item.productId,
          success: false,
          error: error.message
        });
      }
    }

    logger.info('Opening stock created', {
      shopId: req.user.shopId,
      totalItems: items.length,
      successful: results.length,
      failed: errors.length,
      user: req.user.name
    });

    res.json({
      success: true,
      message: `Opening stock created for ${results.length} of ${items.length} products`,
      data: { results, errors }
    });
  })
);

/**
 * POST /api/stock/init-missing-snapshots
 * Initialize stock snapshots for products that don't have them
 * This fixes products created before the event-sourced stock system was implemented
 */
router.post(
  '/init-missing-snapshots',
  requirePermission(PERMISSIONS.MANAGE_STOCK),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);

    // Get all products
    const products = await shopDb.collection('products').find({}).toArray();

    let created = 0;
    let skipped = 0;
    const results = [];

    for (const product of products) {
      // Check if snapshot exists
      const existingSnapshot = await shopDb.collection('stock_snapshots').findOne({
        productId: product._id
      });

      if (existingSnapshot) {
        skipped++;
        continue;
      }

      // Create snapshot with current stock quantity from product record
      const snapshot = {
        productId: product._id,
        productName: product.name,
        sku: product.sku || null,
        onHandQty: product.stockQuantity || 0,
        reservedQty: 0,
        availableQty: product.stockQuantity || 0,
        avgCostPrice: product.purchasePrice || 0,
        totalCostValue: (product.stockQuantity || 0) * (product.purchasePrice || 0),
        reorderPoint: product.minStockLevel || product.reorderPoint || 10,
        lastMovementType: product.stockQuantity > 0 ? 'OPENING_STOCK' : null,
        lastMovementDate: product.stockQuantity > 0 ? new Date() : null,
        batchCount: 0,
        oldestExpiryDate: null,
        nearestExpiryDate: null,
        lastLedgerVersion: 0,
        lastLedgerEntryId: null,
        version: 0,
        updatedAt: new Date(),
        createdAt: new Date(),
      };

      await shopDb.collection('stock_snapshots').insertOne(snapshot);
      created++;

      results.push({
        productId: product._id,
        productName: product.name,
        sku: product.sku,
        initialQty: product.stockQuantity || 0
      });
    }

    logger.info('Missing snapshots initialized', {
      shopId: req.user.shopId,
      totalProducts: products.length,
      snapshotsCreated: created,
      snapshotsSkipped: skipped,
      user: req.user.name
    });

    res.json({
      success: true,
      message: `Initialized ${created} missing stock snapshots (${skipped} already existed)`,
      data: {
        totalProducts: products.length,
        snapshotsCreated: created,
        snapshotsSkipped: skipped,
        products: results
      }
    });
  })
);
