/**
 * Products Routes - Multi-Tenant
 * Handles product CRUD operations for shops
 */

const express = require("express");
const router = express.Router();
const {
  authenticate,
  checkShopStatus,
} = require("../middleware/auth-multi-tenant");
const { requirePermission } = require("../utils/rbac");
const { PERMISSIONS } = require("../utils/rbac");
const productsController = require("../controllers/products.controller");

// Apply authentication and shop status check to all routes
router.use(authenticate);
router.use(checkShopStatus);

/**
 * GET /api/products
 * Get all products for the shop
 */
router.get(
  "/",
  requirePermission(PERMISSIONS.VIEW_PRODUCTS),
  productsController.getProducts.bind(productsController),
);

/**
 * GET /api/products/:id
 * Get single product by ID
 */
router.get(
  "/:id",
  requirePermission(PERMISSIONS.VIEW_PRODUCTS),
  productsController.getProductById.bind(productsController),
);

/**
 * POST /api/products
 * Create new product
 */
router.post(
  "/",
  requirePermission(PERMISSIONS.CREATE_PRODUCT),
  productsController.createProduct.bind(productsController),
);

/**
 * PUT /api/products/:id
 * Update product
 */
router.put(
  "/:id",
  requirePermission(PERMISSIONS.EDIT_PRODUCT),
  productsController.updateProduct.bind(productsController),
);

/**
 * DELETE /api/products/:id
 * Delete product (soft delete)
 */
router.delete(
  "/:id",
  requirePermission(PERMISSIONS.DELETE_PRODUCT),
  productsController.deleteProduct.bind(productsController),
);

module.exports = router;
