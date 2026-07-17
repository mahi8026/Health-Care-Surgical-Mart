/**
 * Email Routes
 * API endpoints for email integration (SendGrid + Mailchimp)
 */

const express = require('express');
const router = express.Router();
const EmailService = require('../services/email/email.service');
const { authenticate } = require('../middleware/auth-multi-tenant');
const { requireRole, ROLES } = require('../utils/rbac');
const { getShopDatabase } = require('../config/database');
const { asyncHandler } = require('../config/error-handling');

/**
 * @swagger
 * /api/email/send:
 *   post:
 *     summary: Send transactional email
 *     description: Send a transactional email using a named template. Requires authentication.
 *     tags: [Email]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [to, templateName]
 *             properties:
 *               to:
 *                 type: string
 *                 format: email
 *                 example: "customer@example.com"
 *               templateName:
 *                 type: string
 *                 enum: [welcome, invoice, order_confirmation, password_reset]
 *                 example: "invoice"
 *               variables:
 *                 type: object
 *                 description: Template variables to inject
 *                 example: { "customerName": "Dr. Ahmed", "invoiceNumber": "INV-001" }
 *     responses:
 *       200:
 *         description: Email sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: object }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       500: { $ref: '#/components/responses/ServerError' }
 *
 * /api/email/send-invoice:
 *   post:
 *     summary: Send invoice email to customer
 *     description: Send a sale invoice to a customer's email address. Requires authentication.
 *     tags: [Email]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [saleId, customerEmail]
 *             properties:
 *               saleId:
 *                 type: string
 *                 example: "507f1f77bcf86cd799439011"
 *               customerEmail:
 *                 type: string
 *                 format: email
 *                 example: "customer@example.com"
 *     responses:
 *       200:
 *         description: Invoice email sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Invoice sent to customer@example.com" }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       404: { $ref: '#/components/responses/NotFoundError' }
 *       500: { $ref: '#/components/responses/ServerError' }
 *
 * /api/email/campaigns:
 *   get:
 *     summary: Get email campaigns
 *     description: Retrieve list of email marketing campaigns. Requires ADMIN or MANAGER role.
 *     tags: [Email]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Campaigns retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: array, items: { type: object } }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { $ref: '#/components/responses/ForbiddenError' }
 *       500: { $ref: '#/components/responses/ServerError' }
 *
 *   post:
 *     summary: Create email campaign
 *     description: Create a new email marketing campaign. Requires ADMIN or MANAGER role.
 *     tags: [Email]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, subject, templateName, recipients]
 *             properties:
 *               name: { type: string, example: "May Promotion" }
 *               subject: { type: string, example: "Special Offer for You!" }
 *               templateName: { type: string }
 *               recipients:
 *                 type: string
 *                 enum: [all_customers, active_customers, custom]
 *               scheduledAt:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Campaign created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: object }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { $ref: '#/components/responses/ForbiddenError' }
 *       500: { $ref: '#/components/responses/ServerError' }
 *
 * /api/email/templates:
 *   get:
 *     summary: Get available email templates
 *     description: Retrieve list of available email templates. Requires authentication.
 *     tags: [Email]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Templates retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: array, items: { type: object } }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       500: { $ref: '#/components/responses/ServerError' }
 *
 * /api/email/campaigns/{id}/send:
 *   post:
 *     summary: Send email campaign
 *     description: Trigger sending of a scheduled or draft campaign. Requires ADMIN role.
 *     tags: [Email]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Campaign sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Campaign sent to 150 recipients" }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { $ref: '#/components/responses/ForbiddenError' }
 *       404: { $ref: '#/components/responses/NotFoundError' }
 *       500: { $ref: '#/components/responses/ServerError' }
 *
 * /api/email/campaigns/{id}/analytics:
 *   get:
 *     summary: Get campaign analytics
 *     description: Retrieve open rates, click rates, and delivery stats for a campaign. Requires ADMIN or MANAGER role.
 *     tags: [Email]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Analytics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     sent: { type: integer }
 *                     delivered: { type: integer }
 *                     opened: { type: integer }
 *                     clicked: { type: integer }
 *                     openRate: { type: number }
 *                     clickRate: { type: number }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { $ref: '#/components/responses/ForbiddenError' }
 *       404: { $ref: '#/components/responses/NotFoundError' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */

/**
 * POST /api/email/send
 * Send a transactional email using a named template
 */
router.post(
  '/send',
  authenticate,
  asyncHandler(async (req, res) => {
    const { to, templateName, variables } = req.body;

    if (!to || !templateName) {
      return res.status(400).json({
        success: false,
        message: 'to and templateName are required',
      });
    }

    const result = await EmailService.sendTransactionalEmail(
      to,
      templateName,
      variables || {},
    );

    res.json({ success: true, data: result });
  }),
);

/**
 * POST /api/email/campaign
 * Create and send a marketing campaign via Mailchimp (admin only)
 */
router.post(
  '/campaign',
  authenticate,
  requireRole([ROLES.SHOP_ADMIN]),
  asyncHandler(async (req, res) => {
    const { title, subject, content, segment, fromName, replyTo, scheduledAt } =
      req.body;

    if (!title || !subject || !content) {
      return res.status(400).json({
        success: false,
        message: 'title, subject, and content are required',
      });
    }

    const result = await EmailService.sendMarketingCampaign({
      title,
      subject,
      content,
      segment,
      fromName,
      replyTo,
      scheduledAt,
    });

    res.json({ success: true, data: result });
  }),
);

/**
 * POST /api/email/sync-customers
 * Sync opted-in customers to Mailchimp (admin only)
 */
router.post(
  '/sync-customers',
  authenticate,
  requireRole([ROLES.SHOP_ADMIN]),
  asyncHandler(async (req, res) => {
    const shopId = req.user.shopId;

    const result = await EmailService.syncCustomersToMailchimp(shopId);

    res.json({ success: true, data: result });
  }),
);

/**
 * GET /api/email/logs
 * Get email logs with optional filters (startDate, endDate, type, status)
 */
router.get(
  '/logs',
  authenticate,
  asyncHandler(async (req, res) => {
    const { startDate, endDate, type, status } = req.query;

    const db = getShopDatabase(req.user.shopId);
    const filter = {};

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {filter.createdAt.$gte = new Date(startDate);}
      if (endDate) {filter.createdAt.$lte = new Date(endDate);}
    }

    if (type) {filter.type = type;}
    if (status) {filter.status = status;}

    const logs = await db
      .collection('email_logs')
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();

    res.json({ success: true, data: logs });
  }),
);

/**
 * GET /api/email/templates
 * List email templates (built-in + custom for the shop)
 */
router.get(
  '/templates',
  authenticate,
  asyncHandler(async (req, res) => {
    const templates = await EmailService.template.list(req.user.shopId);

    res.json({ success: true, data: templates });
  }),
);

/**
 * POST /api/email/templates
 * Create a custom email template
 */
router.post(
  '/templates',
  authenticate,
  asyncHandler(async (req, res) => {
    const { name, subject, html, variables, category } = req.body;

    if (!name || !subject || !html) {
      return res.status(400).json({
        success: false,
        message: 'name, subject, and html are required',
      });
    }

    await EmailService.template.create({
      name,
      subject,
      html,
      variables: variables || [],
      category: category || 'transactional',
      shopId: req.user.shopId,
    });

    res.status(201).json({
      success: true,
      message: 'Template created successfully',
    });
  }),
);

/**
 * GET /api/email/templates/:name/preview
 * Preview a template rendered with sample data
 */
router.get(
  '/templates/:name/preview',
  authenticate,
  asyncHandler(async (req, res) => {
    const { name } = req.params;

    const tmpl = await EmailService.template.get(name);
    const sampleVariables = (tmpl.variables || []).reduce((acc, v) => {
      acc[v] = `[${v}]`;
      return acc;
    }, {});

    const { subject, html } = EmailService.template.render(
      tmpl,
      sampleVariables,
    );

    res.json({ success: true, data: { name, subject, html } });
  }),
);

/**
 * POST /api/email/order-confirmation
 * Send an order confirmation email to a customer
 */
router.post(
  '/order-confirmation',
  authenticate,
  asyncHandler(async (req, res) => {
    const { order, customer } = req.body;

    if (!order || !customer) {
      return res.status(400).json({
        success: false,
        message: 'order and customer are required',
      });
    }

    const result = await EmailService.sendOrderConfirmation(order, customer);

    res.json({ success: true, data: result });
  }),
);

module.exports = router;
