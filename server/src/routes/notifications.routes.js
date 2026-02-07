/**
 * Notifications Routes
 * API endpoints for sending notifications
 */

const express = require("express");
const router = express.Router();
const notificationService = require("../services/notification.service");
const { authenticate } = require("../middleware/auth-multi-tenant");
const { requirePermission } = require("../utils/rbac");
const { PERMISSIONS } = require("../utils/rbac");
const { getShopDatabase } = require("../config/database");
const { asyncHandler } = require("../config/error-handling");

// Apply authentication to all routes
router.use(authenticate);

/**
 * POST /api/notifications/test-email
 * Test email configuration
 */
router.post(
  "/test-email",
  requirePermission(PERMISSIONS.MANAGE_SETTINGS),
  asyncHandler(async (req, res) => {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email address is required",
      });
    }

    const result = await notificationService.sendEmail({
      to: email,
      subject: "Test Email from Health Care Surgical Mart",
      html: `
        <h2>Email Configuration Test</h2>
        <p>This is a test email from your Health Care Surgical Mart POS system.</p>
        <p>If you received this email, your email configuration is working correctly!</p>
        <p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
      `,
    });

    res.json(result);
  }),
);

/**
 * POST /api/notifications/test-sms
 * Test SMS configuration
 */
router.post(
  "/test-sms",
  requirePermission(PERMISSIONS.MANAGE_SETTINGS),
  asyncHandler(async (req, res) => {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required",
      });
    }

    const result = await notificationService.sendSMS({
      to: phone,
      message: `Test SMS from Health Care Surgical Mart. Your SMS configuration is working! Time: ${new Date().toLocaleTimeString()}`,
    });

    res.json(result);
  }),
);

/**
 * POST /api/notifications/test-whatsapp
 * Test WhatsApp configuration
 */
router.post(
  "/test-whatsapp",
  requirePermission(PERMISSIONS.MANAGE_SETTINGS),
  asyncHandler(async (req, res) => {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required",
      });
    }

    const result = await notificationService.sendWhatsApp({
      to: phone,
      message: `🏥 *Test Message*\n\nYour WhatsApp configuration is working correctly!\n\n⏰ Time: ${new Date().toLocaleTimeString()}\n\n- Health Care Surgical Mart`,
    });

    res.json(result);
  }),
);

/**
 * POST /api/notifications/send-promotional
 * Send promotional message to customers
 */
router.post(
  "/send-promotional",
  requirePermission(PERMISSIONS.MANAGE_CUSTOMERS),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const { message, customerIds, sendEmail, sendSMS, sendWhatsApp } = req.body;

    if (!message || !message.text) {
      return res.status(400).json({
        success: false,
        message: "Message text is required",
      });
    }

    // Get customers
    let customers;
    if (customerIds && customerIds.length > 0) {
      customers = await shopDb
        .collection("customers")
        .find({
          _id: { $in: customerIds.map((id) => new ObjectId(id)) },
        })
        .toArray();
    } else {
      // Send to all active customers
      customers = await shopDb
        .collection("customers")
        .find({ isActive: true })
        .toArray();
    }

    if (customers.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No customers found",
      });
    }

    // Get shop settings
    const settings = await shopDb.collection("settings").findOne({});
    const notificationSettings = {
      emailNotifications: sendEmail && settings?.emailNotifications,
      smsNotifications: sendSMS && settings?.smsNotifications,
      whatsappNotifications: sendWhatsApp && settings?.whatsappNotifications,
    };

    const result = await notificationService.sendPromotionalMessage(
      customers,
      message,
      notificationSettings,
    );

    res.json(result);
  }),
);

/**
 * POST /api/notifications/low-stock-alert
 * Send low stock alert to admins
 */
router.post(
  "/low-stock-alert",
  requirePermission(PERMISSIONS.MANAGE_PRODUCTS),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);

    // Get low stock products
    const products = await shopDb
      .collection("products")
      .aggregate([
        {
          $lookup: {
            from: "stock",
            localField: "_id",
            foreignField: "productId",
            as: "stockInfo",
          },
        },
        {
          $unwind: "$stockInfo",
        },
        {
          $match: {
            $expr: {
              $lte: ["$stockInfo.currentQty", "$minStockLevel"],
            },
            isActive: true,
          },
        },
        {
          $project: {
            name: 1,
            sku: 1,
            stockQuantity: "$stockInfo.currentQty",
            minStockLevel: 1,
            unit: 1,
          },
        },
      ])
      .toArray();

    if (products.length === 0) {
      return res.json({
        success: true,
        message: "No low stock products found",
      });
    }

    // Get admin users
    const admins = await shopDb
      .collection("users")
      .find({
        role: { $in: ["admin", "super_admin"] },
        isActive: true,
      })
      .toArray();

    // Get shop settings
    const settings = await shopDb.collection("settings").findOne({});

    const result = await notificationService.sendLowStockAlert(
      products,
      admins,
      settings || {},
    );

    res.json(result);
  }),
);

/**
 * POST /api/notifications/payment-reminder
 * Send payment reminder to customer
 */
router.post(
  "/payment-reminder",
  requirePermission(PERMISSIONS.MANAGE_SALES),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const { customerId, dueAmount, dueDate } = req.body;

    if (!customerId || !dueAmount || !dueDate) {
      return res.status(400).json({
        success: false,
        message: "Customer ID, due amount, and due date are required",
      });
    }

    // Get customer
    const customer = await shopDb
      .collection("customers")
      .findOne({ _id: new ObjectId(customerId) });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    // Get shop settings
    const settings = await shopDb.collection("settings").findOne({});

    const result = await notificationService.sendPaymentReminder(
      customer,
      dueAmount,
      dueDate,
      settings || {},
    );

    res.json(result);
  }),
);

/**
 * GET /api/notifications/history
 * Get notification history (if implemented)
 */
router.get(
  "/history",
  requirePermission(PERMISSIONS.VIEW_REPORTS),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const { page = 1, limit = 20, type } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const query = {};

    if (type) {
      query.type = type;
    }

    const notifications = await shopDb
      .collection("notification_history")
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();

    const total = await shopDb
      .collection("notification_history")
      .countDocuments(query);

    res.json({
      success: true,
      data: notifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  }),
);

module.exports = router;
