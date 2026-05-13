/**
 * Stock Routes
 * Stock management and inventory operations
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

// Apply authentication to all routes
router.use(authenticate);
router.use(checkShopStatus);

/**
 * @swagger
 * /api/stock:
 *   get:
 *     summary: Get stock information with product details
 *     description: Retrieve paginated stock inventory with product information. Supports search and low stock filtering. Requires stock.read permission.
 *     tags: [Stock]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by product name, SKU, or brand
 *       - in: query
 *         name: lowStock
 *         schema:
 *           type: boolean
 *         description: Filter for low stock items only
 *     responses:
 *       200:
 *         description: Stock retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Stock'
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationMeta'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *
 * /api/stock/low-stock:
 *   get:
 *     summary: Get items with low stock
 *     description: Retrieve all products with stock levels below reorder threshold. Requires stock.read permission.
 *     tags: [Stock]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Low stock items retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Stock'
 *                 count:
 *                   type: integer
 *                   example: 15
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *
 * /api/stock/{productId}:
 *   get:
 *     summary: Get stock for specific product
 *     description: Retrieve stock information for a single product. Requires stock.read permission.
 *     tags: [Stock]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *         description: Product ID
 *     responses:
 *       200:
 *         description: Stock retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Stock'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *
 * /api/stock/{productId}/adjust:
 *   put:
 *     summary: Adjust stock quantity
 *     description: Manually adjust stock levels with reason tracking. Requires stock.update permission.
 *     tags: [Stock]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *         description: Product ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - quantity
 *               - type
 *             properties:
 *               quantity:
 *                 type: integer
 *                 minimum: 1
 *                 example: 50
 *               type:
 *                 type: string
 *                 enum: [add, subtract]
 *                 example: "add"
 *               reason:
 *                 type: string
 *                 example: "Received new shipment"
 *     responses:
 *       200:
 *         description: Stock adjusted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Stock adjusted successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     previousQuantity:
 *                       type: integer
 *                       example: 100
 *                     newQuantity:
 *                       type: integer
 *                       example: 150
 *                     adjustment:
 *                       type: string
 *                       example: "+50"
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *
 * /api/stock/adjustments/history:
 *   get:
 *     summary: Get stock adjustment history
 *     description: Retrieve paginated history of all stock adjustments. Requires stock.read permission.
 *     tags: [Stock]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *       - in: query
 *         name: productId
 *         schema:
 *           type: string
 *         description: Filter by product ID
 *     responses:
 *       200:
 *         description: Adjustment history retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       productId:
 *                         type: string
 *                       type:
 *                         type: string
 *                         enum: [add, subtract]
 *                       quantity:
 *                         type: integer
 *                       previousQuantity:
 *                         type: integer
 *                       newQuantity:
 *                         type: integer
 *                       reason:
 *                         type: string
 *                       adjustedBy:
 *                         type: string
 *                       adjustedAt:
 *                         type: string
 *                         format: date-time
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationMeta'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

/**
 * GET /api/stock
 * Get stock information with product details
 */
router.get(
  "/",
  requirePermission(PERMISSIONS.VIEW_STOCK),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const { page = 1, limit = 50, search = "", lowStock = false } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    let matchQuery = {};

    // Filter for low stock items
    if (lowStock === "true") {
      matchQuery.isLowStock = true;
    }

    // Get prefixed collection name for $lookup
    const productsCollectionName = shopDb.getCollectionName("products");

    // Build aggregation pipeline
    const pipeline = [
      { $match: matchQuery },
      {
        $lookup: {
          from: productsCollectionName,
          localField: "productId",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
    ];

    // Add search filter if provided
    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { "product.name": { $regex: search, $options: "i" } },
            { "product.sku": { $regex: search, $options: "i" } },
            { "product.brand": { $regex: search, $options: "i" } },
          ],
        },
      });
    }

    // Add sorting, skip, and limit
    pipeline.push(
      { $sort: { "product.name": 1 } },
      { $skip: skip },
      { $limit: parseInt(limit) },
    );

    const stockItems = await shopDb
      .collection("stock")
      .aggregate(pipeline)
      .toArray();

    // Get total count for pagination
    const countPipeline = [
      { $match: matchQuery },
      {
        $lookup: {
          from: productsCollectionName,
          localField: "productId",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
    ];

    if (search) {
      countPipeline.push({
        $match: {
          $or: [
            { "product.name": { $regex: search, $options: "i" } },
            { "product.sku": { $regex: search, $options: "i" } },
            { "product.brand": { $regex: search, $options: "i" } },
          ],
        },
      });
    }

    countPipeline.push({ $count: "total" });

    const countResult = await shopDb
      .collection("stock")
      .aggregate(countPipeline)
      .toArray();

    const total = countResult.length > 0 ? countResult[0].total : 0;

    res.json({
      success: true,
      data: stockItems,
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
 * GET /api/stock/expiring-soon
 * Returns stock where expiryDate <= today + N days
 *
 * @swagger
 * /api/stock/expiring-soon:
 *   get:
 *     summary: Get stock expiring within N days
 *     description: Returns stock items whose expiry date falls within the specified number of days. Requires stock.read permission.
 *     tags: [Stock]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 30
 *         description: Number of days ahead to check (default 30)
 *     responses:
 *       200:
 *         description: Expiring stock retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       productName: { type: string }
 *                       batchNo: { type: string }
 *                       lotNo: { type: string }
 *                       currentQty: { type: number }
 *                       expiryDate: { type: string, format: date-time }
 *                       daysLeft: { type: integer }
 *                 count: { type: integer }
 */
router.get(
  "/expiring-soon",
  requirePermission(PERMISSIONS.VIEW_STOCK),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const days = parseInt(req.query.days) || 30;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cutoff = new Date(today);
    cutoff.setDate(cutoff.getDate() + days);

    const productsCollectionName = shopDb.getCollectionName("products");

    const items = await shopDb
      .collection("stock")
      .aggregate([
        {
          $match: {
            expiryDate: { $ne: null, $lte: cutoff, $gte: today },
          },
        },
        {
          $lookup: {
            from: productsCollectionName,
            localField: "productId",
            foreignField: "_id",
            as: "product",
          },
        },
        { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
        {
          $addFields: {
            daysLeft: {
              $toInt: {
                $divide: [
                  { $subtract: ["$expiryDate", today] },
                  1000 * 60 * 60 * 24,
                ],
              },
            },
          },
        },
        { $sort: { expiryDate: 1 } },
        {
          $project: {
            productName: { $ifNull: ["$product.name", "$productName"] },
            sku: "$product.sku",
            batchNo: 1,
            lotNo: 1,
            currentQty: 1,
            expiryDate: 1,
            daysLeft: 1,
          },
        },
      ])
      .toArray();

    res.json({ success: true, data: items, count: items.length });
  }),
);

/**
 * GET /api/stock/expired
 * Returns stock where expiryDate < today
 *
 * @swagger
 * /api/stock/expired:
 *   get:
 *     summary: Get expired stock
 *     description: Returns all stock items whose expiry date has passed. Requires stock.read permission.
 *     tags: [Stock]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Expired stock retrieved successfully
 */
router.get(
  "/expired",
  requirePermission(PERMISSIONS.VIEW_STOCK),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const productsCollectionName = shopDb.getCollectionName("products");

    const items = await shopDb
      .collection("stock")
      .aggregate([
        { $match: { expiryDate: { $ne: null, $lt: today } } },
        {
          $lookup: {
            from: productsCollectionName,
            localField: "productId",
            foreignField: "_id",
            as: "product",
          },
        },
        { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
        {
          $addFields: {
            daysExpired: {
              $toInt: {
                $divide: [
                  { $subtract: [today, "$expiryDate"] },
                  1000 * 60 * 60 * 24,
                ],
              },
            },
          },
        },
        { $sort: { expiryDate: 1 } },
        {
          $project: {
            productName: { $ifNull: ["$product.name", "$productName"] },
            sku: "$product.sku",
            batchNo: 1,
            lotNo: 1,
            currentQty: 1,
            expiryDate: 1,
            daysExpired: 1,
          },
        },
      ])
      .toArray();

    res.json({ success: true, data: items, count: items.length });
  }),
);

/**
 * GET /api/stock/low-stock
 * Get items with low stock
 */
router.get(
  "/low-stock",
  requirePermission(PERMISSIONS.VIEW_STOCK),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);

    const productsCollectionName = shopDb.getCollectionName("products");

    const lowStockItems = await shopDb
      .collection("stock")
      .aggregate([
        { $match: { isLowStock: true } },
        {
          $lookup: {
            from: productsCollectionName,
            localField: "productId",
            foreignField: "_id",
            as: "product",
          },
        },
        { $unwind: "$product" },
        { $sort: { "product.name": 1 } },
      ])
      .toArray();

    res.json({
      success: true,
      data: lowStockItems,
      count: lowStockItems.length,
    });
  }),
);

/**
 * GET /api/stock/:productId
 * Get stock for specific product
 */
router.get(
  "/:productId",
  requirePermission(PERMISSIONS.VIEW_STOCK),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);

    const productsCollectionName = shopDb.getCollectionName("products");

    const stockItem = await shopDb
      .collection("stock")
      .aggregate([
        { $match: { productId: new ObjectId(req.params.productId) } },
        {
          $lookup: {
            from: productsCollectionName,
            localField: "productId",
            foreignField: "_id",
            as: "product",
          },
        },
        { $unwind: "$product" },
      ])
      .toArray();

    if (stockItem.length === 0) {
      throw createError.notFound("Stock record not found");
    }

    res.json({
      success: true,
      data: stockItem[0],
    });
  }),
);

/**
 * PUT /api/stock/:productId/adjust
 * Adjust stock quantity
 */
router.put(
  "/:productId/adjust",
  requirePermission(PERMISSIONS.MANAGE_STOCK),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const { quantity, reason, type } = req.body; // type: 'add' or 'subtract'

    if (!quantity || quantity <= 0) {
      throw createError.badRequest("Valid quantity is required");
    }

    if (!type || !["add", "subtract"].includes(type)) {
      throw createError.badRequest("Type must be 'add' or 'subtract'");
    }

    // Get current stock
    const currentStock = await shopDb
      .collection("stock")
      .findOne({ productId: new ObjectId(req.params.productId) });

    if (!currentStock) {
      throw createError.notFound("Stock record not found");
    }

    // Get product details for min stock level
    const product = await shopDb
      .collection("products")
      .findOne({ _id: new ObjectId(req.params.productId) });

    if (!product) {
      throw createError.notFound("Product not found");
    }

    // Calculate new quantity
    let newQuantity = currentStock.quantity;
    if (type === "add") {
      newQuantity += parseInt(quantity);
    } else {
      newQuantity -= parseInt(quantity);
      if (newQuantity < 0) {
        throw createError.badRequest("Insufficient stock for subtraction");
      }
    }

    // Check if low stock
    const isLowStock = newQuantity <= (product.minStockLevel || 0);

    // Update stock
    const updateData = {
      quantity: newQuantity,
      isLowStock,
      lastUpdated: new Date(),
      updatedBy: req.user.id,
    };

    await shopDb
      .collection("stock")
      .updateOne(
        { productId: new ObjectId(req.params.productId) },
        { $set: updateData },
      );

    // Log stock adjustment
    await shopDb.collection("stock_adjustments").insertOne({
      productId: new ObjectId(req.params.productId),
      type,
      quantity: parseInt(quantity),
      previousQuantity: currentStock.quantity,
      newQuantity,
      reason: reason || "Manual adjustment",
      adjustedBy: req.user.id,
      adjustedAt: new Date(),
    });

    // Audit: stock adjusted
    try {
      const auditLog = require("../services/audit-log.service");
      const { AUDIT_ACTIONS } = require("../models/audit-log.schema");
      auditLog.log(req, AUDIT_ACTIONS.STOCK_ADJUSTED, "stock", req.params.productId,
        `Stock ${type === "add" ? "increased" : "decreased"} by ${quantity} for product ${product.name}. Reason: ${reason || "Manual adjustment"}`,
        {
          before: { quantity: currentStock.quantity },
          after: { quantity: newQuantity, adjustment: type === "add" ? `+${quantity}` : `-${quantity}`, reason },
        }
      );
    } catch (_) { /* never block the response */ }

    res.json({
      success: true,
      message: "Stock adjusted successfully",
      data: {
        previousQuantity: currentStock.quantity,
        newQuantity,
        adjustment: type === "add" ? `+${quantity}` : `-${quantity}`,
      },
    });
  }),
);

/**
 * GET /api/stock/adjustments/history
 * Get stock adjustment history
 */
router.get(
  "/adjustments/history",
  requirePermission(PERMISSIONS.VIEW_STOCK),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const { page = 1, limit = 50, productId } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    let matchQuery = {};

    if (productId) {
      matchQuery.productId = new ObjectId(productId);
    }

    const productsCollectionName = shopDb.getCollectionName("products");
    const usersCollectionName = shopDb.getCollectionName("users");

    const adjustments = await shopDb
      .collection("stock_adjustments")
      .aggregate([
        { $match: matchQuery },
        {
          $lookup: {
            from: productsCollectionName,
            localField: "productId",
            foreignField: "_id",
            as: "product",
          },
        },
        { $unwind: "$product" },
        {
          $lookup: {
            from: usersCollectionName,
            localField: "adjustedBy",
            foreignField: "_id",
            as: "adjustedByUser",
          },
        },
        { $unwind: "$adjustedByUser" },
        { $sort: { adjustedAt: -1 } },
        { $skip: skip },
        { $limit: parseInt(limit) },
      ])
      .toArray();

    const total = await shopDb
      .collection("stock_adjustments")
      .countDocuments(matchQuery);

    res.json({
      success: true,
      data: adjustments,
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
 * GET /api/stock/:productId/movement-history
 * Full in/out movement history for a product across sales, purchases, returns, adjustments.
 *
 * @swagger
 * /api/stock/{productId}/movement-history:
 *   get:
 *     summary: Get stock movement history for a product
 *     description: |
 *       Returns a unified timeline of all stock movements for a product:
 *       Sales (out), Purchases (in), Returns (in), Manual Adjustments (in/out).
 *       Queries all collections in parallel using Promise.all.
 *       Requires VIEW_STOCK permission.
 *     tags: [Stock]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema: { type: string }
 *         description: Product ID
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date }
 *         description: Filter from date (default 90 days ago)
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date }
 *         description: Filter to date (default today)
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50, maximum: 200 }
 *     responses:
 *       200:
 *         description: Movement history retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 productName: { type: string }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       date: { type: string, format: date-time }
 *                       type: { type: string, enum: [Sale, Purchase, Return, Adjustment, Bulk Import] }
 *                       qtyChange: { type: number, description: "Positive = in, Negative = out" }
 *                       runningBalance: { type: number }
 *                       reference: { type: string }
 *                       user: { type: string }
 *                       note: { type: string }
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationMeta'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get(
  "/:productId/movement-history",
  requirePermission(PERMISSIONS.VIEW_STOCK),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const { startDate, endDate, page = 1, limit = 50 } = req.query;

    let productId;
    try {
      productId = new ObjectId(req.params.productId);
    } catch {
      throw createError.badRequest("Invalid product ID");
    }

    // Verify product exists
    const product = await shopDb.collection("products").findOne({ _id: productId });
    if (!product) throw createError.notFound("Product not found");

    // Date range — default last 90 days
    const now = new Date();
    const defaultStart = new Date(now);
    defaultStart.setDate(defaultStart.getDate() - 90);
    const start = startDate ? new Date(startDate) : defaultStart;
    const end = endDate ? new Date(endDate) : now;
    end.setHours(23, 59, 59, 999);

    // ── Query all collections in parallel ────────────────────────────────
    const [salesEvents, purchaseEvents, returnEvents, adjustmentEvents] =
      await Promise.all([
        // Sales — stock OUT
        shopDb.collection("sales").aggregate([
          {
            $match: {
              "items.productId": productId,
              saleDate: { $gte: start, $lte: end },
            },
          },
          { $unwind: "$items" },
          { $match: { "items.productId": productId } },
          {
            $project: {
              date: "$saleDate",
              type: { $literal: "Sale" },
              qtyChange: { $multiply: ["$items.qty", -1] },
              reference: "$invoiceNo",
              user: "$createdByName",
              note: { $ifNull: ["$notes", ""] },
            },
          },
        ]).toArray(),

        // Purchases — stock IN
        shopDb.collection("purchases").aggregate([
          {
            $match: {
              "items.productId": productId,
              purchaseDate: { $gte: start, $lte: end },
            },
          },
          { $unwind: "$items" },
          { $match: { "items.productId": productId } },
          {
            $project: {
              date: "$purchaseDate",
              type: { $literal: "Purchase" },
              qtyChange: { $ifNull: ["$items.quantity", "$items.qty"] },
              reference: { $ifNull: ["$purchaseNo", "$invoiceNo"] },
              user: "$createdByName",
              note: { $ifNull: ["$notes", ""] },
            },
          },
        ]).toArray(),

        // Returns — stock IN (returned to shelf)
        shopDb.collection("returns").aggregate([
          {
            $match: {
              "items.productId": productId,
              returnDate: { $gte: start, $lte: end },
            },
          },
          { $unwind: "$items" },
          { $match: { "items.productId": productId } },
          {
            $project: {
              date: "$returnDate",
              type: { $literal: "Return" },
              qtyChange: { $ifNull: ["$items.quantity", "$items.qty"] },
              reference: "$returnNo",
              user: "$createdByName",
              note: { $ifNull: ["$reason", ""] },
            },
          },
        ]).toArray(),

        // Manual adjustments
        shopDb.collection("stock_adjustments").aggregate([
          {
            $match: {
              productId,
              adjustedAt: { $gte: start, $lte: end },
            },
          },
          {
            $project: {
              date: "$adjustedAt",
              type: { $literal: "Adjustment" },
              qtyChange: {
                $cond: {
                  if: { $eq: ["$type", "add"] },
                  then: "$quantity",
                  else: { $multiply: ["$quantity", -1] },
                },
              },
              reference: { $ifNull: ["$reason", "Manual adjustment"] },
              user: "$adjustedByName",
              note: { $ifNull: ["$note", ""] },
            },
          },
        ]).toArray(),
      ]);

    // ── Merge, sort by date desc, compute running balance ────────────────
    const allEvents = [
      ...salesEvents,
      ...purchaseEvents,
      ...returnEvents,
      ...adjustmentEvents,
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    // Compute running balance (forward pass, then reverse for display)
    // Get current stock qty as the starting point
    const currentStock = await shopDb.collection("stock").findOne({ productId });
    let balance = currentStock?.currentQty ?? 0;

    // Walk events oldest→newest to compute running balance
    const sorted = [...allEvents].sort((a, b) => new Date(a.date) - new Date(b.date));
    const withBalance = [];
    let runningQty = balance;
    // Reverse: start from current and subtract/add backwards
    // Simpler: just tag each event with the balance AFTER the event
    // We'll compute forward from 0 and offset by current
    let cumulative = 0;
    for (const ev of sorted) {
      cumulative += (ev.qtyChange || 0);
      withBalance.push({ ...ev, _cumulative: cumulative });
    }
    // Offset so the last event's balance = currentQty
    const offset = balance - cumulative;
    const withFinalBalance = withBalance.map((ev) => ({
      ...ev,
      runningBalance: ev._cumulative + offset,
      _cumulative: undefined,
    }));

    // Sort desc for display
    withFinalBalance.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Paginate
    const total = withFinalBalance.length;
    const pageNum = parseInt(page);
    const limitNum = Math.min(parseInt(limit), 200);
    const skip = (pageNum - 1) * limitNum;
    const paginated = withFinalBalance.slice(skip, skip + limitNum);

    res.json({
      success: true,
      productName: product.name,
      productSku: product.sku,
      currentQty: balance,
      data: paginated,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  }),
);

/**
 * POST /api/stock/:productId/adjust
 * Enhanced stock adjustment — supports add, subtract, set_exact.
 * Creates audit log entry. Atomic update.
 *
 * @swagger
 * /api/stock/{productId}/adjust:
 *   post:
 *     summary: Adjust stock (enhanced — add/subtract/set_exact)
 *     description: |
 *       Performs an atomic stock adjustment. Supports three modes:
 *       - add: stock.qty += quantity
 *       - subtract: stock.qty -= quantity (min 0)
 *       - set_exact: stock.qty = quantity
 *       Creates an audit log entry and a stock_adjustments record.
 *       Requires MANAGE_PRODUCTS permission (SHOP_ADMIN+).
 *     tags: [Stock]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [adjustmentType, quantity, reason]
 *             properties:
 *               adjustmentType:
 *                 type: string
 *                 enum: [add, subtract, set_exact]
 *                 example: add
 *               quantity:
 *                 type: number
 *                 minimum: 0
 *                 example: 50
 *               reason:
 *                 type: string
 *                 enum: [Damage, Expiry Write-off, Theft, Count Correction, Supplier Return, Opening Stock, Other]
 *                 example: Count Correction
 *               batchNo:
 *                 type: string
 *                 example: BATCH-2024-001
 *               expiryDate:
 *                 type: string
 *                 format: date
 *               note:
 *                 type: string
 *                 description: Required when reason = Other
 *     responses:
 *       200:
 *         description: Stock adjusted successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.post(
  "/:productId/adjust",
  requirePermission(PERMISSIONS.MANAGE_PRODUCTS),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const { adjustmentType, quantity, reason, batchNo, expiryDate, note } = req.body;

    // Validate
    const validTypes = ["add", "subtract", "set_exact"];
    if (!adjustmentType || !validTypes.includes(adjustmentType)) {
      throw createError.badRequest(`adjustmentType must be one of: ${validTypes.join(", ")}`);
    }
    if (quantity === undefined || quantity === null || isNaN(parseFloat(quantity)) || parseFloat(quantity) < 0) {
      throw createError.badRequest("quantity must be a non-negative number");
    }
    const validReasons = ["Damage", "Expiry Write-off", "Theft", "Count Correction", "Supplier Return", "Opening Stock", "Other"];
    if (!reason || !validReasons.includes(reason)) {
      throw createError.badRequest(`reason must be one of: ${validReasons.join(", ")}`);
    }
    if (reason === "Other" && !note?.trim()) {
      throw createError.badRequest("note is required when reason is Other");
    }

    let productId;
    try {
      productId = new ObjectId(req.params.productId);
    } catch {
      throw createError.badRequest("Invalid product ID");
    }

    // Fetch product and current stock
    const [product, currentStock] = await Promise.all([
      shopDb.collection("products").findOne({ _id: productId }),
      shopDb.collection("stock").findOne({ productId }),
    ]);

    if (!product) throw createError.notFound("Product not found");
    if (!currentStock) throw createError.notFound("Stock record not found for this product");

    const qty = parseFloat(quantity);
    const prevQty = currentStock.currentQty ?? 0;

    // Calculate new quantity
    let newQty;
    if (adjustmentType === "add") {
      newQty = prevQty + qty;
    } else if (adjustmentType === "subtract") {
      newQty = Math.max(0, prevQty - qty);
    } else {
      // set_exact
      newQty = qty;
    }

    const reorderPoint = currentStock.reorderPoint ?? product.reorderPoint ?? product.minStockLevel ?? 0;
    const isLowStock = newQty <= reorderPoint;

    // ── Atomic update ─────────────────────────────────────────────────────
    const stockUpdate = {
      currentQty: newQty,
      availableQty: newQty,
      isLowStock,
      lastUpdated: new Date(),
    };
    if (batchNo !== undefined) stockUpdate.batchNo = batchNo;
    if (expiryDate !== undefined) stockUpdate.expiryDate = expiryDate ? new Date(expiryDate) : null;

    await shopDb.collection("stock").updateOne(
      { productId },
      { $set: stockUpdate },
    );

    // ── Adjustment record ─────────────────────────────────────────────────
    const qtyChange = adjustmentType === "subtract" ? -(prevQty - newQty) : newQty - prevQty;
    const adjustmentRecord = {
      productId,
      productName: product.name,
      adjustmentType,
      type: adjustmentType === "subtract" ? "subtract" : "add",
      quantity: qty,
      qtyChange,
      previousQuantity: prevQty,
      newQuantity: newQty,
      reason,
      note: note || "",
      batchNo: batchNo || currentStock.batchNo || "",
      expiryDate: expiryDate ? new Date(expiryDate) : (currentStock.expiryDate || null),
      adjustedBy: req.user._id,
      adjustedByName: req.user.name,
      adjustedAt: new Date(),
      createdAt: new Date(),
    };

    await shopDb.collection("stock_adjustments").insertOne(adjustmentRecord);

    // ── Audit log ─────────────────────────────────────────────────────────
    try {
      const auditLog = require("../services/audit-log.service");
      const { AUDIT_ACTIONS } = require("../models/audit-log.schema");
      auditLog.log(
        req,
        AUDIT_ACTIONS.STOCK_ADJUSTED,
        "stock",
        req.params.productId,
        `Stock ${adjustmentType} for "${product.name}": ${prevQty} → ${newQty} (${qtyChange >= 0 ? "+" : ""}${qtyChange}). Reason: ${reason}`,
        {
          before: { currentQty: prevQty },
          after: { currentQty: newQty, adjustmentType, reason, note: note || "" },
        },
      );
    } catch (_) { /* never block the response */ }

    logger.info(`Stock adjusted: product=${product.name}, ${adjustmentType}, ${prevQty}→${newQty}, reason=${reason}`);

    res.json({
      success: true,
      message: `Stock ${adjustmentType === "set_exact" ? "set to" : adjustmentType === "add" ? "increased by" : "decreased by"} ${qty} successfully`,
      data: {
        productName: product.name,
        previousQty: prevQty,
        newQty,
        qtyChange,
        adjustmentType,
        reason,
      },
    });
  }),
);

module.exports = router;