/**
 * Returns Routes - Multi-Tenant
 * Handles sale returns and refunds for medical stores
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
 * GET /api/returns
 * Get all returns for the shop
 */
router.get(
  "/",
  requirePermission(PERMISSIONS.VIEW_RETURNS),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const { page = 1, limit = 20, search = "", status = "" } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const searchQuery = {};

    // Add search filter
    if (search) {
      searchQuery.$or = [
        { returnNumber: { $regex: search, $options: "i" } },
        { originalInvoiceNumber: { $regex: search, $options: "i" } },
        { "customer.name": { $regex: search, $options: "i" } },
      ];
    }

    // Add status filter
    if (status) {
      searchQuery.status = status;
    }

    const returns = await shopDb
      .collection("returns")
      .find(searchQuery)
      .sort({ returnDate: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();

    const total = await shopDb
      .collection("returns")
      .countDocuments(searchQuery);

    res.json({
      success: true,
      data: returns,
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
 * GET /api/returns/:id
 * Get return by ID
 */
router.get(
  "/:id",
  requirePermission(PERMISSIONS.VIEW_RETURNS),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);

    const returnRecord = await shopDb
      .collection("returns")
      .findOne({ _id: new ObjectId(req.params.id) });

    if (!returnRecord) {
      throw createError.notFound("Return record not found");
    }

    res.json({
      success: true,
      data: returnRecord,
    });
  }),
);

/**
 * GET /api/returns/sale/:saleId
 * Get original sale details for return processing
 */
router.get(
  "/sale/:saleId",
  requirePermission(PERMISSIONS.VIEW_RETURNS),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);

    const sale = await shopDb
      .collection("sales")
      .findOne({ _id: new ObjectId(req.params.saleId) });

    if (!sale) {
      throw createError.notFound("Original sale not found");
    }

    // Check if any returns already exist for this sale
    const existingReturns = await shopDb
      .collection("returns")
      .find({ originalSaleId: req.params.saleId })
      .toArray();

    // Calculate returned quantities for each item
    const returnedQuantities = {};
    existingReturns.forEach((returnRecord) => {
      if (returnRecord.status !== "cancelled") {
        returnRecord.items.forEach((item) => {
          const key = item.productId.toString();
          returnedQuantities[key] =
            (returnedQuantities[key] || 0) + item.returnQuantity;
        });
      }
    });

    // Add returnable quantities to sale items
    const saleWithReturnInfo = {
      ...sale,
      items: sale.items.map((item) => ({
        ...item,
        returnedQuantity: returnedQuantities[item.productId.toString()] || 0,
        returnableQuantity:
          item.qty - (returnedQuantities[item.productId.toString()] || 0),
      })),
      existingReturns,
    };

    res.json({
      success: true,
      data: saleWithReturnInfo,
    });
  }),
);

/**
 * POST /api/returns
 * Create new return
 */
router.post(
  "/",
  requirePermission(PERMISSIONS.CREATE_RETURN),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const {
      originalSaleId,
      originalInvoiceNumber,
      customer,
      items,
      returnReason,
      returnType, // 'full' or 'partial'
      refundMethod, // 'cash', 'bank', 'store_credit'
      notes,
    } = req.body;

    // Validate required fields
    if (!originalSaleId || !items || items.length === 0) {
      throw createError.badRequest(
        "Original sale ID and return items are required",
      );
    }

    if (!returnReason) {
      throw createError.badRequest("Return reason is required");
    }

    // Verify original sale exists
    const originalSale = await shopDb
      .collection("sales")
      .findOne({ _id: new ObjectId(originalSaleId) });

    if (!originalSale) {
      throw createError.notFound("Original sale not found");
    }

    // Validate return items and quantities
    const returnItems = [];
    let totalReturnAmount = 0;

    for (const returnItem of items) {
      const {
        productId,
        returnQuantity,
        returnReason: itemReason,
      } = returnItem;

      if (!productId || !returnQuantity || returnQuantity <= 0) {
        throw createError.badRequest("Invalid return item data");
      }

      // Find the original sale item
      const originalItem = originalSale.items.find(
        (item) => item.productId.toString() === productId.toString(),
      );

      if (!originalItem) {
        throw createError.badRequest(
          `Product ${productId} not found in original sale`,
        );
      }

      // Check if return quantity is valid
      const existingReturns = await shopDb
        .collection("returns")
        .find({
          originalSaleId: originalSaleId,
          "items.productId": new ObjectId(productId),
          status: { $ne: "cancelled" },
        })
        .toArray();

      let totalReturnedQty = 0;
      existingReturns.forEach((returnRecord) => {
        const returnedItem = returnRecord.items.find(
          (item) => item.productId.toString() === productId.toString(),
        );
        if (returnedItem) {
          totalReturnedQty += returnedItem.returnQuantity;
        }
      });

      const availableForReturn = originalItem.qty - totalReturnedQty;
      if (returnQuantity > availableForReturn) {
        throw createError.badRequest(
          `Cannot return ${returnQuantity} units of ${originalItem.name}. Only ${availableForReturn} units available for return.`,
        );
      }

      // Get current product details for stock restoration
      const product = await shopDb
        .collection("products")
        .findOne({ _id: new ObjectId(productId) });

      if (!product) {
        throw createError.badRequest(`Product ${productId} not found`);
      }

      const itemReturnAmount = originalItem.price * returnQuantity;
      totalReturnAmount += itemReturnAmount;

      returnItems.push({
        productId: new ObjectId(productId),
        name: originalItem.name,
        sku: originalItem.sku,
        originalQuantity: originalItem.qty,
        returnQuantity: parseInt(returnQuantity),
        price: originalItem.price,
        total: itemReturnAmount,
        returnReason: itemReason || returnReason,
        batchNumber: originalItem.batchNumber || null,
        expiryDate: originalItem.expiryDate || null,
      });
    }

    // Generate return number
    const returnCount =
      (await shopDb.collection("returns").countDocuments({})) + 1;
    const returnNumber = `RET-${Date.now()}-${returnCount.toString().padStart(4, "0")}`;

    // Calculate refund amounts based on original sale proportions
    const originalSubtotal = originalSale.subtotal || originalSale.grandTotal;
    const returnRatio = totalReturnAmount / originalSubtotal;

    const refundDiscount = (originalSale.discount || 0) * returnRatio;
    const refundVAT = (originalSale.vatAmount || 0) * returnRatio;
    const totalRefundAmount = totalReturnAmount - refundDiscount + refundVAT;

    // Create return record
    const returnData = {
      returnNumber,
      originalSaleId: originalSaleId,
      originalInvoiceNumber:
        originalInvoiceNumber || originalSale.invoiceNumber,
      customer: customer || originalSale.customer,
      items: returnItems,
      returnReason,
      returnType,
      refundMethod: refundMethod || "cash",
      subtotal: totalReturnAmount,
      discount: refundDiscount,
      vatAmount: refundVAT,
      totalRefund: totalRefundAmount,
      status: "completed", // 'pending', 'completed', 'cancelled'
      returnDate: new Date(),
      notes: notes || "",
      createdBy: req.user.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Start transaction-like operations
    try {
      // Insert return record
      const result = await shopDb.collection("returns").insertOne(returnData);

      // Update stock quantities for returned items
      for (const item of returnItems) {
        await shopDb.collection("stock").updateOne(
          { productId: item.productId },
          {
            $inc: {
              currentQty: item.returnQuantity,
              availableQty: item.returnQuantity,
            },
            $set: {
              lastUpdated: new Date(),
              updatedBy: req.user.id,
            },
          },
        );

        // Log stock movement
        await shopDb.collection("stock_movements").insertOne({
          productId: item.productId,
          productName: item.name,
          movementType: "return",
          quantity: item.returnQuantity,
          previousQty: 0, // Will be updated by stock service
          newQty: 0, // Will be updated by stock service
          referenceType: "return",
          referenceId: result.insertedId.toString(),
          referenceNumber: returnNumber,
          notes: `Return from sale ${originalInvoiceNumber}`,
          createdBy: req.user.id,
          createdAt: new Date(),
        });
      }

      // Update original sale with return reference
      await shopDb.collection("sales").updateOne(
        { _id: new ObjectId(originalSaleId) },
        {
          $push: {
            returns: {
              returnId: result.insertedId,
              returnNumber,
              returnDate: new Date(),
              returnAmount: totalRefundAmount,
            },
          },
          $set: { updatedAt: new Date() },
        },
      );

      res.status(201).json({
        success: true,
        message: "Return processed successfully",
        data: {
          _id: result.insertedId,
          ...returnData,
        },
      });
    } catch (error) {
      // If any operation fails, we should ideally rollback
      // For now, log the error and throw
      console.error("Return processing error:", error);
      throw createError.internalServerError("Failed to process return");
    }
  }),
);

/**
 * PUT /api/returns/:id/status
 * Update return status (cancel, approve, etc.)
 */
router.put(
  "/:id/status",
  requirePermission(PERMISSIONS.EDIT_RETURN),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const { status, notes } = req.body;

    if (!["pending", "completed", "cancelled"].includes(status)) {
      throw createError.badRequest("Invalid status");
    }

    const returnRecord = await shopDb
      .collection("returns")
      .findOne({ _id: new ObjectId(req.params.id) });

    if (!returnRecord) {
      throw createError.notFound("Return record not found");
    }

    // If cancelling a completed return, restore stock
    if (status === "cancelled" && returnRecord.status === "completed") {
      for (const item of returnRecord.items) {
        await shopDb.collection("stock").updateOne(
          { productId: item.productId },
          {
            $inc: {
              currentQty: -item.returnQuantity,
              availableQty: -item.returnQuantity,
            },
            $set: {
              lastUpdated: new Date(),
              updatedBy: req.user.id,
            },
          },
        );
      }
    }

    // If completing a pending return, update stock
    if (status === "completed" && returnRecord.status === "pending") {
      for (const item of returnRecord.items) {
        await shopDb.collection("stock").updateOne(
          { productId: item.productId },
          {
            $inc: {
              currentQty: item.returnQuantity,
              availableQty: item.returnQuantity,
            },
            $set: {
              lastUpdated: new Date(),
              updatedBy: req.user.id,
            },
          },
        );
      }
    }

    await shopDb.collection("returns").updateOne(
      { _id: new ObjectId(req.params.id) },
      {
        $set: {
          status,
          notes: notes || returnRecord.notes,
          updatedAt: new Date(),
          updatedBy: req.user.id,
        },
      },
    );

    res.json({
      success: true,
      message: "Return status updated successfully",
    });
  }),
);

/**
 * GET /api/returns/stats/summary
 * Get return statistics
 */
router.get(
  "/stats/summary",
  requirePermission(PERMISSIONS.VIEW_RETURNS),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);

    const today = new Date();
    const startOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // Get return statistics
    const [todayReturns, monthlyReturns, totalReturns, returnsByReason] =
      await Promise.all([
        // Today's returns
        shopDb
          .collection("returns")
          .aggregate([
            {
              $match: {
                returnDate: { $gte: startOfDay },
                status: "completed",
              },
            },
            {
              $group: {
                _id: null,
                totalReturns: { $sum: 1 },
                totalAmount: { $sum: "$totalRefund" },
              },
            },
          ])
          .toArray(),

        // Monthly returns
        shopDb
          .collection("returns")
          .aggregate([
            {
              $match: {
                returnDate: { $gte: startOfMonth },
                status: "completed",
              },
            },
            {
              $group: {
                _id: null,
                totalReturns: { $sum: 1 },
                totalAmount: { $sum: "$totalRefund" },
              },
            },
          ])
          .toArray(),

        // Total returns
        shopDb.collection("returns").countDocuments({ status: "completed" }),

        // Returns by reason
        shopDb
          .collection("returns")
          .aggregate([
            {
              $match: { status: "completed" },
            },
            {
              $group: {
                _id: "$returnReason",
                count: { $sum: 1 },
                totalAmount: { $sum: "$totalRefund" },
              },
            },
            {
              $sort: { count: -1 },
            },
          ])
          .toArray(),
      ]);

    const stats = {
      today: {
        returns: todayReturns[0]?.totalReturns || 0,
        amount: todayReturns[0]?.totalAmount || 0,
      },
      monthly: {
        returns: monthlyReturns[0]?.totalReturns || 0,
        amount: monthlyReturns[0]?.totalAmount || 0,
      },
      total: totalReturns,
      byReason: returnsByReason,
    };

    res.json({
      success: true,
      data: stats,
    });
  }),
);

module.exports = router;
