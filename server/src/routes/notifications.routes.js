/**
 * Notifications Routes
 * API endpoints for sending notifications
 */

const express = require('express');
const router = express.Router();
const EmailService = require('../services/email/email.service');
const SMSService = require('../services/sms/sms.service');
const { authenticate } = require('../middleware/auth-multi-tenant');
const { requirePermission } = require('../utils/rbac');
const { PERMISSIONS } = require('../utils/rbac');
const { getShopDatabase } = require('../config/database');
const { asyncHandler } = require('../config/error-handling');
const { ObjectId } = require('mongodb');
const { logger } = require('../config/logging');

// Apply authentication to all routes
router.use(authenticate);

/**
 * @swagger
 * /api/notifications/test-email:
 *   post:
 *     summary: Test email configuration
 *     description: Send a test email to verify email provider is configured correctly. Requires settings.manage permission.
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "admin@shop.com"
 *     responses:
 *       200:
 *         description: Test email sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Test email sent to admin@shop.com" }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { $ref: '#/components/responses/ForbiddenError' }
 *       500: { $ref: '#/components/responses/ServerError' }
 *
 * /api/notifications/test-sms:
 *   post:
 *     summary: Test SMS configuration
 *     description: Send a test SMS to verify SMS provider is configured correctly. Requires settings.manage permission.
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone]
 *             properties:
 *               phone:
 *                 type: string
 *                 example: "+8801712345678"
 *     responses:
 *       200:
 *         description: Test SMS sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Test SMS sent to +8801712345678" }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { $ref: '#/components/responses/ForbiddenError' }
 *       500: { $ref: '#/components/responses/ServerError' }
 *
 * /api/notifications/send-invoice:
 *   post:
 *     summary: Send invoice notification (email + SMS)
 *     description: Send invoice to customer via email and/or SMS. Requires notifications.send permission.
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [saleId]
 *             properties:
 *               saleId:
 *                 type: string
 *                 example: "507f1f77bcf86cd799439011"
 *               channels:
 *                 type: array
 *                 items: { type: string, enum: [email, sms] }
 *                 example: ["email", "sms"]
 *     responses:
 *       200:
 *         description: Invoice notification sent
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     email: { type: object }
 *                     sms: { type: object }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { $ref: '#/components/responses/ForbiddenError' }
 *       404: { $ref: '#/components/responses/NotFoundError' }
 *       500: { $ref: '#/components/responses/ServerError' }
 *
 * /api/notifications/low-stock-alert:
 *   post:
 *     summary: Send low stock alert notification
 *     description: Send low stock alert to shop admin via email and/or SMS. Requires settings.manage permission.
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               channels:
 *                 type: array
 *                 items: { type: string, enum: [email, sms] }
 *                 example: ["email"]
 *     responses:
 *       200:
 *         description: Low stock alert sent
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     itemsAlerted: { type: integer, example: 5 }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { $ref: '#/components/responses/ForbiddenError' }
 *       500: { $ref: '#/components/responses/ServerError' }
 *
 * /api/notifications/payment-reminder:
 *   post:
 *     summary: Send payment reminder to customer
 *     description: Send payment due reminder to a customer with outstanding balance. Requires notifications.send permission.
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [customerId]
 *             properties:
 *               customerId:
 *                 type: string
 *                 example: "507f1f77bcf86cd799439011"
 *               channels:
 *                 type: array
 *                 items: { type: string, enum: [email, sms] }
 *                 example: ["sms"]
 *     responses:
 *       200:
 *         description: Payment reminder sent
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Payment reminder sent" }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { $ref: '#/components/responses/ForbiddenError' }
 *       404: { $ref: '#/components/responses/NotFoundError' }
 *       500: { $ref: '#/components/responses/ServerError' }
 *
 * /api/notifications/bulk-sms:
 *   post:
 *     summary: Send bulk SMS to all customers
 *     description: Send a promotional or informational SMS to all active customers. Requires notifications.send permission.
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message]
 *             properties:
 *               message:
 *                 type: string
 *                 maxLength: 160
 *                 example: "Special offer: 20% off all surgical supplies this week!"
 *               filter:
 *                 type: object
 *                 description: Optional customer filter criteria
 *     responses:
 *       200:
 *         description: Bulk SMS queued
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     queued: { type: integer, example: 120 }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { $ref: '#/components/responses/ForbiddenError' }
 *       500: { $ref: '#/components/responses/ServerError' }
 *
 * /api/notifications/history:
 *   get:
 *     summary: Get notification history
 *     description: Retrieve paginated history of all sent notifications. Requires ADMIN or MANAGER role.
 *     tags: [Notifications]
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
 *         name: type
 *         schema: { type: string, enum: [email, sms, all], default: all }
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: Notification history retrieved
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
 */

/**
 * POST /api/notifications/test-email
 * Test email configuration
 */
router.post(
  '/test-email',
  requirePermission(PERMISSIONS.MANAGE_SETTINGS),
  asyncHandler(async (req, res) => {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email address is required',
      });
    }

    try {
      const result = await EmailService.sendTransactionalEmail(
        email,
        'test_email',
        {
          timestamp: new Date().toLocaleString(),
          shopName: 'Health Care Surgical Mart',
        },
      );

      res.json({
        success: true,
        message: 'Test email sent successfully',
        data: result,
      });
    } catch (error) {
      logger.error('Test email error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to send test email',
      });
    }
  }),
);

/**
 * POST /api/notifications/test-sms
 * Test SMS configuration
 */
router.post(
  '/test-sms',
  requirePermission(PERMISSIONS.MANAGE_SETTINGS),
  asyncHandler(async (req, res) => {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required',
      });
    }

    try {
      const result = await SMSService.send({
        to: phone,
        templateName: 'test_sms',
        variables: {
          time: new Date().toLocaleTimeString(),
        },
        shopId: req.user.shopId,
      });

      res.json({
        success: true,
        message: 'Test SMS sent successfully',
        data: result,
      });
    } catch (error) {
      logger.error('Test SMS error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to send test SMS',
      });
    }
  }),
);

/**
 * POST /api/notifications/test-whatsapp
 * Test WhatsApp configuration (via Twilio)
 */
router.post(
  '/test-whatsapp',
  requirePermission(PERMISSIONS.MANAGE_SETTINGS),
  asyncHandler(async (req, res) => {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required',
      });
    }

    // WhatsApp is handled through Twilio SMS service
    try {
      const result = await SMSService.send({
        to: phone,
        templateName: 'test_whatsapp',
        variables: {
          time: new Date().toLocaleTimeString(),
        },
        shopId: req.user.shopId,
      });

      res.json({
        success: true,
        message: 'Test WhatsApp message sent successfully',
        data: result,
      });
    } catch (error) {
      logger.error('Test WhatsApp error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to send test WhatsApp message',
      });
    }
  }),
);

/**
 * POST /api/notifications/send-promotional
 * Send promotional message to customers
 */
router.post(
  '/send-promotional',
  requirePermission(PERMISSIONS.MANAGE_CUSTOMERS),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const { message, customerIds, sendEmail, sendSMS } = req.body;

    if (!message || !message.text) {
      return res.status(400).json({
        success: false,
        message: 'Message text is required',
      });
    }

    // Get customers
    let customers;
    if (customerIds && customerIds.length > 0) {
      // Ignore malformed IDs instead of crashing the whole request
      const validIds = customerIds.filter((id) => ObjectId.isValid(id));
      customers = validIds.length
        ? await shopDb
            .collection('customers')
            .find({ _id: { $in: validIds.map((id) => new ObjectId(id)) } })
            .toArray()
        : [];
    } else {
      // Send to all active customers
      customers = await shopDb
        .collection('customers')
        .find({ isActive: true })
        .toArray();
    }

    if (customers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No customers found',
      });
    }

    const results = {
      email: { sent: 0, failed: 0 },
      sms: { sent: 0, failed: 0 },
    };

    // Send emails
    if (sendEmail) {
      for (const customer of customers) {
        if (customer.email) {
          try {
            await EmailService.sendTransactionalEmail(
              customer.email,
              'promotional',
              {
                customerName: customer.name,
                message: message.text,
              },
            );
            results.email.sent++;
          } catch (error) {
            logger.error(`Failed to send email to ${customer.email}:`, error);
            results.email.failed++;
          }
        }
      }
    }

    // Send SMS
    if (sendSMS) {
      for (const customer of customers) {
        if (customer.phone) {
          try {
            await SMSService.send({
              to: customer.phone,
              templateName: 'promotional',
              variables: {
                customerName: customer.name,
                message: message.text,
              },
              shopId: req.user.shopId,
            });
            results.sms.sent++;
          } catch (error) {
            logger.error(`Failed to send SMS to ${customer.phone}:`, error);
            results.sms.failed++;
          }
        }
      }
    }

    res.json({
      success: true,
      message: 'Promotional messages sent',
      data: results,
    });
  }),
);

/**
 * POST /api/notifications/low-stock-alert
 * Send low stock alert to admins
 */
router.post(
  '/low-stock-alert',
  requirePermission(PERMISSIONS.MANAGE_PRODUCTS),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);

    // Get low stock products
    const products = await shopDb
      .collection('products')
      .aggregate([
        {
          $lookup: {
            from: 'stock',
            localField: '_id',
            foreignField: 'productId',
            as: 'stockInfo',
          },
        },
        {
          $unwind: '$stockInfo',
        },
        {
          $match: {
            $expr: {
              $lte: ['$stockInfo.currentQty', '$minStockLevel'],
            },
            isActive: true,
          },
        },
        {
          $project: {
            name: 1,
            sku: 1,
            stockQuantity: '$stockInfo.currentQty',
            minStockLevel: 1,
            unit: 1,
          },
        },
      ])
      .toArray();

    if (products.length === 0) {
      return res.json({
        success: true,
        message: 'No low stock products found',
      });
    }

    // Get admin users
    const admins = await shopDb
      .collection('users')
      .find({
        role: 'SHOP_ADMIN',
        isActive: true,
      })
      .toArray();

    const results = { sent: 0, failed: 0 };

    // Send email alerts to admins
    for (const admin of admins) {
      if (admin.email) {
        try {
          await EmailService.sendTransactionalEmail(
            admin.email,
            'low_stock_alert',
            {
              adminName: admin.name,
              productCount: products.length,
              products: products,
            },
          );
          results.sent++;
        } catch (error) {
          logger.error(`Failed to send alert to ${admin.email}:`, error);
          results.failed++;
        }
      }
    }

    res.json({
      success: true,
      message: 'Low stock alerts sent',
      data: results,
    });
  }),
);

/**
 * POST /api/notifications/payment-reminder
 * Send payment reminder to customer
 */
router.post(
  '/payment-reminder',
  requirePermission(PERMISSIONS.MANAGE_SALES),
  asyncHandler(async (req, res) => {
    const shopDb = getShopDatabase(req.user.shopId);
    const { customerId, dueAmount, dueDate } = req.body;

    if (!customerId || !ObjectId.isValid(customerId) || !dueAmount || !dueDate) {
      return res.status(400).json({
        success: false,
        message: 'Customer ID, due amount, and due date are required',
      });
    }

    // Get customer
    const customer = await shopDb
      .collection('customers')
      .findOne({ _id: new ObjectId(customerId) });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
    }

    const results = { email: false, sms: false };

    // Send email reminder
    if (customer.email) {
      try {
        await EmailService.sendTransactionalEmail(
          customer.email,
          'payment_reminder',
          {
            customerName: customer.name,
            dueAmount: dueAmount,
            dueDate: new Date(dueDate).toLocaleDateString(),
          },
        );
        results.email = true;
      } catch (error) {
        logger.error('Failed to send payment reminder email:', error);
      }
    }

    // Send SMS reminder
    if (customer.phone) {
      try {
        await SMSService.send({
          to: customer.phone,
          templateName: 'payment_reminder',
          variables: {
            customerName: customer.name,
            dueAmount: dueAmount,
            dueDate: new Date(dueDate).toLocaleDateString(),
          },
          shopId: req.user.shopId,
        });
        results.sms = true;
      } catch (error) {
        logger.error('Failed to send payment reminder SMS:', error);
      }
    }

    res.json({
      success: true,
      message: 'Payment reminder sent',
      data: results,
    });
  }),
);

/**
 * GET /api/notifications/history
 * Get notification history (if implemented)
 */
router.get(
  '/history',
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
      .collection('notification_history')
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();

    const total = await shopDb
      .collection('notification_history')
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
