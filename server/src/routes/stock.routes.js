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
  requirePermission(PERMISSIONS.READ_STOCK),
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
 * GET /api/stock/low-stock
 * Get items with low stock
 */
router.get(
  "/low-stock",
  requirePermission(PERMISSIONS.READ_STOCK),
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
  requirePermission(PERMISSIONS.READ_STOCK),
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
  requirePermission(PERMISSIONS.UPDATE_STOCK),
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
  requirePermission(PERMISSIONS.READ_STOCK),
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

module.exports = router;
