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

// Apply authentication and shop status check to all routes
router.use(authenticate);
router.use(checkShopStatus);

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

module.exports = router;
