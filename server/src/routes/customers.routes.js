/**
 * Customers Routes
 * CRUD operations for customer management
 */

const express = require("express");
const router = express.Router();
const {
  authenticate,
  checkShopStatus,
} = require("../middleware/auth-multi-tenant");
const { requirePermission } = require("../utils/rbac");
const { PERMISSIONS } = require("../utils/rbac");
const customersController = require("../controllers/customers.controller");

// Apply authentication to all routes
router.use(authenticate);
router.use(checkShopStatus);

/**
 * GET /api/customers
 * Get all customers for the shop
 */
router.get(
  "/",
  requirePermission(PERMISSIONS.VIEW_CUSTOMERS),
  customersController.getCustomers.bind(customersController),
);

/**
 * GET /api/customers/:id
 * Get customer by ID
 */
router.get(
  "/:id",
  requirePermission(PERMISSIONS.VIEW_CUSTOMERS),
  customersController.getCustomerById.bind(customersController),
);

/**
 * POST /api/customers
 * Create new customer
 */
router.post(
  "/",
  requirePermission(PERMISSIONS.CREATE_CUSTOMER),
  customersController.createCustomer.bind(customersController),
);

/**
 * PUT /api/customers/:id
 * Update customer
 */
router.put(
  "/:id",
  requirePermission(PERMISSIONS.EDIT_CUSTOMER),
  customersController.updateCustomer.bind(customersController),
);

/**
 * DELETE /api/customers/:id
 * Delete customer
 */
router.delete(
  "/:id",
  requirePermission(PERMISSIONS.DELETE_CUSTOMER),
  customersController.deleteCustomer.bind(customersController),
);

module.exports = router;
