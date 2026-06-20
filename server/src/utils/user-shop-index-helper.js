/**
 * User-Shop Index Helper
 *
 * Maintains the user_shop_index collection for fast user lookups.
 * This index eliminates N+1 query problems when finding a user's shop.
 *
 * Usage: Call updateUserShopIndex() whenever a user is created or updated.
 */

const { getSystemDatabase } = require('../config/database');
const { logger } = require('../config/logging');

/**
 * Update or create user-shop index entry
 * @param {object} params - User parameters
 * @param {string} params.email - User email (unique)
 * @param {string} params.shopId - Shop ID
 * @param {string} params.userId - User ID
 * @param {string} params.role - User role
 * @param {boolean} params.isActive - User active status
 * @returns {Promise<boolean>} Success status
 */
async function updateUserShopIndex({ email, shopId, userId, role, isActive = true }) {
  try {
    const systemDb = getSystemDatabase();

    await systemDb.collection('user_shop_index').updateOne(
      { email },
      {
        $set: {
          email,
          shopId,
          userId,
          role,
          isActive,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );

    logger.debug('User-shop index updated', { email, shopId });
    return true;
  } catch (error) {
    logger.error('Failed to update user-shop index:', {
      error: error.message,
      email,
      shopId,
    });
    return false;
  }
}

/**
 * Remove user from index (e.g., when user is deleted)
 * @param {string} email - User email
 * @returns {Promise<boolean>} Success status
 */
async function removeUserFromIndex(email) {
  try {
    const systemDb = getSystemDatabase();

    await systemDb.collection('user_shop_index').deleteOne({ email });

    logger.debug('User removed from shop index', { email });
    return true;
  } catch (error) {
    logger.error('Failed to remove user from index:', {
      error: error.message,
      email,
    });
    return false;
  }
}

/**
 * Mark user as inactive in index (e.g., when user is deactivated)
 * @param {string} email - User email
 * @returns {Promise<boolean>} Success status
 */
async function deactivateUserInIndex(email) {
  try {
    const systemDb = getSystemDatabase();

    await systemDb.collection('user_shop_index').updateOne(
      { email },
      {
        $set: {
          isActive: false,
          updatedAt: new Date(),
        },
      }
    );

    logger.debug('User deactivated in shop index', { email });
    return true;
  } catch (error) {
    logger.error('Failed to deactivate user in index:', {
      error: error.message,
      email,
    });
    return false;
  }
}

/**
 * Mark user as active in index (e.g., when user is reactivated)
 * @param {string} email - User email
 * @returns {Promise<boolean>} Success status
 */
async function activateUserInIndex(email) {
  try {
    const systemDb = getSystemDatabase();

    await systemDb.collection('user_shop_index').updateOne(
      { email },
      {
        $set: {
          isActive: true,
          updatedAt: new Date(),
        },
      }
    );

    logger.debug('User activated in shop index', { email });
    return true;
  } catch (error) {
    logger.error('Failed to activate user in index:', {
      error: error.message,
      email,
    });
    return false;
  }
}

/**
 * Find user's shop by email (O(1) lookup)
 * @param {string} email - User email
 * @returns {Promise<object|null>} User-shop mapping or null
 */
async function findUserShop(email) {
  try {
    const systemDb = getSystemDatabase();

    const mapping = await systemDb
      .collection('user_shop_index')
      .findOne({ email, isActive: true });

    return mapping;
  } catch (error) {
    logger.error('Failed to find user shop:', {
      error: error.message,
      email,
    });
    return null;
  }
}

/**
 * Get index statistics
 * @returns {Promise<object>} Index stats
 */
async function getIndexStats() {
  try {
    const systemDb = getSystemDatabase();

    const total = await systemDb.collection('user_shop_index').countDocuments();
    const active = await systemDb.collection('user_shop_index').countDocuments({ isActive: true });
    const inactive = await systemDb.collection('user_shop_index').countDocuments({ isActive: false });

    return {
      total,
      active,
      inactive,
      lastChecked: new Date(),
    };
  } catch (error) {
    logger.error('Failed to get index stats:', error);
    return {
      total: 0,
      active: 0,
      inactive: 0,
      error: error.message,
    };
  }
}

module.exports = {
  updateUserShopIndex,
  removeUserFromIndex,
  deactivateUserInIndex,
  activateUserInIndex,
  findUserShop,
  getIndexStats,
};
