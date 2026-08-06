/**
 * Super Admin Routes
 * Platform-level management endpoints for SUPER_ADMIN role only.
 * Shops are stored in the system database; user counts require iterating
 * the per-shop databases.
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth-multi-tenant');
const { getSystemDatabase, getShopDatabase } = require('../config/database');
const { logger } = require('../config/logging');

router.use(authenticate);

// Role gate: every route in this router is SUPER_ADMIN only
router.use((req, res, next) => {
  if (req.user?.role !== 'SUPER_ADMIN') {
    return res.status(403).json({
      success: false,
      message: 'Access denied: SUPER_ADMIN role required',
    });
  }
  next();
});

/**
 * GET /api/super-admin/shops
 * List all registered shops (platform-wide)
 */
router.get('/shops', async (req, res) => {
  try {
    const systemDb = getSystemDatabase();
    const shops = await systemDb
      .collection('shops')
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    const data = shops.map((shop) => ({
      _id: shop._id,
      shopId: shop.shopId,
      name: shop.shopName || shop.name || shop.shopId,
      ownerName: shop.ownerName || '',
      ownerEmail: shop.ownerEmail || '',
      phone: shop.ownerPhone || shop.phone || '',
      status: shop.status || 'Active',
      subscriptionPlan: shop.subscriptionPlan || 'basic',
      subscriptionExpiry: shop.subscriptionExpiry || null,
      createdAt: shop.createdAt || null,
    }));

    res.json({ success: true, data });
  } catch (error) {
    logger.error('Super admin: failed to list shops:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load shops',
    });
  }
});

/**
 * GET /api/super-admin/dashboard
 * Platform-level stats (shops, users, system health)
 */
router.get('/dashboard', async (req, res) => {
  try {
    const systemDb = getSystemDatabase();
    const shops = await systemDb.collection('shops').find({}).toArray();

    const totalShops = shops.length;
    const activeShops = shops.filter(
      (shop) => shop.status === 'Active'
    ).length;

    let totalUsers = 0;
    let activeUsers = 0;

    await Promise.all(
      shops.map(async (shop) => {
        try {
          const shopDb = getShopDatabase(shop.shopId);
          const [count, activeCount] = await Promise.all([
            shopDb.collection('users').countDocuments({}),
            shopDb.collection('users').countDocuments({ isActive: true }),
          ]);
          totalUsers += count;
          activeUsers += activeCount;
        } catch (err) {
          logger.warn(
            `Super admin: failed to count users for shop ${shop.shopId}: ${err.message}`
          );
        }
      })
    );

    // Also count super admins themselves
    const superAdminCount = await systemDb
      .collection('system_users')
      .countDocuments({ isSuper: true });
    totalUsers += superAdminCount;
    activeUsers += superAdminCount;

    let databaseStatus = 'Connected';
    let systemHealth = 'Good';
    try {
      await systemDb.admin().ping();
    } catch {
      databaseStatus = 'Disconnected';
      systemHealth = 'Degraded';
    }

    const totalCollections = (await systemDb.listCollections().toArray()).length;

    res.json({
      success: true,
      data: {
        totalShops,
        activeShops,
        totalUsers,
        activeUsers,
        systemHealth,
        databaseStatus,
        totalCollections,
      },
    });
  } catch (error) {
    logger.error('Super admin: failed to load dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load platform stats',
    });
  }
});

module.exports = router;
