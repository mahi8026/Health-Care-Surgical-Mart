/**
 * SMS Routes
 * API endpoints for SMS gateway integration
 */

const express = require("express");
const router = express.Router();
const SMSService = require("../services/sms/sms.service");
const { authenticate } = require("../middleware/auth-multi-tenant");
const { requirePermission, requireRole, ROLES } = require("../utils/rbac");
const { getShopDatabase } = require("../config/database");
const { asyncHandler } = require("../config/error-handling");

/**
 * POST /api/sms/send
 * Send a transactional SMS using a named template
 */
router.post(
  "/send",
  authenticate,
  asyncHandler(async (req, res) => {
    const { to, templateName, variables } = req.body;

    if (!to || !templateName) {
      return res.status(400).json({
        success: false,
        message: "to and templateName are required",
      });
    }

    const result = await SMSService.sendTransactionalSMS(
      to,
      templateName,
      variables || {},
    );

    res.json({ success: true, data: result });
  }),
);

/**
 * POST /api/sms/bulk
 * Send bulk SMS (requires SEND_BULK_SMS permission)
 */
router.post(
  "/bulk",
  authenticate,
  requirePermission("SEND_BULK_SMS"),
  asyncHandler(async (req, res) => {
    const { recipients, message, scheduledAt } = req.body;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({
        success: false,
        message: "recipients must be a non-empty array",
      });
    }

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "message is required",
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
  "/logs",
  authenticate,
  asyncHandler(async (req, res) => {
    const { startDate, endDate, type, status } = req.query;

    const db = getShopDatabase(req.user.shopId);
    const filter = {};

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    if (type) filter.type = type;
    if (status) filter.status = status;

    const logs = await db
      .collection("sms_logs")
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
  "/status/:messageId",
  authenticate,
  asyncHandler(async (req, res) => {
    const { messageId } = req.params;
    const { provider } = req.query;

    if (!provider) {
      return res.status(400).json({
        success: false,
        message: "provider query parameter is required",
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
  "/otp",
  authenticate,
  asyncHandler(async (req, res) => {
    const { phoneNumber, otp } = req.body;

    if (!phoneNumber || !otp) {
      return res.status(400).json({
        success: false,
        message: "phoneNumber and otp are required",
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
  "/templates",
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
  "/templates",
  authenticate,
  asyncHandler(async (req, res) => {
    const { name, content, variables, category, dltId } = req.body;

    if (!name || !content) {
      return res.status(400).json({
        success: false,
        message: "name and content are required",
      });
    }

    await SMSService.template.create({
      name,
      content,
      variables: variables || [],
      category: category || "transactional",
      dltId: dltId || null,
      shopId: req.user.shopId,
    });

    res.status(201).json({
      success: true,
      message: "Template created successfully",
    });
  }),
);

/**
 * GET /api/sms/queue/stats
 * Get SMS queue statistics (admin only)
 */
router.get(
  "/queue/stats",
  authenticate,
  requireRole([ROLES.SUPER_ADMIN, ROLES.SHOP_ADMIN]),
  asyncHandler(async (req, res) => {
    const stats = await SMSService.queue.getStats();

    res.json({ success: true, data: stats });
  }),
);

module.exports = router;
