/**
 * SMS Routes
 * API endpoints for SMS gateway integration
 */

const express = require('express');
const router = express.Router();
const SMSService = require('../services/sms/sms.service');
const { authenticate } = require('../middleware/auth-multi-tenant');
const { requirePermission, requireRole, ROLES } = require('../utils/rbac');
const { getShopDatabase } = require('../config/database');
const { asyncHandler } = require('../config/error-handling');

/**
 * @swagger
 * /api/sms/config-status:
 *   get:
 *     summary: Check SMS provider configuration status
 *     description: Returns which SMS providers (Twilio, MSG91) are configured and active. Requires authentication.
 *     tags: [SMS]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Configuration status retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     configured: { type: boolean, example: true }
 *                     provider: { type: string, example: "twilio" }
 *                     providers:
 *                       type: object
 *                       properties:
 *                         twilio: { type: boolean }
 *                         msg91: { type: boolean }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       500: { $ref: '#/components/responses/ServerError' }
 *
 * /api/sms/send:
 *   post:
 *     summary: Send SMS to a single recipient
 *     description: Send an SMS message to a phone number. Requires notifications.send permission.
 *     tags: [SMS]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [to, message]
 *             properties:
 *               to:
 *                 type: string
 *                 example: "+8801712345678"
 *               message:
 *                 type: string
 *                 maxLength: 160
 *                 example: "Your order INV-001 is ready for pickup."
 *               provider:
 *                 type: string
 *                 enum: [twilio, msg91]
 *                 description: Override default provider
 *     responses:
 *       200:
 *         description: SMS sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     messageId: { type: string }
 *                     status: { type: string }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { $ref: '#/components/responses/ForbiddenError' }
 *       500: { $ref: '#/components/responses/ServerError' }
 *
 * /api/sms/send-bulk:
 *   post:
 *     summary: Send bulk SMS to multiple recipients
 *     description: Send SMS to multiple phone numbers at once. Requires notifications.send permission.
 *     tags: [SMS]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [recipients, message]
 *             properties:
 *               recipients:
 *                 type: array
 *                 items: { type: string }
 *                 example: ["+8801712345678", "+8801812345678"]
 *               message:
 *                 type: string
 *                 maxLength: 160
 *                 example: "Special offer: 20% off all surgical supplies this week!"
 *     responses:
 *       200:
 *         description: Bulk SMS queued successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     queued: { type: integer, example: 50 }
 *                     failed: { type: integer, example: 2 }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { $ref: '#/components/responses/ForbiddenError' }
 *       500: { $ref: '#/components/responses/ServerError' }
 *
 * /api/sms/logs:
 *   get:
 *     summary: Get SMS logs
 *     description: Retrieve paginated SMS delivery logs. Requires ADMIN or MANAGER role.
 *     tags: [SMS]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [sent, delivered, failed, pending] }
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: SMS logs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: array, items: { type: object } }
 *                 pagination: { $ref: '#/components/schemas/PaginationMeta' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { $ref: '#/components/responses/ForbiddenError' }
 *       500: { $ref: '#/components/responses/ServerError' }
 *
 * /api/sms/templates:
 *   get:
 *     summary: Get SMS templates
 *     description: Retrieve available SMS message templates. Requires authentication.
 *     tags: [SMS]
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
 *   post:
 *     summary: Create SMS template
 *     description: Create a reusable SMS message template. Requires ADMIN role.
 *     tags: [SMS]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, message]
 *             properties:
 *               name: { type: string, example: "Invoice Ready" }
 *               message: { type: string, example: "Dear {{customerName}}, your invoice {{invoiceNumber}} is ready." }
 *     responses:
 *       201:
 *         description: Template created successfully
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
 * /api/sms/stats:
 *   get:
 *     summary: Get SMS usage statistics
 *     description: Retrieve SMS delivery statistics and usage summary. Requires ADMIN role.
 *     tags: [SMS]
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
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalSent: { type: integer }
 *                     delivered: { type: integer }
 *                     failed: { type: integer }
 *                     deliveryRate: { type: number }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { $ref: '#/components/responses/ForbiddenError' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */

/**
 * GET /api/sms/config-status
 * Check SMS provider configuration status
 */
router.get('/config-status', authenticate, (req, res) => {
  const twilioConfigured =
    !!process.env.TWILIO_ACCOUNT_SID &&
    !!process.env.TWILIO_AUTH_TOKEN &&
    !!process.env.TWILIO_PHONE_NUMBER;

  const msg91Configured = !!process.env.MSG91_API_KEY && !!process.env.MSG91_SENDER_ID;

  const defaultProvider = process.env.SMS_DEFAULT_PROVIDER || 'twilio';
  const isConfigured =
    (defaultProvider === 'twilio' && twilioConfigured) ||
    (defaultProvider === 'msg91' && msg91Configured);

  res.json({
    success: true,
    data: {
      configured: isConfigured,
      provider: defaultProvider,
      providers: {
        twilio: twilioConfigured,
        msg91: msg91Configured,
      },
    },
  });
});

/**
 * POST /api/sms/send
 * Send a transactional SMS using a named template
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

    try {
      const result = await SMSService.sendTransactionalSMS(
        to,
        templateName,
        variables || {},
      );

      res.json({ success: true, data: result });
    } catch (error) {
      // Return a user-friendly error message
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to send SMS',
      });
    }
  }),
);

/**
 * POST /api/sms/bulk
 * Send bulk SMS (requires SEND_BULK_SMS permission)
 */
router.post(
  '/bulk',
  authenticate,
  requirePermission('SEND_BULK_SMS'),
  asyncHandler(async (req, res) => {
    const { recipients, message, scheduledAt } = req.body;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'recipients must be a non-empty array',
      });
    }

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'message is required',
      });
    }

    const result = await SMSService.sendBulkSMS(recipients, message, {
      scheduledAt,
      shopId: req.user.shopId,
    });

    res.json({ success: true, data: result });
  }),
);

/**
 * GET /api/sms/logs
 * Get SMS logs with optional filters (startDate, endDate, type, status)
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
      .collection('sms_logs')
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();

    res.json({ success: true, data: logs });
  }),
);

/**
 * GET /api/sms/status/:messageId
 * Get delivery status for a message (requires provider query param)
 */
router.get(
  '/status/:messageId',
  authenticate,
  asyncHandler(async (req, res) => {
    const { messageId } = req.params;
    const { provider } = req.query;

    if (!provider) {
      return res.status(400).json({
        success: false,
        message: 'provider query parameter is required',
      });
    }

    const status = await SMSService.getDeliveryStatus(messageId, provider);

    res.json({ success: true, data: status });
  }),
);

/**
 * POST /api/sms/otp
 * Send OTP to a phone number
 */
router.post(
  '/otp',
  authenticate,
  asyncHandler(async (req, res) => {
    const { phoneNumber, otp } = req.body;

    if (!phoneNumber || !otp) {
      return res.status(400).json({
        success: false,
        message: 'phoneNumber and otp are required',
      });
    }

    const result = await SMSService.sendOTP(phoneNumber, otp);

    res.json({ success: true, data: result });
  }),
);

/**
 * GET /api/sms/templates
 * List SMS templates (built-in + custom for the shop)
 */
router.get(
  '/templates',
  authenticate,
  asyncHandler(async (req, res) => {
    const templates = await SMSService.template.list(req.user.shopId);

    res.json({ success: true, data: templates });
  }),
);

/**
 * POST /api/sms/templates
 * Create a custom SMS template
 */
router.post(
  '/templates',
  authenticate,
  asyncHandler(async (req, res) => {
    const { name, content, variables, category, dltId } = req.body;

    if (!name || !content) {
      return res.status(400).json({
        success: false,
        message: 'name and content are required',
      });
    }

    await SMSService.template.create({
      name,
      content,
      variables: variables || [],
      category: category || 'transactional',
      dltId: dltId || null,
      shopId: req.user.shopId,
    });

    res.status(201).json({
      success: true,
      message: 'Template created successfully',
    });
  }),
);

/**
 * GET /api/sms/queue/stats
 * Get SMS queue statistics (admin only)
 */
router.get(
  '/queue/stats',
  authenticate,
  requireRole([ROLES.SHOP_ADMIN]),
  asyncHandler(async (req, res) => {
    const stats = await SMSService.queue.getStats();

    res.json({ success: true, data: stats });
  }),
);

module.exports = router;
