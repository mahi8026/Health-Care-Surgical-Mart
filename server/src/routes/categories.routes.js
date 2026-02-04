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

// Apply authentication and shop status check to all routes
router.use(authenticate);
router.use(checkShopStatus);

/**
 * GET /api/categories
 * Get all categories
 */
router.get(
  "/",
  requirePermission(PERMISSIONS.VIEW_PRODUCTS),
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
      console.error("Get categories error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch categories",
      });
    }
  },
);

module.exports = router;
