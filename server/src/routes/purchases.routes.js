/**
 * Purchases Routes
 * Purchase order management and inventory receiving
 */

const express = require("express");
const router = express.Router();
const { ObjectId } = require("mongodb");
const {
  authenticate,
  checkShopStatus,
} = require("../middleware/auth-multi-tenant");
const { requirePermission } = require("../utils/rbac");
const { PERMISSIONS } = require("../utils/rbac");
const { getShopDatabase } = require("../config/database");
const { asyncHandler, createError } = require("../config/error-handling");
const { logger } = require('../config/logging');
const { cacheService } = require("../services/cache.service");

/**
 * @swagger
 * /api/purchases:
 *   get:
 *     summary: Get all purchase orders
 *     description: Retrieve paginated list of purchase orders with supplier details. Requires purchases.view permission.
 *     tags: [Purchases]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: supplierId
 *         schema: { type: string }
 *         description: Filter by supplier ID
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pending, received, cancelled] }
 *     responses:
 *       200:
 *         description: Purchases retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Purchase' }
 *                 pagination: { $ref: '#/components/schemas/PaginationMeta' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { $ref: '#/components/responses/ForbiddenError' }
 *       500: { $ref: '#/components/responses/ServerError' }
 *
 *   post:
 *     summary: Create new purchase order
 *     description: Create a purchase order from a supplier. Requires purchases.create permission.
 *     tags: [Purchases]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [supplierId, items]
 *             properties:
 *               supplierId:
 *                 type: string
 *                 example: "507f1f77bcf86cd799439011"
 *               items:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required: [productId, quantity, costPrice]
 *                   properties:
 *                     productId: { type: string }
 *                     quantity: { type: integer, minimum: 1 }
 *                     costPrice: { type: number, minimum: 0 }
 *               notes:
 *                 type: string
 *           example:
 *             supplierId: "507f1f77bcf86cd799439011"
 *             items:
 *               - productId: "507f1f77bcf86cd799439012"
 *                 quantity: 100
 *                 costPrice: 10.50
 *             notes: "Urgent order"
 *     responses:
 *       201:
 *         description: Purchase order created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Purchase order created successfully" }
 *                 data: { $ref: '#/components/schemas/Purchase' }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { $ref: '#/components/responses/ForbiddenError' }
 *       500: { $ref: '#/components/responses/ServerError' }
 *
 * /api/purchases/{id}:
 *   get:
 *     summary: Get purchase order by ID
 *     description: Retrieve a specific purchase order with full item details. Requires purchases.view permission.
 *     tags: [Purchases]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Purchase retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/Purchase' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { $ref: '#/components/responses/ForbiddenError' }
 *       404: { $ref: '#/components/responses/NotFoundError' }
 *       500: { $ref: '#/components/responses/ServerError' }
 *
 *   put:
 *     summary: Update purchase order
 *     description: Update purchase order details. Requires purchases.edit permission.
 *     tags: [Purchases]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               items: { type: array }
 *               notes: { type: string }
 *     responses:
 *       200:
 *         description: Purchase updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Purchase updated successfully" }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { $ref: '#/components/responses/ForbiddenError' }
 *       404: { $ref: '#/components/responses/NotFoundError' }
 *       500: { $ref: '#/components/responses/ServerError' }
 *
 * /api/purchases/{id}/receive:
 *   put:
 *     summary: Mark purchase as received
 *     description: Mark a purchase order as received and automatically update stock levels. Requires purchases.receive permission.
 *     tags: [Purchases]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               receivedDate:
 *                 type: string
 *                 format: date
 *                 example: "2026-05-10"
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Purchase marked as received, stock updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Purchase received and stock updated" }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { $ref: '#/components/responses/ForbiddenError' }
 *       404: { $ref: '#/components/responses/NotFoundError' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */

// Helper function to handle ObjectId conversion for both MongoDB and mock database
function toObjectId(id) {
  if (!id) return null;

  // If it's already an ObjectId, return as is
  if (id instanceof ObjectId) return id;

  // If it's a string that looks like a MongoDB ObjectId (24 hex chars), convert it
  if (
    typeof id === "string" &&
    id.length === 24 &&
    /^[0-9a-fA-F]{24}$/.test(id)
  ) {
    return new ObjectId(id);
  }

  // For mock database or other string IDs, return as string
  return id;
}

// Apply authentication to all routes
router.use(authenticate);
router.use(checkShopStatus);

/**
 * GET /api/purchases
 * Get all purchases for the shop
 */
router.get(
  "/",
  requirePermission(PERMISSIONS.VIEW_PURCHASES),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const {
      page = 1,
      limit = 50,
      search = "",
      startDate,
      endDate,
      supplierId,
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    let matchQuery = {};

    // Date range filter
    if (startDate || endDate) {
      matchQuery.purchaseDate = {};
      if (startDate) matchQuery.purchaseDate.$gte = new Date(startDate);
      if (endDate) matchQuery.purchaseDate.$lte = new Date(endDate);
    }

    // Supplier filter
    if (supplierId) {
      matchQuery.supplierId = toObjectId(supplierId);
    }

    const suppliersCollectionName = shopDb.getCollectionName("suppliers");

    const pipeline = [
      { $match: matchQuery },
      {
        $lookup: {
          from: suppliersCollectionName,
          localField: "supplierId",
          foreignField: "_id",
          as: "supplier",
        },
      },
      { $unwind: "$supplier" },
    ];

    // Add search filter
    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { invoiceNo: { $regex: search, $options: "i" } },
            { "supplier.name": { $regex: search, $options: "i" } },
            { "supplier.company": { $regex: search, $options: "i" } },
          ],
        },
      });
    }

    // Add sorting, skip, and limit
    pipeline.push(
      { $sort: { purchaseDate: -1 } },
      { $skip: skip },
      { $limit: parseInt(limit) },
    );

    const purchases = await shopDb
      .collection("purchases")
      .aggregate(pipeline)
      .toArray();

    // Get total count
    const countPipeline = [...pipeline];
    countPipeline.pop(); // Remove limit
    countPipeline.pop(); // Remove skip
    countPipeline.pop(); // Remove sort
    countPipeline.push({ $count: "total" });

    const countResult = await shopDb
      .collection("purchases")
      .aggregate(countPipeline)
      .toArray();

    const total = countResult.length > 0 ? countResult[0].total : 0;

    res.json({
      success: true,
      data: purchases,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  }),
);

/**
 * GET /api/purchases/:id
 * Get purchase by ID with full details
 */
router.get(
  "/:id",
  requirePermission(PERMISSIONS.VIEW_PURCHASES),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);

    const suppliersCollectionName = shopDb.getCollectionName("suppliers");
    const usersCollectionName = shopDb.getCollectionName("users");

    const purchase = await shopDb
      .collection("purchases")
      .aggregate([
        { $match: { _id: toObjectId(req.params.id) } },
        {
          $lookup: {
            from: suppliersCollectionName,
            localField: "supplierId",
            foreignField: "_id",
            as: "supplier",
          },
        },
        { $unwind: "$supplier" },
        {
          $lookup: {
            from: usersCollectionName,
            localField: "createdBy",
            foreignField: "_id",
            as: "createdByUser",
          },
        },
        { $unwind: "$createdByUser" },
      ])
      .toArray();

    if (purchase.length === 0) {
      throw createError.notFound("Purchase not found");
    }

    // Get product details for each item
    const purchaseData = purchase[0];
    for (let item of purchaseData.items) {
      const product = await shopDb
        .collection("products")
        .findOne({ _id: toObjectId(item.productId) });
      item.product = product;
    }

    res.json({
      success: true,
      data: purchaseData,
    });
  }),
);

/**
 * POST /api/purchases
 * Create new purchase order
 */
router.post(
  "/",
  requirePermission(PERMISSIONS.CREATE_PURCHASE),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const {
      supplierId,
      items,
      invoiceNo,
      purchaseDate = new Date(),
      notes,
    } = req.body;

    // Validate required fields
    if (!supplierId || !items || !Array.isArray(items) || items.length === 0) {
      throw createError.badRequest("Supplier ID and items array are required");
    }

    // Validate supplier exists
    const supplier = await shopDb
      .collection("suppliers")
      .findOne({ _id: toObjectId(supplierId) });

    if (!supplier) {
      throw createError.notFound("Supplier not found");
    }

    // Validate and calculate totals
    let grandTotal = 0;
    const validatedItems = [];

    for (let item of items) {
      const { productId, qty, unitCost } = item;

      if (!productId || !qty || qty <= 0 || !unitCost || unitCost <= 0) {
        throw createError.badRequest(
          "Each item must have valid productId, qty, and unitCost",
        );
      }

      // Validate product exists
      const product = await shopDb
        .collection("products")
        .findOne({ _id: toObjectId(productId) });

      if (!product) {
        throw createError.badRequest(`Product not found: ${productId}`);
      }

      const totalCost = parseFloat(qty) * parseFloat(unitCost);
      grandTotal += totalCost;

      validatedItems.push({
        productId: toObjectId(productId),
        name: product.name, // Add product name as required by schema
        qty: Number(parseFloat(qty)), // Ensure it's a proper double
        rate: Number(parseFloat(unitCost)), // Ensure it's a proper double
        total: Number(parseFloat(totalCost)), // Ensure it's a proper double
      });
    }

    // Generate invoice number if not provided
    const finalInvoiceNo =
      invoiceNo ||
      `PO-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

    // Check if invoice number already exists
    if (invoiceNo) {
      const existingPurchase = await shopDb
        .collection("purchases")
        .findOne({ invoiceNo });

      if (existingPurchase) {
        throw createError.conflict("Invoice number already exists");
      }
    }

    // Get supplier name for the schema
    const supplierName = supplier.name;

    const purchaseData = {
      purchaseNo: finalInvoiceNo, // Use purchaseNo instead of invoiceNo
      supplierName: supplierName, // Required by schema
      supplierPhone: supplier.phone || "", // Optional
      supplierAddress: supplier.address || "", // Optional
      items: validatedItems,
      totalAmount: Number(parseFloat(grandTotal.toFixed(2))), // Required by schema
      paidAmount: 0, // Default to 0
      dueAmount: Number(parseFloat(grandTotal.toFixed(2))), // Same as totalAmount initially
      paymentStatus: "Pending", // Default status
      purchaseDate: new Date(purchaseDate), // Required by schema
      createdBy: toObjectId(req.user._id), // Required by schema
      createdByName: req.user.name, // Optional but useful
      notes: notes?.trim() || "", // Optional
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await shopDb.collection("purchases").insertOne(purchaseData);

    // Invalidate financial reports cache (purchase affects cash-flow, P&L)
    cacheService.invalidateShopCache(req.user.shopId, "reports");

    res.status(201).json({
      success: true,
      message: "Purchase order created successfully",
      data: { _id: result.insertedId, ...purchaseData },
    });
  }),
);

/**
 * PUT /api/purchases/:id/receive
 * Mark purchase as received and update stock
 * Phase 3B: Now creates batches for batch tracking
 */
router.put(
  "/:id/receive",
  requirePermission(PERMISSIONS.EDIT_PURCHASE),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const stockCommand = require('../services/stock-command.service');
    const { receivedItems, notes } = req.body;

    // Get purchase order
    const purchase = await shopDb
      .collection("purchases")
      .findOne({ _id: toObjectId(req.params.id) });

    if (!purchase) {
      throw createError.notFound("Purchase order not found");
    }

    if (purchase.status === "received") {
      throw createError.badRequest("Purchase order already received");
    }

    if (purchase.status === "cancelled") {
      throw createError.badRequest("Cannot receive cancelled purchase order");
    }

    // If no receivedItems provided, receive all items as ordered
    const itemsToReceive = receivedItems || purchase.items;

    // Process each received item
    for (let item of itemsToReceive) {
      const productId = toObjectId(item.productId || item.productId);
      const receivedQty = item.receivedQty || item.qty;
      const unitCost = item.unitCost || item.rate;

      // Get product details
      const product = await shopDb
        .collection("products")
        .findOne({ _id: productId });

      if (!product) {
        logger.warn(`Product not found during purchase receive: ${productId}`);
        continue;
      }

      // Phase 3B: Create batch if batch tracking info provided
      if (item.batchNo || item.expiryDate) {
        try {
          // Auto-generate batch number if not provided
          const batchNo = item.batchNo || `BATCH-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

          const batchData = {
            productId: productId,
            shopId: req.user.shopId,
            batchNo: batchNo,
            lotNo: item.lotNo || null,
            quantity: parseInt(receivedQty),
            originalQuantity: parseInt(receivedQty),
            expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
            manufactureDate: item.manufactureDate ? new Date(item.manufactureDate) : null,
            receivedDate: new Date(),
            supplierId: toObjectId(purchase.supplierId),
            purchaseId: toObjectId(req.params.id),
            costPrice: parseFloat(unitCost),
            status: 'ACTIVE',
            sourceDocument: purchase.purchaseNo || purchase.invoiceNo,
            notes: item.batchNotes || notes || null,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          // Check if batch already exists
          const existingBatch = await shopDb.collection('stock_batches').findOne({
            productId: productId,
            batchNo: batchNo,
            shopId: req.user.shopId,
          });

          if (!existingBatch) {
            await shopDb.collection('stock_batches').insertOne(batchData);
            logger.info('Batch created from purchase receipt', {
              shopId: req.user.shopId,
              purchaseId: req.params.id,
              batchNo: batchNo,
              productId: productId.toString(),
              quantity: receivedQty,
            });
          } else {
            logger.warn('Batch already exists, skipping creation', {
              batchNo: batchNo,
              productId: productId.toString(),
            });
          }
        } catch (batchError) {
          logger.error('Failed to create batch from purchase', {
            error: batchError.message,
            productId: productId.toString(),
            batchNo: item.batchNo,
          });
          // Don't fail the entire purchase - continue with stock update
        }
      }

      // Record stock movement using event-sourced system
      try {
        await stockCommand.recordMovement({
          shopId: req.user.shopId,
          productId: productId,
          movementType: 'PURCHASE',
          quantity: parseInt(receivedQty),
          userId: toObjectId(req.user._id),
          referenceType: 'PURCHASE',
          referenceId: toObjectId(req.params.id),
          batchNo: item.batchNo || null,
          expiryDate: item.expiryDate || null,
          costPrice: parseFloat(unitCost),
          note: `Purchase ${purchase.purchaseNo || purchase.invoiceNo} received`,
        });

        logger.info('Stock movement recorded for purchase', {
          shopId: req.user.shopId,
          purchaseId: req.params.id,
          productId: productId.toString(),
          quantity: receivedQty,
        });
      } catch (stockError) {
        logger.error('Failed to record stock movement', {
          error: stockError.message,
          productId: productId.toString(),
        });
        throw createError.serverError(`Failed to update stock for product ${product.name}`);
      }

      // Update product's purchase price if provided
      if (unitCost) {
        await shopDb.collection("products").updateOne(
          { _id: productId },
          {
            $set: {
              purchasePrice: parseFloat(unitCost),
              updatedAt: new Date(),
            },
          },
        );
      }
    }

    // Update purchase status
    await shopDb.collection("purchases").updateOne(
      { _id: toObjectId(req.params.id) },
      {
        $set: {
          status: "received",
          receivedAt: new Date(),
          receivedBy: toObjectId(req.user._id),
          receivedItems: itemsToReceive,
          receivingNotes: notes?.trim() || null,
          updatedAt: new Date(),
        },
      },
    );

    // Invalidate caches
    cacheService.invalidateShopCache(req.user.shopId, "reports");
    cacheService.invalidateShopCache(req.user.shopId, "products");

    res.json({
      success: true,
      message: "Purchase order received, stock updated, and batches created successfully",
    });
  }),
);

/**
 * PUT /api/purchases/:id/cancel
 * Cancel purchase order
 */
router.put(
  "/:id/cancel",
  requirePermission(PERMISSIONS.EDIT_PURCHASE),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const { reason } = req.body;

    // Get purchase order
    const purchase = await shopDb
      .collection("purchases")
      .findOne({ _id: new ObjectId(req.params.id) });

    if (!purchase) {
      throw createError.notFound("Purchase order not found");
    }

    if (purchase.status === "received") {
      throw createError.badRequest("Cannot cancel received purchase order");
    }

    if (purchase.status === "cancelled") {
      throw createError.badRequest("Purchase order already cancelled");
    }

    // Update purchase status
    await shopDb.collection("purchases").updateOne(
      { _id: new ObjectId(req.params.id) },
      {
        $set: {
          status: "cancelled",
          cancelledAt: new Date(),
          cancelledBy: new ObjectId(req.user._id),
          cancellationReason: reason?.trim() || null,
          updatedAt: new Date(),
        },
      },
    );

    // Invalidate financial reports cache
    cacheService.invalidateShopCache(req.user.shopId, "reports");

    res.json({
      success: true,
      message: "Purchase order cancelled successfully",
    });
  }),
);

module.exports = router;
