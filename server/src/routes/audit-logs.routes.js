/**
 * Audit Logs Routes
 * Read-only access to the audit trail.
 * SHOP_ADMIN: own shop only.
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth-multi-tenant');
const { ROLES } = require('../utils/rbac');
const auditLogService = require('../services/audit-log.service');
const { AUDIT_ACTIONS } = require('../models/audit-log.schema');

router.use(authenticate);

/**
 * @swagger
 * /api/audit-logs:
 *   get:
 *     summary: Query audit logs
 *     description: |
 *       Retrieve paginated audit log entries.
 *       SHOP_ADMIN is automatically scoped to their own shop.
 *       Requires SHOP_ADMIN role.
 *     tags: [Audit Logs]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: shopId
 *         schema: { type: string }
 *         description: Filter by shop (auto-scoped to user's shop)
 *       - in: query
 *         name: userId
 *         schema: { type: string }
 *         description: Filter by user ID
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *           enum: [LOGIN, LOGOUT, LOGIN_FAILED, TOKEN_REFRESH, USER_CREATED,
 *                  USER_UPDATED, USER_DELETED, ROLE_CHANGED, PASSWORD_CHANGED,
 *                  PRODUCT_CREATED, PRODUCT_UPDATED, PRODUCT_DELETED, BULK_IMPORT,
 *                  SALE_CREATED, SALE_VOIDED, INVOICE_SENT,
 *                  RETURN_CREATED, RETURN_APPROVED, RETURN_REJECTED,
 *                  PURCHASE_CREATED, PURCHASE_UPDATED,
 *                  CUSTOMER_CREATED, CUSTOMER_UPDATED, CUSTOMER_DELETED,
 *                  EXPENSE_CREATED, EXPENSE_UPDATED, EXPENSE_DELETED,
 *                  SETTINGS_UPDATED, PERMISSION_CHANGED]
 *         description: Filter by action type
 *       - in: query
 *         name: resource
 *         schema: { type: string }
 *         description: Filter by resource type (e.g. "product", "sale", "user")
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date }
 *         example: "2026-05-01"
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date }
 *         example: "2026-05-31"
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 200, default: 50 }
 *     responses:
 *       200:
 *         description: Audit logs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id: { type: string }
 *                       shopId: { type: string }
 *                       userId: { type: string }
 *                       userEmail: { type: string }
 *                       role: { type: string }
 *                       action: { type: string }
 *                       resource: { type: string }
 *                       resourceId: { type: string }
 *                       description: { type: string }
 *                       ipAddress: { type: string }
 *                       status: { type: string, enum: [success, failure] }
 *                       timestamp: { type: string, format: date-time }
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationMeta'
 *                 availableActions:
 *                   type: array
 *                   items: { type: string }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { $ref: '#/components/responses/ForbiddenError' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
router.get('/', async (req, res) => {
  try {
    const { role, shopId: userShopId } = req.user;

    // Only SHOP_ADMIN can access audit logs
    if (role !== 'SHOP_ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions to view audit logs',
      });
    }

    const {
      userId,
      action,
      resource,
      startDate,
      endDate,
      page = 1,
      limit = 50,
    } = req.query;

    // SHOP_ADMIN is always scoped to their own shop
    const effectiveShopId = userShopId;

    const result = await auditLogService.query({
      shopId: effectiveShopId,
      userId,
      action,
      resource,
      startDate,
      endDate,
      page: parseInt(page),
      limit: parseInt(limit),
    });

    return res.json({
      success: true,
      data: result.entries,
      pagination: {
        page: result.page,
        limit: parseInt(limit),
        total: result.total,
        pages: result.pages,
      },
      availableActions: Object.values(AUDIT_ACTIONS),
    });
  } catch (error) {
    const { logger } = require('../config/logging');
    logger.error('Audit log query error:', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve audit logs',
    });
  }
});

module.exports = router;
