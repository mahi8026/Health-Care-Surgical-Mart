/**
 * Returns Routes - Multi-Tenant
 * Handles sale returns and refunds for medical stores
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

// Apply authentication to all routes
router.use(authenticate);
router.use(checkShopStatus);

/**
 * @swagger
 * /api/returns:
 *   get:
 *     summary: Get all returns for shop
 *     description: Retrieve paginated list of product returns. Supports search and status filtering. Requires returns.view permission.
 *     tags: [Returns]
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
 *           default: 20
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by return number, invoice number, or customer name
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, completed, cancelled]
 *         description: Filter by return status
 *     responses:
 *       200:
 *         description: Returns retrieved successfully
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
 *                     $ref: '#/components/schemas/Return'
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationMeta'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *
 *   post:
 *     summary: Create new return
 *     description: Process a product return with automatic stock restoration and refund calculation. Requires returns.create permission.
 *     tags: [Returns]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - originalSaleId
 *               - items
 *               - returnReason
 *             properties:
 *               originalSaleId:
 *                 type: string
 *                 example: "507f1f77bcf86cd799439011"
 *               originalInvoiceNumber:
 *                 type: string
 *                 example: "INV-2026-00123"
 *               customer:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                   phone:
 *                     type: string
 *               items:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required:
 *                     - productId
 *                     - returnQuantity
 *                   properties:
 *                     productId:
 *                       type: string
 *                     returnQuantity:
 *                       type: integer
 *                       minimum: 1
 *                     returnReason:
 *                       type: string
 *               returnReason:
 *                 type: string
 *                 example: "Damaged product"
 *               returnType:
 *                 type: string
 *                 enum: [full, partial]
 *                 example: "partial"
 *               refundMethod:
 *                 type: string
 *                 enum: [cash, bank, store_credit]
 *                 example: "cash"
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Return processed successfully
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
 *                   example: "Return processed successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Return'
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
 * /api/returns/{id}:
 *   get:
 *     summary: Get return by ID
 *     description: Retrieve detailed information about a specific return. Requires returns.view permission.
 *     tags: [Returns]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Return ID
 *     responses:
 *       200:
 *         description: Return retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Return'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *
 * /api/returns/sale/{saleId}:
 *   get:
 *     summary: Get original sale details for return processing
 *     description: Retrieve sale information with returnable quantities for each item. Requires returns.view permission.
 *     tags: [Returns]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: saleId
 *         required: true
 *         schema:
 *           type: string
 *         description: Original sale ID
 *     responses:
 *       200:
 *         description: Sale details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Sale'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *
 * /api/returns/{id}/status:
 *   put:
 *     summary: Update return status
 *     description: Change return status (cancel, approve, complete). Automatically adjusts stock. Requires returns.edit permission.
 *     tags: [Returns]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Return ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, completed, cancelled]
 *                 example: "completed"
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Return status updated successfully
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
 *                   example: "Return status updated successfully"
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
 * /api/returns/stats/summary:
 *   get:
 *     summary: Get return statistics
 *     description: Retrieve return statistics including daily, monthly totals and breakdown by reason. Requires returns.view permission.
 *     tags: [Returns]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     today:
 *                       type: object
 *                       properties:
 *                         returns:
 *                           type: integer
 *                         amount:
 *                           type: number
 *                     monthly:
 *                       type: object
 *                       properties:
 *                         returns:
 *                           type: integer
 *                         amount:
 *                           type: number
 *                     total:
 *                       type: integer
 *                     byReason:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           count:
 *                             type: integer
 *                           totalAmount:
 *                             type: number
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

/**
 * GET /api/returns
 * Get all returns for the shop
 */
router.get(
  '/',
  requirePermission(PERMISSIONS.VIEW_RETURNS),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const { page = 1, limit = 20, search = '', status = '' } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const searchQuery = {};

    // Add search filter
    if (search) {
      searchQuery.$or = [
        { returnNumber: { $regex: search, $options: 'i' } },
        { originalInvoiceNumber: { $regex: search, $options: 'i' } },
        { 'customer.name': { $regex: search, $options: 'i' } },
      ];
    }

    // Add status filter
    if (status) {
      searchQuery.status = status;
    }

    const returns = await shopDb
      .collection('returns')
      .find(searchQuery)
      .sort({ returnDate: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();

    const total = await shopDb
      .collection('returns')
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
  '/:id',
  requirePermission(PERMISSIONS.VIEW_RETURNS),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);

    if (!ObjectId.isValid(req.params.id)) {
      throw createError.notFound('Return record not found');
    }

    const returnRecord = await shopDb
      .collection('returns')
      .findOne({ _id: new ObjectId(req.params.id) });

    if (!returnRecord) {
      throw createError.notFound('Return record not found');
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
  '/sale/:saleId',
  requirePermission(PERMISSIONS.VIEW_RETURNS),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);

    if (!ObjectId.isValid(req.params.saleId)) {
      throw createError.notFound('Original sale not found');
    }

    const sale = await shopDb
      .collection('sales')
      .findOne({ _id: new ObjectId(req.params.saleId) });

    if (!sale) {
      throw createError.notFound('Original sale not found');
    }

    // Check if any returns already exist for this sale
    const existingReturns = await shopDb
      .collection('returns')
      .find({ originalSaleId: req.params.saleId })
      .toArray();

    // Calculate returned quantities for each item
    const returnedQuantities = {};
    existingReturns.forEach((returnRecord) => {
      if (returnRecord.status !== 'cancelled') {
        returnRecord.items.forEach((item) => {
          if (!item.productId) {return;}
          const key = item.productId.toString();
          returnedQuantities[key] =
            (returnedQuantities[key] || 0) + item.returnQuantity;
        });
      }
    });

    // Add returnable quantities to sale items
    const saleWithReturnInfo = {
      ...sale,
      items: sale.items
        .filter((item) => item.productId)
        .map((item) => ({
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
  '/',
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
      idempotencyKey, // optional client-generated key to prevent duplicate returns
    } = req.body;

    // Validate required fields
    if (!originalSaleId || !items || items.length === 0) {
      throw createError.badRequest(
        'Original sale ID and return items are required',
      );
    }

    if (!ObjectId.isValid(originalSaleId)) {
      throw createError.badRequest('Invalid original sale ID');
    }

    // Idempotency: a retry with the same key returns the already-created
    // return instead of processing the refund twice.
    if (idempotencyKey) {
      const existing = await shopDb
        .collection('returns')
        .findOne({ idempotencyKey });
      if (existing) {
        return res.status(201).json({
          success: true,
          message: 'Return already processed (idempotent replay)',
          data: existing,
          idempotent: true,
        });
      }
    }

    if (!returnReason) {
      throw createError.badRequest('Return reason is required');
    }

    // Verify original sale exists
    const originalSale = await shopDb
      .collection('sales')
      .findOne({ _id: new ObjectId(originalSaleId) });

    if (!originalSale) {
      throw createError.notFound('Original sale not found');
    }

    // Validate return items and quantities
    const returnItems = [];
    let totalReturnAmount = 0;
    // Track quantities already claimed for each product WITHIN this request —
    // a payload that lists the same product twice must not be validated (and
    // restored) against the same available quantity twice.
    const inRequestQty = new Map();

    for (const returnItem of items) {
      const {
        productId,
        returnQuantity,
        returnReason: itemReason,
      } = returnItem;

      if (!productId || !ObjectId.isValid(productId) || !returnQuantity || returnQuantity <= 0) {
        throw createError.badRequest('Invalid return item data');
      }

      // Sum every matching sale line — the same product can appear on
      // multiple lines of one sale.
      const soldQty = originalSale.items
        .filter(
          (item) =>
            item.productId &&
            item.productId.toString() === productId.toString(),
        )
        .reduce((sum, item) => sum + (item.qty || 0), 0);

      // Find the original sale item (custom items have no productId — skip)
      const originalItem = originalSale.items.find(
        (item) =>
          item.productId &&
          item.productId.toString() === productId.toString(),
      );

      if (!originalItem) {
        throw createError.badRequest(
          `Product ${productId} not found in original sale`,
        );
      }

      // Check if return quantity is valid
      const existingReturns = await shopDb
        .collection('returns')
        .find({
          originalSaleId: originalSaleId,
          'items.productId': new ObjectId(productId),
          status: { $ne: 'cancelled' },
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

      // Quantities for this product already accepted earlier in THIS request
      const requestedSoFar = inRequestQty.get(productId.toString()) || 0;

      const availableForReturn =
        soldQty - totalReturnedQty - requestedSoFar;
      if (returnQuantity > availableForReturn) {
        throw createError.badRequest(
          `Cannot return ${returnQuantity} units of ${originalItem.name}. Only ${Math.max(0, availableForReturn)} units available for return.`,
        );
      }
      inRequestQty.set(
        productId.toString(),
        requestedSoFar + returnQuantity,
      );

      // Get current product details for stock restoration
      const product = await shopDb
        .collection('products')
        .findOne({ _id: new ObjectId(productId) });

      if (!product) {
        throw createError.badRequest(`Product ${productId} not found`);
      }

      // Sale items store the selling price in `rate` (schema-required field)
      const unitPrice =
        originalItem.rate ||
        originalItem.sellingPrice ||
        originalItem.saleRate ||
        originalItem.price ||
        0;
      const itemReturnAmount = unitPrice * returnQuantity;
      totalReturnAmount += itemReturnAmount;

      returnItems.push({
        productId: new ObjectId(productId),
        name: originalItem.name,
        sku: originalItem.sku,
        originalQuantity: originalItem.qty,
        returnQuantity: parseInt(returnQuantity),
        price: unitPrice,
        costPrice: originalItem.costPrice || product.purchasePrice || 0,
        total: itemReturnAmount,
        returnReason: itemReason || returnReason,
        batchNumber: originalItem.batchNumber || null,
        expiryDate: originalItem.expiryDate || null,
      });
    }

    // Generate return number
    const returnCount =
      (await shopDb.collection('returns').countDocuments({})) + 1;
    const returnNumber = `RET-${Date.now()}-${returnCount.toString().padStart(4, '0')}`;

    // Calculate refund amounts based on original sale proportions
    const originalSubtotal = originalSale.subtotal || originalSale.grandTotal;
    // Guard against a zero subtotal (fully-discounted/legacy sale) — an
    // unchecked division would poison downstream money math with Infinity/NaN.
    const returnRatio =
      originalSubtotal > 0 ? totalReturnAmount / originalSubtotal : 0;

    const refundDiscount = (originalSale.discountAmount || originalSale.discount || 0) * returnRatio;
    const refundVAT = (originalSale.vatAmount || 0) * returnRatio;
    const totalRefundAmount = totalReturnAmount - refundDiscount + refundVAT;

    // How much of the original sale's outstanding due this return settles
    // (persisted on the return so a later cancel can restore it exactly)
    const originalPaymentMethod = originalSale.paymentMethod?.toLowerCase();
    const originalDue = originalSale.dueAmount || 0;
    const saleCustomerId = originalSale.customerId || customer?.id;
    const isCreditSettled =
      (originalPaymentMethod === 'credit' || originalDue > 0) &&
      saleCustomerId &&
      ObjectId.isValid(saleCustomerId);
    const dueReduction = isCreditSettled
      ? Math.min(totalRefundAmount, originalDue)
      : 0;

    // Create return record
    const returnData = {
      returnNumber,
      originalSaleId: originalSaleId,
      originalInvoiceNumber:
        originalInvoiceNumber || originalSale.invoiceNo || originalSale.invoiceNumber,
      customer: customer || originalSale.customer,
      items: returnItems,
      returnReason,
      returnType,
      refundMethod: refundMethod || 'cash',
      subtotal: totalReturnAmount,
      discount: refundDiscount,
      vatAmount: refundVAT,
      totalRefund: totalRefundAmount,
      dueReduction,
      status: 'completed', // 'pending', 'completed', 'cancelled'
      returnDate: new Date(),
      notes: notes || '',
      idempotencyKey: idempotencyKey || null,
      createdBy: req.user._id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Start transaction-like operations
    try {
      // Insert return record (unique idempotencyKey index turns a racing
      // duplicate submit into a conflict we can resolve safely)
      let result;
      try {
        result = await shopDb.collection('returns').insertOne(returnData);
      } catch (insertError) {
        if (insertError.code === 11000 && idempotencyKey) {
          const existing = await shopDb
            .collection('returns')
            .findOne({ idempotencyKey });
          if (existing) {
            return res.status(201).json({
              success: true,
              message: 'Return already processed (idempotent replay)',
              data: existing,
              idempotent: true,
            });
          }
        }
        throw insertError;
      }

      // Phase 6: Update stock using event-sourced system
      const stockCommand = require('../services/stock-command.service');

      for (const item of returnItems) {
        // Record stock movement via event-sourced system
        await stockCommand.recordMovement({
          shopId: req.user.shopId,
          productId: item.productId,
          movementType: 'RETURN_IN',
          quantity: item.returnQuantity,
          userId: req.user.id || req.user._id,
          referenceType: 'RETURN',
          referenceId: result.insertedId,
          batchNo: item.batchNumber || `RET-${returnNumber}`,
          expiryDate: item.expiryDate,
          note: `Return from sale ${originalInvoiceNumber}`,
          metadata: {
            returnNumber,
            originalSaleId,
            reason: returnReason
          }
        });

        // Create a return batch
        await shopDb.collection('stock_batches').insertOne({
          productId: item.productId,
          shopId: req.user.shopId, // Required — other batch writes set shopId
          batchNo: item.batchNumber || `RET-${returnNumber}`,
          lotNo: null,
          quantity: item.returnQuantity,
          expiryDate: item.expiryDate || null,
          costPrice: item.costPrice || item.purchasePrice || 0,
          status: 'ACTIVE',
          source: 'RETURN',
          referenceId: result.insertedId,
          createdAt: new Date(),
          updatedAt: new Date()
        });

        // Log stock movement (legacy - for backward compatibility)
        await shopDb.collection('stock_movements').insertOne({
          productId: item.productId,
          productName: item.name,
          movementType: 'return',
          quantity: item.returnQuantity,
          previousQty: 0, // Will be updated by stock service
          newQty: 0, // Will be updated by stock service
          referenceType: 'return',
          referenceId: result.insertedId.toString(),
          referenceNumber: returnNumber,
          notes: `Return from sale ${originalInvoiceNumber}`,
          createdBy: req.user._id,
          createdAt: new Date(),
        });
      }

      // Update original sale with return reference
      await shopDb.collection('sales').updateOne(
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

      // Credit/partial sales: refunding item value must reduce the customer's
      // outstanding due too, otherwise money is lost twice (refund handed out,
      // but due never lowered). Reduce up to the refund amount, never negative.
      let customerDueReduced = 0;
      if (isCreditSettled) {
        const customerUpdate = await shopDb.collection('customers').findOneAndUpdate(
          { _id: new ObjectId(saleCustomerId) },
          [
            {
              $set: {
                // Compute the new due first, then the amount ACTUALLY removed
                // (clamped at zero when part of the debt was already settled).
                // The audit field lets a later cancellation restore exactly
                // what was taken instead of inventing due money.
                __newDue: {
                  $max: [0, { $subtract: [{ $ifNull: ['$currentDue', 0] }, totalRefundAmount] }],
                },
                customerDueReducedLastReturn: {
                  $subtract: [{ $ifNull: ['$currentDue', 0] }, '$__newDue'],
                },
                currentDue: '$__newDue',
                updatedAt: new Date(),
              },
            },
            { $unset: '__newDue' },
          ],
          { returnDocument: 'after' },
        );
        customerDueReduced =
          customerUpdate?.customerDueReducedLastReturn || 0;

        // Persist the actual reduction on the return record for exact reversal
        // on cancellation.
        await shopDb.collection('returns').updateOne(
          { _id: result.insertedId },
          { $set: { customerDueReduced } },
        );

        // Keep the sale's own due books in sync — customer.currentDue is derived
        // from sale.dueAmount/totalOutstanding (see /customers/recalculate-due),
        // so the sale must be reduced by the same amount or recalculation would
        // undo this refund adjustment.
        if (dueReduction > 0) {
          await shopDb.collection('sales').updateOne(
            { _id: new ObjectId(originalSaleId) },
            {
              $inc: { dueAmount: -dueReduction, totalOutstanding: -dueReduction },
              $set: { updatedAt: new Date() },
            },
          );
        }
      }

      res.status(201).json({
        success: true,
        message: 'Return processed successfully',
        data: {
          _id: result.insertedId,
          ...returnData,
        },
      });
    } catch (error) {
      // If any operation fails, we should ideally rollback
      // For now, log the error and throw
      logger.error('Return processing error:', error);
      throw createError.internal('Failed to process return');
    }
  }),
);

/**
 * PUT /api/returns/:id/status
 * Update return status (cancel, approve, etc.)
 */
router.put(
  '/:id/status',
  requirePermission(PERMISSIONS.EDIT_RETURN),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const { status, notes } = req.body;

    if (!['pending', 'completed', 'cancelled'].includes(status)) {
      throw createError.badRequest('Invalid status');
    }

    if (!ObjectId.isValid(req.params.id)) {
      throw createError.notFound('Return record not found');
    }

    const returnRecord = await shopDb
      .collection('returns')
      .findOne({ _id: new ObjectId(req.params.id) });

    if (!returnRecord) {
      throw createError.notFound('Return record not found');
    }

    // If cancelling a completed return, restore stock (remove returned items)
    // Phase 6: Use event-sourced system
    if (status === 'cancelled' && returnRecord.status === 'completed') {
      const stockCommand = require('../services/stock-command.service');

      for (const item of returnRecord.items) {
        await stockCommand.recordMovement({
          shopId: req.user.shopId,
          productId: item.productId,
          movementType: 'RETURN_OUT',
          quantity: item.returnQuantity,
          userId: req.user.id || req.user._id,
          referenceType: 'RETURN_CANCEL',
          referenceId: returnRecord._id,
          note: `Cancelled return ${returnRecord.returnNumber}`,
          metadata: {
            returnNumber: returnRecord.returnNumber,
            reason: notes || 'Return cancelled'
          }
        });
      }

      // Remove the return batch created when the return was processed
      await shopDb.collection('stock_batches').deleteMany({
        referenceId: returnRecord._id,
        source: 'RETURN',
      });

      // Reverse the due adjustments exactly as they were applied on return
      // creation. Two separate amounts are involved:
      //   • customerDueReduced — what was ACTUALLY removed from the customer
      //     (clamped at zero when part of the debt was already settled), so a
      //     refund that exceeded the live due cannot inflate the due back.
      //   • dueReduction — what was removed from the sale's own due books.
      // Legacy records only carry `dueReduction`, which is used for both.
      const customerReduction =
        returnRecord.customerDueReduced != null
          ? returnRecord.customerDueReduced
          : returnRecord.dueReduction || 0;
      const saleReduction = returnRecord.dueReduction || 0;
      if (saleReduction > 0 || customerReduction > 0) {
        const originalSale = await shopDb
          .collection('sales')
          .findOne({ _id: new ObjectId(returnRecord.originalSaleId) });
        const custId = originalSale?.customerId;
        if (custId && ObjectId.isValid(custId) && customerReduction > 0) {
          await shopDb.collection('customers').updateOne(
            { _id: new ObjectId(custId) },
            { $inc: { currentDue: customerReduction }, $set: { updatedAt: new Date() } },
          );
        }
        if (originalSale && saleReduction > 0) {
          await shopDb.collection('sales').updateOne(
            { _id: originalSale._id },
            {
              $inc: { dueAmount: saleReduction, totalOutstanding: saleReduction },
              $pull: { returns: { returnId: returnRecord._id } },
              $set: { updatedAt: new Date() },
            },
          );
        } else if (originalSale) {
          await shopDb.collection('sales').updateOne(
            { _id: originalSale._id },
            { $pull: { returns: { returnId: returnRecord._id } }, $set: { updatedAt: new Date() } },
          );
        }
      } else if (returnRecord.originalSaleId && ObjectId.isValid(returnRecord.originalSaleId)) {
        // No due was reduced — still detach the return reference from the sale
        await shopDb.collection('sales').updateOne(
          { _id: new ObjectId(returnRecord.originalSaleId) },
          { $pull: { returns: { returnId: returnRecord._id } }, $set: { updatedAt: new Date() } },
        );
      }
    }

    // If completing a pending return, update stock (add returned items)
    if (status === 'completed' && returnRecord.status === 'pending') {
      const stockCommand = require('../services/stock-command.service');

      for (const item of returnRecord.items) {
        await stockCommand.recordMovement({
          shopId: req.user.shopId,
          productId: item.productId,
          movementType: 'RETURN_IN',
          quantity: item.returnQuantity,
          userId: req.user.id || req.user._id,
          referenceType: 'RETURN',
          referenceId: returnRecord._id,
          note: `Approved return ${returnRecord.returnNumber}`,
          metadata: {
            returnNumber: returnRecord.returnNumber,
            originalStatus: returnRecord.status
          }
        });
      }
    }

    await shopDb.collection('returns').updateOne(
      { _id: new ObjectId(req.params.id) },
      {
        $set: {
          status,
          notes: notes || returnRecord.notes,
          updatedAt: new Date(),
          updatedBy: req.user._id,
        },
      },
    );

    res.json({
      success: true,
      message: 'Return status updated successfully',
    });
  }),
);

/**
 * GET /api/returns/stats/summary
 * Get return statistics
 */
router.get(
  '/stats/summary',
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
          .collection('returns')
          .aggregate([
            {
              $match: {
                returnDate: { $gte: startOfDay },
                status: 'completed',
              },
            },
            {
              $group: {
                _id: null,
                totalReturns: { $sum: 1 },
                totalAmount: { $sum: '$totalRefund' },
              },
            },
          ])
          .toArray(),

        // Monthly returns
        shopDb
          .collection('returns')
          .aggregate([
            {
              $match: {
                returnDate: { $gte: startOfMonth },
                status: 'completed',
              },
            },
            {
              $group: {
                _id: null,
                totalReturns: { $sum: 1 },
                totalAmount: { $sum: '$totalRefund' },
              },
            },
          ])
          .toArray(),

        // Total returns
        shopDb.collection('returns').countDocuments({ status: 'completed' }),

        // Returns by reason
        shopDb
          .collection('returns')
          .aggregate([
            {
              $match: { status: 'completed' },
            },
            {
              $group: {
                _id: '$returnReason',
                count: { $sum: 1 },
                totalAmount: { $sum: '$totalRefund' },
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
