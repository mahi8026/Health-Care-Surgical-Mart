/**
 * Shared shop-user resolution for auth routes.
 *
 * Resolves the shop for a given email via three strategies:
 *   1. user_shop_index (O(1) lookup)
 *   2. shops collection ownerEmail match
 *   3. scan each shop's users collection
 *
 * Then verifies the shop exists and is active, and returns the user.
 */

const { getShopDatabase, getSystemDatabase } = require('../config/database');
const { ObjectId } = require('mongodb');
const { logger } = require('../config/logging');

/**
 * Resolve a user's shop and load the user document.
 * @param {string} email - normalized (lowercase) email
 * @param {string|null} explicitShopId - optional explicit shop selection
 * @param {object} [opts]
 * @param {string} [opts.noShopMessage] - error message when the email maps to no shop
 * @returns {Promise<{user, shop, shopDb, shopId}>} on success (user may be null if the
 *   shop is found but the user does not exist in it)
 * @returns {Promise<{error: {statusCode, message}}>} on failure
 */
async function resolveShopUser(email, explicitShopId = null, opts = {}) {
  const systemDb = getSystemDatabase();
  const noShopMessage =
    opts.noShopMessage || 'Shop not found for this email. Please contact support.';

  let targetShopId = explicitShopId;

  if (!targetShopId) {
    // PERFORMANCE OPTIMIZATION: Use user_shop_index for O(1) lookup
    try {
      const userShopMapping = await systemDb
        .collection('user_shop_index')
        .findOne({ email, isActive: true });

      if (userShopMapping) {
        targetShopId = userShopMapping.shopId;
        logger.debug('Shop resolved via index lookup', { email, shopId: targetShopId });
      }
    } catch (indexError) {
      logger.warn('Failed to query user_shop_index, falling back to shop loop', {
        email,
        error: indexError.message
      });
    }

    // FALLBACK: legacy method (loop through shops)
    if (!targetShopId) {
      const shops = await systemDb
        .collection('shops')
        .find({ status: 'Active' })
        .toArray();

      // First check if email matches shop owner email
      for (const shop of shops) {
        if (shop.ownerEmail === email) {
          targetShopId = shop.shopId;
          break;
        }
      }

      // If not found as owner, search in each shop's users collection
      if (!targetShopId) {
        for (const shop of shops) {
          try {
            const shopDb = getShopDatabase(shop.shopId);
            const shopUser = await shopDb.collection('users').findOne({ email });
            if (shopUser) {
              targetShopId = shop.shopId;
              break;
            }
          } catch (error) {
            logger.warn('Failed to query shop database during auto-detect', {
              shopId: shop.shopId,
              error: error.message
            });
          }
        }
      }
    }

    if (!targetShopId) {
      return { error: { statusCode: 400, message: noShopMessage } };
    }
  }

  // Verify shop exists (find by _id as ObjectId or shopId as string)
  let shop;
  try {
    shop = await systemDb.collection('shops').findOne({
      $or: [
        { shopId: targetShopId },
        { _id: new ObjectId(targetShopId) }
      ]
    });
  } catch {
    // If targetShopId is not a valid ObjectId, try shopId only
    shop = await systemDb.collection('shops').findOne({ shopId: targetShopId });
  }

  if (!shop) {
    return { error: { statusCode: 404, message: 'Shop not found' } };
  }

  if (shop.status !== 'Active') {
    return {
      error: {
        statusCode: 403,
        message: `Shop is ${shop.status.toLowerCase()}. Please contact support.`,
      }
    };
  }

  const shopDb = getShopDatabase(targetShopId);
  const user = await shopDb.collection('users').findOne({ email });

  return { user, shop, shopDb, shopId: targetShopId };
}

module.exports = { resolveShopUser };
