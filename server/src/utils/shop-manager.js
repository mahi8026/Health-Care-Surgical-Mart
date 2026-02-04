/**
 * Shop Manager
 * Handles shop creation, deletion, and management
 */

const {
  getSystemDatabase,
  getShopDatabase,
  client,
} = require("../config/database");
const { initializeShopDatabase } = require("./database-initializer");
const bcrypt = require("bcryptjs");
const { ObjectId } = require("mongodb");

/**
 * Create a new shop with database and admin user
 * @param {Object} shopData - Shop information
 * @param {Object} adminData - Shop admin user information
 * @param {string} createdBy - Super admin user ID
 * @returns {Promise<Object>} Created shop and admin details
 */
async function createShop(shopData, adminData, createdBy) {
  const systemDb = getSystemDatabase();
  const shopsCollection = systemDb.collection("shops");

  try {
    // Generate unique shop ID
    const shopId = generateShopId(shopData.shopName);

    // Check if shop already exists
    const existingShop = await shopsCollection.findOne({
      $or: [{ shopId: shopId }, { ownerEmail: shopData.ownerEmail }],
    });

    if (existingShop) {
      throw new Error("Shop with this ID or owner email already exists");
    }

    // Create shop record in system database
    const shopRecord = {
      shopId: shopId,
      shopName: shopData.shopName,
      ownerName: shopData.ownerName,
      ownerEmail: shopData.ownerEmail,
      ownerPhone: shopData.ownerPhone || "",
      address: shopData.address || "",
      city: shopData.city || "",
      state: shopData.state || "",
      country: shopData.country || "",
      licenseNo: shopData.licenseNo || "",
      gstNo: shopData.gstNo || "",
      status: "Active",
      subscriptionPlan: shopData.subscriptionPlan || "Trial",
      subscriptionExpiry:
        shopData.subscriptionExpiry ||
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days trial
      maxUsers: shopData.maxUsers || 5,
      currentUsers: 1, // Admin user
      createdBy: new ObjectId(createdBy),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const shopResult = await shopsCollection.insertOne(shopRecord);

    // Initialize shop database
    const shopDb = getShopDatabase(shopId);
    const initResult = await initializeShopDatabase(shopDb);

    // Create shop admin user
    const passwordHash = await bcrypt.hash(adminData.password, 10);
    const usersCollection = shopDb.collection("users");

    const adminUser = {
      name: adminData.name || shopData.ownerName,
      email: adminData.email || shopData.ownerEmail,
      passwordHash: passwordHash,
      role: "SHOP_ADMIN",
      phone: adminData.phone || shopData.ownerPhone,
      shopId: shopId,
      isActive: true,
      createdBy: new ObjectId(createdBy),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const adminResult = await usersCollection.insertOne(adminUser);

    return {
      success: true,
      shop: {
        _id: shopResult.insertedId,
        shopId: shopId,
        shopName: shopData.shopName,
        status: "Active",
      },
      admin: {
        _id: adminResult.insertedId,
        name: adminUser.name,
        email: adminUser.email,
        role: "SHOP_ADMIN",
      },
      initialization: initResult,
    };
  } catch (error) {
    console.error("Error creating shop:", error);
    throw error;
  }
}

/**
 * Generate unique shop ID from shop name
 * @param {string} shopName - Shop name
 * @returns {string} Shop ID
 */
function generateShopId(shopName) {
  const cleanName = shopName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .substring(0, 20);

  const timestamp = Date.now().toString(36);
  return `${cleanName}_${timestamp}`;
}

/**
 * Get shop details
 * @param {string} shopId - Shop ID
 * @returns {Promise<Object>} Shop details
 */
async function getShop(shopId) {
  const systemDb = getSystemDatabase();
  const shopsCollection = systemDb.collection("shops");

  const shop = await shopsCollection.findOne({ shopId: shopId });
  return shop;
}

/**
 * List all shops
 * @param {Object} filter - Filter criteria
 * @returns {Promise<Array>} List of shops
 */
async function listShops(filter = {}) {
  const systemDb = getSystemDatabase();
  const shopsCollection = systemDb.collection("shops");

  const shops = await shopsCollection
    .find(filter)
    .sort({ createdAt: -1 })
    .toArray();

  return shops;
}

/**
 * Update shop status
 * @param {string} shopId - Shop ID
 * @param {string} status - New status (Active, Suspended, Inactive)
 * @returns {Promise<Object>} Update result
 */
async function updateShopStatus(shopId, status) {
  const systemDb = getSystemDatabase();
  const shopsCollection = systemDb.collection("shops");

  const result = await shopsCollection.updateOne(
    { shopId: shopId },
    {
      $set: {
        status: status,
        updatedAt: new Date(),
      },
    },
  );

  return result;
}

/**
 * Delete shop and its database
 * @param {string} shopId - Shop ID
 * @returns {Promise<Object>} Deletion result
 */
async function deleteShop(shopId) {
  const systemDb = getSystemDatabase();
  const shopsCollection = systemDb.collection("shops");

  try {
    // Delete shop database
    const dbName = `shop_${shopId}`;
    await client.db(dbName).dropDatabase();

    // Delete shop record
    const result = await shopsCollection.deleteOne({ shopId: shopId });

    return {
      success: true,
      message: `Shop ${shopId} and its database deleted successfully`,
      deletedCount: result.deletedCount,
    };
  } catch (error) {
    console.error("Error deleting shop:", error);
    throw error;
  }
}

/**
 * Get shop statistics
 * @param {string} shopId - Shop ID
 * @returns {Promise<Object>} Shop statistics
 */
async function getShopStats(shopId) {
  const shopDb = getShopDatabase(shopId);

  const stats = {
    products: await shopDb.collection("products").countDocuments(),
    customers: await shopDb.collection("customers").countDocuments(),
    sales: await shopDb.collection("sales").countDocuments(),
    purchases: await shopDb.collection("purchases").countDocuments(),
    users: await shopDb.collection("users").countDocuments(),
    lowStock: await shopDb
      .collection("stock")
      .countDocuments({ isLowStock: true }),
  };

  return stats;
}

module.exports = {
  createShop,
  getShop,
  listShops,
  updateShopStatus,
  deleteShop,
  getShopStats,
  generateShopId,
};
