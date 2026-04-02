/**
 * Sales Controller
 * Handles business logic for sales/POS operations
 */

const { ObjectId } = require("mongodb");
const { logger } = require("../config/logging");
const EmailService = require("../services/email/email.service");

class SalesController {
  /**
   * Create new sale
   */
  async createSale(req, res) {
    try {
      const {
        invoiceNumber,
        customer,
        items,
        subtotal,
        discount,
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

      // Enrich items with product details
      const enrichedItems = await this._enrichSaleItems(req.shopDb, items);

      // Create sale record
      const sale = this._buildSaleRecord({
        invoiceNo,
        customer,
        enrichedItems,
        subtotal,
        discount,
        vatAmount,
        vatPercent,
        grandTotal,
        cashPaid,
        bankPaid,
        notes,
        user: req.user,
      });

      // Insert sale
      const result = await req.shopDb.collection("sales").insertOne(sale, {
        bypassDocumentValidation: true,
      });

      // Update stock quantities
      await this._updateStockForSale(req.shopDb, enrichedItems);

      // Send notification (async, don't wait) - wrapped in try-catch
      setImmediate(() => {
        this._sendSaleNotification(req.shopDb, sale, customer).catch((err) =>
          logger.error("Notification error:", err),
        );
      });

      // Send response immediately
      return res.status(201).json({
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

      if (error.code === 121) {
        logger.error(
          "Schema validation failed:",
          error.errInfo?.details,
        );
      }

      return res.status(500).json({
        success: false,
        message: error.message || "Failed to create sale",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }

  /**
   * Get all sales for the shop
   */
  async getSales(req, res) {
    try {
      const { startDate, endDate, customerId, limit = 50 } = req.query;

      // Build filter
      const filter = this._buildSalesFilter({ startDate, endDate, customerId });

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
  }

  /**
   * Get single sale by ID
   */
  async getSaleById(req, res) {
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
  }

  // ==================== Private Helper Methods ====================

  /**
   * Enrich sale items with product details
   */
  async _enrichSaleItems(shopDb, items) {
    const enrichedItems = [];

    for (const item of items) {
      const product = await shopDb.collection("products").findOne({
        _id: new ObjectId(item.productId),
      });

      if (!product) {
        throw new Error(`Product not found: ${item.productId}`);
      }

      // Check stock availability - WARNING ONLY
      const stock = await shopDb.collection("stock").findOne({
        productId: new ObjectId(item.productId),
      });

      if (!stock || stock.currentQty < item.quantity) {
        logger.warn(
          `Warning: Insufficient stock for ${product.name}. Available: ${stock?.currentQty || 0}, Requested: ${item.quantity}`,
        );
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

    return enrichedItems;
  }

  /**
   * Build sale record object
   */
  _buildSaleRecord({
    invoiceNo,
    customer,
    enrichedItems,
    subtotal,
    discount,
    vatAmount,
    vatPercent,
    grandTotal,
    cashPaid,
    bankPaid,
    notes,
    user,
  }) {
    return {
      invoiceNo,
      customerId: customer?.id ? new ObjectId(customer.id) : null,
      customerName: customer?.name || "Cash Customer",
      items: enrichedItems,
      subtotal: parseFloat(subtotal) || 0,
      discountAmount: parseFloat(discount) || 0,
      discountPercent: 0,
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
      createdBy: new ObjectId(user._id),
      createdByName: user.name,
      notes: notes || "",
      createdAt: new Date(),
    };
  }

  /**
   * Update stock quantities after sale
   */
  async _updateStockForSale(shopDb, enrichedItems) {
    for (const item of enrichedItems) {
      const existingStock = await shopDb.collection("stock").findOne({
        productId: item.productId,
      });

      if (existingStock) {
        // Update existing stock
        await shopDb.collection("stock").updateOne(
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
        // Create stock record with negative quantity
        const product = await shopDb.collection("products").findOne({
          _id: item.productId,
        });

        await shopDb.collection("stock").insertOne({
          productId: item.productId,
          productName: product?.name || item.name,
          currentQty: -item.qty,
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

      // Update low stock flag
      const updatedStock = await shopDb.collection("stock").findOne({
        productId: item.productId,
      });

      if (updatedStock) {
        const isLowStock =
          updatedStock.currentQty <= (updatedStock.minStockLevel || 0);
        await shopDb
          .collection("stock")
          .updateOne({ productId: item.productId }, { $set: { isLowStock } });
      }
    }
  }

  /**
   * Send sale notification to customer
   */
  async _sendSaleNotification(shopDb, sale, customer) {
    try {
      if (!customer || !customer._id) {
        return;
      }

      const customerData = await shopDb
        .collection("customers")
        .findOne({ _id: new ObjectId(customer._id) });

      if (customerData && customerData.email) {
        await EmailService.send({
          to: customerData.email,
          subject: `Order Confirmation - Invoice #${sale.invoiceNo}`,
          templateName: "order_confirmation",
          variables: {
            customerName: customerData.name,
            invoiceNo: sale.invoiceNo,
            saleDate: sale.saleDate.toLocaleDateString(),
            grandTotal: sale.grandTotal,
            items: sale.items,
          },
        });
      }
    } catch (error) {
      // Don't fail the sale if notification fails
      logger.error("Failed to send sale notification:", error);
    }
  }

  /**
   * Build filter for sales query
   */
  _buildSalesFilter({ startDate, endDate, customerId }) {
    const filter = {};

    if (startDate || endDate) {
      filter.saleDate = {};
      if (startDate) filter.saleDate.$gte = new Date(startDate);
      if (endDate) filter.saleDate.$lte = new Date(endDate);
    }

    if (customerId) {
      filter.customerId = new ObjectId(customerId);
    }

    return filter;
  }
}

module.exports = new SalesController();
