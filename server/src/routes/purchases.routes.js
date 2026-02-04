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

// Apply authentication to all routes
router.use(authenticate);
router.use(checkShopStatus);

/**
 * GET /api/purchases
 * Get all purchases for the shop
 */
router.get(
  "/",
  requirePermission(PERMISSIONS.READ_PURCHASES),
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
      matchQuery.supplierId = new ObjectId(supplierId);
    }

    const pipeline = [
      { $match: matchQuery },
      {
        $lookup: {
          from: "suppliers",
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
  requirePermission(PERMISSIONS.READ_PURCHASES),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);

    const purchase = await shopDb
      .collection("purchases")
      .aggregate([
        { $match: { _id: new ObjectId(req.params.id) } },
        {
          $lookup: {
            from: "suppliers",
            localField: "supplierId",
            foreignField: "_id",
            as: "supplier",
          },
        },
        { $unwind: "$supplier" },
        {
          $lookup: {
            from: "users",
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
        .findOne({ _id: new ObjectId(item.productId) });
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
  requirePermission(PERMISSIONS.CREATE_PURCHASES),
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
      .findOne({ _id: new ObjectId(supplierId) });

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
        .findOne({ _id: new ObjectId(productId) });

      if (!product) {
        throw createError.badRequest(`Product not found: ${productId}`);
      }

      const totalCost = parseFloat(qty) * parseFloat(unitCost);
      grandTotal += totalCost;

      validatedItems.push({
        productId: new ObjectId(productId),
        qty: parseInt(qty),
        unitCost: parseFloat(unitCost),
        totalCost,
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

    const purchaseData = {
      supplierId: new ObjectId(supplierId),
      invoiceNo: finalInvoiceNo,
      items: validatedItems,
      grandTotal: parseFloat(grandTotal.toFixed(2)),
      purchaseDate: new Date(purchaseDate),
      notes: notes?.trim() || null,
      status: "pending", // pending, received, cancelled
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: new ObjectId(req.user.id),
    };

    const result = await shopDb.collection("purchases").insertOne(purchaseData);

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
 */
router.put(
  "/:id/receive",
  requirePermission(PERMISSIONS.UPDATE_PURCHASES),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const { receivedItems, notes } = req.body;

    // Get purchase order
    const purchase = await shopDb
      .collection("purchases")
      .findOne({ _id: new ObjectId(req.params.id) });

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

    // Update stock for each received item
    for (let item of itemsToReceive) {
      const productId = item.productId || item.productId;
      const receivedQty = item.receivedQty || item.qty;

      // Get current stock
      let currentStock = await shopDb
        .collection("stock")
        .findOne({ productId: new ObjectId(productId) });

      if (!currentStock) {
        // Create new stock record
        const product = await shopDb
          .collection("products")
          .findOne({ _id: new ObjectId(productId) });

        currentStock = {
          productId: new ObjectId(productId),
          currentQty: 0,
          availableQty: 0,
          reservedQty: 0,
          isLowStock: true,
          lastUpdated: new Date(),
        };

        await shopDb.collection("stock").insertOne(currentStock);
      }

      // Update stock quantity
      const newQuantity = currentStock.currentQty + parseInt(receivedQty);
      const product = await shopDb
        .collection("products")
        .findOne({ _id: new ObjectId(productId) });

      const isLowStock = newQuantity <= (product?.minStockLevel || 0);

      await shopDb.collection("stock").updateOne(
        { productId: new ObjectId(productId) },
        {
          $set: {
            currentQty: newQuantity,
            availableQty: newQuantity - (currentStock.reservedQty || 0),
            isLowStock,
            lastUpdated: new Date(),
            lastPurchaseDate: new Date(),
            updatedBy: new ObjectId(req.user.id),
          },
        },
      );

      // Update product's purchase price if provided
      if (item.unitCost) {
        await shopDb.collection("products").updateOne(
          { _id: new ObjectId(productId) },
          {
            $set: {
              purchasePrice: parseFloat(item.unitCost),
              updatedAt: new Date(),
            },
          },
        );
      }
    }

    // Update purchase status
    await shopDb.collection("purchases").updateOne(
      { _id: new ObjectId(req.params.id) },
      {
        $set: {
          status: "received",
          receivedAt: new Date(),
          receivedBy: new ObjectId(req.user.id),
          receivedItems: itemsToReceive,
          receivingNotes: notes?.trim() || null,
          updatedAt: new Date(),
        },
      },
    );

    res.json({
      success: true,
      message: "Purchase order received and stock updated successfully",
    });
  }),
);

/**
 * PUT /api/purchases/:id/cancel
 * Cancel purchase order
 */
router.put(
  "/:id/cancel",
  requirePermission(PERMISSIONS.UPDATE_PURCHASES),
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
          cancelledBy: new ObjectId(req.user.id),
          cancellationReason: reason?.trim() || null,
          updatedAt: new Date(),
        },
      },
    );

    res.json({
      success: true,
      message: "Purchase order cancelled successfully",
    });
  }),
);

module.exports = router;
