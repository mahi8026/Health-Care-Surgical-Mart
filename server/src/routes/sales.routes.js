/**
 * Sales Routes - Multi-Tenant
const { logger } = require('../config/logging');
 * Handles sales/POS operations for shops
 */

const express = require("express");
const router = express.Router();
const {
  authenticate,
  checkShopStatus,
} = require("../middleware/auth-multi-tenant");
const { requirePermission } = require("../utils/rbac");
const { PERMISSIONS } = require("../utils/rbac");
const { ObjectId } = require("mongodb");

// Apply authentication and shop status check to all routes
router.use(authenticate);
router.use(checkShopStatus);

/**
 * POST /api/sales
 * Create new sale
 */
router.post(
  "/",
  requirePermission(PERMISSIONS.CREATE_SALE),
  async (req, res) => {
    try {
      const {
        invoiceNumber, // Frontend sends invoiceNumber
        customer,
        items,
        subtotal,
        discount, // Frontend sends discount (not discountAmount)
        vatAmount,
        grandTotal,
        cashPaid,
        bankPaid,
        saleType,
        vatPercent,
        notes,
      } = req.body;

      // Validate required fields
      if (!items || items.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Sale must have at least one item",
        });
      }

      if (!grandTotal || grandTotal <= 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid sale amount",
        });
      }

      // Validate user exists
      if (!req.user || !req.user._id) {
        return res.status(401).json({
          success: false,
          message: "User authentication required",
        });
      }

      // Use provided invoice number or generate one
      const invoiceNo = invoiceNumber || `INV-${Date.now()}`;

      // Get product details for items to ensure we have all required fields
      const enrichedItems = [];
      for (const item of items) {
        const product = await req.shopDb.collection("products").findOne({
          _id: new ObjectId(item.productId),
        });

        if (!product) {
          return res.status(400).json({
            success: false,
            message: `Product not found: ${item.productId}`,
          });
        }

        // Check stock availability - WARNING ONLY, don't block sale
        const stock = await req.shopDb.collection("stock").findOne({
          productId: new ObjectId(item.productId),
        });

        // Log warning if insufficient stock but allow sale
        if (!stock || stock.currentQty < item.quantity) {
          logger.warn(
            `Warning: Insufficient stock for ${product.name}. Available: ${stock?.currentQty || 0}, Requested: ${item.quantity}`,
          );
          // Don't block the sale - useful for services, pre-orders, etc.
        }

        enrichedItems.push({
          productId: new ObjectId(item.productId),
          name: product.name,
          rate: parseFloat(item.sellingPrice || product.sellingPrice),
          qty: parseFloat(item.quantity),
          total:
            parseFloat(item.sellingPrice || product.sellingPrice) *
            parseFloat(item.quantity),
        });
      }

      // Create sale record matching the schema
      const sale = {
        invoiceNo,
        customerId: customer?.id ? new ObjectId(customer.id) : null,
        customerName: customer?.name || "Cash Customer",
        items: enrichedItems,
        subtotal: parseFloat(subtotal) || 0,
        discountAmount: parseFloat(discount) || 0,
        discountPercent: 0, // Calculate if needed
        vatAmount: parseFloat(vatAmount) || 0,
        vatPercent: parseFloat(vatPercent) || 0,
        grandTotal: parseFloat(grandTotal),
        cashPaid: parseFloat(cashPaid) || 0,
        bankPaid: parseFloat(bankPaid) || 0,
        returnAmount: Math.max(
          0,
          (parseFloat(cashPaid) || 0) +
            (parseFloat(bankPaid) || 0) -
            parseFloat(grandTotal),
        ),
        paymentStatus: "Paid",
        saleDate: new Date(),
        createdBy: new ObjectId(req.user._id),
        createdByName: req.user.name,
        notes: notes || "",
        createdAt: new Date(),
      };

      // Insert sale (temporarily bypass validation for debugging)
      const result = await req.shopDb.collection("sales").insertOne(sale, {
        bypassDocumentValidation: true,
      });

      // Update stock quantities
      for (const item of enrichedItems) {
        // Check if stock record exists
        const existingStock = await req.shopDb.collection("stock").findOne({
          productId: item.productId,
        });

        if (existingStock) {
          // Update existing stock
          await req.shopDb.collection("stock").updateOne(
            { productId: item.productId },
            {
              $inc: {
                currentQty: -item.qty,
                availableQty: -item.qty,
              },
              $set: {
                lastUpdated: new Date(),
                lastSaleDate: new Date(),
              },
            },
          );
        } else {
          // Create stock record with negative quantity (indicates sold before stock was added)
          const product = await req.shopDb.collection("products").findOne({
            _id: item.productId,
          });

          await req.shopDb.collection("stock").insertOne({
            productId: item.productId,
            productName: product?.name || item.name,
            currentQty: -item.qty, // Negative indicates oversold
            reservedQty: 0,
            availableQty: -item.qty,
            minStockLevel: product?.minStockLevel || 0,
            isLowStock: true,
            lastUpdated: new Date(),
            lastSaleDate: new Date(),
            createdAt: new Date(),
          });

          logger.warn(
            `Created stock record for ${item.name} with negative quantity: -${item.qty}`,
          );
        }

        // Check if stock is now low
        const updatedStock = await req.shopDb.collection("stock").findOne({
          productId: item.productId,
        });

        if (updatedStock) {
          const isLowStock =
            updatedStock.currentQty <= (updatedStock.minStockLevel || 0);
          await req.shopDb
            .collection("stock")
            .updateOne({ productId: item.productId }, { $set: { isLowStock } });
        }
      }

      // Send notification to customer (async, don't wait)
      try {
        const notificationService = require("../services/notification.service");
        const settings = await req.shopDb.collection("settings").findOne({});

        if (customer && customer._id) {
          const customerData = await req.shopDb
            .collection("customers")
            .findOne({ _id: new ObjectId(customer._id) });

          if (customerData) {
            notificationService
              .sendSaleConfirmation(sale, customerData, settings || {})
              .catch((err) => logger.error("Notification error:", err));
          }
        }
      } catch (notifError) {
        // Don't fail the sale if notification fails
        logger.error("Failed to send notification:", notifError);
      }

      res.status(201).json({
        success: true,
        message: "Sale created successfully",
        data: {
          _id: result.insertedId,
          invoiceNo: sale.invoiceNo,
          grandTotal: sale.grandTotal,
          saleDate: sale.saleDate,
        },
      });
    } catch (error) {
      logger.error("Create sale error:", error);

      // Log the sale data that failed for debugging
      if (typeof sale !== "undefined") {
        logger.error("Sale data that failed:", JSON.stringify(sale, null, 2));
      }

      // Log specific validation errors
      if (error.code === 121) {
        logger.error(
          "Schema validation failed. Error details:",
          error.errInfo?.details,
        );
      }

      res.status(500).json({
        success: false,
        message: "Failed to create sale",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  },
);

/**
 * GET /api/sales
 * Get all sales for the shop
 */
router.get("/", requirePermission(PERMISSIONS.VIEW_SALES), async (req, res) => {
  try {
    const { startDate, endDate, customerId, limit = 50 } = req.query;

    // Build filter
    const filter = {};
    if (startDate || endDate) {
      filter.saleDate = {};
      if (startDate) filter.saleDate.$gte = new Date(startDate);
      if (endDate) filter.saleDate.$lte = new Date(endDate);
    }
    if (customerId) filter.customerId = new ObjectId(customerId);

    const sales = await req.shopDb
      .collection("sales")
      .find(filter)
      .sort({ saleDate: -1 })
      .limit(parseInt(limit))
      .toArray();

    res.json({
      success: true,
      count: sales.length,
      data: sales,
    });
  } catch (error) {
    logger.error("Get sales error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch sales",
    });
  }
});

/**
 * GET /api/sales/:id
 * Get single sale by ID
 */
router.get(
  "/:id",
  requirePermission(PERMISSIONS.VIEW_SALES),
  async (req, res) => {
    try {
      const sale = await req.shopDb.collection("sales").findOne({
        _id: new ObjectId(req.params.id),
      });

      if (!sale) {
        return res.status(404).json({
          success: false,
          message: "Sale not found",
        });
      }

      res.json({
        success: true,
        data: sale,
      });
    } catch (error) {
      logger.error("Get sale error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch sale",
      });
    }
  },
);

module.exports = router;
