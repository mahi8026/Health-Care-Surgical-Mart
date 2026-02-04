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

// All routes require SUPER_ADMIN role
router.use(authenticate);
router.use(requireRole([ROLES.SUPER_ADMIN]));

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

    res.status(201).json({
      success: true,
      message: "Shop created successfully",
      data: result,
    });
  } catch (error) {
    console.error("Create shop error:", error);
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
    console.error("List shops error:", error);
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
    console.error("Get shop error:", error);
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

    res.json({
      success: true,
      message: `Shop status updated to ${status}`,
    });
  } catch (error) {
    console.error("Update shop status error:", error);
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

    res.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error("Delete shop error:", error);
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
    console.error("Get shop stats error:", error);
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
    console.error("List databases error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to list databases",
    });
  }
});

module.exports = router;
