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

// Apply authentication to all routes
router.use(authenticate);
router.use(checkShopStatus);

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

    // Build aggregation pipeline
    const pipeline = [
      { $match: matchQuery },
      {
        $lookup: {
          from: "products",
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
          from: "products",
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

    const lowStockItems = await shopDb
      .collection("stock")
      .aggregate([
        { $match: { isLowStock: true } },
        {
          $lookup: {
            from: "products",
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

    const stockItem = await shopDb
      .collection("stock")
      .aggregate([
        { $match: { productId: new ObjectId(req.params.productId) } },
        {
          $lookup: {
            from: "products",
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

    const adjustments = await shopDb
      .collection("stock_adjustments")
      .aggregate([
        { $match: matchQuery },
        {
          $lookup: {
            from: "products",
            localField: "productId",
            foreignField: "_id",
            as: "product",
          },
        },
        { $unwind: "$product" },
        {
          $lookup: {
            from: "users",
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
