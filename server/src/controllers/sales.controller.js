/**
 * Sales Controller
 * Handles business logic for sales/POS operations
 */

const { ObjectId } = require('mongodb');
const { logger } = require('../config/logging');
const EmailService = require('../services/email/email.service');
const { cacheService } = require('../services/cache.service');
const { client: getMongoClient } = require('../config/database');

class SalesController {
  /**
   * Create new sale
   */
  async createSale(req, res) {
    try {
      const {
        invoiceNumber: _invoiceNumber, // Auto-generated, not used from input
        customer,
        customerType,
        items,
        subtotal,
        discount,
        vatAmount,
        grandTotal,
        cashPaid,
        bankPaid,
        saleType: _saleType, // Reserved for future use
        vatPercent,
        notes,
      } = req.body;

      // Validate required fields
      if (!items || items.length === 0) {
        return res.status(400).json({ success: false, message: 'Sale must have at least one item' });
      }
      if (!grandTotal || grandTotal <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid sale amount' });
      }
      if (!req.user || !req.user._id) {
        return res.status(401).json({ success: false, message: 'User authentication required' });
      }

      // -- Credit sale validation --------------------------------------------
      const paymentMethod = req.body.paymentMethod || 'cash';
      if (paymentMethod === 'credit') {
        if (!customer || !customer.id || !ObjectId.isValid(customer.id)) {
          return res.status(400).json({
            success: false,
            message: 'A customer must be selected for credit sales',
          });
        }

        const creditCustomer = await req.shopDb
          .collection('customers')
          .findOne({ _id: new ObjectId(customer.id) });

        if (!creditCustomer) {
          return res.status(404).json({ success: false, message: 'Customer not found' });
        }
        if (!creditCustomer.creditEnabled) {
          return res.status(400).json({
            success: false,
            message: `Credit is not enabled for ${creditCustomer.name}. Enable credit in customer settings first.`,
          });
        }

        const currentDue = creditCustomer.currentDue || 0;
        const creditLimit = creditCustomer.creditLimit || 0;
        const newDue = currentDue + parseFloat(grandTotal);

        if (newDue > creditLimit) {
          const available = Math.max(0, creditLimit - currentDue);
          return res.status(400).json({
            success: false,
            message: `Credit limit exceeded. Available credit: ?${available.toFixed(2)} (Limit: ?${creditLimit.toFixed(2)}, Current due: ?${currentDue.toFixed(2)})`,
          });
        }
      }

      // Generate sequential invoice number
      const invoiceNumberService = require('../services/invoice-number.service');
      const invoiceNo = await invoiceNumberService.generateInvoiceNumber(req.user.shopId);

      // Enrich items with product details (outside transaction � read-only)
      const enrichedItems = await this._enrichSaleItems(req.shopDb, items);

      // -- Server-side totals validation -------------------------------------
      // Recompute the total from the item prices we actually fetched, so a
      // tampered client payload cannot inflate sales amounts. Client values
      // are accepted only within a 1 Tk tolerance.
      const parsedSubtotal = parseFloat(subtotal) || 0;
      const parsedDiscount = parseFloat(discount) || 0;
      const parsedVat = parseFloat(vatAmount) || 0;
      const parsedGrandTotal = parseFloat(grandTotal) || 0;
      if (
        !isFinite(parsedSubtotal) ||
        !isFinite(parsedDiscount) ||
        !isFinite(parsedVat) ||
        !isFinite(parsedGrandTotal) ||
        parsedSubtotal < 0 ||
        parsedDiscount < 0 ||
        parsedVat < 0 ||
        parsedGrandTotal <= 0
      ) {
        return res.status(400).json({ success: false, message: 'Invalid sale amounts' });
      }
      const computedSubtotal = enrichedItems.reduce(
        (sum, it) => sum + (Number(it.rate) || 0) * (Number(it.qty) || 0),
        0,
      );
      const expectedTotal = Math.max(0, computedSubtotal - parsedDiscount + parsedVat);
      if (Math.abs(expectedTotal - parsedGrandTotal) > 1) {
        return res.status(400).json({
          success: false,
          message: `Sale total mismatch: expected ${expectedTotal.toFixed(2)}, received ${parsedGrandTotal.toFixed(2)}`,
        });
      }

      // Fetch customer's previous due balance before this sale
      let previousDue = 0;
      if (customer?.id) {
        try {
          const customerDoc = await req.shopDb.collection('customers').findOne(
            { _id: new ObjectId(customer.id) }
          );
          previousDue = customerDoc?.currentDue || 0;
        } catch (_) { /* non-blocking */ }
      }

      // Create sale record object
      const sale = this._buildSaleRecord({
        invoiceNo,
        customer,
        customerType,
        enrichedItems,
        subtotal,
        discount,
        vatAmount,
        vatPercent,
        grandTotal,
        cashPaid,
        bankPaid,
        paymentMethod: req.body.paymentMethod || 'cash',
        dueAmount: req.body.dueAmount,
        previousDue,
        notes,
        user: req.user,
      });

      // -- Transactional writes ----------------------------------------------
      let insertedId;
      const mongoClient = getMongoClient();

      if (mongoClient) {
        const session = mongoClient.startSession();
        try {
          await session.withTransaction(async () => {
            // 1. Insert sale
            const result = await req.shopDb.collection('sales').insertOne(sale, { session });
            insertedId = result.insertedId;

            // 2. Update stock quantities
            await this._updateStockForSale(req.shopDb, enrichedItems, session, insertedId, req.user._id, req.user.shopId);

            // 3. Update customer totals (credit due, totalPurchased, lastPurchaseDate)
            if (customer?.id) {
              await this._updateCustomerAfterSale(
                req.shopDb,
                customer.id,
                parseFloat(grandTotal),
                req.body.paymentMethod,
                session,
                sale.dueAmount,
              );
            }
          });
        } catch (txError) {
          // Replica-set not available � fall back to non-transactional writes
          if (
            txError.message?.includes('Transaction numbers are only allowed on a replica set') ||
            txError.codeName === 'IllegalOperation'
          ) {
            logger.warn(
              'MongoDB transactions not supported (standalone node) � falling back to non-transactional writes',
              { error: txError.message },
            );
            // Validate every item's stock BEFORE inserting the sale to avoid an
            // orphan sale (sale committed, stock never deducted).
            const fallbackPlan = await this._allocateStockForSale(enrichedItems, req.user.shopId);
            const result = await req.shopDb.collection('sales').insertOne(sale);
            insertedId = result.insertedId;
            for (const { item, batchAllocations } of fallbackPlan) {
              if (!item.productId) {
                continue;
              }
              await this._recordStockMovement(item, batchAllocations, null, insertedId, req.user._id, req.user.shopId);
            }
            if (customer?.id) {
              await this._updateCustomerAfterSale(
                req.shopDb, customer.id, parseFloat(grandTotal), req.body.paymentMethod, null, sale.dueAmount,
              );
            }
          } else {
            throw txError;
          }
        } finally {
          await session.endSession();
        }
      } else {
        // Client not yet available (e.g. test environment) � non-transactional
        logger.warn('MongoDB client unavailable � using non-transactional sale insert');
        // Validate stock BEFORE inserting the sale (avoid orphan sale on
        // insufficient stock).
        const legacyPlan = await this._allocateStockForSale(enrichedItems, req.user.shopId);
        const result = await req.shopDb.collection('sales').insertOne(sale);
        insertedId = result.insertedId;
        for (const { item, batchAllocations } of legacyPlan) {
          if (!item.productId) {
            continue;
          }
          await this._recordStockMovement(item, batchAllocations, null, insertedId, req.user._id, req.user.shopId);
        }
        if (customer?.id) {
          await this._updateCustomerAfterSale(
            req.shopDb, customer.id, parseFloat(grandTotal), req.body.paymentMethod, null, sale.dueAmount,
          );
        }
      }

      // Send notification (async, don't wait) - wrapped in try-catch
      setImmediate(() => {
        this._sendSaleNotification(req.shopDb, sale, customer).catch((err) =>
          logger.error('Notification error:', err),
        );
      });

      // Audit: sale created (fire-and-forget)
      try {
        const auditLog = require('../services/audit-log.service');
        const { AUDIT_ACTIONS } = require('../models/audit-log.schema');
        auditLog.log(req, AUDIT_ACTIONS.SALE_CREATED, 'sale', insertedId.toString(),
          `Created sale ${sale.invoiceNo} � total ?${sale.grandTotal}`,
          { after: { invoiceNo: sale.invoiceNo, grandTotal: sale.grandTotal, itemCount: enrichedItems.length } }
        );
      } catch (_) { /* never block the response */ }

      // Invalidate financial reports cache (sale affects P&L, daily-summary, cash-flow)
      cacheService.invalidateShopCache(req.user.shopId, 'reports');

      // Send response immediately
      return res.status(201).json({
        success: true,
        message: 'Sale created successfully',
        data: {
          _id: insertedId,
          invoiceNo: sale.invoiceNo,
          grandTotal: sale.grandTotal,
          dueAmount: sale.dueAmount,
          previousDue: sale.previousDue,
          totalOutstanding: sale.totalOutstanding,
          saleDate: sale.saleDate,
        },
      });
    } catch (error) {
      logger.error('Create sale error:', error);

      // Expired item or business rule violation → 400
      if (error.message?.startsWith('Cannot sell expired item')) {
        return res.status(400).json({ success: false, message: error.message });
      }

      // Insufficient stock → 400 (not 500)
      if (error.message?.startsWith('Insufficient stock')) {
        return res.status(400).json({ success: false, message: error.message });
      }

      if (error.code === 121) {
        logger.error('Schema validation failed:', error.errInfo?.details);
      }

      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to create sale',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }

  /**
   * Get all sales for the shop
   */
  async getSales(req, res) {
    try {
      const {
        startDate,
        endDate,
        customerId,
        search,
        paymentStatus,
        limit = 20,
        page = 1,
      } = req.query;

      const parsedLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
      const parsedPage = Math.max(parseInt(page) || 1, 1);
      const skip = (parsedPage - 1) * parsedLimit;

      // Build filter
      const filter = this._buildSalesFilter({ startDate, endDate, customerId, search, paymentStatus });

      // Run count and data fetch in parallel
      const [total, sales] = await Promise.all([
        req.shopDb.collection('sales').countDocuments(filter),
        req.shopDb
          .collection('sales')
          .find(filter)
          .sort({ saleDate: -1 })
          .skip(skip)
          .limit(parsedLimit)
          .toArray(),
      ]);

      const pages = Math.ceil(total / parsedLimit);

      res.json({
        success: true,
        data: {
          sales,
          pagination: {
            page: parsedPage,
            limit: parsedLimit,
            total,
            pages,
          },
        },
      });
    } catch (error) {
      logger.error('Get sales error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to fetch sales',
      });
    }
  }

  /**
   * Get single sale by ID
   */
  async getSaleById(req, res) {
    try {
      if (!ObjectId.isValid(req.params.id)) {
        return res.status(404).json({
          success: false,
          message: 'Sale not found',
        });
      }
      const sale = await req.shopDb.collection('sales').findOne({
        _id: new ObjectId(req.params.id),
      });

      if (!sale) {
        return res.status(404).json({
          success: false,
          message: 'Sale not found',
        });
      }

      res.json({
        success: true,
        data: sale,
      });
    } catch (error) {
      logger.error('Get sale error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to fetch sale',
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
      // Handle custom items (no productId, no barcode, no sku)
      if (!item.productId && !item.barcode && !item.sku) {
        if (!item.customName) {
          throw new Error('Custom items must have a customName');
        }

        enrichedItems.push({
          productId: null,
          customName: item.customName,
          name: item.customName,
          rate: parseFloat(item.sellingPrice),
          costPrice: 0,
          qty: parseFloat(item.quantity),
          total: parseFloat(item.sellingPrice) * parseFloat(item.quantity),
        });
        continue;
      }

      // Handle regular products
      // Resolve by productId first, then by barcode/SKU (for POS scanners where
      // the client may only have the scanned code).
      let product = null;

      if (item.productId && ObjectId.isValid(item.productId)) {
        product = await shopDb.collection('products').findOne({
          _id: new ObjectId(item.productId),
        });
      } else if (item.productId && !ObjectId.isValid(item.productId)) {
        const code = String(item.productId).trim();
        if (code) {
          product = await this._findProductByCode(shopDb, code);
        }
      } else if (item.barcode || item.sku) {
        const code = String(item.barcode || item.sku).trim();
        if (code) {
          product = await this._findProductByCode(shopDb, code);
        }
      }

      if (!product) {
        throw new Error(`Product not found: ${item.productId || item.barcode || item.sku}`);
      }

      // Check stock availability - WARNING ONLY
      const stock = await shopDb.collection('stock').findOne({
        productId: product._id,
      });

      if (!stock || stock.currentQty < item.quantity) {
        logger.warn(
          `Warning: Insufficient stock for ${product.name}. Available: ${stock?.currentQty || 0}, Requested: ${item.quantity}`,
        );
      }

      // Block sale of expired items (only if expiryDate is set)
      const stockExpiry = stock?.expiryDate || product.expiryDate;
      if (stockExpiry && new Date(stockExpiry) < new Date()) {
        const expiredDate = new Date(stockExpiry).toLocaleDateString('en-BD');
        throw new Error(
          `Cannot sell expired item: ${product.name} (expired ${expiredDate})`
        );
      }

      enrichedItems.push({
        productId: product._id,
        name: product.name,
        rate: parseFloat(item.sellingPrice || product.sellingPrice),
        costPrice: parseFloat(product.purchasePrice || 0),
        qty: parseFloat(item.quantity),
        total:
          parseFloat(item.sellingPrice || product.sellingPrice) *
          parseFloat(item.quantity),
      });
    }

    return enrichedItems;
  }

  /**
   * Find a product by exact barcode or SKU match (POS scanner support).
   */
  async _findProductByCode(shopDb, code) {
    const normalized = String(code).trim();
    if (!normalized) {
      return null;
    }
    const candidates = [...new Set([normalized, normalized.toLowerCase(), normalized.toUpperCase()])];
    return await shopDb.collection('products').findOne({
      $or: candidates.flatMap((value) => [{ barcode: value }, { sku: value }]),
    });
  }

  /**
   * Build sale record object
   */
  _buildSaleRecord({
    invoiceNo, customer, customerType, enrichedItems, subtotal, discount,
    vatAmount, vatPercent, grandTotal, cashPaid, bankPaid,
    paymentMethod, _dueAmount, previousDue = 0, notes, user,
  }) {
    const paid = (parseFloat(cashPaid) || 0) + (parseFloat(bankPaid) || 0);
    const due = paymentMethod === 'credit'
      ? parseFloat(grandTotal)
      : Math.max(0, parseFloat(grandTotal) - paid);

    const parsedSubtotal = parseFloat(subtotal) || 0;
    const discountAmount = parseFloat(discount) || 0;
    const discountPercent = parsedSubtotal > 0
      ? Math.round((discountAmount / parsedSubtotal) * 100 * 100) / 100
      : 0;

    const totalOutstanding = (parseFloat(previousDue) || 0) + due;

    return {
      invoiceNo,
      customerId: customer?.id ? new ObjectId(customer.id) : null,
      customerName: customer?.name || 'Cash Customer',
      customerPhone: customer?.phone || customer?.mobile || null,
      customerAddress: customer?.address || null,
      customerType: customerType || 'Walk-in',
      items: enrichedItems,
      subtotal: parsedSubtotal,
      discountAmount: discountAmount,
      discountPercent: discountPercent,
      vatAmount: parseFloat(vatAmount) || 0,
      vatPercent: parseFloat(vatPercent) || 0,
      grandTotal: parseFloat(grandTotal),
      cashPaid: paymentMethod === 'credit' ? 0 : (parseFloat(cashPaid) || 0),
      bankPaid: paymentMethod === 'credit' ? 0 : (parseFloat(bankPaid) || 0),
      returnAmount: paymentMethod === 'credit' ? 0 : Math.max(0, paid - parseFloat(grandTotal)),
      dueAmount: due,
      previousDue: parseFloat(previousDue) || 0,
      totalOutstanding,
      paymentMethod: paymentMethod || 'cash',
      paymentStatus: due > 0 ? (paymentMethod === 'credit' ? 'Credit' : 'Partial') : 'Paid',
      saleDate: new Date(),
      createdBy: new ObjectId(user._id),
      createdByName: user.name,
      notes: notes || '',
      createdAt: new Date(),
    };
  }

  /**
   * Update customer totals after a sale
   */
  async _updateCustomerAfterSale(shopDb, customerId, saleTotal, paymentMethod, session = null, dueAmount = 0) {
    try {
      const update = {
        // totalPurchases is a count of sale records, not a second money total
        $inc: { totalPurchased: saleTotal, totalPurchases: 1 },
        $set: { lastPurchaseDate: new Date(), updatedAt: new Date() },
      };
      // Add to currentDue for credit sales OR partial payments
      if (paymentMethod === 'credit') {
        update.$inc.currentDue = saleTotal;
      } else if (dueAmount > 0) {
        update.$inc.currentDue = dueAmount;
      }
      const options = session ? { session } : {};
      await shopDb.collection('customers').updateOne(
        { _id: new ObjectId(customerId) },
        update,
        options,
      );
    } catch (err) {
      logger.warn('Failed to update customer totals after sale:', err.message);
    }
  }

  /**
   * Pass 1: allocate batches (FEFO) for every item. Throws InsufficientStockError
   * before any write happens so a sale can never be committed without its stock.
   */
  async _allocateStockForSale(enrichedItems, shopId) {
    const stockCommand = require('../services/stock-command.service');
    const { InsufficientStockError } = stockCommand;

    const plan = [];
    for (const item of enrichedItems) {
      if (!item.productId) {
        plan.push({ item, batchAllocations: [] });
        continue;
      }
      let batchAllocations;
      try {
        batchAllocations = await stockCommand.allocateBatchesFEFO(
          item.productId,
          item.qty,
          shopId
        );
      } catch (error) {
        if (error instanceof InsufficientStockError) {
          throw new Error(
            `Insufficient stock for ${item.name}. Available: ${error.available}, Requested: ${error.requested}`
          );
        }
        throw error;
      }
      plan.push({ item, batchAllocations });
    }
    return plan;
  }

  /**
   * Update stock quantities after sale
   * Phase 6: Event-sourced system with FEFO batch tracking (legacy system retired)
   */
  async _updateStockForSale(shopDb, enrichedItems, session = null, saleId = null, userId = null, shopId = null) {
    // Allocate first (throws before any write on insufficient stock)
    const plan = await this._allocateStockForSale(enrichedItems, shopId);

    // Apply movements only after every allocation succeeded
    for (const { item, batchAllocations } of plan) {
      if (!item.productId) {
        continue;
      }
      await this._recordStockMovement(item, batchAllocations, session, saleId, userId, shopId);
    }

    logger.info('Stock updates completed via event-sourced system');
  }

  /**
   * Persist one stock movement. Uses an existing session when available.
   */
  async _recordStockMovement(item, batchAllocations, session, saleId, userId, shopId) {
    const stockCommand = require('../services/stock-command.service');
    await stockCommand.recordMovement({
      shopId,
      productId: item.productId,
      movementType: 'SALE',
      quantity: item.qty,
      userId,
      referenceType: 'SALE',
      referenceId: saleId,
      batchAllocations,
      costPrice: item.costPrice, // Actual cost (purchase price) for profit reporting
      note: `Sale ${saleId}`,
      session,
    });
  }

  /**
   * Send sale notification to customer
   */
  async _sendSaleNotification(shopDb, sale, customer) {
    try {
      // req.body.customer carries `id` (not `_id`); accept either shape
      const customerId = customer?.id || customer?._id;
      if (!customerId || !ObjectId.isValid(customerId)) {
        return;
      }

      const customerData = await shopDb
        .collection('customers')
        .findOne({ _id: new ObjectId(customerId) });

      if (customerData && customerData.email) {
        await EmailService.sendTransactionalEmail(
          customerData.email,
          'order_confirmation',
          {
            customerName: customerData.name,
            invoiceNo: sale.invoiceNo,
            saleDate: sale.saleDate.toLocaleDateString(),
            grandTotal: sale.grandTotal,
            items: sale.items,
          },
        );
      }
    } catch (error) {
      // Don't fail the sale if notification fails
      logger.error('Failed to send sale notification:', error);
    }
  }

  /**
   * Build filter for sales query
   */
  _buildSalesFilter({ startDate, endDate, customerId, search, paymentStatus }) {
    const filter = {};

    if (startDate || endDate) {
      filter.saleDate = {};
      if (startDate) {filter.saleDate.$gte = new Date(startDate);}
      if (endDate) {filter.saleDate.$lte = new Date(endDate);}
    }

    if (customerId) {
      if (ObjectId.isValid(customerId)) {
        filter.customerId = new ObjectId(customerId);
      } else {
        filter.customerId = customerId;
      }
    }

    // Search by invoice number or customer name
    if (search && search.trim()) {
      filter.$or = [
        { invoiceNo: { $regex: search.trim(), $options: 'i' } },
        { customerName: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    // Filter by payment status
    if (paymentStatus && paymentStatus.trim()) {
      filter.paymentStatus = paymentStatus.trim();
    }

    return filter;
  }
}

module.exports = new SalesController();
