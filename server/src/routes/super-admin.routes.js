/**
 * Super Admin Routes
 * Routes for system-wide shop management
 */

const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth-multi-tenant");
const { requireRole } = require("../utils/rbac");
const { ROLES } = require("../utils/rbac");
const {
  createShop,
  listShops,
  getShop,
  updateShopStatus,
  deleteShop,
  getShopStats,
} = require("../utils/shop-manager");
const { listAllShops } = require("../config/database");
const { logger } = require('../config/logging');
const auditLog = require("../services/audit-log.service");
const { AUDIT_ACTIONS } = require("../models/audit-log.schema");

// All routes require SUPER_ADMIN role
router.use(authenticate);
router.use(requireRole([ROLES.SUPER_ADMIN]));

/**
 * @swagger
 * /api/super-admin/shops:
 *   post:
 *     summary: Create a new shop
 *     description: Create a new tenant shop with admin user. Requires SUPER_ADMIN role.
 *     tags: [Super Admin]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [shopData, adminData]
 *             properties:
 *               shopData:
 *                 type: object
 *                 required: [name, ownerEmail]
 *                 properties:
 *                   name: { type: string, example: "City Medical Store" }
 *                   ownerEmail: { type: string, format: email, example: "owner@citymedical.com" }
 *                   phone: { type: string, example: "+8801712345678" }
 *                   address: { type: string, example: "123 Main St, Dhaka" }
 *                   subscriptionPlan: { type: string, enum: [basic, professional, enterprise], example: "professional" }
 *               adminData:
 *                 type: object
 *                 required: [name, email, password]
 *                 properties:
 *                   name: { type: string, example: "Shop Admin" }
 *                   email: { type: string, format: email, example: "admin@citymedical.com" }
 *                   password: { type: string, format: password, minLength: 8 }
 *     responses:
 *       201:
 *         description: Shop created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Shop created successfully" }
 *                 data:
 *                   type: object
 *                   properties:
 *                     shopId: { type: string, example: "shop_citymedical_001" }
 *                     shop: { type: object }
 *                     admin: { $ref: '#/components/schemas/User' }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { $ref: '#/components/responses/ForbiddenError' }
 *       500: { $ref: '#/components/responses/ServerError' }
 *
 *   get:
 *     summary: List all shops
 *     description: Retrieve all registered shops in the system. Requires SUPER_ADMIN role.
 *     tags: [Super Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [Active, Suspended, Inactive] }
 *     responses:
 *       200:
 *         description: Shops retrieved successfully
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
 *
 * /api/super-admin/shops/{shopId}:
 *   get:
 *     summary: Get shop details
 *     description: Retrieve detailed information about a specific shop. Requires SUPER_ADMIN role.
 *     tags: [Super Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: shopId
 *         required: true
 *         schema: { type: string }
 *         example: "shop_citymedical_001"
 *     responses:
 *       200:
 *         description: Shop retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: object }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { $ref: '#/components/responses/ForbiddenError' }
 *       404: { $ref: '#/components/responses/NotFoundError' }
 *       500: { $ref: '#/components/responses/ServerError' }
 *
 *   delete:
 *     summary: Delete shop
 *     description: Permanently delete a shop and all its data. Irreversible. Requires SUPER_ADMIN role.
 *     tags: [Super Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: shopId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Shop deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Shop deleted successfully" }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { $ref: '#/components/responses/ForbiddenError' }
 *       404: { $ref: '#/components/responses/NotFoundError' }
 *       500: { $ref: '#/components/responses/ServerError' }
 *
 * /api/super-admin/shops/{shopId}/status:
 *   patch:
 *     summary: Update shop status
 *     description: Activate, suspend, or deactivate a shop. Requires SUPER_ADMIN role.
 *     tags: [Super Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: shopId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [Active, Suspended, Inactive]
 *                 example: "Suspended"
 *               reason:
 *                 type: string
 *                 example: "Payment overdue"
 *     responses:
 *       200:
 *         description: Shop status updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Shop status updated to Suspended" }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { $ref: '#/components/responses/ForbiddenError' }
 *       404: { $ref: '#/components/responses/NotFoundError' }
 *       500: { $ref: '#/components/responses/ServerError' }
 *
 * /api/super-admin/shops/{shopId}/stats:
 *   get:
 *     summary: Get shop statistics
 *     description: Retrieve usage statistics for a specific shop. Requires SUPER_ADMIN role.
 *     tags: [Super Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: shopId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Shop stats retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalSales: { type: integer }
 *                     totalProducts: { type: integer }
 *                     totalCustomers: { type: integer }
 *                     totalUsers: { type: integer }
 *                     lastActivity: { type: string, format: date-time }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { $ref: '#/components/responses/ForbiddenError' }
 *       404: { $ref: '#/components/responses/NotFoundError' }
 *       500: { $ref: '#/components/responses/ServerError' }
 *
 * /api/super-admin/database-list:
 *   get:
 *     summary: List all shop databases
 *     description: Retrieve list of all MongoDB collections/databases for all shops. Requires SUPER_ADMIN role.
 *     tags: [Super Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Database list retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: array, items: { type: object } }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { $ref: '#/components/responses/ForbiddenError' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */

/**
 * GET /api/super-admin/dashboard
 * Get platform-level dashboard statistics
 */
router.get("/dashboard", async (req, res) => {
  try {
    const systemDb = getSystemDatabase();

    // Get all shops
    const allShops = await systemDb.collection("shops").find({}).toArray();
    const activeShops = allShops.filter((s) => s.status === "Active").length;

    // Get all users from system_users collection
    const systemUsers = await systemDb.collection("system_users").find({}).toArray();
    const activeSystemUsers = systemUsers.filter((u) => u.isActive).length;

    // Get shop users count (aggregate from all shop databases)
    let totalShopUsers = 0;
    let activeShopUsers = 0;
    
    for (const shop of allShops) {
      try {
        const { getShopDatabase } = require("../config/database");
        const shopDb = getShopDatabase(shop.shopId);
        const users = await shopDb.collection("users").find({}).toArray();
        totalShopUsers += users.length;
        activeShopUsers += users.filter((u) => u.isActive).length;
      } catch (error) {
        logger.warn(`Failed to get users for shop ${shop.shopId}:`, error.message);
      }
    }

    // Get database collections count
    const collections = await systemDb.listCollections().toArray();

    const stats = {
      totalShops: allShops.length,
      activeShops,
      suspendedShops: allShops.filter((s) => s.status === "Suspended").length,
      inactiveShops: allShops.filter((s) => s.status === "Inactive").length,
      totalUsers: systemUsers.length + totalShopUsers,
      activeUsers: activeSystemUsers + activeShopUsers,
      systemUsers: systemUsers.length,
      shopUsers: totalShopUsers,
      systemHealth: "Good",
      databaseStatus: "Connected",
      totalCollections: collections.length,
      lastUpdated: new Date().toISOString(),
    };

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error("Get platform dashboard error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get platform statistics",
    });
  }
});

/**
 * POST /api/super-admin/shops
 * Create a new shop
 */
router.post("/shops", async (req, res) => {
  try {
    const { shopData, adminData } = req.body;

    if (!shopData || !adminData) {
      return res.status(400).json({
        success: false,
        message: "Shop data and admin data are required",
      });
    }

    const result = await createShop(
      shopData,
      adminData,
      req.user._id.toString(),
    );

    // Audit: shop created
    auditLog.log(req, AUDIT_ACTIONS.USER_CREATED, "shop", result.shopId,
      `SUPER_ADMIN created shop "${shopData.name}" (${result.shopId})`,
      { after: { shopId: result.shopId, name: shopData.name, ownerEmail: shopData.ownerEmail } }
    );

    res.status(201).json({
      success: true,
      message: "Shop created successfully",
      data: result,
    });
  } catch (error) {
    logger.error("Create shop error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create shop",
    });
  }
});

/**
 * GET /api/super-admin/shops
 * List all shops
 */
router.get("/shops", async (req, res) => {
  try {
    const { status, subscriptionPlan } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (subscriptionPlan) filter.subscriptionPlan = subscriptionPlan;

    const shops = await listShops(filter);

    res.json({
      success: true,
      count: shops.length,
      data: shops,
    });
  } catch (error) {
    logger.error("List shops error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to list shops",
    });
  }
});

/**
 * GET /api/super-admin/shops/:shopId
 * Get shop details
 */
router.get("/shops/:shopId", async (req, res) => {
  try {
    const shop = await getShop(req.params.shopId);

    if (!shop) {
      return res.status(404).json({
        success: false,
        message: "Shop not found",
      });
    }

    res.json({
      success: true,
      data: shop,
    });
  } catch (error) {
    logger.error("Get shop error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get shop details",
    });
  }
});

/**
 * PATCH /api/super-admin/shops/:shopId/status
 * Update shop status
 */
router.patch("/shops/:shopId/status", async (req, res) => {
  try {
    const { status } = req.body;

    if (!["Active", "Suspended", "Inactive"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Must be Active, Suspended, or Inactive",
      });
    }

    const result = await updateShopStatus(req.params.shopId, status);

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Shop not found",
      });
    }

    // Audit: shop status changed
    auditLog.log(req, AUDIT_ACTIONS.SETTINGS_UPDATED, "shop", req.params.shopId,
      `SUPER_ADMIN changed shop ${req.params.shopId} status to ${status}`,
      { after: { shopId: req.params.shopId, status } }
    );

    res.json({
      success: true,
      message: `Shop status updated to ${status}`,
    });
  } catch (error) {
    logger.error("Update shop status error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update shop status",
    });
  }
});

/**
 * DELETE /api/super-admin/shops/:shopId
 * Delete shop and its database
 */
router.delete("/shops/:shopId", async (req, res) => {
  try {
    const result = await deleteShop(req.params.shopId);

    // Audit: shop deleted
    auditLog.log(req, AUDIT_ACTIONS.USER_DELETED, "shop", req.params.shopId,
      `SUPER_ADMIN deleted shop ${req.params.shopId}`,
      { before: { shopId: req.params.shopId } }
    );

    res.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    logger.error("Delete shop error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete shop",
    });
  }
});

/**
 * GET /api/super-admin/shops/:shopId/stats
 * Get shop statistics
 */
router.get("/shops/:shopId/stats", async (req, res) => {
  try {
    const stats = await getShopStats(req.params.shopId);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error("Get shop stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get shop statistics",
    });
  }
});

/**
 * GET /api/super-admin/database-list
 * List all shop databases
 */
router.get("/database-list", async (req, res) => {
  try {
    const databases = await listAllShops();

    res.json({
      success: true,
      count: databases.length,
      data: databases,
    });
  } catch (error) {
    logger.error("List databases error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to list databases",
    });
  }
});

module.exports = router;
