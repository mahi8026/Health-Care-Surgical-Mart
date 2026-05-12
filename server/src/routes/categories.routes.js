/**
 * Categories Routes - Multi-Tenant
 * Handles product categories
 */

const express = require("express");
const router = express.Router();
const {
  authenticate,
  checkShopStatus,
} = require("../middleware/auth-multi-tenant");
const { requirePermission } = require("../utils/rbac");
const { PERMISSIONS } = require("../utils/rbac");
const { logger } = require('../config/logging');
const { cacheResponse } = require("../middleware/cache.middleware");
const { TTL } = require("../services/cache.service");

// Apply authentication and shop status check to all routes
router.use(authenticate);
router.use(checkShopStatus);

/**
 * @swagger
 * /api/categories:
 *   get:
 *     summary: Get all product categories
 *     description: Retrieve the predefined list of medical product categories. Requires products.view permission.
 *     tags: [Products]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Categories retrieved successfully
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
 *                       _id: { type: string, example: "medical" }
 *                       name: { type: string, example: "Medical" }
 *                       description: { type: string }
 *                       isActive: { type: boolean, example: true }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { $ref: '#/components/responses/ForbiddenError' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */

/**
 * GET /api/categories
 * Get all categories
 */
router.get(
  "/",
  requirePermission(PERMISSIONS.VIEW_PRODUCTS),
  cacheResponse(TTL.CATEGORIES, (req) => `categories:${req.user.shopId}`),
  async (req, res) => {
    try {
      // Return predefined categories for medical store
      const categories = [
        {
          _id: "medical",
          name: "Medical",
          description: "Pharmaceutical medicines and drugs",
          isActive: true,
        },
        {
          _id: "lab",
          name: "Lab",
          description: "Laboratory equipment and diagnostic tools",
          isActive: true,
        },
        {
          _id: "surgical",
          name: "Surgical",
          description: "Surgical instruments and supplies",
          isActive: true,
        },
      ];

      res.json({
        success: true,
        count: categories.length,
        data: categories,
      });
    } catch (error) {
      logger.error("Get categories error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch categories",
      });
    }
  },
);

module.exports = router;
