/**
 * Email Routes
 * API endpoints for email integration (SendGrid + Mailchimp)
 */

const express = require("express");
const router = express.Router();
const EmailService = require("../services/email/email.service");
const { authenticate } = require("../middleware/auth-multi-tenant");
const { requireRole, ROLES } = require("../utils/rbac");
const { getShopDatabase } = require("../config/database");
const { asyncHandler } = require("../config/error-handling");

/**
 * POST /api/email/send
 * Send a transactional email using a named template
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
  "/campaign",
  authenticate,
  requireRole([ROLES.SUPER_ADMIN, ROLES.SHOP_ADMIN]),
  asyncHandler(async (req, res) => {
    const { title, subject, content, segment, fromName, replyTo, scheduledAt } =
      req.body;

    if (!title || !subject || !content) {
      return res.status(400).json({
        success: false,
        message: "title, subject, and content are required",
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
  "/sync-customers",
  authenticate,
  requireRole([ROLES.SUPER_ADMIN, ROLES.SHOP_ADMIN]),
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
      .collection("email_logs")
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
  "/templates",
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
  "/templates",
  authenticate,
  asyncHandler(async (req, res) => {
    const { name, subject, html, variables, category } = req.body;

    if (!name || !subject || !html) {
      return res.status(400).json({
        success: false,
        message: "name, subject, and html are required",
      });
    }

    await EmailService.template.create({
      name,
      subject,
      html,
      variables: variables || [],
      category: category || "transactional",
      shopId: req.user.shopId,
    });

    res.status(201).json({
      success: true,
      message: "Template created successfully",
    });
  }),
);

/**
 * GET /api/email/templates/:name/preview
 * Preview a template rendered with sample data
 */
router.get(
  "/templates/:name/preview",
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
  "/order-confirmation",
  authenticate,
  asyncHandler(async (req, res) => {
    const { order, customer } = req.body;

    if (!order || !customer) {
      return res.status(400).json({
        success: false,
        message: "order and customer are required",
      });
    }

    const result = await EmailService.sendOrderConfirmation(order, customer);

    res.json({ success: true, data: result });
  }),
);

module.exports = router;
