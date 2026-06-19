/**
 * Sales Routes - Multi-Tenant
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
const salesController = require("../controllers/sales.controller");
const auditLog = require("../services/audit-log.service");
const { AUDIT_ACTIONS } = require("../models/audit-log.schema");

// Apply authentication and shop status check to all routes
router.use(authenticate);
router.use(checkShopStatus);

/**
 * GET /api/sales/next-invoice-number
 * Get next sequential invoice number
 */
router.get(
  "/next-invoice-number",
  requirePermission(PERMISSIONS.CREATE_SALE),
  async (req, res) => {
    try {
      const invoiceNumberService = require('../services/invoice-number.service');
      const nextInvoiceNumber = await invoiceNumberService.getNextInvoiceNumber(req.user.shopId);
      
      res.json({
        success: true,
        data: {
          invoiceNumber: nextInvoiceNumber
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to generate invoice number'
      });
    }
  }
);

/**
 * @swagger
 * /api/sales:
 *   post:
 *     summary: Create new sale transaction
 *     description: Create a new POS sale transaction with automatic stock deduction and invoice generation. Requires sales.create permission.
 *     tags: [Sales]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - items
 *               - paymentMethod
 *             properties:
 *               customerId:
 *                 type: string
 *                 description: Customer ID (optional for walk-in customers)
 *                 example: "507f1f77bcf86cd799439011"
 *               items:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required:
 *                     - productId
 *                     - quantity
 *                     - price
 *                   properties:
 *                     productId:
 *                       type: string
 *                       example: "507f1f77bcf86cd799439012"
 *                     quantity:
 *                       type: integer
 *                       minimum: 1
 *                       example: 5
 *                     price:
 *                       type: number
 *                       minimum: 0
 *                       example: 15.99
 *                     discount:
 *                       type: number
 *                       minimum: 0
 *                       default: 0
 *                       example: 2.0
 *               paymentMethod:
 *                 type: string
 *                 enum: [cash, card, mobile, credit]
 *                 example: "card"
 *               discount:
 *                 type: number
 *                 minimum: 0
 *                 default: 0
 *                 example: 10.0
 *               notes:
 *                 type: string
 *                 example: "Customer requested express delivery"
 *           example:
 *             customerId: "507f1f77bcf86cd799439011"
 *             items:
 *               - productId: "507f1f77bcf86cd799439012"
 *                 quantity: 5
 *                 price: 15.99
 *                 discount: 0
 *               - productId: "507f1f77bcf86cd799439013"
 *                 quantity: 2
 *                 price: 25.50
 *                 discount: 5.0
 *             paymentMethod: "card"
 *             discount: 10.0
 *             notes: "Regular customer"
 *     responses:
 *       201:
 *         description: Sale created successfully
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
 *                   example: "Sale created successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Sale'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *
 *   get:
 *     summary: Get all sales for shop
 *     description: Retrieve paginated list of sales transactions for the authenticated shop. Supports filtering and sorting. Requires sales.view permission.
 *     tags: [Sales]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number (defaults to 1)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Items per page (max 100, defaults to 20)
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter sales from this date
 *         example: "2026-05-01"
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter sales until this date
 *         example: "2026-05-31"
 *       - in: query
 *         name: customerId
 *         schema:
 *           type: string
 *         description: Filter by customer ID
 *       - in: query
 *         name: paymentMethod
 *         schema:
 *           type: string
 *           enum: [cash, card, mobile, credit]
 *         description: Filter by payment method
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [completed, pending, cancelled]
 *         description: Filter by sale status
 *     responses:
 *       200:
 *         description: Sales retrieved successfully
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
 *                     sales:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Sale'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                           example: 1
 *                         limit:
 *                           type: integer
 *                           example: 20
 *                         total:
 *                           type: integer
 *                           example: 150
 *                         pages:
 *                           type: integer
 *                           example: 8
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *
 * /api/sales/{id}:
 *   get:
 *     summary: Get sale by ID
 *     description: Retrieve detailed information about a specific sale transaction. Requires sales.view permission.
 *     tags: [Sales]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Sale ID
 *         example: "507f1f77bcf86cd799439011"
 *     responses:
 *       200:
 *         description: Sale retrieved successfully
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
 */

/**
 * POST /api/sales
 * Create new sale
 */
router.post(
  "/",
  requirePermission(PERMISSIONS.CREATE_SALE),
  salesController.createSale.bind(salesController),
);

/**
 * GET /api/sales
 * Get all sales for the shop
 */
router.get(
  "/",
  requirePermission(PERMISSIONS.VIEW_SALES),
  salesController.getSales.bind(salesController),
);

/**
 * GET /api/sales/:id
 * Get single sale by ID
 */
router.get(
  "/:id",
  requirePermission(PERMISSIONS.VIEW_SALES),
  salesController.getSaleById.bind(salesController),
);

/**
 * PATCH /api/sales/:id/previous-due
 * Edit the previousDue amount recorded on a sale and recalculate totalOutstanding
 */
router.patch(
  "/:id/previous-due",
  requirePermission(PERMISSIONS.MANAGE_SALES),
  async (req, res) => {
    try {
      const { ObjectId } = require("mongodb");
      const { logger } = require("../config/logging");

      const { previousDue } = req.body;

      if (previousDue === undefined || previousDue === null || previousDue === "") {
        return res.status(400).json({ success: false, message: "previousDue is required" });
      }

      const parsedPreviousDue = parseFloat(previousDue);
      if (isNaN(parsedPreviousDue) || parsedPreviousDue < 0) {
        return res.status(400).json({ success: false, message: "previousDue must be a non-negative number" });
      }

      let saleId;
      try {
        saleId = new ObjectId(req.params.id);
      } catch {
        return res.status(400).json({ success: false, message: "Invalid sale ID" });
      }

      const sale = await req.shopDb.collection("sales").findOne({ _id: saleId });
      if (!sale) {
        return res.status(404).json({ success: false, message: "Sale not found" });
      }

      const dueAmount = sale.dueAmount || 0;
      const newTotalOutstanding = parsedPreviousDue + dueAmount;

      await req.shopDb.collection("sales").updateOne(
        { _id: saleId },
        {
          $set: {
            previousDue: parsedPreviousDue,
            totalOutstanding: newTotalOutstanding,
            updatedAt: new Date(),
            previousDueEditedBy: req.user.name || req.user._id,
            previousDueEditedAt: new Date(),
          },
        }
      );

      // Audit log
      try {
        auditLog.log(
          req,
          AUDIT_ACTIONS.SALE_UPDATED || "SALE_UPDATED",
          "sale",
          req.params.id,
          `Previous due updated on sale ${sale.invoiceNo}: ৳${sale.previousDue || 0} → ৳${parsedPreviousDue}`,
          {
            before: { previousDue: sale.previousDue || 0, totalOutstanding: sale.totalOutstanding || 0 },
            after: { previousDue: parsedPreviousDue, totalOutstanding: newTotalOutstanding },
          }
        );
      } catch (_) { /* non-blocking */ }

      logger.info(`Previous due updated for sale ${sale.invoiceNo}`, {
        saleId: req.params.id,
        oldPreviousDue: sale.previousDue || 0,
        newPreviousDue: parsedPreviousDue,
        newTotalOutstanding,
        updatedBy: req.user.name,
      });

      return res.json({
        success: true,
        message: "Previous due updated successfully",
        data: {
          _id: sale._id,
          invoiceNo: sale.invoiceNo,
          previousDue: parsedPreviousDue,
          dueAmount,
          totalOutstanding: newTotalOutstanding,
        },
      });
    } catch (error) {
      const { logger } = require("../config/logging");
      logger.error("Update previous due error:", { error: error.message, saleId: req.params.id });
      return res.status(500).json({ success: false, message: "Failed to update previous due" });
    }
  }
);

/**
 * GET /api/sales/:id/download-invoice
 * Generate PDF invoice and stream directly to browser (no storage needed)
 */
router.get(
  "/:id/download-invoice",
  requirePermission(PERMISSIONS.VIEW_SALES),
  async (req, res) => {
    try {
      const { ObjectId } = require("mongodb");
      const EmailService = require("../services/email/email.service");

      const sale = await req.shopDb.collection("sales").findOne({
        _id: new ObjectId(req.params.id),
      });

      if (!sale) {
        return res.status(404).json({ success: false, message: "Sale not found" });
      }

      // Enrich sale with items product names if needed
      sale.shopId = req.user.shopId;

      const pdfBuffer = await EmailService.generateInvoicePDF(sale);

      const filename = `invoice-${sale.invoiceNo || req.params.id}.pdf`;
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Length", pdfBuffer.length);
      return res.send(pdfBuffer);
    } catch (error) {
      const { logger } = require("../config/logging");
      logger.error("Download invoice error:", { error: error.message, saleId: req.params.id });
      return res.status(500).json({ success: false, message: "Failed to generate invoice PDF" });
    }
  }
);

/**
 * @swagger
 * /api/sales/{id}/send-invoice:
 *   post:
 *     summary: Generate PDF invoice and send to customer
 *     description: |
 *       Generates a professional PDF invoice for the sale, uploads it to GCS
 *       (or local storage as fallback), and sends an email with a download link
 *       to the customer. If the customer has no email, the invoice URL is still
 *       returned. Requires manage_sales permission.
 *     tags: [Sales]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Sale ID
 *         example: "507f1f77bcf86cd799439011"
 *     responses:
 *       200:
 *         description: Invoice generated (and emailed if customer has email)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 invoiceUrl:
 *                   type: string
 *                   description: Public URL to the generated PDF
 *                   example: "https://storage.googleapis.com/bucket/invoices/shop_01/invoice-abc123-1715000000000.pdf"
 *                 emailSent:
 *                   type: boolean
 *                   description: Whether the email was sent to the customer
 *                   example: true
 *                 storage:
 *                   type: string
 *                   enum: [gcs, local]
 *                   description: Where the PDF was stored
 *                   example: "gcs"
 *                 message:
 *                   type: string
 *                   example: "Invoice generated and sent to customer@example.com"
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

/**
 * POST /api/sales/:id/send-invoice
 * Generate PDF invoice, upload to GCS, and email to customer
 */
router.post(
  "/:id/send-invoice",
  requirePermission(PERMISSIONS.MANAGE_SALES),
  async (req, res) => {
    try {
      const { ObjectId } = require("mongodb");
      const EmailService = require("../services/email/email.service");
      const { logger } = require("../config/logging");

      // Fetch the sale
      const sale = await req.shopDb.collection("sales").findOne({
        _id: new ObjectId(req.params.id),
      });

      if (!sale) {
        return res.status(404).json({
          success: false,
          message: "Sale not found",
        });
      }

      // Attach shopId to sale for PDF generation and GCS path
      sale.shopId = req.user.shopId;

      // Fetch customer if sale has a customerId
      let customer = null;
      if (sale.customerId) {
        customer = await req.shopDb.collection("customers").findOne({
          _id: sale.customerId,
        });
      }

      // Fall back to inline customer data from the sale record
      if (!customer) {
        customer = {
          name: sale.customerName || "Walk-in Customer",
          email: null,
          phone: sale.customerPhone || null,
        };
      }

      // Generate PDF, upload, and optionally send email
      const { invoiceUrl, emailSent, storage } = await EmailService.sendInvoice(
        sale,
        customer,
        { shopId: req.user.shopId }
      );

      // Persist the invoice URL back to the sale record
      await req.shopDb.collection("sales").updateOne(
        { _id: sale._id },
        { $set: { invoiceUrl, invoiceGeneratedAt: new Date() } }
      );

      // Audit: invoice sent
      auditLog.log(req, AUDIT_ACTIONS.INVOICE_SENT, "sale", req.params.id,
        `Invoice ${sale.invoiceNo} generated${emailSent ? ` and emailed to ${customer.email}` : ""}`,
        { after: { invoiceNo: sale.invoiceNo, invoiceUrl, emailSent, storage } }
      );

      const message = emailSent
        ? `Invoice generated and sent to ${customer.email}`
        : customer?.email
          ? "Invoice generated but email delivery failed"
          : "Invoice generated (customer has no email address)";

      logger.info("Invoice generated", {
        saleId: req.params.id,
        invoiceNo: sale.invoiceNo,
        shopId: req.user.shopId,
        emailSent,
        storage,
        invoiceUrl,
      });

      return res.json({
        success: true,
        invoiceUrl,
        emailSent,
        storage,
        message,
      });
    } catch (error) {
      const { logger } = require("../config/logging");
      logger.error("Send invoice error:", {
        error: error.message,
        saleId: req.params.id,
        shopId: req.user?.shopId,
      });
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to generate invoice",
      });
    }
  }
);

module.exports = router;
