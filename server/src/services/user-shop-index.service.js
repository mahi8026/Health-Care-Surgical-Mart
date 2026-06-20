/**
 * User-Shop Index Service
 *
 * Manages email-to-shopId mapping for fast user lookup during login
 * Eliminates N+1 query problem (looping through all shops)
 */

const { getSystemDatabase } = require('../config/database');
const { logger } = require('../config/logging');

class UserShopIndexService {
  /**
   * Find shopId by email (O(1) lookup instead of O(n) loop)
   */
  async findShopByEmail(email) {
    try {
      const systemDb = getSystemDatabase();
      const mapping = await systemDb.collection('user_shop_index').findOne({
        email: email.toLowerCase()
      });

      return mapping ? mapping.shopId : null;
    } catch (error) {
      logger.error('Failed to find shop by email:', { email, error: error.message });
      return null;
    }
  }

  /**
   * Add user to index (called when creating new user)
   */
  async addUser(email, shopId, userId, role, isActive = true) {
    try {
      const systemDb = getSystemDatabase();

      await systemDb.collection('user_shop_index').insertOne({
        email: email.toLowerCase(),
        shopId,
        userId,
        role,
        isActive,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      logger.info('User added to shop index', { email, shopId });
      return true;
    } catch (error) {
      if (error.code === 11000) {
        // Duplicate key - user already indexed
        logger.warn('User already exists in shop index', { email });
        return false;
      }
      logger.error('Failed to add user to shop index:', { email, shopId, error: error.message });
      throw error;
    }
  }

  /**
   * Update user in index (called when updating user)
   */
  async updateUser(email, updates) {
    try {
      const systemDb = getSystemDatabase();

      const result = await systemDb.collection('user_shop_index').findOneAndUpdate(
        { email: email.toLowerCase() },
        {
          $set: {
            ...updates,
            updatedAt: new Date()
          }
        },
        { returnDocument: 'after' }
      );

      if (result) {
        logger.info('User updated in shop index', { email, updates });
        return true;
      }

      logger.warn('User not found in shop index for update', { email });
      return false;
    } catch (error) {
      logger.error('Failed to update user in shop index:', { email, error: error.message });
      throw error;
    }
  }

  /**
   * Remove user from index (called when deleting user)
   */
  async removeUser(email) {
    try {
      const systemDb = getSystemDatabase();

      const result = await systemDb.collection('user_shop_index').deleteOne({
        email: email.toLowerCase()
      });

      if (result.deletedCount > 0) {
        logger.info('User removed from shop index', { email });
        return true;
      }

      logger.warn('User not found in shop index for removal', { email });
      return false;
    } catch (error) {
      logger.error('Failed to remove user from shop index:', { email, error: error.message });
      throw error;
    }
  }

  /**
   * Check if email exists in any shop (for validation)
   */
  async emailExists(email) {
    try {
      const systemDb = getSystemDatabase();
      const count = await systemDb.collection('user_shop_index').countDocuments({
        email: email.toLowerCase()
      });
      return count > 0;
    } catch (error) {
      logger.error('Failed to check email existence:', { email, error: error.message });
      return false;
    }
  }

  /**
   * Get all users for a shop (for admin panel)
   */
  async getUsersByShop(shopId) {
    try {
      const systemDb = getSystemDatabase();
      return await systemDb.collection('user_shop_index').find({ shopId }).toArray();
    } catch (error) {
      logger.error('Failed to get users by shop:', { shopId, error: error.message });
      return [];
    }
  }

  /**
   * Batch add users (for migration or bulk import)
   */
  async batchAddUsers(users) {
    try {
      const systemDb = getSystemDatabase();

      const operations = users.map(user => ({
        insertOne: {
          document: {
            email: user.email.toLowerCase(),
            shopId: user.shopId,
            userId: user.userId,
            role: user.role,
            isActive: user.isActive !== false,
            createdAt: user.createdAt || new Date(),
            updatedAt: new Date()
          }
        }
      }));

      const result = await systemDb.collection('user_shop_index').bulkWrite(
        operations,
        { ordered: false } // Continue on duplicate key errors
      );

      logger.info('Batch user index operation completed', {
        inserted: result.insertedCount,
        errors: result.writeErrors?.length || 0
      });

      return {
        success: true,
        inserted: result.insertedCount,
        errors: result.writeErrors?.length || 0
      };
    } catch (error) {
      logger.error('Failed to batch add users:', { error: error.message });
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new UserShopIndexService();
module.exports.UserShopIndexService = UserShopIndexService;
